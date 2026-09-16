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

export async function createPayin(payload: JsonRecord): Promise<PayinResponse> {
  const response = await fetch("/api/payin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
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
  const response = await fetch(`/api/payin-status?${qs.toString()}`, { cache: "no-store" });
  const data = asRecord(await response.json());
  return String(data["status"] ?? "pending");
}
