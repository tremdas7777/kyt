import type { CartItem, CheckoutPayload, Order, PaymentStatus } from "@/lib/cart";

export type Attribution = {
  fbp: string;
  fbc: string;
  fbclid: string;
  ttclid: string;
  ttp: string;
  gclid: string;
  gbraid: string;
  wbraid: string;
  clientId: string;
};

export type PublicTrackingConfig = {
  tiktok: { enabled: boolean; pixelIds: string[] };
  meta: { enabled: boolean; pixelId: string };
  google: {
    enabled: boolean;
    measurementId: string;
    adsId: string;
    adsPurchaseLabel: string;
  };
};

export type TrackingSettings = {
  tiktok: {
    enabled: boolean;
    pixelIds: string[];
    accessToken: string;
    testEventCode: string;
    markAsPaidOnPixCreate: boolean;
  };
  meta: {
    enabled: boolean;
    pixelId: string;
    accessToken: string;
    testEventCode: string;
  };
  google: {
    enabled: boolean;
    measurementId: string;
    apiSecret: string;
    adsId: string;
    adsPurchaseLabel: string;
  };
};

export type StoreOrder = Order & {
  eventId: string;
  attribution: Attribution;
  userAgent: string;
  ip: string;
  purchaseSent: boolean;
};

export type TrackingLog = {
  id: string;
  at: string;
  event: string;
  source: "browser" | "server" | "capi" | "tiktok" | "google";
  eventId: string;
  orderId: string;
  value: number;
  ok: boolean;
  detail: string;
};

export type PixelContent = {
  id: string;
  name: string;
  category?: string;
  quantity: number;
  price: number;
};

export type TrackPayload = {
  event: string;
  eventId: string;
  value: number;
  currency: "BRL";
  contents: PixelContent[];
  orderId?: string;
  attribution: Attribution;
  customer?: Pick<CheckoutPayload, "name" | "email" | "phone" | "cpf" | "city" | "state" | "cep">;
  userAgent?: string;
};

export type { CartItem, CheckoutPayload, Order, PaymentStatus };
