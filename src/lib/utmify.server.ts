// Envio de vendas para a UTMify (API de credenciais), como na loja Aidex. Somente servidor.
// Token salvo em Integrações (tracking.utmify.apiToken) ou na variável UTMIFY_API_TOKEN.
// Nunca lança erro: falha na UTMify não pode quebrar o checkout.
import { appendTrackingLog, getTrackingSettings, upsertStoreOrder } from "@/lib/admin-store.server";
import type { StoreOrder } from "@/lib/tracking-types";

export type UtmifyStatus = "waiting_payment" | "paid" | "refused";

/** Formato "YYYY-MM-DD HH:MM:SS" em UTC, exigido pela UTMify. */
function fmt(ms: number): string {
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19);
}

export async function getUtmifyToken(): Promise<string> {
  const settings = await getTrackingSettings();
  return settings.utmify?.apiToken?.trim() ?? "";
}

export async function sendUtmifyOrder(input: {
  orderId: string;
  status: UtmifyStatus;
  createdAt: number;
  approvedAt?: number;
  customer: { name: string; email: string; phone: string; document: string; ip?: string };
  products: { id: string; name: string; quantity: number; priceInCents: number }[];
  amountCents: number;
  utm?: Partial<Record<"src" | "sck" | "utm_source" | "utm_medium" | "utm_campaign" | "utm_content" | "utm_term", string>>;
  isTest?: boolean;
  /** Token a usar no lugar do salvo (botão de teste com o token recém-digitado). */
  token?: string;
}): Promise<{ ok: boolean; status?: number; error?: string }> {
  const token = input.token?.trim() || (await getUtmifyToken());
  if (!token) return { ok: false, error: "Token da UTMify não configurado" };
  const utm = input.utm ?? {};
  try {
    const response = await fetch("https://api.utmify.com.br/api-credentials/orders", {
      method: "POST",
      headers: { "x-api-token": token, "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: input.orderId,
        platform: "KytCheckout",
        paymentMethod: "pix",
        status: input.status,
        createdAt: fmt(input.createdAt),
        approvedDate: input.status === "paid" ? fmt(input.approvedAt ?? Date.now()) : null,
        refundedAt: null,
        customer: {
          name: input.customer.name,
          email: input.customer.email,
          phone: input.customer.phone,
          document: input.customer.document,
          country: "BR",
          ip: input.customer.ip || "0.0.0.0",
        },
        products: input.products.map((product) => ({
          id: product.id,
          name: product.name,
          planId: null,
          planName: null,
          quantity: product.quantity,
          priceInCents: product.priceInCents,
        })),
        trackingParameters: {
          src: utm.src ?? null,
          sck: utm.sck ?? null,
          utm_source: utm.utm_source ?? null,
          utm_campaign: utm.utm_campaign ?? null,
          utm_medium: utm.utm_medium ?? null,
          utm_content: utm.utm_content ?? null,
          utm_term: utm.utm_term ?? null,
        },
        commission: { totalPriceInCents: input.amountCents, gatewayFeeInCents: 0, userCommissionInCents: input.amountCents },
        isTest: input.isTest ?? false,
      }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("UTMify error", response.status, text.slice(0, 300));
      return { ok: false, status: response.status, error: text.slice(0, 200) };
    }
    return { ok: true, status: response.status };
  } catch (error) {
    console.error("UTMify fetch failed", error);
    return { ok: false, error: error instanceof Error ? error.message : "Falha de conexão" };
  }
}

/** Reporta um pedido da loja (pendente quando o PIX é gerado; pago quando confirma). Idempotente por pedido. */
export async function reportOrderToUtmify(order: StoreOrder, status: "waiting_payment" | "paid"): Promise<void> {
  const token = await getUtmifyToken();
  if (!token) return;
  if (status === "paid" && order.utmifyPaidSent) return;
  if (status === "waiting_payment" && (order.utmifyPendingSent || order.utmifyPaidSent)) return;
  const digits = (value: string) => String(value ?? "").replace(/\D/g, "");
  const amountCents = Math.round(order.total * 100);
  const products = order.items.map((item) => ({
    id: item.productId,
    name: [item.name, item.color, item.size].filter((part) => part && part !== "—").join(" "),
    quantity: item.quantity,
    priceInCents: Math.round(item.price * 100),
  }));
  const attr = order.attribution;
  const result = await sendUtmifyOrder({
    orderId: order.id,
    status,
    createdAt: Date.parse(order.createdAt) || Date.now(),
    customer: {
      name: order.customer.name,
      email: order.customer.email,
      phone: digits(order.customer.phone),
      document: digits(order.customer.cpf),
      ...(order.ip ? { ip: order.ip } : {}),
    },
    products,
    amountCents,
    utm: {
      ...(attr.src ? { src: attr.src } : {}),
      ...(attr.sck ? { sck: attr.sck } : {}),
      ...(attr.utmSource ? { utm_source: attr.utmSource } : {}),
      ...(attr.utmMedium ? { utm_medium: attr.utmMedium } : {}),
      ...(attr.utmCampaign ? { utm_campaign: attr.utmCampaign } : {}),
      ...(attr.utmContent ? { utm_content: attr.utmContent } : {}),
      ...(attr.utmTerm ? { utm_term: attr.utmTerm } : {}),
    },
  });
  await appendTrackingLog({
    event: status === "paid" ? "UtmifyPaid" : "UtmifyPending",
    source: "utmify",
    eventId: order.eventId,
    orderId: order.id,
    value: order.total,
    ok: result.ok,
    detail: result.ok ? `HTTP ${result.status}` : (result.error ?? "falha"),
    clientId: attr.clientId,
  });
  if (result.ok) {
    await upsertStoreOrder({ ...order, ...(status === "paid" ? { utmifyPaidSent: true } : { utmifyPendingSent: true }) });
  }
}

/** Venda de teste (isTest: true não entra nas métricas da UTMify). */
export async function testUtmify(status: "paid" | "waiting_payment", token?: string): Promise<{ ok: boolean; message: string }> {
  const now = Date.now();
  const result = await sendUtmifyOrder({
    orderId: `KYT-TESTE-${now.toString(36).toUpperCase()}`,
    status,
    createdAt: now,
    customer: { name: "Teste KYT", email: "teste@capacetekyt.com.br", phone: "11999999999", document: "00000000000" },
    products: [{ id: "tt-course", name: "TT-Course (teste)", quantity: 1, priceInCents: 9900 }],
    amountCents: 9900,
    isTest: true,
    ...(token?.trim() ? { token: token.trim() } : {}),
  });
  return result.ok
    ? { ok: true, message: `A UTMify aceitou o pedido de teste ${status === "paid" ? "pago" : "pendente"} (enviado como teste, não entra nas vendas).` }
    : { ok: false, message: `A UTMify recusou${result.status ? ` (HTTP ${result.status})` : ""}: ${result.error ?? "sem detalhes"}` };
}
