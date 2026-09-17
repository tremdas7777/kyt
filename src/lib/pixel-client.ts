import {
  emptyAttribution,
  fromGoogleAds,
  fromMetaAds,
  fromTikTokAds,
  keepExternalReferrer,
  trafficPlatformFrom,
  type TrafficPlatform,
} from "@/lib/ad-origin";
import type { Attribution, PixelContent, PublicTrackingConfig } from "@/lib/tracking-types";

const ATTR_KEY = "kyt-attribution";
const CID_KEY = "kyt-cid";
const LANDING_REF_KEY = "kyt-landing-ref";
const TRAFFIC_KEY = "kyt-traffic";

type Fbq = (...args: unknown[]) => void;
type Ttq = {
  load: (id: string) => void;
  page: () => void;
  track: (event: string, params?: Record<string, unknown>, options?: Record<string, unknown>) => void;
  instance: (id: string) => { track: Ttq["track"]; page: () => void };
};
type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
    ttq?: Ttq;
    gtag?: Gtag;
    dataLayer?: unknown[];
    kytTrack?: typeof trackEvent;
  }
}

let publicConfig: PublicTrackingConfig | null = null;
let pixelsReady = false;

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const parts = document.cookie.split("; ");
  for (const part of parts) {
    if (part.startsWith(`${name}=`)) {
      try {
        return decodeURIComponent(part.slice(name.length + 1));
      } catch {
        return part.slice(name.length + 1);
      }
    }
  }
  return "";
}

