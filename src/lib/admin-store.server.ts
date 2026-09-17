import { emptyAttribution as blankAttribution, keepExternalReferrer } from "@/lib/ad-origin";
import { HISTORY_MS } from "@/lib/live-window";
import { getRuntimeEnv } from "@/lib/legacy.server";
import type { Attribution, LiveSession, StoreOrder, TrackingLog, TrackingSettings } from "@/lib/tracking-types";
import { emptyPaymentSettings, isPixGateway, type PaymentSettings } from "@/lib/payment-types";

type AdminState = {
  passwordHash: string;
  passwordSalt: string;
  passwordEnvFingerprint?: string;
  tracking: TrackingSettings;
  payment: PaymentSettings;
  orders: StoreOrder[];
  events: TrackingLog[];
  sessions: LiveSession[];
  abandoned: LiveSession[];
};

const FILE_NAME = "kyt-admin.json";
const LIVE_FILE_NAME = "kyt-live.json";
const ORDERS_FILE_NAME = "kyt-orders.json";
const KV_KEY = "kyt-admin-v1";
const LIVE_KV_KEY = "kyt-live-sessions-v1";
const ORDERS_KV_KEY = "kyt-orders-v1";
const CACHE_URL = "https://kyt.internal/admin-store-v1";
const LIVE_CACHE_URL = "https://kyt.internal/live-sessions-v1";
const ORDERS_CACHE_URL = "https://kyt.internal/orders-v1";
const TRACKING_FILE_NAME = "kyt-tracking.json";
const TRACKING_KV_KEY = "kyt-tracking-v1";
const TRACKING_CACHE_URL = "https://kyt.internal/tracking-v1";
const MAX_ORDERS = 50_000;
const MAX_EVENTS = 8000;
const MAX_SESSIONS = 8000;
const MAX_ABANDONED = 50_000;
const SESSION_TTL = HISTORY_MS;
const TRAIL_MAX = 250;

function emptyTracking(): TrackingSettings {
  return {
    tiktok: {
      enabled: false,
      pixelIds: [],
      accessToken: "",
      testEventCode: "",
      markAsPaidOnPixCreate: false,
    },
    meta: {
      enabled: false,
      pixelId: "",
      accessToken: "",
      testEventCode: "",
    },
    google: {
      enabled: false,
      measurementId: "",
      apiSecret: "",
      adsId: "",
      adsPurchaseLabel: "",
    },
    pushcut: {
      pendingUrl: "",
      paidUrl: "",
    },
  };
}

function memorySlot(): { state?: AdminState } {
  const g = globalThis as typeof globalThis & { __kytAdmin?: { state?: AdminState } };
  if (!g.__kytAdmin) g.__kytAdmin = {};
  return g.__kytAdmin;
}

function lookupEnv(name: string): string {
  const runtime = getRuntimeEnv();
  if (runtime) {
    const direct = runtime[name];
    if (typeof direct === "string" && direct.trim()) return direct.trim();
  }
  if (typeof process !== "undefined" && process.env) {
    const value = String(process.env[name] ?? "").trim();
    if (value) return value;
  }
  return "";
}

function seedTrackingFromEnv(tracking: TrackingSettings, fresh: boolean): TrackingSettings {
  const envTiktok = [
    lookupEnv("TIKTOK_PIXEL_ID"),
    ...lookupEnv("TIKTOK_PIXEL_IDS")
      .split(/[,\s]+/)
      .map((id) => id.trim()),
  ].filter(Boolean);
  const uniqueTiktok = Array.from(new Set(tracking.tiktok.pixelIds.length ? tracking.tiktok.pixelIds : envTiktok));
  const metaPixel = tracking.meta.pixelId || lookupEnv("META_PIXEL_ID") || lookupEnv("FACEBOOK_PIXEL_ID");
  const gaId = tracking.google.measurementId || lookupEnv("GA_MEASUREMENT_ID") || lookupEnv("GOOGLE_MEASUREMENT_ID");

  return {
    tiktok: {
      enabled: tracking.tiktok.enabled || (fresh && uniqueTiktok.length > 0),
      pixelIds: uniqueTiktok,
      accessToken: tracking.tiktok.accessToken || lookupEnv("TIKTOK_ACCESS_TOKEN"),
      testEventCode: tracking.tiktok.testEventCode || lookupEnv("TIKTOK_TEST_EVENT_CODE"),
      markAsPaidOnPixCreate: tracking.tiktok.markAsPaidOnPixCreate,
    },
    meta: {
      enabled: tracking.meta.enabled || Boolean(metaPixel),
      pixelId: metaPixel,
      accessToken: tracking.meta.accessToken || lookupEnv("META_CAPI_TOKEN") || lookupEnv("FACEBOOK_CAPI_TOKEN"),
      testEventCode: tracking.meta.testEventCode || lookupEnv("META_TEST_EVENT_CODE"),
    },
    google: {
      enabled: tracking.google.enabled || (fresh && Boolean(gaId)),
      measurementId: gaId,
      apiSecret: tracking.google.apiSecret || lookupEnv("GA_API_SECRET"),
      adsId: tracking.google.adsId || lookupEnv("GOOGLE_ADS_ID"),
      adsPurchaseLabel: tracking.google.adsPurchaseLabel || lookupEnv("GOOGLE_ADS_PURCHASE_LABEL"),
    },
    pushcut: {
      pendingUrl: tracking.pushcut?.pendingUrl || lookupEnv("PUSHCUT_PENDING_URL"),
      paidUrl: tracking.pushcut?.paidUrl || lookupEnv("PUSHCUT_PAID_URL"),
    },
  };
}

