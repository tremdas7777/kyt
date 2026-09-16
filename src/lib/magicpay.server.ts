import { getPaymentSettings } from "@/lib/admin-store.server";
import type { PaymentGateway } from "@/lib/payment-types";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function onlyDigits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function jsonResponse(status: number, payload: JsonRecord): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function authHeader(publicKey: string, secretKey: string): string {
  const raw = `${publicKey}:${secretKey}`;
  const token = typeof Buffer !== "undefined" ? Buffer.from(raw).toString("base64") : btoa(raw);
  return `Basic ${token}`;
}

function localPhone(phone: unknown): string {
  const digits = onlyDigits(phone);
  if (digits.startsWith("55") && digits.length >= 12) return digits.slice(2);
  return digits;
}

function pixCodeFrom(data: JsonRecord): string {
  const pix = asRecord(data["pix"]);
  const nested = asRecord(data["data"]);
  const nestedPix = asRecord(nested["pix"]);
  const candidates = [
    pix["qrcode"],
    pix["qrCode"],
    pix["emv"],
    pix["copyPaste"],
    pix["copy_paste"],
    pix["copiaecola"],
    pix["payload"],
    data["qrcode"],
    data["qrCode"],
    data["emv"],
    nested["qrcode"],
    nestedPix["qrcode"],
    nestedPix["emv"],
    nestedPix["copyPaste"],
  ];
  for (const candidate of candidates) {
    const text = String(candidate ?? "").trim();
    if (text.startsWith("000201") || text.length > 40) return text;
  }
  return firstNonEmpty(...candidates);
}

function publicStatus(status: unknown): "pending" | "paid" | "failed" {
  const value = String(status ?? "").toLowerCase().trim();
  if (["paid", "pago", "approved", "aprovado", "confirmed", "completed", "success"].includes(value)) return "paid";
  if (["failed", "refused", "cancelled", "canceled", "expired", "chargeback"].includes(value)) return "failed";
  return "pending";
}

function pixImageFrom(pixCode: string): string {
  if (!pixCode) return "";
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&ecc=M&margin=8&data=${encodeURIComponent(pixCode)}`;
}

function webhookUrl(request: Request): string {
  try {
    const origin = new URL(request.url).origin;
    if (origin.startsWith("https://") && !origin.includes("localhost")) {
      return `${origin}/webhooks/magicpay`;
    }
  } catch {
    // ignore
  }
  return "";
}

function payerIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || "127.0.0.1";
}

async function magicPayConfig(override?: { publicKey?: string; secretKey?: string; apiUrl?: string }) {
  const settings = await getPaymentSettings();
  const publicKey = (override?.publicKey?.trim() || settings.magicpay.publicKey).trim();
  const secretKey = (override?.secretKey?.trim() || settings.magicpay.secretKey).trim();
  const apiUrl = (override?.apiUrl?.trim() || settings.magicpay.apiUrl).trim().replace(/\/$/, "") || "https://api.dashboardmagicpay.com";
  if (!publicKey || !secretKey) {
    throw new Error("Configure a chave pública e a chave secreta da MagicPay em Integrações.");
  }
  return { publicKey, secretKey, apiUrl };
}

async function magicPayRequest(
  path: string,
  init?: RequestInit,
  override?: { publicKey?: string; secretKey?: string; apiUrl?: string },
): Promise<{ ok: boolean; status: number; data: JsonRecord }> {
  const cfg = await magicPayConfig(override);
  const response = await fetch(`${cfg.apiUrl}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(cfg.publicKey, cfg.secretKey),
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "kyt-store/1.0",
      ...(init?.headers ?? {}),
    },
  });
  const raw = await response.text();
  let data: JsonRecord = {};
  try {
    data = raw ? (JSON.parse(raw) as JsonRecord) : {};
  } catch {
    data = { message: raw };
  }
  return { ok: response.ok, status: response.status, data };
}

function mapCustomer(customer: JsonRecord): JsonRecord {
  const address = asRecord(customer["address"]);
  const document = onlyDigits(customer["document"]);
  return {
    name: String(customer["name"] ?? "Cliente").trim(),
    email: String(customer["email"] ?? "").trim(),
    phone: localPhone(customer["phone"]),
    document: {
      type: document.length === 14 ? "cnpj" : "cpf",
      number: document,
    },
    address: {
      street: String(address["street"] ?? "Rua").trim(),
      streetNumber: String(address["number"] ?? "S/N").trim(),
      complement: String(address["complement"] ?? "").trim(),
      zipCode: onlyDigits(address["zipCode"]) || "01000000",
      neighborhood: String(address["neighborhood"] ?? "Centro").trim(),
      city: String(address["city"] ?? "São Paulo").trim(),
      state: String(address["state"] ?? "SP").trim().slice(0, 2).toUpperCase(),
      country: "BR",
    },
  };
}

