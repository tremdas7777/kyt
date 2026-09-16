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
  utmSource: string;
  utmMedium: string;
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
  sourceUrl?: string;
  attribution: Attribution;
  customer?: Pick<CheckoutPayload, "name" | "email" | "phone" | "cpf" | "city" | "state" | "cep">;
  userAgent?: string;
};

export type TrafficSource = "tiktok" | "meta" | "google" | "direct" | "other";
export type FunnelStage = "home" | "listing" | "product" | "cart" | "checkout" | "payment" | "paid";
export type DeviceType = "mobile" | "desktop";

export type LiveCartLine = {
  id: string;
  productId: string;
  name: string;
  color: string;
  size: string;
  quantity: number;
  price: number;
  image: string;
};

export type LiveVisitor = {
  id: string;
  clientId: string;
  startedAt: string;
  lastAt: string;
  path: string;
  referrer: string;
  source: TrafficSource;
  device: DeviceType;
  stage: FunnelStage;
  pageViews: number;
  sawProduct: boolean;
  addedCart: boolean;
  startedCheckout: boolean;
  addedPayment: boolean;
  purchased: boolean;
  cartValue: number;
  cartItems: LiveCartLine[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  orderId: string;
  paymentStatus: "" | PaymentStatus;
  ip: string;
  userAgent: string;
};

export type FunnelWindow = {
  label: string;
  visit: number;
  product: number;
  cart: number;
  checkout: number;
  purchase: number;
  revenue: number;
};

export type AbandonedCart = LiveVisitor & {
  idleMs: number;
  status: "quente" | "abandonado" | "pix" | "perdido";
};

export type SourceFunnels = Record<TrafficSource, FunnelWindow>;

export type LivePageHit = {
  path: string;
  count: number;
  cartValue: number;
};

export type CartStatusBucket = {
  count: number;
  value: number;
};

export type AbandonedProduct = {
  name: string;
  quantity: number;
  value: number;
};

export type LiveSnapshot = {
  generatedAt: string;
  online: LiveVisitor[];
  onlineCount: number;
  inCheckout: number;
  activeCarts: number;
  awaitingPix: number;
  abandonedToday: number;
  abandonedValueToday: number;
  conversionToday: number;
  visitors: LiveVisitor[];
  funnel: { today: FunnelWindow; week: FunnelWindow; month: FunnelWindow };
  sourceFunnels: { today: SourceFunnels; week: SourceFunnels; month: SourceFunnels };
  pages: LivePageHit[];
  carts: AbandonedCart[];
  cartStatus: Record<AbandonedCart["status"], CartStatusBucket>;
  topAbandoned: AbandonedProduct[];
  sources: Record<TrafficSource, number>;
};

export type { CartItem, CheckoutPayload, Order, PaymentStatus };

export type LiveCartItem = {
  productId: string;
  name: string;
  color: string;
  size: string;
  quantity: number;
  price: number;
  image: string;
};

export type LiveStage = "browsing" | "cart" | "checkout" | "ordered";

export type LiveSession = {
  id: string;
  firstSeen: string;
  lastSeen: string;
  path: string;
  title: string;
  views: number;
  stage: LiveStage;
  device: "mobile" | "tablet" | "desktop";
  os: string;
  browser: string;
  referrer: string;
  source: string;
  utm: { source: string; medium: string; campaign: string; content: string; term: string };
  city: string;
  region: string;
  country: string;
  ip: string;
  userAgent: string;
  cart: LiveCartItem[];
  cartValue: number;
  customer: { name: string; email: string; phone: string };
  orderId: string;
  paymentStatus: "" | "pending" | "paid" | "failed";
  attribution: Attribution;
  trail: { at: string; label: string }[];
};
