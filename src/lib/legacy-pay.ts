export type JsonRecord = Record<string, unknown>;

export type LegacyPayClient = {
  prepareCardPayment: (input: JsonRecord) => Promise<JsonRecord>;
  buildPayinPayload: (base: JsonRecord, prepared: JsonRecord) => JsonRecord;
  handlePendingThreeDS: (payin: JsonRecord, input: JsonRecord) => Promise<unknown>;
  getConfig?: () => Promise<JsonRecord>;
};

type LegacyPayGlobal = {
  init: (options: { publicKey: string; apiBaseUrl: string }) => LegacyPayClient;
};

declare global {
  interface Window {
    LegacyPay?: LegacyPayGlobal;
  }
}

export async function loadLegacyPay(): Promise<LegacyPayGlobal> {
  if (typeof window === "undefined") throw new Error("Checkout seguro só funciona no navegador.");
  if (window.LegacyPay) return window.LegacyPay;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://api.legacyecombrasil.com/checkout/sdk/legacy-pay.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar o checkout seguro."));
    document.head.appendChild(script);
  });
  if (!window.LegacyPay) throw new Error("SDK LegacyPay indisponível.");
  return window.LegacyPay;
}

export async function fetchLegacyPublicConfig(): Promise<{ publicKey: string; apiBaseUrl: string }> {
  const response = await fetch("/api/legacy-config", { cache: "no-store" });
  const data = (await response.json()) as JsonRecord;
  const publicKey = String(data["publicKey"] ?? "").trim();
  const apiBaseUrl = String(data["apiBaseUrl"] ?? "https://api.legacyecombrasil.com").trim();
  if (!response.ok || !publicKey) {
    throw new Error(String(data["message"] ?? "Configure as chaves da Legacy para receber cartão."));
  }
  return { publicKey, apiBaseUrl };
}

export function newReferenceId() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `kyt-${hex}`;
}

export function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}
