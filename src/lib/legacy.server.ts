import { getProduct, INSTALLMENTS, pixPrice } from "@/data/catalog";

type JsonRecord = Record<string, unknown>;

type LegacyConfig = {
  public_key: string;
  secret_key: string;
  api_url: string;
  webhook_url: string;
  webhook_secret: string;
  is_physical_product: boolean;
};

const PAID_STATUSES = new Set([
  "paid",
  "pago",
  "aprovado",
  "approved",
  "confirmado",
  "confirmed",
  "liquidado",
  "completed",
  "complete",
  "success",
  "succeeded",
  "settled",
  "received",
  "done",
]);

const FAILED_STATUSES = new Set([
  "failed",
  "falha",
  "cancelled",
  "canceled",
  "expired",
  "expirado",
  "refunded",
  "estornado",
  "refused",
  "recusado",
  "chargeback",
  "med",
]);

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function onlyDigits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function normalizePhone(phone: unknown): string {
  const digits = onlyDigits(phone);
  if (digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits || "5511999999999";
}

function toCents(value: number): number {
  return Math.max(1, Math.round(value * 100));
}

let runtimeEnv: Record<string, unknown> | undefined;

export function getRuntimeEnv(): Record<string, unknown> | undefined {
  return runtimeEnv;
}

export function setRuntimeEnv(env: unknown) {
  runtimeEnv = env && typeof env === "object" ? (env as Record<string, unknown>) : undefined;
  if (!runtimeEnv || typeof process === "undefined" || !process.env) return;
  for (const [key, value] of Object.entries(runtimeEnv)) {
    if (typeof value === "string" && value && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

function lookupBinding(source: unknown, name: string): string {
  if (!source || typeof source !== "object") return "";
  const rec = source as Record<string, unknown>;
  const direct = rec[name];
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  for (const nestedKey of ["secrets", "SECRETS", "env", "bindings"]) {
    const nested = rec[nestedKey];
    if (nested && typeof nested === "object") {
      const inner = (nested as Record<string, unknown>)[name];
      if (typeof inner === "string" && inner.trim()) return inner.trim();
    }
  }
  return "";
}

function env(name: string): string {
  const fromRuntime = lookupBinding(runtimeEnv, name);
  if (fromRuntime) return fromRuntime;
  const fromProcess = String(process.env[name] ?? "").trim();
  if (fromProcess) return fromProcess;
  try {
    const fromMeta = String((import.meta as ImportMeta & { env?: Record<string, unknown> }).env?.[name] ?? "").trim();
    if (fromMeta) return fromMeta;
  } catch {
    // import.meta.env is optional
  }
  return "";
}

async function loadConfig(): Promise<LegacyConfig> {
  const fromEnv: LegacyConfig = {
    public_key: env("LEGACY_PUBLIC_KEY"),
    secret_key: env("LEGACY_SECRET_KEY"),
    api_url: env("LEGACY_API_URL") || "https://api.legacyecombrasil.com",
    webhook_url: env("LEGACY_WEBHOOK_URL"),
    webhook_secret: env("LEGACY_WEBHOOK_SECRET"),
    is_physical_product: env("LEGACY_IS_PHYSICAL_PRODUCT") !== "false",
  };

  if (fromEnv.public_key && fromEnv.secret_key) {
    return fromEnv;
  }

  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const raw = await readFile(join(process.cwd(), "legacy-config.json"), "utf8");
    const parsed = JSON.parse(raw) as JsonRecord;
    const publicKey = String(parsed["public_key"] ?? "").trim();
    const secretKey = String(parsed["secret_key"] ?? "").trim();
    if (publicKey && secretKey) {
      return {
        public_key: publicKey,
        secret_key: secretKey,
        api_url: String(parsed["api_url"] ?? fromEnv.api_url).trim() || fromEnv.api_url,
        webhook_url: String(parsed["webhook_url"] ?? "").trim(),
        webhook_secret: String(parsed["webhook_secret"] ?? fromEnv.webhook_secret).trim(),
        is_physical_product: parsed["is_physical_product"] !== false,
      };
    }
  } catch {
    // Local file is optional when env vars are set in Lovable.
  }

  throw new Error(
    "Configure LEGACY_PUBLIC_KEY e LEGACY_SECRET_KEY nos Secrets do Lovable (ou legacy-config.json localmente).",
  );
}

function authHeader(publicKey: string, secretKey: string): string {
  const raw = `${publicKey}:${secretKey}`;
  const token =
    typeof Buffer !== "undefined"
      ? Buffer.from(raw).toString("base64")
      : btoa(raw);
  return `Basic ${token}`;
}

function webhookFromRequest(request: Request, configured: string): string {
  const explicit = configured.trim();
  if (explicit && !explicit.startsWith("https://SEU-DOMINIO")) return explicit;
  try {
    const origin = new URL(request.url).origin;
    if (origin.startsWith("https://") && !origin.includes("localhost")) {
      return `${origin}/webhooks/legacy`;
    }
  } catch {
    // ignore malformed request URLs
  }
  return "";
}

function payerIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || "127.0.0.1";
}

function looksLikeImagePayload(value: string): boolean {
  if (value.startsWith("data:image") || value.startsWith("http://") || value.startsWith("https://")) {
    return true;
  }
  return /^[A-Za-z0-9+/]+=*$/.test(value) && value.length > 200 && !value.startsWith("000201");
}

function extractPixCode(data: JsonRecord): string {
  const pix = asRecord(data["pix"]);
  const nestedPix = asRecord(pix["pix"]);
  const inner = asRecord(data["data"]);
  const candidates = [
    pix["qrcode"],
    pix["qrCode"],
    pix["emv"],
    pix["copyPaste"],
    pix["copy_paste"],
    pix["copiaecola"],
    pix["qr_code"],
    pix["pix_qr_code"],
    pix["code"],
    nestedPix["qrcode"],
    nestedPix["emv"],
    data["qrcode"],
    data["qr_code"],
    data["emv"],
    data["copy_and_paste"],
    data["copyPaste"],
    inner["qrcode"],
    inner["qr_code"],
    inner["emv"],
    inner["copypaste"],
    inner["qr_code_pix"],
  ];
  for (const candidate of candidates) {
    const text = String(candidate ?? "").trim();
    if (text && (text.startsWith("000201") || text.length > 40) && !looksLikeImagePayload(text)) {
      return text;
    }
  }
  return firstNonEmpty(...candidates);
}

function extractPixImage(data: JsonRecord, pixCode: string): string {
  const pix = asRecord(data["pix"]);
  const inner = asRecord(data["data"]);
  const raw = firstNonEmpty(
    pix["qrCodeImage"],
    pix["qr_code_image"],
    pix["qr_code_base64"],
    pix["qrcode_base64"],
    pix["image"],
    data["qr_code_base64"],
    data["pix_qr_code_base64"],
    data["qr_code_image_url"],
    data["pix_qr_code_image"],
    inner["qr_code_image_url"],
    inner["pix_qr_code_image"],
  );
  if (raw.startsWith("data:image") || raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }
  if (raw && !raw.startsWith("000201")) {
    return `data:image/png;base64,${raw}`;
  }
  if (!pixCode) return "";
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&ecc=M&margin=8&data=${encodeURIComponent(pixCode)}`;
}

function paymentMethodFromOrder(order: JsonRecord): "PIX" | "CREDIT_CARD" {
  const raw = String(order["paymentMethod"] ?? order["method"] ?? "PIX").toUpperCase();
  if (raw === "CREDIT_CARD" || raw === "CARD" || raw === "CARTAO" || raw === "CARTÃO") {
    return "CREDIT_CARD";
  }
  return "PIX";
}

function resolveItems(order: JsonRecord, method: "PIX" | "CREDIT_CARD"): { items: JsonRecord[]; amountCents: number } {
  const carrinho = Array.isArray(order["carrinho"]) ? order["carrinho"] : [];
  const items: JsonRecord[] = [];
  let amountCents = 0;

  for (const rawItem of carrinho) {
    const item = asRecord(rawItem);
    const productId = String(item["productId"] ?? item["id"] ?? "").trim();
    const product = productId ? getProduct(productId) : undefined;
    const qty = Math.max(1, Number(item["quantidade"] ?? item["qty"] ?? item["quantity"] ?? 1) || 1);
    const catalogPrice = product?.price;
    const fallbackPrice = Number(item["preco"] ?? item["price"] ?? 0);
    const unitReais = catalogPrice ?? fallbackPrice;
    if (!Number.isFinite(unitReais) || unitReais <= 0) continue;
    const charged = method === "PIX" ? pixPrice(unitReais) : unitReais;
    const unitPrice = toCents(charged);
    const title = String(
      item["titulo"] ?? item["title"] ?? (product ? `${product.name}` : "Capacete KYT"),
    ).slice(0, 120);
    items.push({ title, quantity: qty, unitPrice });
    amountCents += unitPrice * qty;
  }

  if (items.length === 0 || amountCents <= 0) {
    throw new Error("Valor inválido.");
  }

  return { items, amountCents };
}

function buildCustomer(order: JsonRecord): JsonRecord {
  const comprador = asRecord(order["comprador"] ?? order["customer"]);
  const entrega = asRecord(order["entrega"] ?? asRecord(comprador["address"]));
  const document = onlyDigits(comprador["cpf"] ?? comprador["document"]);
  if (document.length !== 11 && document.length !== 14) {
    throw new Error("CPF/CNPJ inválido.");
  }

  const address: JsonRecord = {
    street: String(entrega["endereco"] ?? entrega["street"] ?? "Rua").trim(),
    number: String(entrega["numero"] ?? entrega["number"] ?? "S/N").trim(),
    zipCode: onlyDigits(entrega["cep"] ?? entrega["zipCode"]) || "01000000",
    city: String(entrega["cidade"] ?? entrega["city"] ?? "São Paulo").trim(),
    state: String(entrega["estado"] ?? entrega["state"] ?? "SP").trim().slice(0, 2).toUpperCase(),
  };
  const complemento = String(entrega["complemento"] ?? entrega["complement"] ?? "").trim();
  const bairro = String(entrega["bairro"] ?? entrega["neighborhood"] ?? "").trim();
  if (complemento) address["complement"] = complemento;
  if (bairro) address["neighborhood"] = bairro;

  return {
    name: String(comprador["nome"] ?? comprador["name"] ?? "Cliente").trim(),
    document,
    email: String(comprador["email"] ?? "cliente@email.com").trim(),
    phone: normalizePhone(comprador["telefone"] ?? comprador["phone"]),
    address,
  };
}

function referenceIdFromOrder(order: JsonRecord): string {
  const incoming = String(order["referenceId"] ?? "").trim();
  if (/^kyt-[a-z0-9]{8,32}$/i.test(incoming)) return incoming;
  return `kyt-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function buildCard(order: JsonRecord): JsonRecord {
  const card = asRecord(order["card"]);
  const token = String(card["token"] ?? "").trim();
  if (!token.startsWith("cvt_")) {
    throw new Error("Tokenize o cartão pelo checkout seguro antes de pagar.");
  }
  const installments = Math.min(
    INSTALLMENTS,
    Math.max(1, Number(card["installments"] ?? order["installments"] ?? 1) || 1),
  );
  const payload: JsonRecord = { token, installments };
  const threeDSecure = card["threeDSecure"];
  if (threeDSecure && typeof threeDSecure === "object") {
    payload["threeDSecure"] = threeDSecure;
  }
  return payload;
}

function buildAntifraud(order: JsonRecord): JsonRecord | undefined {
  const antifraud = asRecord(order["antifraud"]);
  const sessionId = String(antifraud["sessionId"] ?? "").trim();
  if (!sessionId) return undefined;
  return { sessionId };
}

async function postPayin(payload: JsonRecord, cfg: LegacyConfig): Promise<{ ok: boolean; status: number; data: JsonRecord; raw: string }> {
  const apiUrl = cfg.api_url.replace(/\/$/, "");
  const response = await fetch(`${apiUrl}/payin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(cfg.public_key, cfg.secret_key),
      "User-Agent": "kyt-store/1.0",
    },
    body: JSON.stringify(payload),
  });
  const raw = await response.text();
  let data: JsonRecord = {};
  try {
    data = raw ? (JSON.parse(raw) as JsonRecord) : {};
  } catch {
    data = {};
  }
  return { ok: response.ok, status: response.status, data, raw };
}

export function publicPaymentStatus(status: unknown): string {
  const value = String(status ?? "").toLowerCase().trim();
  if (PAID_STATUSES.has(value)) return "paid";
  if (FAILED_STATUSES.has(value)) return "failed";
  if (value === "pending_3ds" || value === "pending3ds") return "pending";
  return value || "pending";
}

export async function handleLegacyConfigRequest(): Promise<Response> {
  try {
    const cfg = await loadConfig();
    return jsonResponse(200, {
      success: true,
      publicKey: cfg.public_key,
      apiBaseUrl: cfg.api_url.replace(/\/$/, "") || "https://api.legacyecombrasil.com",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gateway indisponível.";
    return jsonResponse(500, { success: false, message });
  }
}

export async function handlePayinRequest(request: Request): Promise<Response> {
  try {
    const raw = await request.text();
    const order = raw ? (JSON.parse(raw) as JsonRecord) : {};
    const method = paymentMethodFromOrder(order);
    const cfg = await loadConfig();
    const { items, amountCents } = resolveItems(order, method);
    const payload: JsonRecord = {
      paymentMethod: method,
      amount: amountCents,
      referenceId: referenceIdFromOrder(order),
      isPhysicalProduct: cfg.is_physical_product,
      payerIp: payerIpFromRequest(request),
      customer: buildCustomer(order),
      items,
    };
    const webhookUrl = webhookFromRequest(request, cfg.webhook_url);
    if (webhookUrl) payload["webhookUrl"] = webhookUrl;

    if (method === "CREDIT_CARD") {
      payload["card"] = buildCard(order);
      const antifraud = buildAntifraud(order);
      if (antifraud) payload["antifraud"] = antifraud;
    }

    const result = await postPayin(payload, cfg);
    if (!result.ok) {
      const message = String(
        result.data["message"] ?? result.data["error"] ?? result.raw ?? `Legacy API ${result.status}`,
      );
      throw new Error(`Legacy API ${result.status}: ${message}`);
    }

    const data = result.data;
    const referenceId = firstNonEmpty(data["referenceId"], payload["referenceId"]);
    const transactionId = firstNonEmpty(data["id"], data["transactionId"]);
    const status = publicPaymentStatus(data["status"]);
    const threeDSecurePending = data["threeDSecurePending"] === true || status === "pending" && method === "CREDIT_CARD" && data["threeDSecureSession"] != null;

    if (method === "PIX") {
      const qrcode = extractPixCode(data);
      if (!qrcode) throw new Error("Legacy não retornou QR Code PIX.");
      const pix = asRecord(data["pix"]);
      return jsonResponse(200, {
        ...data,
        success: true,
        paymentMethod: "PIX",
        status,
        qr_code: qrcode,
        pix_qr_code: qrcode,
        pixCode: qrcode,
        copy_and_paste: qrcode,
        qr_code_image_url: extractPixImage(data, qrcode),
        pix_qr_code_image: extractPixImage(data, qrcode),
        pixImage: extractPixImage(data, qrcode),
        referenceId,
        transactionId,
        amount: amountCents,
        pix: Object.keys(pix).length ? { ...pix, qrcode } : { qrcode },
      });
    }

    return jsonResponse(200, {
      ...data,
      success: status !== "failed",
      paymentMethod: "CREDIT_CARD",
      status,
      referenceId,
      transactionId,
      threeDSecurePending: Boolean(threeDSecurePending),
      amount: amountCents,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao gerar pagamento.";
    const status =
      message.includes("inválido") || message.includes("Tokenize") || message.includes("Valor")
        ? 400
        : message.includes("Configure")
          ? 500
          : 502;
    return jsonResponse(status, { success: false, message });
  }
}

export async function handlePixRequest(request: Request): Promise<Response> {
  try {
    const raw = await request.text();
    const order = raw ? (JSON.parse(raw) as JsonRecord) : {};
    order["paymentMethod"] = "PIX";
    return handlePayinRequest(
      new Request(request.url, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify(order),
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao gerar Pix.";
    return jsonResponse(400, { success: false, message });
  }
}

async function legacyGet(path: string): Promise<{ ok: boolean; status: number; data: JsonRecord }> {
  const cfg = await loadConfig();
  const apiUrl = cfg.api_url.replace(/\/$/, "");
  const response = await fetch(`${apiUrl}${path}`, {
    method: "GET",
    headers: {
      Authorization: authHeader(cfg.public_key, cfg.secret_key),
      "User-Agent": "kyt-store/1.0",
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

export async function getPayin(tx: string, ref: string): Promise<JsonRecord> {
  const transactionId = tx.trim();
  const referenceId = ref.trim();
  if (!transactionId && !referenceId) {
    throw new Error("Informe ref ou tx.");
  }

  if (transactionId) {
    const byId = await legacyGet(`/payin/${encodeURIComponent(transactionId)}`);
    if (byId.ok) return byId.data;
    if (byId.status !== 404) {
      throw new Error(String(byId.data["message"] ?? `Legacy API ${byId.status}`));
    }
  }

  if (referenceId) {
    const byRef = await legacyGet(`/payin?referenceId=${encodeURIComponent(referenceId)}`);
    if (byRef.ok) {
      const rows = Array.isArray(byRef.data["data"]) ? byRef.data["data"] : [];
      const first = rows[0];
      if (first && typeof first === "object") return first as JsonRecord;
      if (!Array.isArray(byRef.data["data"]) && byRef.data["id"]) return byRef.data;
    }
  }

  throw new Error("Pedido não encontrado.");
}

export async function handlePayinStatusRequest(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const payin = await getPayin(url.searchParams.get("tx") ?? "", url.searchParams.get("ref") ?? "");
    const status = publicPaymentStatus(payin["status"]);
    if (status === "paid") {
      const { confirmPaidOrder } = await import("@/lib/tracking-capi.server");
      await confirmPaidOrder({
        transactionId: String(payin["id"] ?? ""),
        referenceId: String(payin["referenceId"] ?? url.searchParams.get("ref") ?? ""),
        request,
      });
    }
    return jsonResponse(200, {
      success: true,
      status,
      referenceId: payin["referenceId"],
      transactionId: payin["id"],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao consultar pagamento.";
    const status = message.includes("Informe") ? 400 : message.includes("Configure") ? 500 : 200;
    return jsonResponse(status, { success: false, status: "pending", message });
  }
}

export const handlePixStatusRequest = handlePayinStatusRequest;

function parseSignatureHeader(header: string): { timestamp: number; signatures: string[] } {
  const signatures: string[] = [];
  let timestamp = 0;
  for (const part of header.split(",")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key === "t") timestamp = Number(value);
    if (key === "v1" && value) signatures.push(value);
  }
  return { timestamp, signatures };
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

export async function handleLegacyWebhookRequest(request: Request): Promise<Response> {
  const raw = await request.text();
  try {
    const cfg = await loadConfig();
    const secret = cfg.webhook_secret.trim();
    if (secret) {
      const header = request.headers.get("X-Webhook-Signature") ?? "";
      const parsed = parseSignatureHeader(header);
      if (!parsed.timestamp || Math.abs(Date.now() / 1000 - parsed.timestamp) > 300) {
        return jsonResponse(401, { received: false, message: "assinatura expirada" });
      }
      const expected = await hmacSha256Hex(secret, `${parsed.timestamp}.${raw}`);
      const valid = parsed.signatures.some((signature) => timingSafeEqual(signature, expected));
      if (!valid) {
        return jsonResponse(401, { received: false, message: "assinatura inválida" });
      }
    }
    if (raw) {
      try {
        const payload = JSON.parse(raw) as JsonRecord;
        const nested = asRecord(payload["data"]);
        const status = publicPaymentStatus(payload["status"] ?? nested["status"]);
        if (status === "paid") {
          const { confirmPaidOrder } = await import("@/lib/tracking-capi.server");
          await confirmPaidOrder({
            transactionId: firstNonEmpty(payload["id"], payload["transactionId"], nested["id"]),
            referenceId: firstNonEmpty(payload["referenceId"], nested["referenceId"]),
            request,
          });
        }
      } catch {
        // keep webhook 200
      }
    }
  } catch {
    // Acknowledge even if config/body is messy so Legacy does not retry forever.
  }
  return jsonResponse(200, { received: true });
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
