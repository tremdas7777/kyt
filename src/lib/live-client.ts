import { getAttribution } from "@/lib/pixel-client";
import type { CartItem, LiveStage } from "@/lib/tracking-types";

const SID_KEY = "kyt-sid";

type LiveContext = {
  path: string;
  title: string;
  stage: LiveStage;
  cart: CartItem[];
  customer: { name: string; email: string; phone: string };
  orderId: string;
  paymentStatus: "" | "pending" | "paid" | "failed";
};

const context: LiveContext = {
  path: "/",
  title: "",
  stage: "browsing",
  cart: [],
  customer: { name: "", email: "", phone: "" },
  orderId: "",
  paymentStatus: "",
};

let lastReferrer = "";

export function liveSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const stored = window.localStorage.getItem(SID_KEY);
    if (stored) return stored;
    const next = crypto.randomUUID();
    window.localStorage.setItem(SID_KEY, next);
    return next;
  } catch {
    return "";
  }
}

function utmFromUrl() {
  if (typeof window === "undefined") return { source: "", medium: "", campaign: "", content: "", term: "" };
  const params = new URLSearchParams(window.location.search);
  const read = (key: string) => params.get(key) ?? "";
  const saved = (() => {
    try {
      return JSON.parse(window.sessionStorage.getItem("kyt-utm") || "null") as Record<string, string> | null;
    } catch {
      return null;
    }
  })();
  const next = {
    source: read("utm_source") || saved?.["source"] || "",
    medium: read("utm_medium") || saved?.["medium"] || "",
    campaign: read("utm_campaign") || saved?.["campaign"] || "",
    content: read("utm_content") || saved?.["content"] || "",
    term: read("utm_term") || saved?.["term"] || "",
  };
  try {
    window.sessionStorage.setItem("kyt-utm", JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function setLiveContext(patch: Partial<LiveContext>) {
  Object.assign(context, patch);
  if (patch.customer) {
    context.customer = { ...context.customer, ...patch.customer };
  }
}

export function pingLive(patch?: Partial<LiveContext>) {
  if (typeof window === "undefined") return;
  if (patch) setLiveContext(patch);
  const sessionId = liveSessionId();
  if (!sessionId) return;
  if (!lastReferrer) {
    try {
      lastReferrer = document.referrer && !document.referrer.includes(window.location.host) ? document.referrer : "";
    } catch {
      lastReferrer = "";
    }
  }

  const payload = {
    sessionId,
    path: context.path || window.location.pathname,
    title: context.title || document.title,
    stage: context.stage,
    referrer: lastReferrer,
    utm: utmFromUrl(),
    attribution: getAttribution(),
    cart: context.cart.map((item) => ({
      productId: item.productId,
      name: item.name,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      price: item.price,
      image: item.image,
    })),
    customer: context.customer,
    orderId: context.orderId,
    paymentStatus: context.paymentStatus,
  };

  try {
    void fetch("/api/live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // ignore
  }
}