function seedPaymentFromEnv(payment: PaymentSettings, _fresh: boolean): PaymentSettings {
  const publicKey = payment.magicpay.publicKey || lookupEnv("MAGICPAY_PUBLIC_KEY");
  const secretKey = payment.magicpay.secretKey || lookupEnv("MAGICPAY_SECRET_KEY");
  const envGateway = lookupEnv("MAGICPAY_PIX_GATEWAY");
  const fromEnv = isPixGateway(envGateway) ? envGateway : null;
  return {
    pixGateway: payment.pixGatewayChosen
      ? payment.pixGateway
      : fromEnv || payment.pixGateway || "magicpay",
    pixGatewayChosen: payment.pixGatewayChosen || Boolean(fromEnv),
    cardEnabled: payment.cardEnabledChosen === true && payment.cardEnabled === true,
    cardEnabledChosen: payment.cardEnabledChosen === true,
    ...(payment.updatedAt ? { updatedAt: payment.updatedAt } : {}),
    magicpay: {
      publicKey,
      secretKey,
      apiUrl:
        payment.magicpay.apiUrl ||
        lookupEnv("MAGICPAY_API_URL") ||
        emptyPaymentSettings().magicpay.apiUrl,
    },
  };
}

function asPayment(raw: unknown): PaymentSettings {
  const rec = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const magic = rec["magicpay"] && typeof rec["magicpay"] === "object" ? (rec["magicpay"] as Record<string, unknown>) : {};
  const base = emptyPaymentSettings();
  const stored = isPixGateway(rec["pixGateway"]) ? rec["pixGateway"] : base.pixGateway;
  const chosen = rec["pixGatewayChosen"] === true;
  const updatedAt = String(rec["updatedAt"] ?? "").trim();
  return {
    pixGateway: isPixGateway(stored) ? stored : "magicpay",
    pixGatewayChosen: chosen || isPixGateway(stored),
    cardEnabled: rec["cardEnabledChosen"] === true && rec["cardEnabled"] === true,
    cardEnabledChosen: rec["cardEnabledChosen"] === true,
    ...(updatedAt ? { updatedAt } : {}),
    magicpay: {
      publicKey: String(magic["publicKey"] ?? "").trim(),
      secretKey: String(magic["secretKey"] ?? "").trim(),
      apiUrl: String(magic["apiUrl"] ?? "").trim() || base.magicpay.apiUrl,
    },
  };
}

function paymentStamp(payment: PaymentSettings | undefined): number {
  return Date.parse(payment?.updatedAt ?? "") || 0;
}

function pickSecret(left: string | undefined, right: string | undefined): string {
  return (right ?? "").trim() || (left ?? "").trim();
}

function mergeTracking(left: TrackingSettings | undefined, right: TrackingSettings | undefined): TrackingSettings {
  const a = left ?? emptyTracking();
  const b = right ?? emptyTracking();
  const pixelIds = Array.from(new Set([...a.tiktok.pixelIds, ...b.tiktok.pixelIds].map((id) => id.trim()).filter(Boolean)));
  return {
    tiktok: {
      enabled: a.tiktok.enabled || b.tiktok.enabled,
      pixelIds: pixelIds.length ? pixelIds : a.tiktok.pixelIds,
      accessToken: pickSecret(a.tiktok.accessToken, b.tiktok.accessToken),
      testEventCode: pickSecret(a.tiktok.testEventCode, b.tiktok.testEventCode),
      markAsPaidOnPixCreate: a.tiktok.markAsPaidOnPixCreate || b.tiktok.markAsPaidOnPixCreate,
    },
    meta: {
      enabled: a.meta.enabled || b.meta.enabled,
      pixelId: pickSecret(a.meta.pixelId, b.meta.pixelId),
      accessToken: pickSecret(a.meta.accessToken, b.meta.accessToken),
      testEventCode: pickSecret(a.meta.testEventCode, b.meta.testEventCode),
    },
    google: {
      enabled: a.google.enabled || b.google.enabled,
      measurementId: pickSecret(a.google.measurementId, b.google.measurementId),
      apiSecret: pickSecret(a.google.apiSecret, b.google.apiSecret),
      adsId: pickSecret(a.google.adsId, b.google.adsId),
      adsPurchaseLabel: pickSecret(a.google.adsPurchaseLabel, b.google.adsPurchaseLabel),
    },
    pushcut: {
      pendingUrl: pickSecret(a.pushcut?.pendingUrl, b.pushcut?.pendingUrl),
      paidUrl: pickSecret(a.pushcut?.paidUrl, b.pushcut?.paidUrl),
    },
  };
}

function mergePayment(left: PaymentSettings | undefined, right: PaymentSettings | undefined): PaymentSettings {
  const a = asPayment(left ?? emptyPaymentSettings());
  const b = asPayment(right ?? emptyPaymentSettings());
  const pick =
    a.pixGatewayChosen && !b.pixGatewayChosen
      ? a
      : b.pixGatewayChosen && !a.pixGatewayChosen
        ? b
        : paymentStamp(b) >= paymentStamp(a)
          ? b
          : a;
  const older = pick === b ? a : b;
  return {
    pixGateway: pick.pixGatewayChosen
      ? pick.pixGateway
      : older.pixGatewayChosen
        ? older.pixGateway
        : pick.pixGateway || "magicpay",
    pixGatewayChosen: pick.pixGatewayChosen || older.pixGatewayChosen,
    cardEnabled:
      (pick.cardEnabledChosen && !pick.cardEnabled) || (older.cardEnabledChosen && !older.cardEnabled)
        ? false
        : pick.cardEnabledChosen
          ? pick.cardEnabled
          : older.cardEnabledChosen
            ? older.cardEnabled
            : false,
    cardEnabledChosen: pick.cardEnabledChosen || older.cardEnabledChosen,
    ...(pick.updatedAt || older.updatedAt ? { updatedAt: pick.updatedAt || older.updatedAt } : {}),
    magicpay: {
      publicKey: pick.magicpay.publicKey || older.magicpay.publicKey,
      secretKey: pick.magicpay.secretKey || older.magicpay.secretKey,
      apiUrl: pick.magicpay.apiUrl || older.magicpay.apiUrl,
    },
  };
}

