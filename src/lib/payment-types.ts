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
  magicpay: MagicPaySettings;
};

export function isPixGateway(value: unknown): value is PixGateway {
  return value === "legacy" || value === "magicpay";
}

export function emptyPaymentSettings(): PaymentSettings {
  return {
    pixGateway: "legacy",
    magicpay: {
      publicKey: "",
      secretKey: "",
      apiUrl: "https://api.dashboardmagicpay.com",
    },
  };
}