function mapItems(items: JsonRecord[]): JsonRecord[] {
  return items.map((item, index) => ({
    title: String(item["title"] ?? "Capacete KYT").slice(0, 120),
    quantity: Math.max(1, Number(item["quantity"] ?? 1) || 1),
    unitPrice: Math.max(1, Number(item["unitPrice"] ?? 0) || 0),
    tangible: true,
    externalRef: String(item["externalRef"] ?? `item-${index + 1}`),
  }));
}

export async function createMagicPayPix(input: {
  items: JsonRecord[];
  amountCents: number;
  customer: JsonRecord;
  referenceId: string;
  request: Request;
}): Promise<Response> {
  const payload: JsonRecord = {
    amount: input.amountCents,
    currency: "BRL",
    paymentMethod: "pix",
    description: "Pedido KYT Capacetes",
    externalRef: input.referenceId,
    ip: payerIp(input.request),
    customer: mapCustomer(input.customer),
    items: mapItems(input.items),
  };
  const hook = webhookUrl(input.request);
  if (hook) payload["postbackUrl"] = hook;

  const result = await magicPayRequest("/v1/transactions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!result.ok) {
    const message = String(result.data["message"] ?? result.data["error"] ?? `MagicPay ${result.status}`);
    throw new Error(`MagicPay ${result.status}: ${message}`);
  }

  const data = asRecord(result.data["data"]).id ? asRecord(result.data["data"]) : result.data;
  const qrcode = pixCodeFrom(data);
  if (!qrcode) throw new Error("MagicPay não retornou QR Code PIX.");
  const transactionId = firstNonEmpty(data["id"], data["transactionId"]);
  const referenceId = firstNonEmpty(data["externalRef"], input.referenceId);
  const status = publicStatus(data["status"]);
  const pixImage = pixImageFrom(qrcode);

  return jsonResponse(200, {
    success: true,
    paymentMethod: "PIX",
    paymentGateway: "magicpay" satisfies PaymentGateway,
    status,
    qr_code: qrcode,
    pix_qr_code: qrcode,
    pixCode: qrcode,
    copy_and_paste: qrcode,
    qr_code_image_url: pixImage,
    pix_qr_code_image: pixImage,
    pixImage,
    referenceId,
    transactionId,
    amount: input.amountCents,
    pix: { qrcode },
  });
}

export async function getMagicPayTransaction(tx: string, ref: string): Promise<JsonRecord> {
  const transactionId = tx.trim();
  const referenceId = ref.trim();
  if (transactionId) {
    const byId = await magicPayRequest(`/v1/transactions/${encodeURIComponent(transactionId)}`);
    if (byId.ok) {
      const nested = asRecord(byId.data["data"]);
      return nested.id || nested.status ? nested : byId.data;
    }
    if (byId.status !== 404) {
      throw new Error(String(byId.data["message"] ?? `MagicPay ${byId.status}`));
    }
  }
  if (referenceId) {
    const byRef = await magicPayRequest(`/v1/transactions?externalRef=${encodeURIComponent(referenceId)}`);
    if (byRef.ok) {
      const rows = Array.isArray(byRef.data["data"])
        ? byRef.data["data"]
        : Array.isArray(byRef.data["transactions"])
          ? byRef.data["transactions"]
          : [];
      const first = rows[0];
      if (first && typeof first === "object") return first as JsonRecord;
      if (byRef.data["id"]) return byRef.data;
    }
  }
  throw new Error("Pedido não encontrado.");
}

export async function handleMagicPayWebhookRequest(request: Request): Promise<Response> {
  const raw = await request.text();
  try {
    if (raw) {
      const payload = JSON.parse(raw) as JsonRecord;
      const nested = asRecord(payload["data"]);
      const status = publicStatus(payload["status"] ?? nested["status"]);
      if (status === "paid") {
        const { confirmPaidOrder } = await import("@/lib/tracking-capi.server");
        await confirmPaidOrder({
          transactionId: firstNonEmpty(payload["id"], payload["objectId"], nested["id"], payload["transactionId"]),
          referenceId: firstNonEmpty(payload["externalRef"], nested["externalRef"], payload["referenceId"]),
          request,
        });
      }
    }
  } catch {
    // keep 200 so MagicPay does not retry forever
  }
  return jsonResponse(200, { received: true });
}

export async function testMagicPayConnection(override?: {
  publicKey?: string;
  secretKey?: string;
  apiUrl?: string;
}): Promise<{ ok: boolean; message: string }> {
  try {
    const result = await magicPayRequest("/v1/transactions?page=1&limit=1", { method: "GET" }, override);
    if (result.status === 401 || result.status === 403) {
      return { ok: false, message: "A MagicPay recusou as chaves. Confira pública, secreta e se são as de teste certas." };
    }
    if (result.ok || result.status === 404) {
      return { ok: true, message: "Chaves aceitas. Marque PIX na MagicPay, salve, e o checkout gera o QR por ela." };
    }
    const detail = String(result.data["message"] ?? result.data["error"] ?? `HTTP ${result.status}`);
    return { ok: false, message: `MagicPay ${result.status}: ${detail}` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Falha ao falar com a MagicPay." };
  }
}
