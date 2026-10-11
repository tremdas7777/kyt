export const PIX_GATEWAYS = ["legacy", "magicpay", "pixgate", "sagacepay"] as const;
export type PixGateway = (typeof PIX_GATEWAYS)[number];
export type PaymentGateway = PixGateway;

export const PIX_GATEWAY_LABEL: Record<PixGateway, string> = {
  legacy: "Legacy",
  magicpay: "MagicPay",
  pixgate: "PixGate",
  sagacepay: "SagacePay",
};

export type MagicPaySettings = {
  publicKey: string;
  secretKey: string;
  apiUrl: string;
};

/** Gateways de PIX com uma única chave de API (PixGate e SagacePay). */
export type ApiKeySettings = {
  apiKey: string;
};

export type PaymentSettings = {
  pixGateway: PixGateway;
  pixGatewayChosen?: boolean;
  cardEnabled: boolean;
  cardEnabledChosen?: boolean;
  updatedAt?: string;
  magicpay: MagicPaySettings;
  pixgate: ApiKeySettings;
  sagacepay: ApiKeySettings;
};

export function isPixGateway(value: unknown): value is PixGateway {
  return typeof value === "string" && (PIX_GATEWAYS as readonly string[]).includes(value);
}

/** Isolates do not share admin saves. Keep card copy off in the storefront until this is true. */
export const STOREFRONT_ALLOWS_CARD = false;

export function emptyPaymentSettings(): PaymentSettings {
  return {
    pixGateway: "magicpay",
    pixGatewayChosen: false,
    cardEnabled: false,
    cardEnabledChosen: false,
    magicpay: {
      publicKey: "",
      secretKey: "",
      apiUrl: "https://api.dashboardmagicpay.com",
    },
    pixgate: { apiKey: "" },
    sagacepay: { apiKey: "" },
  };
}

/** Versão segura para o navegador: segredos viram só "configurado ou não". */
export type PublicPaymentSettings = Omit<PaymentSettings, "magicpay" | "pixgate" | "sagacepay"> & {
  magicpay: { apiUrl: string; configured: boolean; publicKeyMasked: string };
  pixgate: { configured: boolean; apiKeyMasked: string };
  sagacepay: { configured: boolean; apiKeyMasked: string };
};

export function maskSecret(value: string): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text.length <= 8) return "••••";
  return `${text.slice(0, 4)}••••${text.slice(-4)}`;
}
