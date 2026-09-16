import { emptyAttribution as blankAttribution } from "@/lib/ad-origin";
import { getRuntimeEnv } from "@/lib/legacy.server";
import type { Attribution, LiveSession, StoreOrder, TrackingLog, TrackingSettings } from "@/lib/tracking-types";

type AdminState = {
  passwordHash: string;
  passwordSalt: string;
  passwordEnvFingerprint?: string;
  tracking: TrackingSettings;
  orders: StoreOrder[];
  events: TrackingLog[];
  sessions: LiveSession[];
};

const FILE_NAME = "kyt-admin.json";
const KV_KEY = "kyt-admin-v1";
const CACHE_URL = "https://kyt.internal/admin-store-v1";
const MAX_ORDERS = 400;
const MAX_EVENTS = 250;

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
  };
}

function normalizeState(raw: unknown): AdminState {
  const rec = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const trackingRaw = rec["tracking"] && typeof rec["tracking"] === "object" ? (rec["tracking"] as Record<string, unknown>) : {};
  const tiktok = trackingRaw["tiktok"] && typeof trackingRaw["tiktok"] === "object" ? (trackingRaw["tiktok"] as Record<string, unknown>) : {};
  const meta = trackingRaw["meta"] && typeof trackingRaw["meta"] === "object" ? (trackingRaw["meta"] as Record<string, unknown>) : {};
  const google = trackingRaw["google"] && typeof trackingRaw["google"] === "object" ? (trackingRaw["google"] as Record<string, unknown>) : {};
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
  };

  return {
    passwordHash: String(rec["passwordHash"] ?? ""),
    passwordSalt: String(rec["passwordSalt"] ?? ""),
    ...(rec["passwordEnvFingerprint"] ? { passwordEnvFingerprint: String(rec["passwordEnvFingerprint"]) } : {}),
    tracking: { ...base, ...tracking, tiktok: { ...base.tiktok, ...tracking.tiktok }, meta: { ...base.meta, ...tracking.meta }, google: { ...base.google, ...tracking.google } },
    orders: Array.isArray(rec["orders"]) ? (rec["orders"] as StoreOrder[]) : [],
    events: Array.isArray(rec["events"]) ? (rec["events"] as TrackingLog[]) : [],
    sessions: Array.isArray(rec["sessions"]) ? (rec["sessions"] as LiveSession[]) : [],
  };
}

type KvLike = {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string) => Promise<void>;
};

function kvBinding(): KvLike | null {
  const runtime = getRuntimeEnv();
  if (!runtime) return null;
  const binding = runtime["KYT_STORE"] ?? runtime["kyt_store"];
  if (binding && typeof binding === "object" && "get" in binding && "put" in binding) {
    return binding as KvLike;
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
      if (value) return value;
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
  if (mem.state) {
    if (!Array.isArray(mem.state.sessions)) mem.state.sessions = [];
    return mem.state;
  }
  const raw = await readBackends();
  const fresh = !raw;
  const state = raw ? normalizeState(JSON.parse(raw) as unknown) : normalizeState({});
  let dirty = fresh;
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
  state.tracking = seedTrackingFromEnv(state.tracking, fresh);
  mem.state = state;
  if (dirty) await saveState(state);
  return state;
}

async function saveState(state: AdminState): Promise<void> {
  memorySlot().state = state;
  await writeBackends(JSON.stringify(state));
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
    current.tracking = next;
  });
  return state.tracking;
}

export function emptyAttr(): Attribution {
  return blankAttribution();
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
        saved = {
          ...current,
          ...order,
          attribution: { ...blankAttribution(), ...current.attribution, ...order.attribution },
          items: order.items.length ? order.items : current.items,
          customer: order.customer.email ? order.customer : current.customer,
          purchaseSent: current.purchaseSent || order.purchaseSent,
        };
        state.orders[index] = saved;
      }
    } else {
      state.orders = [order, ...state.orders].slice(0, MAX_ORDERS);
      saved = order;
    }
  });
  return saved;
}

export async function listStoreOrders(): Promise<StoreOrder[]> {
  const state = await getAdminState();
  return state.orders;
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

const MAX_SESSIONS = 500;
const SESSION_TTL = 24 * 60 * 60 * 1000;

export async function upsertLiveSession(patch: Partial<LiveSession> & { id: string }): Promise<LiveSession> {
  let saved: LiveSession | null = null;
  await updateAdminState((state) => {
    const list = Array.isArray(state.sessions) ? state.sessions : [];
    const now = Date.now();
    const index = list.findIndex((entry) => entry.id === patch.id);
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
      source: "direto",
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

    const next: LiveSession = {
      ...base,
      ...patch,
      utm: { ...base.utm, ...(patch.utm ?? {}) },
      customer: {
        name: patch.customer?.name || base.customer.name,
        email: patch.customer?.email || base.customer.email,
        phone: patch.customer?.phone || base.customer.phone,
      },
      attribution: { ...base.attribution, ...(patch.attribution ?? {}) },
      cart: patch.cart ?? base.cart,
      cartValue: patch.cartValue ?? base.cartValue,
      orderId: patch.orderId || base.orderId,
      paymentStatus: patch.paymentStatus || base.paymentStatus,
      firstSeen: base.firstSeen,
      lastSeen: new Date().toISOString(),
      views: base.views + (patch.path && patch.path !== base.path ? 1 : base.views === 0 ? 1 : 0),
      trail: base.trail,
    };

    const label = patch.path && patch.path !== base.path ? patch.path : base.views === 0 ? next.path : "";
    if (label) {
      next.trail = [{ at: next.lastSeen, label }, ...base.trail].slice(0, 14);
    }

    const rest = list.filter((entry) => entry.id !== patch.id && now - new Date(entry.lastSeen).getTime() < SESSION_TTL);
    state.sessions = [next, ...rest].slice(0, MAX_SESSIONS);
    saved = next;
  });
  return saved as unknown as LiveSession;
}

export async function listLiveSessions(): Promise<LiveSession[]> {
  const state = await getAdminState();
  const list = Array.isArray(state.sessions) ? state.sessions : [];
  return [...list].sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
}
