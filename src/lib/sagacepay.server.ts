// SagacePay: cobranças Pix. Somente servidor. Docs: https://sub.sagacepay.com/docs
// Chave (sk_live_...): a salva no painel (/admin/integracoes) ou a variável SAGACEPAY_API_KEY.
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { getRuntimeEnv } from "@/lib/legacy.server";

export const SAGACEPAY_API = "https://sagacepay.com/api";

type JsonRecord = Record<string, unknown>;

function env(name: string): string {
  const runtime = getRuntimeEnv();
  if (runtime && typeof runtime === "object") {
    const direct = (runtime as Record<string, unknown>)[name];
    if (typeof direct === "string" && direct.trim()) return direct.trim();
  }
  if (typeof process !== "undefined" && process.env) {
    const value = String(process.env[name] ?? "").trim();
    if (value) return value;
  }
  return "";
}

export async function getSagacePayKey(): Promise<string> {
  const { getPaymentSettings } = await import("@/lib/admin-store.server");
  const settings = await getPaymentSettings();
  return settings.sagacepay.apiKey.trim() || env("SAGACEPAY_API_KEY");
}

export async function sagacePayKeySource(): Promise<"admin" | "env" | null> {
  const { getPaymentSettings } = await import("@/lib/admin-store.server");
  const settings = await getPaymentSettings();
  if (settings.sagacepay.apiKey.trim()) return "admin";
  return env("SAGACEPAY_API_KEY") ? "env" : null;
}

async function headers(key?: string): Promise<Record<string, string>> {
  const resolved = key ?? (await getSagacePayKey());
  if (!resolved) throw new Error("SagacePay: cadastre a chave de API em Integrações.");
  return { "x-api-key": resolved, "Content-Type": "application/json", Accept: "application/json" };
}

// A API às vezes devolve a venda dentro de "data".
function unwrap(json: JsonRecord | null): JsonRecord {
  if (!json) return {};
  const data = json["data"];
  if (data && typeof data === "object" && !json["id"]) return data as JsonRecord;
  return json;
}

/** Status da SagacePay: pending → paid | failed | refunded | expired. */
export function sagacePublicStatus(status: unknown): "pending" | "paid" | "failed" {
  const value = String(status ?? "").toLowerCase().trim();
  if (["paid", "pago", "completed", "confirmed"].includes(value)) return "paid";
  if (["failed", "refunded", "expired", "cancelled", "canceled", "refused"].includes(value)) return "failed";
  return "pending";
}

/** Gera a cobrança (POST /sales). Valor em centavos; a SagacePay recebe reais. */
export async function createSagacePix(input: {
  amountCents: number;
  customer: { name: string; cpf: string; email?: string; phone?: string };
  description: string;
  postbackUrl: string;
  /** Também é a chave de idempotência. */
  externalId: string;
  expiresInSeconds: number;
}): Promise<{ transactionId: string; pixCode: string; status: "pending" | "paid" | "failed" }> {
  const amount = Number((input.amountCents / 100).toFixed(2));
  const response = await fetchWithTimeout(`${SAGACEPAY_API}/sales`, {
    method: "POST",
    headers: { ...(await headers()), "idempotency-key": input.externalId },
    body: JSON.stringify({
      amount,
      description: input.description,
      expirationInSeconds: Math.min(86400, Math.max(300, Math.round(input.expiresInSeconds))),
      customer: {
        name: input.customer.name,
        document: input.customer.cpf,
        ...(input.customer.email ? { email: input.customer.email } : {}),
        ...(input.customer.phone ? { phone: input.customer.phone } : {}),
      },
      items: [{ description: input.description, quantity: 1, unitPrice: amount }],
      ...(input.postbackUrl ? { postbackUrl: input.postbackUrl } : {}),
      externalId: input.externalId,
    }),
  }, 20000, "A SagacePay");
  const sale = unwrap((await response.json().catch(() => null)) as JsonRecord | null);
  const transactionId = sale["id"];
  const pixCode = sale["pixCode"];
  if (!response.ok || !transactionId || !pixCode) {
    console.error("SagacePay error", response.status, JSON.stringify(sale)?.slice(0, 500));
    const detail = String(sale["message"] ?? sale["error"] ?? `HTTP ${response.status}`);
    throw new Error(`SagacePay ${response.status}: ${detail}`);
  }
  return {
    transactionId: String(transactionId),
    pixCode: String(pixCode),
    status: sagacePublicStatus(sale["status"]),
  };
}

/** Status real da venda (GET /sales/:id). Valor devolvido em centavos. */
export async function getSagaceStatus(id: string): Promise<{ status: "pending" | "paid" | "failed"; amountCents: number; raw: string }> {
  const response = await fetchWithTimeout(`${SAGACEPAY_API}/sales/${encodeURIComponent(id)}`, { headers: await headers() }, 10000, "A SagacePay");
  const sale = unwrap((await response.json().catch(() => null)) as JsonRecord | null);
  if (!response.ok) throw new Error(`SagacePay HTTP ${response.status}`);
  return {
    status: sagacePublicStatus(sale["status"]),
    amountCents: Math.round(Number(sale["amount"] ?? 0) * 100),
    raw: String(sale["status"] ?? ""),
  };
}

/** Testa a chave sem criar cobrança (GET /sales?limit=1). */
export async function testSagacePayKey(): Promise<{ ok: boolean; message: string }> {
  const key = await getSagacePayKey();
  if (!key) return { ok: false, message: "Nenhuma chave da SagacePay cadastrada." };
  try {
    const response = await fetchWithTimeout(`${SAGACEPAY_API}/sales?page=1&limit=1`, { headers: await headers(key) }, 10000, "A SagacePay");
    if (response.ok) {
      return { ok: true, message: "SagacePay respondeu. Chave aceita; clique em PIX na SagacePay para o checkout usar ela." };
    }
    const json = (await response.json().catch(() => null)) as JsonRecord | null;
    return { ok: false, message: String(json?.["message"] ?? `A SagacePay recusou a chave (HTTP ${response.status}).`).slice(0, 200) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Falha de conexão com a SagacePay." };
  }
}