function normalizeState(raw: unknown): AdminState {
  const rec = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const trackingRaw = rec["tracking"] && typeof rec["tracking"] === "object" ? (rec["tracking"] as Record<string, unknown>) : {};
  const tiktok = trackingRaw["tiktok"] && typeof trackingRaw["tiktok"] === "object" ? (trackingRaw["tiktok"] as Record<string, unknown>) : {};
  const meta = trackingRaw["meta"] && typeof trackingRaw["meta"] === "object" ? (trackingRaw["meta"] as Record<string, unknown>) : {};
  const google = trackingRaw["google"] && typeof trackingRaw["google"] === "object" ? (trackingRaw["google"] as Record<string, unknown>) : {};
  const pushcutRaw = trackingRaw["pushcut"] && typeof trackingRaw["pushcut"] === "object" ? (trackingRaw["pushcut"] as Record<string, unknown>) : {};
  const pixelIds = Array.isArray(tiktok["pixelIds"])
    ? tiktok["pixelIds"].map((id) => String(id).trim()).filter(Boolean)
    : String(tiktok["pixelId"] ?? "")
        .split(/[,\s]+/)
        .map((id) => id.trim())
        .filter(Boolean);

  const base = emptyTracking();
  const tracking: TrackingSettings = {
    tiktok: {
      enabled: tiktok["enabled"] === true || (tiktok["enabled"] !== false && pixelIds.length > 0),
      pixelIds,
      accessToken: String(tiktok["accessToken"] ?? ""),
      testEventCode: String(tiktok["testEventCode"] ?? ""),
      markAsPaidOnPixCreate: tiktok["markAsPaidOnPixCreate"] === true,
    },
    meta: {
      enabled: meta["enabled"] === true || (meta["enabled"] !== false && Boolean(meta["pixelId"])),
      pixelId: String(meta["pixelId"] ?? ""),
      accessToken: String(meta["accessToken"] ?? ""),
      testEventCode: String(meta["testEventCode"] ?? ""),
    },
    google: {
      enabled: google["enabled"] === true || (google["enabled"] !== false && Boolean(google["measurementId"])),
      measurementId: String(google["measurementId"] ?? ""),
      apiSecret: String(google["apiSecret"] ?? ""),
      adsId: String(google["adsId"] ?? ""),
      adsPurchaseLabel: String(google["adsPurchaseLabel"] ?? ""),
    },
    pushcut: {
      pendingUrl: String(pushcutRaw["pendingUrl"] ?? ""),
      paidUrl: String(pushcutRaw["paidUrl"] ?? ""),
    },
  };

  return {
    passwordHash: String(rec["passwordHash"] ?? ""),
    passwordSalt: String(rec["passwordSalt"] ?? ""),
    ...(rec["passwordEnvFingerprint"] ? { passwordEnvFingerprint: String(rec["passwordEnvFingerprint"]) } : {}),
    tracking: {
      ...base,
      ...tracking,
      tiktok: { ...base.tiktok, ...tracking.tiktok },
      meta: { ...base.meta, ...tracking.meta },
      google: { ...base.google, ...tracking.google },
      pushcut: { ...base.pushcut, ...tracking.pushcut },
    },
    payment: asPayment(rec["payment"]),
    orders: Array.isArray(rec["orders"]) ? (rec["orders"] as StoreOrder[]) : [],
    events: Array.isArray(rec["events"]) ? (rec["events"] as TrackingLog[]) : [],
    sessions: Array.isArray(rec["sessions"]) ? (rec["sessions"] as LiveSession[]) : [],
    abandoned: Array.isArray(rec["abandoned"]) ? (rec["abandoned"] as LiveSession[]) : [],
  };
}

function sessionStamp(session: LiveSession): number {
  return Math.max(Date.parse(session.lastSeen) || 0, Date.parse(session.firstSeen) || 0);
}

function mergeTrail(left: LiveSession["trail"] | undefined, right: LiveSession["trail"] | undefined): LiveSession["trail"] {
  const map = new Map<string, { at: string; label: string }>();
  for (const entry of [...(left ?? []), ...(right ?? [])]) {
    const label = String(entry.label ?? "").trim();
    if (!label) continue;
    const key = `${entry.at}|${label}`;
    if (!map.has(key)) map.set(key, { at: entry.at, label });
  }
  const all = [...map.values()].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const firstByPath = new Map<string, { at: string; label: string }>();
  for (const entry of all) {
    if (!firstByPath.has(entry.label)) firstByPath.set(entry.label, entry);
  }
  const kept = new Set(firstByPath.values());
  const extra = all.filter((entry) => !kept.has(entry)).reverse();
  return [...firstByPath.values(), ...extra].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, TRAIL_MAX);
}

function mergeSessions(left: LiveSession[], right: LiveSession[]): LiveSession[] {
  const map = new Map<string, LiveSession>();
  for (const session of [...left, ...right]) {
    if (!session?.id) continue;
    const current = map.get(session.id);
    if (!current) {
      map.set(session.id, session);
      continue;
    }
    const newer = sessionStamp(session) >= sessionStamp(current) ? session : current;
    const older = newer === session ? current : session;
    const firstSeen = Date.parse(older.firstSeen) <= Date.parse(newer.firstSeen) ? older.firstSeen : newer.firstSeen;
    map.set(session.id, {
      ...older,
      ...newer,
      firstSeen,
      lastSeen: sessionStamp(newer) >= sessionStamp(older) ? newer.lastSeen : older.lastSeen,
      views: Math.max(Number(older.views) || 0, Number(newer.views) || 0),
      trail: mergeTrail(older.trail, newer.trail),
      source: keepSource(newer.source, older.source),
      referrer: keepExternalReferrer(newer.referrer, older.referrer),
      attribution: mergeFilled(older.attribution ?? emptyAttr(), newer.attribution),
      utm: {
        source: newer.utm?.source || older.utm?.source || "",
        medium: newer.utm?.medium || older.utm?.medium || "",
        campaign: newer.utm?.campaign || older.utm?.campaign || "",
        content: newer.utm?.content || older.utm?.content || "",
        term: newer.utm?.term || older.utm?.term || "",
      },
      cart: keepCart(newer, older).cart,
      cartValue: keepCart(newer, older).cartValue,
      orderId: newer.orderId || older.orderId,
      paymentStatus:
        newer.paymentStatus === "paid" || older.paymentStatus === "paid"
          ? "paid"
          : newer.paymentStatus || older.paymentStatus,
      customer: {
        name: newer.customer?.name || older.customer?.name || "",
        email: newer.customer?.email || older.customer?.email || "",
        phone: newer.customer?.phone || older.customer?.phone || "",
      },
    });
  }
  const now = Date.now();
  const merged = [...map.values()]
    .filter((session) => hasOpenCart(session) || now - sessionStamp(session) < SESSION_TTL)
    .sort((a, b) => sessionStamp(b) - sessionStamp(a));
  const protectedSessions = merged.filter(hasOpenCart);
  const rest = merged.filter((session) => !hasOpenCart(session));
  const room = Math.max(0, MAX_SESSIONS - protectedSessions.length);
  return [...protectedSessions, ...rest.slice(0, room)];
}