function writeCookie(name: string, value: string, days = 90) {
  if (typeof document === "undefined" || !value) return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${days * 86400}; Path=/; SameSite=Lax${secure}`;
}

function randomId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function emptyAttr(): Attribution {
  return emptyAttribution();
}

function readStoredAttr(): Attribution | null {
  if (typeof window === "undefined") return null;
  for (const store of [window.sessionStorage, window.localStorage]) {
    try {
      const parsed = JSON.parse(store.getItem(ATTR_KEY) || "null") as Attribution | null;
      if (parsed && typeof parsed === "object") return { ...emptyAttribution(), ...parsed };
    } catch {
      // ignore
    }
  }
  return null;
}

function persistAttr(next: Attribution) {
  const raw = JSON.stringify(next);
  try {
    window.sessionStorage.setItem(ATTR_KEY, raw);
    window.localStorage.setItem(ATTR_KEY, raw);
  } catch {
    // ignore quota
  }
}

function clickParams(): URLSearchParams {
  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (hash.includes("=")) {
    const extra = new URLSearchParams(hash.startsWith("?") ? hash.slice(1) : hash);
    extra.forEach((value, key) => {
      if (value && !params.get(key)) params.set(key, value);
    });
  }
  try {
    if (document.referrer) {
      const ref = new URL(document.referrer);
      for (const key of ["fbclid", "ttclid", "gclid", "gbraid", "wbraid", "utm_source", "utm_medium"]) {
        const value = ref.searchParams.get(key);
        if (value && !params.get(key)) params.set(key, value);
      }
    }
  } catch {
    // ignore invalid referrer
  }
  return params;
}

function fbclidFromFbc(fbc: string): string {
  const parts = fbc.split(".");
  return parts.length >= 4 ? parts.slice(3).join(".") : "";
}

export function captureAttribution(): Attribution {
  if (typeof window === "undefined") return emptyAttr();
  const params = clickParams();
  const stored = readStoredAttr();
  const cookieFbc = readCookie("_fbc") || stored?.fbc || "";

  const next: Attribution = {
    fbp: readCookie("_fbp") || stored?.fbp || "",
    fbc: cookieFbc,
    fbclid: params.get("fbclid") || stored?.fbclid || fbclidFromFbc(cookieFbc) || "",
    ttclid: params.get("ttclid") || stored?.ttclid || readCookie("ttclid") || "",
    ttp: readCookie("_ttp") || stored?.ttp || "",
    gclid: params.get("gclid") || stored?.gclid || readCookie("_kyt_gclid") || "",
    gbraid: params.get("gbraid") || stored?.gbraid || "",
    wbraid: params.get("wbraid") || stored?.wbraid || "",
    clientId: readCookie(CID_KEY) || stored?.clientId || "",
    utmSource: params.get("utm_source") || stored?.utmSource || "",
    utmMedium: params.get("utm_medium") || stored?.utmMedium || "",
  };

  if (!next.clientId) next.clientId = randomId();
  writeCookie(CID_KEY, next.clientId, 730);

  if (fromMetaAds(next)) {
    if (!next.fbp) {
      next.fbp = `fb.1.${Date.now()}.${Math.floor(Math.random() * 1e10)}`;
      writeCookie("_fbp", next.fbp);
    }
  }
  if (next.fbclid && !next.fbc) {
    next.fbc = `fb.1.${Date.now()}.${next.fbclid}`;
    writeCookie("_fbc", next.fbc);
  }
  if (next.ttclid) writeCookie("ttclid", next.ttclid);
  if (next.gclid) writeCookie("_kyt_gclid", next.gclid);

  persistAttr(next);
  return next;
}

export function getAttribution(): Attribution {
  return captureAttribution();
}

function loadScript(src: string, id: string) {
  if (document.getElementById(id)) return;
  const script = document.createElement("script");
  script.id = id;
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

function initMeta(pixelId: string, attr?: Attribution) {
  const advanced = attr?.clientId ? { external_id: attr.clientId } : undefined;
  if (window.fbq) {
    window.fbq("init", pixelId, advanced);
    return;
  }
  const fbq: Fbq = (...args: unknown[]) => {
    (fbq as Fbq & { q: unknown[] }).q.push(args);
  };
  (fbq as Fbq & { q: unknown[]; l: number }).q = [];
  (fbq as Fbq & { l: number }).l = Date.now();
  window.fbq = fbq;
  window._fbq = fbq;
  loadScript("https://connect.facebook.net/en_US/fbevents.js", "kyt-meta-pixel");
  window.fbq("init", pixelId, advanced);
}

function initTikTok(pixelIds: string[]) {
  const w = window as Window & { TiktokAnalyticsObject?: string };
  w.TiktokAnalyticsObject = "ttq";
  const ttq = (w.ttq || []) as Ttq & {
    methods: string[];
    setAndDefer: (target: Record<string, unknown>, method: string) => void;
    _i: Record<string, unknown[]>;
    _t: Record<string, number>;
    _o: Record<string, unknown>;
    push: (...args: unknown[]) => number;
  };
  if (!w.ttq) {
    ttq.methods = [
      "page",
      "track",
      "identify",
      "instances",
      "debug",
      "on",
      "off",
      "once",
      "ready",
      "alias",
      "group",
      "enableCookie",
      "disableCookie",
    ];
    ttq.setAndDefer = (target, method) => {
      target[method] = function (...args: unknown[]) {
        (target as { push: (item: unknown) => void }).push([method, ...args]);
      };
    };
    ttq.methods.forEach((method) => ttq.setAndDefer(ttq as unknown as Record<string, unknown>, method));
    ttq.instance = ((id: string) => {
      const bucket = (ttq._i[id] || []) as unknown as Record<string, unknown>;
      ttq.methods.forEach((method) => ttq.setAndDefer(bucket, method));
      return bucket as unknown as { track: Ttq["track"]; page: () => void };
    }) as Ttq["instance"];
    ttq.load = (id: string) => {
      ttq._i = ttq._i || {};
      ttq._i[id] = [];
      ttq._t = ttq._t || {};
      ttq._t[id] = Date.now();
      ttq._o = ttq._o || {};
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${encodeURIComponent(id)}&lib=ttq`;
      const first = document.getElementsByTagName("script")[0];
      first?.parentNode?.insertBefore(script, first);
    };
    w.ttq = ttq;
  }
  for (const id of pixelIds) w.ttq?.load(id);
}

