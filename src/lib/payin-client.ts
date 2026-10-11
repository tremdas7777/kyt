import { asRecord, type JsonRecord } from "@/lib/legacy-pay";
import type { PaymentGateway } from "@/lib/payment-types";

export type PayinResponse = JsonRecord & {
  success?: boolean;
  message?: string;
  paymentMethod?: string;
  paymentGateway?: PaymentGateway;
  status?: string;
  pixCode?: string;
  pixImage?: string;
  referenceId?: string;
  transactionId?: string;
  threeDSecurePending?: boolean;
  amount?: number;
};

/** Mensagem amigável para falhas de rede ("Load failed" no Safari, "Failed to fetch" no Chrome). */
export function friendlyNetworkError(error: unknown): Error {
  if (error instanceof DOMException && error.name === "AbortError") {
    return new Error("O pagamento demorou demais para responder. Confira sua internet e tente gerar o PIX de novo.");
  }
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/load failed|failed to fetch|networkerror|network request failed|the network connection was lost/i.test(message)) {
    return new Error("Não conseguimos falar com o servidor de pagamento. Confira sua internet e tente gerar o PIX de novo.");
  }
  return error instanceof Error ? error : new Error(message || "Falha ao gerar o pagamento.");
}

export async function createPayin(payload: JsonRecord): Promise<PayinResponse> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 45000);
  let response: Response;
  try {
    response = await fetch("/api/payin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    throw friendlyNetworkError(error);
  } finally {
    window.clearTimeout(timer);
  }
  const raw = await response.text();
  let data: PayinResponse = {};
  try {
    data = raw ? (JSON.parse(raw) as PayinResponse) : {};
  } catch {
    throw new Error(response.ok ? "Resposta inválida do gateway." : "Falha ao gerar o pagamento.");
  }
  if (!response.ok || data["success"] === false) {
    throw new Error(String(data["message"] ?? "Falha ao gerar o pagamento."));
  }
  return data;
}

export async function checkPayinStatus(tx: string, ref: string, gateway?: PaymentGateway): Promise<string> {
  const qs = new URLSearchParams();
  if (tx) qs.set("tx", tx);
  if (ref) qs.set("ref", ref);
  if (gateway) qs.set("gateway", gateway);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15000);
  let response: Response;
  try {
    response = await fetch(`/api/payin-status?${qs.toString()}`, { cache: "no-store", signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
  const data = asRecord(await response.json());
  return String(data["status"] ?? "pending");
}