function hasOpenCart(session: LiveSession): boolean {
  if (session.paymentStatus === "paid") return false;
  if (session.paymentStatus === "pending") return true;
  return Array.isArray(session.cart) && session.cart.length > 0;
}

function keepCart(newer: LiveSession, older: LiveSession): { cart: LiveSession["cart"]; cartValue: number } {
  const paid = newer.paymentStatus === "paid" || older.paymentStatus === "paid";
  const newerEmpty = !Array.isArray(newer.cart) || newer.cart.length === 0;
  const olderHas = Array.isArray(older.cart) && older.cart.length > 0;
  if (!paid && newerEmpty && olderHas) {
    return { cart: older.cart, cartValue: Number(older.cartValue) || 0 };
  }
  if (Array.isArray(newer.cart)) {
    return { cart: newer.cart, cartValue: Number(newer.cartValue) || 0 };
  }
  return { cart: older.cart ?? [], cartValue: Number(newer.cartValue) || Number(older.cartValue) || 0 };
}

function mergeAbandoned(left: LiveSession[], right: LiveSession[]): LiveSession[] {
  const map = new Map<string, LiveSession>();
  for (const session of [...left, ...right]) {
    if (!session?.id) continue;
    const current = map.get(session.id);
    if (!current) {
      map.set(session.id, session);
      continue;
    }
    const newer = sessionStamp(session) >= sessionStamp(current) ? session : current;
    const older = newer === session ? current : session;
    const firstSeen = Date.parse(older.firstSeen) <= Date.parse(newer.firstSeen) ? older.firstSeen : newer.firstSeen;
    const cart = keepCart(newer, older);
    map.set(session.id, {
      ...older,
      ...newer,
      firstSeen,
      lastSeen: sessionStamp(newer) >= sessionStamp(older) ? newer.lastSeen : older.lastSeen,
      cart: cart.cart,
      cartValue: cart.cartValue,
      orderId: newer.orderId || older.orderId,
      paymentStatus:
        newer.paymentStatus === "paid" || older.paymentStatus === "paid"
          ? "paid"
          : newer.paymentStatus || older.paymentStatus,
      customer: {
        name: newer.customer?.name || older.customer?.name || "",
        email: newer.customer?.email || older.customer?.email || "",
        phone: newer.customer?.phone || older.customer?.phone || "",
      },
      attribution: { ...older.attribution, ...newer.attribution },
    });
  }
  return [...map.values()]
    .filter(hasOpenCart)
    .sort((a, b) => sessionStamp(b) - sessionStamp(a))
    .slice(0, MAX_ABANDONED);
}

function rememberAbandoned(state: AdminState, session: LiveSession) {
  if (!Array.isArray(state.abandoned)) state.abandoned = [];
  if (session.paymentStatus === "paid") {
    state.abandoned = state.abandoned.filter(
      (entry) => entry.id !== session.id && (!session.orderId || entry.orderId !== session.orderId),
    );
    return;
  }
  if (!hasOpenCart(session)) return;
  state.abandoned = mergeAbandoned(state.abandoned, [session]);
}

function mergeEvents(left: TrackingLog[], right: TrackingLog[]): TrackingLog[] {
  const map = new Map<string, TrackingLog>();
  for (const event of [...left, ...right]) {
    const key = event.id || `${event.at}|${event.event}|${event.eventId}`;
    if (!map.has(key)) map.set(key, event);
  }
  return [...map.values()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, MAX_EVENTS);
}

function mergeOrders(left: StoreOrder[], right: StoreOrder[]): StoreOrder[] {
  const rank = (status: StoreOrder["paymentStatus"] | undefined) =>
    status === "paid" ? 3 : status === "pending" ? 2 : status === "failed" ? 1 : 0;
  const map = new Map<string, StoreOrder>();
  for (const order of [...left, ...right]) {
    const key = order.id || order.referenceId || order.transactionId || "";
    if (!key) continue;
    const current = map.get(key);
    if (!current) {
      map.set(key, order);
      continue;
    }
    const newer = Date.parse(order.createdAt) >= Date.parse(current.createdAt) ? order : current;
    const older = newer === order ? current : order;
    map.set(key, {
      ...older,
      ...newer,
      items: newer.items.length ? newer.items : older.items,
      paymentStatus: rank(newer.paymentStatus) >= rank(older.paymentStatus) ? newer.paymentStatus : older.paymentStatus,
      errorMessage:
        rank(newer.paymentStatus) >= rank(older.paymentStatus)
          ? newer.paymentStatus === "failed"
            ? newer.errorMessage || older.errorMessage
            : undefined
          : older.paymentStatus === "failed"
            ? older.errorMessage
            : newer.errorMessage,
      purchaseSent: Boolean(older.purchaseSent || newer.purchaseSent),
    });
  }
  return [...map.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, MAX_ORDERS);
}

type KvLike = {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string) => Promise<void>;
};

function isKvLike(value: unknown): value is KvLike {
  return Boolean(value && typeof value === "object" && "get" in value && "put" in value && typeof (value as KvLike).get === "function" && typeof (value as KvLike).put === "function");
}

function kvBinding(): KvLike | null {
  const runtime = getRuntimeEnv();
  if (!runtime) return null;
  const names = ["KYT_STORE", "kyt_store", "KV", "STORE", "ADMIN_KV", "ADMIN_STORE"];
  for (const name of names) {
    const binding = runtime[name];
    if (isKvLike(binding)) return binding;
  }
  for (const nestedKey of ["bindings", "env", "SECRETS", "secrets"]) {
    const nested = runtime[nestedKey];
    if (!nested || typeof nested !== "object") continue;
    for (const name of names) {
      const binding = (nested as Record<string, unknown>)[name];
      if (isKvLike(binding)) return binding;
    }
  }
  return null;
}

