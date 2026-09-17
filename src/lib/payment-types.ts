export const PIX_GATEWAYS = ["legacy", "magicpay"] as const;
export type PixGateway = (typeof PIX_GATEWAYS)[number];
export type PaymentGateway = "legacy" | "magicpay";

export type MagicPaySettings = {
  publicKey: string;
  secretKey: string;
  apiUrl: string;
};

export type PaymentSettings = {
  pixGateway: PixGateway;
  pixGatewayChosen?: boolean;
  cardEnabled: boolean;
  cardEnabledChosen?: boolean;
  updatedAt?: string;
  magicpay: MagicPaySettings;
};

export function isPixGateway(value: unknown): value is PixGateway {
  return value === "legacy" || value === "magicpay";
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
  };
}
