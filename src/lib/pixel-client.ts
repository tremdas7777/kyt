import type { Attribution, PixelContent, PublicTrackingConfig } from "@/lib/tracking-types";

const ATTR_KEY = "kyt-attribution";
const CID_KEY = "kyt-cid";

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
  return {
    fbp: "",
    fbc: "",
    fbclid: "",
    ttclid: "",
    ttp: "",
    gclid: "",
    gbraid: "",
    wbraid: "",
    clientId: "",
  };
}

export function captureAttribution(): Attribution {
  if (typeof window === "undefined") return emptyAttr();
  const params = new URLSearchParams(window.location.search);
  const stored = (() => {
    try {
      return JSON.parse(window.sessionStorage.getItem(ATTR_KEY) || "null") as Attribution | null;
    } catch {
      return null;
    }
  })();

  const next: Attribution = {
    fbp: readCookie("_fbp") || stored?.fbp || "",
    fbc: readCookie("_fbc") || stored?.fbc || "",
    fbclid: params.get("fbclid") || stored?.fbclid || "",
    ttclid: params.get("ttclid") || stored?.ttclid || readCookie("ttclid") || "",
    ttp: readCookie("_ttp") || stored?.ttp || "",
    gclid: params.get("gclid") || stored?.gclid || "",
    gbraid: params.get("gbraid") || stored?.gbraid || "",
    wbraid: params.get("wbraid") || stored?.wbraid || "",
    clientId: readCookie(CID_KEY) || stored?.clientId || "",
  };

  if (!next.clientId) next.clientId = randomId();
  writeCookie(CID_KEY, next.clientId, 730);

  if (!next.fbp) {
    next.fbp = `fb.1.${Date.now()}.${Math.floor(Math.random() * 1e10)}`;
    writeCookie("_fbp", next.fbp);
  }
  if (next.fbclid) {
    next.fbc = `fb.1.${Date.now()}.${next.fbclid}`;
    writeCookie("_fbc", next.fbc);
  }
  if (next.ttclid) writeCookie("ttclid", next.ttclid);
  if (next.gclid) writeCookie("_kyt_gclid", next.gclid);

  try {
    window.sessionStorage.setItem(ATTR_KEY, JSON.stringify(next));
  } catch {
    // ignore quota
  }
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

function initMeta(pixelId: string) {
  if (window.fbq) {
    window.fbq("init", pixelId);
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
  window.fbq("init", pixelId);
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
  if (config.meta.enabled && config.meta.pixelId) initMeta(config.meta.pixelId);
  if (config.tiktok.enabled && config.tiktok.pixelIds.length) initTikTok(config.tiktok.pixelIds);
  if (config.google.enabled && (config.google.measurementId || config.google.adsId)) {
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
  CompletePayment: "Purchase",
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
  const config = publicConfig;
  if (!config) return;
  const eventId = input.eventId || newEventId(input.event.toLowerCase());
  if (!once(input.event, eventId)) return;
  const contents = input.contents ?? [];
  const value = Number(input.value ?? 0);
  const params = contentParams(contents, value);
  const metaName = META_EVENTS[input.event];
  const tiktokName = TIKTOK_EVENTS[input.event];

  if (config.meta.enabled && config.meta.pixelId && window.fbq && metaName) {
    window.fbq("track", metaName, params, { eventID: eventId });
  }
  if (config.tiktok.enabled && window.ttq && tiktokName) {
    window.ttq.track(tiktokName, params, { event_id: eventId });
  }
  if (config.google.enabled && window.gtag) {
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
                : input.event === "Purchase" || input.event === "CompletePayment"
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
      if ((input.event === "Purchase" || input.event === "CompletePayment") && config.google.adsId && config.google.adsPurchaseLabel) {
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
    attribution: getAttribution(),
  };
  if (input.orderId) body["orderId"] = input.orderId;
  if (input.customer) body["customer"] = input.customer;
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