async function getCache(): Promise<Cache | null> {
  try {
    const cachesObj = globalThis.caches as CacheStorage & { default?: Cache };
    if (cachesObj && "default" in cachesObj && cachesObj.default) return cachesObj.default;
    if (cachesObj && typeof cachesObj.open === "function") return await cachesObj.open("kyt-admin");
  } catch {
    // ignore
  }
  return null;
}

async function readBackends(): Promise<string | null> {
  const kv = kvBinding();
  if (kv) {
    try {
      const value = await kv.get(KV_KEY);
      if (typeof value === "string" && value) return value;
    } catch {
      // continue
    }
  }

  try {
    const cache = await getCache();
    const hit = cache ? await cache.match(CACHE_URL) : null;
    if (hit) return await hit.text();
  } catch {
    // continue
  }

  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    return await readFile(join(process.cwd(), ".data", FILE_NAME), "utf8");
  } catch {
    return null;
  }
}

async function writeBackends(raw: string): Promise<void> {
  const kv = kvBinding();
  if (kv) {
    try {
      await kv.put(KV_KEY, raw);
    } catch {
      // continue
    }
  }

  try {
    const cache = await getCache();
    if (cache) {
      await cache.put(
        CACHE_URL,
        new Response(raw, {
          headers: { "Content-Type": "application/json", "Cache-Control": "max-age=31536000" },
        }),
      );
    }
  } catch {
    // continue
  }

  try {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const dir = join(process.cwd(), ".data");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, FILE_NAME), raw, "utf8");
  } catch {
    // Cloudflare workers have no filesystem
  }
}

async function readLiveShard(): Promise<LiveSession[]> {
  const kv = kvBinding();
  if (kv) {
    try {
      const value = await kv.get(LIVE_KV_KEY);
      if (typeof value === "string" && value) {
        const parsed = JSON.parse(value) as unknown;
        if (Array.isArray(parsed)) return parsed as LiveSession[];
      }
    } catch {
      // continue
    }
  }
  try {
    const cache = await getCache();
    const hit = cache ? await cache.match(LIVE_CACHE_URL) : null;
    if (hit) {
      const parsed = JSON.parse(await hit.text()) as unknown;
      if (Array.isArray(parsed)) return parsed as LiveSession[];
    }
  } catch {
    // continue
  }
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const parsed = JSON.parse(await readFile(join(process.cwd(), ".data", LIVE_FILE_NAME), "utf8")) as unknown;
    if (Array.isArray(parsed)) return parsed as LiveSession[];
  } catch {
    // ignore
  }
  return [];
}

async function writeLiveShard(sessions: LiveSession[]): Promise<void> {
  const raw = JSON.stringify(sessions);
  const kv = kvBinding();
  if (kv) {
    try {
      await kv.put(LIVE_KV_KEY, raw);
    } catch {
      // continue
    }
  }
  try {
    const cache = await getCache();
    if (cache) {
      await cache.put(
        LIVE_CACHE_URL,
        new Response(raw, {
          headers: { "Content-Type": "application/json", "Cache-Control": "max-age=31536000" },
        }),
      );
    }
  } catch {
    // continue
  }
  try {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const dir = join(process.cwd(), ".data");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, LIVE_FILE_NAME), raw, "utf8");
  } catch {
    // Cloudflare workers have no filesystem
  }
}

async function readOrdersShard(): Promise<StoreOrder[]> {
  const kv = kvBinding();
  if (kv) {
    try {
      const value = await kv.get(ORDERS_KV_KEY);
      if (typeof value === "string" && value) {
        const parsed = JSON.parse(value) as unknown;
        if (Array.isArray(parsed)) return parsed as StoreOrder[];
      }
    } catch {
      // continue
    }
  }
  try {
    const cache = await getCache();
    const hit = cache ? await cache.match(ORDERS_CACHE_URL) : null;
    if (hit) {
      const parsed = JSON.parse(await hit.text()) as unknown;
      if (Array.isArray(parsed)) return parsed as StoreOrder[];
    }
  } catch {
    // continue
  }
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const parsed = JSON.parse(await readFile(join(process.cwd(), ".data", ORDERS_FILE_NAME), "utf8")) as unknown;
    if (Array.isArray(parsed)) return parsed as StoreOrder[];
  } catch {
    // ignore
  }
  return [];
}

async function writeOrdersShard(orders: StoreOrder[]): Promise<void> {
  const raw = JSON.stringify(orders);
  const kv = kvBinding();
  if (kv) {
    try {
      await kv.put(ORDERS_KV_KEY, raw);
    } catch {
      // continue
    }
  }
  try {
    const cache = await getCache();
    if (cache) {
      await cache.put(
        ORDERS_CACHE_URL,
        new Response(raw, {
          headers: { "Content-Type": "application/json", "Cache-Control": "max-age=31536000" },
        }),
      );
    }
  } catch {
    // continue
  }
  try {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const dir = join(process.cwd(), ".data");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, ORDERS_FILE_NAME), raw, "utf8");
  } catch {
    // Cloudflare workers have no filesystem
  }
}

async function readTrackingShard(): Promise<TrackingSettings | null> {
  const kv = kvBinding();
  if (kv) {
    try {
      const value = await kv.get(TRACKING_KV_KEY);
      if (typeof value === "string" && value) {
        const parsed = JSON.parse(value) as unknown;
        if (parsed && typeof parsed === "object") return mergeTracking(emptyTracking(), parsed as TrackingSettings);
      }
    } catch {
      // continue
    }
  }
  try {
    const cache = await getCache();
    const hit = cache ? await cache.match(TRACKING_CACHE_URL) : null;
    if (hit) {
      const parsed = JSON.parse(await hit.text()) as unknown;
      if (parsed && typeof parsed === "object") return mergeTracking(emptyTracking(), parsed as TrackingSettings);
    }
  } catch {
    // continue
  }
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const parsed = JSON.parse(await readFile(join(process.cwd(), ".data", TRACKING_FILE_NAME), "utf8")) as unknown;
    if (parsed && typeof parsed === "object") return mergeTracking(emptyTracking(), parsed as TrackingSettings);
  } catch {
    // ignore
  }
  return null;
}

