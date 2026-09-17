import { pixPrice } from "@/data/catalog";
import { getTrackingSettings, upsertStoreOrder } from "@/lib/admin-store.server";
import { formatBRL } from "@/lib/format";
import type { StoreOrder } from "@/lib/tracking-types";

export type PushcutKind = "pending" | "paid";

function isPushcutUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "api.pushcut.io" && url.pathname.includes("/notifications/");
  } catch {
    return false;
  }
}

function saleAmount(order: StoreOrder) {
  const total = Number(order.total) || 0;
  const shipping = Number(order.shipping) || 0;
  if (order.customer.payment === "card") return total;
  if (Number(order.discount) > 0) return total;
  const items = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  if (items > 0) return Math.round((pixPrice(items) + shipping) * 100) / 100;
  return total;
}

function paymentLabel(order: StoreOrder) {
  return order.customer.payment === "card" ? "Cartão" : "PIX 10% OFF";
}

function bodyFor(order: StoreOrder, kind: PushcutKind) {
  const amount = saleAmount(order);
  const value = formatBRL(amount);
  const name = order.customer.name.trim() || "Cliente";
  const items = order.items
    .map((item) => item.name)
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");
  const title = kind === "paid" ? "Pedido pago" : "Pedido pendente";
  const text = [value, paymentLabel(order), name, order.id, items].filter(Boolean).join(" · ");
  return {
    title,
    text,
    input: amount.toFixed(2),
  };
}

async function postPushcut(url: string, body: Record<string, string>): Promise<{ ok: boolean; detail: string }> {
  if (!isPushcutUrl(url)) return { ok: false, detail: "URL do Pushcut inválida." };
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const detail = (await response.text()).slice(0, 240) || String(response.status);
    return { ok: response.ok, detail };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "Falha de rede" };
  }
}

export async function notifyPushcutOrder(order: StoreOrder, kind: PushcutKind): Promise<StoreOrder> {
  if (kind === "pending" && (order.paymentStatus === "paid" || order.pushcutPendingSent)) return order;
  if (kind === "paid" && (order.paymentStatus === "failed" || order.pushcutPaidSent)) return order;
  const settings = await getTrackingSettings();
  const url = kind === "paid" ? settings.pushcut.paidUrl.trim() : settings.pushcut.pendingUrl.trim();
  if (!url) return order;
  const result = await postPushcut(url, bodyFor(order, kind));
  if (!result.ok) return order;
  return upsertStoreOrder({
    ...order,
    pushcutPendingSent: kind === "pending" || order.pushcutPendingSent,
    pushcutPaidSent: kind === "paid" || order.pushcutPaidSent,
  });
}

export async function testPushcut(kind: PushcutKind): Promise<{ ok: boolean; message: string }> {
  const settings = await getTrackingSettings();
  const url = kind === "paid" ? settings.pushcut.paidUrl.trim() : settings.pushcut.pendingUrl.trim();
  if (!url) return { ok: false, message: kind === "paid" ? "Cole a URL do pedido pago." : "Cole a URL do pedido pendente." };
  const sample: StoreOrder = {
    id: "KYT-TESTE",
    createdAt: new Date().toISOString(),
    items: [{ id: "d-city", productId: "d-city", name: "D-City", color: "", size: "", image: "", price: 297, quantity: 1 }],
    customer: {
      name: "Teste KYT",
      email: "",
      phone: "",
      cpf: "",
      cep: "",
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      payment: "pix",
    },
    subtotal: 297,
    shipping: 0,
    shippingMethod: "gratis",
    total: pixPrice(297),
    discount: Math.round((297 - pixPrice(297)) * 100) / 100,
    paymentStatus: kind === "paid" ? "paid" : "pending",
    eventId: "test-pushcut",
    attribution: {
      fbp: "",
      fbc: "",
      fbclid: "",
      ttclid: "",
      ttp: "",
      gclid: "",
      gbraid: "",
      wbraid: "",
      clientId: "",
      utmSource: "",
      utmMedium: "",
    },
    userAgent: "",
    ip: "",
    purchaseSent: kind === "paid",
  };
  const result = await postPushcut(url, bodyFor(sample, kind));
  if (!result.ok) return { ok: false, message: result.detail || "O Pushcut recusou o teste." };
  return {
    ok: true,
    message: kind === "paid" ? `Teste de pedido pago enviado ao Pushcut (${formatBRL(pixPrice(297))} no PIX).` : `Teste de pedido pendente enviado ao Pushcut (${formatBRL(pixPrice(297))} no PIX).`,
  };
}