function initGoogle(measurementId: string, adsId: string) {
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function gtag(...args: unknown[]) {
      (window.dataLayer as unknown[]).push(args);
    };
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId || adsId)}`, "kyt-gtag");
    window.gtag("js", new Date());
  }
  if (measurementId) window.gtag("config", measurementId, { send_page_view: false });
  if (adsId) window.gtag("config", adsId, { send_page_view: false });
}

export async function loadPublicTracking(): Promise<PublicTrackingConfig | null> {
  try {
    const response = await fetch("/api/tracking-public", { cache: "no-store" });
    const data = (await response.json()) as PublicTrackingConfig;
    publicConfig = data;
    return data;
  } catch {
    return null;
  }
}

export function initPixels(config: PublicTrackingConfig) {
  if (typeof window === "undefined" || pixelsReady) return;
  publicConfig = config;
  const attr = captureAttribution();
  if (config.meta.enabled && config.meta.pixelId && fromMetaAds(attr)) initMeta(config.meta.pixelId, attr);
  if (config.tiktok.enabled && config.tiktok.pixelIds.length && fromTikTokAds(attr)) initTikTok(config.tiktok.pixelIds);
  if (
    config.google.enabled &&
    (config.google.measurementId || config.google.adsId) &&
    fromGoogleAds(attr)
  ) {
    initGoogle(config.google.measurementId, config.google.adsId);
  }
  pixelsReady = true;
  window.kytTrack = trackEvent;
}

function contentParams(contents: PixelContent[], value: number) {
  return {
    currency: "BRL" as const,
    value,
    contents: contents.map((item) => ({
      content_id: item.id,
      content_name: item.name,
      quantity: item.quantity,
      price: item.price,
    })),
    content_type: "product",
    content_ids: contents.map((item) => item.id),
    num_items: contents.reduce((sum, item) => sum + item.quantity, 0),
  };
}

const META_EVENTS: Record<string, string> = {
  PageView: "PageView",
  ViewContent: "ViewContent",
  AddToCart: "AddToCart",
  InitiateCheckout: "InitiateCheckout",
  AddPaymentInfo: "AddPaymentInfo",
  CompletePayment: "AddPaymentInfo",
  Purchase: "Purchase",
};

const TIKTOK_EVENTS: Record<string, string> = {
  PageView: "Pageview",
  ViewContent: "ViewContent",
  AddToCart: "AddToCart",
  InitiateCheckout: "InitiateCheckout",
  AddPaymentInfo: "AddPaymentInfo",
  CompletePayment: "CompletePayment",
  Purchase: "CompletePayment",
};

function lockKey(event: string, eventId: string) {
  return `kyt_evt_${event}_${eventId}`;
}

function once(event: string, eventId: string): boolean {
  if (typeof window === "undefined") return true;
  if (event !== "Purchase" && event !== "CompletePayment") return true;
  const key = lockKey(event, eventId);
  try {
    if (window.sessionStorage.getItem(key)) return false;
    window.sessionStorage.setItem(key, "1");
  } catch {
    return true;
  }
  return true;
}

export function newEventId(prefix: string): string {
  return `${prefix}_${randomId().slice(0, 16)}`;
}

export type ClientTrackInput = {
  event: string;
  eventId?: string;
  value?: number;
  contents?: PixelContent[];
  orderId?: string;
  customer?: TrackPayloadCustomer;
};

type TrackPayloadCustomer = {
  name?: string;
  email?: string;
  phone?: string;
  cpf?: string;
  city?: string;
  state?: string;
  cep?: string;
};

export function trackEvent(input: ClientTrackInput) {
  if (typeof window === "undefined") return;
  const contents = input.contents ?? [];
  pingLive({
    event: input.event,
    path:
      input.event === "Purchase" && input.orderId
        ? `/obrigado/${input.orderId}`
        : input.event === "CompletePayment" && input.orderId
          ? `/pedido/${input.orderId}`
          : window.location.pathname,
    orderId: input.orderId,
    paymentStatus:
      input.event === "Purchase" ? "paid" : input.event === "CompletePayment" && input.orderId ? "pending" : undefined,
    customer: input.customer,
    cartItems: contents.map((item) => ({
      id: item.id,
      productId: item.id,
      name: item.name,
      color: "",
      size: "",
      quantity: item.quantity,
      price: item.price,
      image: "",
    })),
  });
  const eventId = input.eventId || newEventId(input.event.toLowerCase());
  if (!once(input.event, eventId)) return;
  const value = Number(input.value ?? 0);
  const params = contentParams(contents, value);
  const metaName = META_EVENTS[input.event];
  const tiktokName = TIKTOK_EVENTS[input.event];
  const attr = getAttribution();
  const config = publicConfig;
  if (config?.meta.enabled && config.meta.pixelId && fromMetaAds(attr) && metaName) {
    if (!window.fbq) initMeta(config.meta.pixelId, attr);
    window.fbq?.("track", metaName, params, { eventID: eventId });
  }
  if (config?.tiktok.enabled && window.ttq && tiktokName && fromTikTokAds(attr)) {
    window.ttq.track(tiktokName, params, { event_id: eventId });
  }
  if (config?.google.enabled && window.gtag && fromGoogleAds(attr)) {
    const gaName =
      input.event === "PageView"
        ? "page_view"
        : input.event === "ViewContent"
          ? "view_item"
          : input.event === "AddToCart"
            ? "add_to_cart"
            : input.event === "InitiateCheckout"
              ? "begin_checkout"
              : input.event === "AddPaymentInfo"
                ? "add_payment_info"
                : input.event === "Purchase"
                  ? "purchase"
                  : "";
    if (gaName) {
      const gaParams: Record<string, unknown> = {
        currency: "BRL",
        value,
        items: contents.map((item) => ({
          item_id: item.id,
          item_name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
      };
      if (input.orderId) gaParams["transaction_id"] = input.orderId;
      window.gtag("event", gaName, gaParams);
      if (input.event === "Purchase" && config?.google.adsId && config.google.adsPurchaseLabel) {
        window.gtag("event", "conversion", {
          send_to: `${config.google.adsId}/${config.google.adsPurchaseLabel}`,
          value,
          currency: "BRL",
          transaction_id: input.orderId || eventId,
        });
      }
    }
  }

  const body: Record<string, unknown> = {
    event: input.event,
    eventId,
    value,
    currency: "BRL",
    contents,
    clientId: attr.clientId,
    attribution: attr,
  };
  if (input.orderId) body["orderId"] = input.orderId;
  if (input.customer) body["customer"] = input.customer;
  body["path"] = typeof window !== "undefined" ? window.location.pathname : "";
  body["sourceUrl"] = typeof window !== "undefined" ? window.location.href : "";
  body["referrer"] = typeof window !== "undefined" ? document.referrer : "";
  const storedCart = cartFromStorage();
  const contentsAsCart = contents.map((item) => ({
    id: item.id,
    productId: item.id,
    name: item.name,
    color: "",
    size: "",
    quantity: item.quantity,
    price: item.price,
    image: "",
  }));
  body["cartItems"] = storedCart.length ? storedCart : contentsAsCart;
  void fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => undefined);
}

export function trackPageView(path: string) {
  trackEvent({ event: "PageView", eventId: newEventId(`pv_${path.replace(/\W+/g, "_").slice(0, 24)}`) });
}

type StoredCartItem = {
  productId?: string;
  id?: string;
  name?: string;
  color?: string;
  size?: string;
  quantity?: number;
  price?: number;
  image?: string;
};

function cartFromStorage() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("kyt-cart");
    const items = raw ? (JSON.parse(raw) as StoredCartItem[]) : [];
    if (!Array.isArray(items)) return [];
    return items.map((item) => ({
      id: String(item.id ?? ""),
      productId: String(item.productId ?? item.id ?? ""),
      name: String(item.name ?? ""),
      color: String(item.color ?? ""),
      size: String(item.size ?? ""),
      quantity: Number(item.quantity ?? 1) || 1,
      price: Number(item.price ?? 0) || 0,
      image: String(item.image ?? ""),
    }));
  } catch {
    return [];
  }
}

function rememberedReferrer() {
  if (typeof window === "undefined") return "";
  try {
    const stored = window.localStorage.getItem(LANDING_REF_KEY) || "";
    const kept = keepExternalReferrer(document.referrer, stored);
    if (kept) window.localStorage.setItem(LANDING_REF_KEY, kept);
    return kept;
  } catch {
    return document.referrer || "";
  }
}

function rememberedSource(attr: ReturnType<typeof getAttribution>, referrer: string): TrafficPlatform {
  const next = trafficPlatformFrom({ attr, referrer, userAgent: navigator.userAgent });
  try {
    const stored = window.localStorage.getItem(TRAFFIC_KEY) || "";
    const weak = next === "direct" || next === "other";
    const keep = stored === "tiktok" || stored === "meta" || stored === "google";
    const value = (weak && keep ? stored : next) as TrafficPlatform;
    window.localStorage.setItem(TRAFFIC_KEY, value);
    return value;
  } catch {
    return next;
  }
}

function orderFromStorage(orderId?: string) {
  if (!orderId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("kyt-orders");
    const orders = raw ? (JSON.parse(raw) as Array<{
      id?: string;
      items?: StoredCartItem[];
      total?: number;
      customer?: { name?: string; email?: string; phone?: string };
    }>) : [];
    if (!Array.isArray(orders)) return null;
    return orders.find((order) => order.id === orderId) ?? null;
  } catch {
    return null;
  }
}

function orderHintFromPath(path: string): { orderId?: string; paymentStatus?: "pending" | "paid" } {
  const pedido = path.match(/^\/pedido\/([^/?#]+)/);
  if (pedido?.[1]) return { orderId: pedido[1], paymentStatus: "pending" };
  const obrigado = path.match(/^\/obrigado\/([^/?#]+)/);
  if (obrigado?.[1]) return { orderId: obrigado[1], paymentStatus: "paid" };
  return {};
}

export function pingLive(extra?: {
  event?: string;
  path?: string;
  orderId?: string;
  paymentStatus?: "pending" | "paid" | "failed";
  customer?: { name?: string; email?: string; phone?: string };
  cartItems?: ReturnType<typeof cartFromStorage>;
}) {
  if (typeof window === "undefined") return;
  const attribution = getAttribution();
  const path = extra?.path || window.location.pathname;
  const hint = orderHintFromPath(path);
  const orderId = extra?.orderId || hint.orderId;
  const paymentStatus = extra?.paymentStatus || hint.paymentStatus;
  const storedOrder = extra?.cartItems?.length ? null : orderFromStorage(orderId);
  const cartItems = extra?.cartItems?.length
    ? extra.cartItems
    : storedOrder?.items?.length
      ? storedOrder.items.map((item) => ({
          id: String(item.id ?? ""),
          productId: String(item.productId ?? item.id ?? ""),
          name: String(item.name ?? ""),
          color: String(item.color ?? ""),
          size: String(item.size ?? ""),
          quantity: Number(item.quantity ?? 1) || 1,
          price: Number(item.price ?? 0) || 0,
          image: String(item.image ?? ""),
        }))
      : cartFromStorage();
  const referrer = rememberedReferrer();
  const customer = extra?.customer ?? storedOrder?.customer;
  const pageParams = typeof window === "undefined" ? null : new URLSearchParams(window.location.search);
  const body = {
    clientId: attribution.clientId,
    path,
    referrer,
    source: rememberedSource(attribution, referrer),
    title: document.title,
    event: extra?.event ?? "heartbeat",
    cartItems,
    cartValue: cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    attribution,
    utm: {
      source: attribution.utmSource,
      medium: attribution.utmMedium,
      campaign: pageParams?.get("utm_campaign") || "",
      content: pageParams?.get("utm_content") || "",
      term: pageParams?.get("utm_term") || "",
    },
    ...(orderId ? { orderId } : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
    ...(customer && (customer.name || customer.email || customer.phone) ? { customer } : {}),
  };
  const payload = JSON.stringify(body);
  void fetch("/api/live", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/live", new Blob([payload], { type: "application/json" }));
      }
    } catch {
      // ignore
    }
  });
}