async function writeTrackingShard(tracking: TrackingSettings): Promise<void> {
  const raw = JSON.stringify(tracking);
  const kv = kvBinding();
  if (kv) {
    try {
      await kv.put(TRACKING_KV_KEY, raw);
    } catch {
      // continue
    }
  }
  try {
    const cache = await getCache();
    if (cache) {
      await cache.put(
        TRACKING_CACHE_URL,
        new Response(raw, {
          headers: { "Content-Type": "application/json", "Cache-Control": "max-age=31536000" },
        }),
      );
    }
  } catch {
    // continue
  }
  try {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const dir = join(process.cwd(), ".data");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, TRACKING_FILE_NAME), raw, "utf8");
  } catch {
    // Cloudflare workers have no filesystem
  }
}

let chain: Promise<unknown> = Promise.resolve();

function lock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function loadState(): Promise<AdminState> {
  const mem = memorySlot();
  const raw = await readBackends();
  const fresh = !raw;
  const disk = raw ? normalizeState(JSON.parse(raw) as unknown) : normalizeState({});
  let state = mem.state;
  if (!state) {
    state = disk;
  } else {
    state.sessions = mergeSessions(disk.sessions, state.sessions);
    state.abandoned = mergeAbandoned(disk.abandoned ?? [], state.abandoned ?? []);
    state.events = mergeEvents(disk.events, state.events);
    state.orders = mergeOrders(disk.orders, state.orders);
    state.payment = mergePayment(disk.payment, state.payment);
    state.tracking = mergeTracking(disk.tracking, state.tracking);
    if (!state.passwordHash && disk.passwordHash) {
      state.passwordHash = disk.passwordHash;
      state.passwordSalt = disk.passwordSalt;
      if (disk.passwordEnvFingerprint) state.passwordEnvFingerprint = disk.passwordEnvFingerprint;
    }
  }
  if (!Array.isArray(state.sessions)) state.sessions = [];
  if (!Array.isArray(state.abandoned)) state.abandoned = [];
  try {
    const shard = await readLiveShard();
    if (shard.length) state.sessions = mergeSessions(shard, state.sessions);
  } catch {
    // keep merged memory + disk
  }
  try {
    const orderShard = await readOrdersShard();
    if (orderShard.length) state.orders = mergeOrders(orderShard, state.orders ?? []);
  } catch {
    // keep merged orders
  }
  try {
    const trackingShard = await readTrackingShard();
    if (trackingShard) state.tracking = mergeTracking(trackingShard, state.tracking);
  } catch {
    // keep merged tracking
  }
  state.abandoned = mergeAbandoned(state.abandoned, state.sessions.filter(hasOpenCart));
  let dirty = fresh && !mem.state;
  const envPassword = lookupEnv("ADMIN_PASSWORD");
  if (envPassword) {
    const fingerprint = await hashPassword(envPassword, "env-fingerprint");
    if (!state.passwordHash || state.passwordEnvFingerprint !== fingerprint) {
      const salt = crypto.randomUUID();
      state.passwordSalt = salt;
      state.passwordHash = await hashPassword(envPassword, salt);
      state.passwordEnvFingerprint = fingerprint;
      dirty = true;
    }
  }
  state.tracking = seedTrackingFromEnv(state.tracking, fresh && !disk.passwordHash);
  state.payment = seedPaymentFromEnv(state.payment ?? emptyPaymentSettings(), fresh && !disk.passwordHash);
  mem.state = state;
  if (dirty) await saveState(state);
  return state;
}

async function persistState(state: AdminState): Promise<void> {
  memorySlot().state = state;
  await Promise.all([
    writeBackends(JSON.stringify(state)),
    writeLiveShard(state.sessions ?? []),
    writeOrdersShard(state.orders ?? []),
    writeTrackingShard(state.tracking),
  ]);
}

