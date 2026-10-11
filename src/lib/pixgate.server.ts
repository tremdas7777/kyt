// PixGate: cobranças Pix. Somente servidor. API: https://app.pixgateip.com/api
// Chave: a salva no painel (/admin/integracoes) ou, sem ela, a variável PIXGATE_API_KEY.
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { getRuntimeEnv } from "@/lib/legacy.server";

export const PIXGATE_API = "https://app.pixgateip.com/api";

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

export async function getPixgateKey(): Promise<string> {
  const { getPaymentSettings } = await import("@/lib/admin-store.server");
  const settings = await getPaymentSettings();
  return settings.pixgate.apiKey.trim() || env("PIXGATE_API_KEY");
}

export async function pixgateKeySource(): Promise<"admin" | "env" | null> {
  const { getPaymentSettings } = await import("@/lib/admin-store.server");
  const settings = await getPaymentSettings();
  if (settings.pixgate.apiKey.trim()) return "admin";
  return env("PIXGATE_API_KEY") ? "env" : null;
}

async function keyOrThrow(): Promise<string> {
  const key = await getPixgateKey();
  if (!key) throw new Error("PixGate: cadastre a chave de API em Integrações.");
  return key;
}

/** Status público: a PixGate usa "approved" para Pix gerado e ainda não pago. */
export function pixgatePublicStatus(status: unknown): "pending" | "paid" | "failed" {
  const value = String(status ?? "").toLowerCase().trim();
  if (["paid", "pago", "completed", "concluido", "concluida", "confirmed"].includes(value)) return "paid";
  if (["failed", "cancelled", "canceled", "expired", "expirado", "refunded", "estornado", "refused"].includes(value))
    return "failed";
  return "pending";
}

function pixImage(pixCode: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&ecc=M&margin=8&data=${encodeURIComponent(pixCode)}`;
}

/** Gera a cobrança (POST /v1/cashin). Valor em centavos; a PixGate recebe reais. */
export async function createPixgatePix(input: {
  amountCents: number;
  customerName: string;
  cpf: string;
  description: string;
  postbackUrl: string;
}): Promise<{ transactionId: string; pixCode: string; status: "pending" | "paid" | "failed" }> {
  const valor = Number((input.amountCents / 100).toFixed(2));
  const response = await fetchWithTimeout(`${PIXGATE_API}/v1/cashin`, {
    method: "POST",
    headers: { Apikey: await keyOrThrow(), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      nome: input.customerName,
      cpf: input.cpf,
      valor,
      descricao: input.description,
      ...(input.postbackUrl ? { postback: input.postbackUrl } : {}),
    }),
  }, 20000, "A PixGate");
  const json = (await response.json().catch(() => null)) as JsonRecord | null;
  const transactionId = json?.["id"];
  const pixCode = json?.["pix"];
  if (!response.ok || !transactionId || !pixCode) {
    console.error("PixGate error", response.status, JSON.stringify(json)?.slice(0, 500));
    const detail = String(json?.["message"] ?? json?.["error"] ?? `HTTP ${response.status}`);
    throw new Error(`PixGate ${response.status}: ${detail}`);
  }
  return {
    transactionId: String(transactionId),
    pixCode: String(pixCode),
    status: pixgatePublicStatus(json?.["status"]),
  };
}

/** Status real (GET /stats/:id). Valor devolvido em centavos. */
export async function getPixgateStatus(id: string): Promise<{ status: "pending" | "paid" | "failed"; amountCents: number; raw: string }> {
  const response = await fetchWithTimeout(`${PIXGATE_API}/stats/${encodeURIComponent(id)}`, {
    headers: { Apikey: await keyOrThrow(), Accept: "application/json" },
  }, 10000, "A PixGate");
  const json = (await response.json().catch(() => null)) as JsonRecord | null;
  if (!response.ok) throw new Error(`PixGate HTTP ${response.status}`);
  return {
    status: pixgatePublicStatus(json?.["status"]),
    amountCents: Math.round(Number(json?.["value"] ?? 0) * 100),
    raw: String(json?.["status"] ?? ""),
  };
}

/** Testa a chave sem criar cobrança: consulta um Pix inexistente. 401/403 = chave recusada. */
export async function testPixgateKey(): Promise<{ ok: boolean; message: string }> {
  const key = await getPixgateKey();
  if (!key) return { ok: false, message: "Nenhuma chave da PixGate cadastrada." };
  try {
    const response = await fetchWithTimeout(`${PIXGATE_API}/stats/00000000-0000-0000-0000-000000000000`, {
      headers: { Apikey: key, Accept: "application/json" },
    }, 10000, "A PixGate");
    if (response.status === 401 || response.status === 403) {
      return { ok: false, message: "A PixGate recusou a chave. Confira a Apikey no painel da PixGate." };
    }
    if (response.status >= 500) return { ok: false, message: `PixGate HTTP ${response.status}.` };
    return { ok: true, message: "PixGate respondeu. Chave aceita; clique em PIX na PixGate para o checkout usar ela." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Falha de conexão com a PixGate." };
  }
}

export { pixImage as pixgatePixImage };