async function saveState(state: AdminState): Promise<void> {
  try {
    const raw = await readBackends();
    if (raw) {
      const prev = normalizeState(JSON.parse(raw) as unknown);
      state.sessions = mergeSessions(prev.sessions, state.sessions);
      state.abandoned = mergeAbandoned(prev.abandoned ?? [], state.abandoned ?? []);
      state.events = mergeEvents(prev.events, state.events);
      state.orders = mergeOrders(prev.orders, state.orders);
      state.payment = mergePayment(prev.payment, state.payment);
      state.tracking = mergeTracking(prev.tracking, state.tracking);
    }
  } catch {
    // keep in-memory history if backends are unreachable
  }
  await persistState(state);
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function getAdminState(): Promise<AdminState> {
  return lock(() => loadState());
}

export async function updateAdminState(mutator: (state: AdminState) => void | Promise<void>): Promise<AdminState> {
  return lock(async () => {
    const state = await loadState();
    await mutator(state);
    await saveState(state);
    return state;
  });
}

export async function getTrackingSettings(): Promise<TrackingSettings> {
  const state = await getAdminState();
  return state.tracking;
}

export async function saveTrackingSettings(next: TrackingSettings): Promise<TrackingSettings> {
  const state = await updateAdminState((current) => {
    const prev = current.tracking ?? emptyTracking();
    current.tracking = {
      ...next,
      tiktok: {
        ...next.tiktok,
        accessToken: next.tiktok.accessToken || prev.tiktok.accessToken,
      },
      meta: {
        ...next.meta,
        accessToken: next.meta.accessToken || prev.meta.accessToken,
      },
      google: {
        ...next.google,
        apiSecret: next.google.apiSecret || prev.google.apiSecret,
      },
      pushcut: {
        pendingUrl: (next.pushcut?.pendingUrl ?? prev.pushcut?.pendingUrl ?? "").trim(),
        paidUrl: (next.pushcut?.paidUrl ?? prev.pushcut?.paidUrl ?? "").trim(),
      },
    };
  });
  return state.tracking;
}

export async function getPaymentSettings(): Promise<PaymentSettings> {
  const state = await getAdminState();
  return state.payment ?? emptyPaymentSettings();
}

export async function savePaymentSettings(next: PaymentSettings): Promise<PaymentSettings> {
  const state = await updateAdminState((current) => {
    const prev = current.payment ?? emptyPaymentSettings();
    current.payment = asPayment({
      ...next,
      pixGatewayChosen: true,
      cardEnabledChosen: true,
      updatedAt: new Date().toISOString(),
      magicpay: {
        publicKey: next.magicpay.publicKey || prev.magicpay.publicKey,
        secretKey: next.magicpay.secretKey || prev.magicpay.secretKey,
        apiUrl: next.magicpay.apiUrl || prev.magicpay.apiUrl,
      },
    });
  });
  return state.payment;
}

export function emptyAttr(): Attribution {
  return blankAttribution();
}

function blankCheckoutCustomer(): StoreOrder["customer"] {
  return {
    name: "",
    email: "",
    phone: "",
    cpf: "",
    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    payment: "pix",
  };
}

function itemsFromLiveCart(cart: LiveSession["cart"] | undefined): StoreOrder["items"] {
  return (cart ?? []).map((item, index) => ({
    id: item.productId ? `${item.productId}::${item.color}::${item.size}` : `item-${index}`,
    productId: item.productId || item.name,
    name: item.name || item.productId,
    color: item.color || "",
    size: item.size || "",
    image: item.image || "",
    price: Number(item.price) || 0,
    quantity: Math.max(1, Number(item.quantity) || 1),
  }));
}

export function storeOrderFromSession(session: LiveSession): StoreOrder | null {
  const id = (session.orderId ?? "").trim();
  if (!id) return null;
  const paymentStatus =
    session.paymentStatus === "paid" || session.paymentStatus === "failed" ? session.paymentStatus : "pending";
  const items = itemsFromLiveCart(session.cart);
  const total = Number(session.cartValue) || items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return {
    id,
    createdAt: session.firstSeen || session.lastSeen || new Date().toISOString(),
    items,
    customer: {
      ...blankCheckoutCustomer(),
      name: session.customer?.name || "",
      email: session.customer?.email || "",
      phone: session.customer?.phone || "",
    },
    subtotal: total,
    shipping: 0,
    shippingMethod: "gratis",
    total,
    discount: 0,
    paymentStatus,
    eventId: `live_${id}`,
    attribution: { ...emptyAttr(), ...session.attribution },
    userAgent: session.userAgent || "",
    ip: session.ip || "",
    purchaseSent: paymentStatus === "paid",
  };
}

export async function ensureStoreOrderFromLive(input: {
  orderId: string;
  paymentStatus?: StoreOrder["paymentStatus"] | "";
  items?: StoreOrder["items"];
  customer?: Partial<StoreOrder["customer"]>;
  total?: number;
  attribution?: Attribution;
  userAgent?: string;
  ip?: string;
}): Promise<void> {
  const id = input.orderId.trim();
  if (!id) return;
  const paymentStatus =
    input.paymentStatus === "paid" || input.paymentStatus === "failed" ? input.paymentStatus : "pending";
  await upsertStoreOrder({
    id,
    createdAt: new Date().toISOString(),
    items: input.items ?? [],
    customer: { ...blankCheckoutCustomer(), ...input.customer },
    subtotal: input.total ?? 0,
    shipping: 0,
    shippingMethod: "gratis",
    total: input.total ?? 0,
    discount: 0,
    paymentStatus,
    eventId: `live_${id}`,
    attribution: { ...emptyAttr(), ...input.attribution },
    userAgent: input.userAgent ?? "",
    ip: input.ip ?? "",
    purchaseSent: paymentStatus === "paid",
  });
}

export async function upsertStoreOrder(order: StoreOrder): Promise<StoreOrder> {
  let saved = order;
  await updateAdminState((state) => {
    const index = state.orders.findIndex(
      (entry) =>
        entry.id === order.id ||
        (order.referenceId && entry.referenceId === order.referenceId) ||
        (order.transactionId && entry.transactionId === order.transactionId),
    );
    if (index >= 0) {
      const current = state.orders[index];
      if (current) {
        const nextItems = order.items.length ? order.items : current.items;
        const nextTotal = order.items.length || order.total > 0 ? order.total : current.total;
        saved = {
          ...current,
          ...order,
          attribution: { ...blankAttribution(), ...current.attribution, ...order.attribution },
          items: nextItems,
          subtotal: order.items.length || order.subtotal > 0 ? order.subtotal : current.subtotal,
          total: nextTotal,
          customer: {
            ...current.customer,
            ...Object.fromEntries(
              Object.entries(order.customer).filter(([, value]) => typeof value === "string" && value.trim().length > 0),
            ),
          } as StoreOrder["customer"],
          purchaseSent: current.purchaseSent || order.purchaseSent,
          pushcutPendingSent: current.pushcutPendingSent || order.pushcutPendingSent,
          pushcutPaidSent: current.pushcutPaidSent || order.pushcutPaidSent,
          errorMessage:
            order.paymentStatus === "failed"
              ? order.errorMessage || current.errorMessage
              : order.paymentStatus === "paid" || order.paymentStatus === "pending"
                ? undefined
                : current.errorMessage,
        };
        state.orders[index] = saved;
      }
    } else {
      if (!order.items.length && !order.customer.name && !order.customer.email && !order.customer.phone) return;
      state.orders = [order, ...state.orders];
      saved = order;
    }
  });
  return saved;
}

export async function listStoreOrders(): Promise<StoreOrder[]> {
  const state = await getAdminState();
  const extras: StoreOrder[] = [];
  const ids = new Set(state.orders.map((order) => order.id));
  for (const session of state.sessions) {
    const order = storeOrderFromSession(session);
    if (!order || ids.has(order.id)) continue;
    extras.push(order);
    ids.add(order.id);
  }
  if (extras.length) {
    const saved = await updateAdminState((current) => {
      current.orders = mergeOrders(current.orders, extras);
    });
    return [...saved.orders].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
  return [...state.orders].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function findStoreOrder(input: { id?: string; referenceId?: string; transactionId?: string }): Promise<StoreOrder | undefined> {
  const state = await getAdminState();
  return state.orders.find((order) => {
    if (input.id && order.id === input.id) return true;
    if (input.referenceId && order.referenceId === input.referenceId) return true;
    if (input.transactionId && order.transactionId === input.transactionId) return true;
    return false;
  });
}

export async function appendTrackingLog(entry: Omit<TrackingLog, "id" | "at"> & { id?: string; at?: string }): Promise<void> {
  await updateAdminState((state) => {
    state.events = [
      {
        id: entry.id ?? crypto.randomUUID(),
        at: entry.at ?? new Date().toISOString(),
        event: entry.event,
        source: entry.source,
        eventId: entry.eventId,
        orderId: entry.orderId,
        value: entry.value,
        ok: entry.ok,
        detail: entry.detail,
        ...(entry.clientId ? { clientId: entry.clientId } : {}),
        ...(entry.path ? { path: entry.path } : {}),
        ...(entry.platform ? { platform: entry.platform } : {}),
        ...(entry.fbclid ? { fbclid: entry.fbclid } : {}),
      },
      ...state.events,
    ].slice(0, MAX_EVENTS);
  });
}

export async function listTrackingLogs(): Promise<TrackingLog[]> {
  const state = await getAdminState();
  return state.events;
}

export function adminSecret(): string {
  return lookupEnv("ADMIN_SECRET") || lookupEnv("LEGACY_SECRET_KEY") || "kyt-admin-local";
}

export function adminEnvPassword(): string {
  return lookupEnv("ADMIN_PASSWORD");
}

function filled(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function mergeFilled<T extends Record<string, string>>(base: T, patch?: Partial<T>): T {
  const next = { ...base };
  if (!patch) return next;
  for (const key of Object.keys(patch) as (keyof T)[]) {
    const value = patch[key];
    if (filled(value)) next[key] = value;
  }
  return next;
}

function keepSource(incoming: string | undefined, base: string): string {
  const normalize = (value: string) => {
    const next = value.trim().toLowerCase();
    if (!next || next === "direto") return "direct";
    if (next === "outro") return "other";
    return next;
  };
  const next = normalize(incoming ?? "");
  const stored = normalize(base);
  const weak = new Set(["", "direct", "other"]);
  if (weak.has(next) && stored && !weak.has(stored)) return stored;
  return next || stored || "direct";
}

export async function upsertLiveSession(
  patch: Partial<LiveSession> & { id: string; trailHints?: string[] },
): Promise<LiveSession> {
  let saved: LiveSession | null = null;
  await updateAdminState((state) => {
    const { trailHints = [], ...fields } = patch;
    const list = Array.isArray(state.sessions) ? state.sessions : [];
    const index = list.findIndex((entry) => entry.id === fields.id);
    const current = index >= 0 ? list[index] : undefined;
    const base: LiveSession = current ?? {
      id: patch.id,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      path: "/",
      title: "",
      views: 0,
      stage: "browsing",
      device: "desktop",
      os: "",
      browser: "",
      referrer: "",
      source: "direct",
      utm: { source: "", medium: "", campaign: "", content: "", term: "" },
      city: "",
      region: "",
      country: "",
      ip: "",
      userAgent: "",
      cart: [],
      cartValue: 0,
      customer: { name: "", email: "", phone: "" },
      orderId: "",
      paymentStatus: "",
      attribution: emptyAttr(),
      trail: [],
    };

    const cartProvided = Array.isArray(fields.cart);
    const keepStoredCart =
      (Boolean(base.orderId || fields.orderId) ||
        base.paymentStatus === "pending" ||
        fields.paymentStatus === "pending" ||
        ((base.cart?.length ?? 0) > 0 && base.paymentStatus !== "paid")) &&
      fields.paymentStatus !== "paid";
    const nextCart = cartProvided ? fields.cart ?? [] : base.cart;
    const incomingCart = cartProvided && nextCart.length === 0 && keepStoredCart ? base.cart : nextCart;
    const incomingValue =
      cartProvided && nextCart.length === 0 && keepStoredCart
        ? Number(base.cartValue || 0)
        : cartProvided
          ? Number(fields.cartValue ?? 0) || 0
          : Number(base.cartValue || 0);
    const next: LiveSession = {
      ...base,
      ...fields,
      title: filled(fields.title) ? fields.title : base.title,
      referrer: keepExternalReferrer(fields.referrer, base.referrer),
      source: keepSource(fields.source, base.source),
      os: filled(fields.os) ? fields.os : base.os,
      browser: filled(fields.browser) ? fields.browser : base.browser,
      city: filled(fields.city) ? fields.city : base.city,
      region: filled(fields.region) ? fields.region : base.region,
      country: filled(fields.country) ? fields.country : base.country,
      utm: mergeFilled(base.utm, fields.utm),
      customer: {
        name: fields.customer?.name || base.customer.name,
        email: fields.customer?.email || base.customer.email,
        phone: fields.customer?.phone || base.customer.phone,
      },
      attribution: mergeFilled(base.attribution, fields.attribution),
      cart: incomingCart,
      cartValue: incomingValue,
      orderId: fields.orderId || base.orderId,
      paymentStatus: base.paymentStatus === "paid" ? "paid" : fields.paymentStatus || base.paymentStatus,
      firstSeen: base.firstSeen,
      lastSeen: new Date().toISOString(),
      views: base.views,
      trail: base.trail,
    };
    if (next.paymentStatus === "pending" && next.orderId) {
      if (!next.path.startsWith("/pedido") && !next.path.startsWith("/obrigado")) {
        next.path = `/pedido/${next.orderId}`;
      }
      if (next.stage !== "ordered") next.stage = "checkout";
    }

    const labels: string[] = [];
    if (base.views === 0 && next.path) labels.push(next.path);
    for (const hint of trailHints) {
      const path = hint.trim();
      if (path && !labels.includes(path)) labels.push(path);
    }
    if (labels.length) {
      const latest = (base.trail[0]?.label ?? "").trim();
      const fresh = labels.filter((label) => label !== latest);
      if (fresh.length) {
        next.trail = [...fresh.map((label) => ({ at: next.lastSeen, label })), ...base.trail].slice(0, TRAIL_MAX);
      }
      if (trailHints.length > 0 || base.views === 0) next.views = Math.max(1, base.views + 1);
    }

    const rest = list.filter((entry) => entry.id !== fields.id);
    state.sessions = mergeSessions(rest, [next]);
    rememberAbandoned(state, next);
    saved = next;
  });
  return saved as unknown as LiveSession;
}

export async function listLiveSessions(): Promise<LiveSession[]> {
  const state = await getAdminState();
  const list = Array.isArray(state.sessions) ? state.sessions : [];
  return [...list].sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
}
