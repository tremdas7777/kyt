import { emptyAttribution as blankAttribution } from "@/lib/ad-origin";
import { HISTORY_MS } from "@/lib/live-window";
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
const MAX_ORDERS = 800;
const MAX_EVENTS = 8000;
const MAX_SESSIONS = 8000;
const SESSION_TTL = HISTORY_MS;
const TRAIL_MAX = 80;

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

function sessionStamp(session: LiveSession): number {
  return Math.max(Date.parse(session.lastSeen) || 0, Date.parse(session.firstSeen) || 0);
}

function mergeTrail(left: LiveSession["trail"] | undefined, right: LiveSession["trail"] | undefined): LiveSession["trail"] {
  const map = new Map<string, { at: string; label: string }>();
  for (const entry of [...(left ?? []), ...(right ?? [])]) {
    const key = `${entry.at}|${entry.label}`;
    if (!map.has(key)) map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, TRAIL_MAX);
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
      cart: newer.cart?.length ? newer.cart : older.cart,
      cartValue: Number(newer.cartValue) || Number(older.cartValue) || 0,
      orderId: newer.orderId || older.orderId,
      paymentStatus: newer.paymentStatus || older.paymentStatus,
      customer: {
        name: newer.customer?.name || older.customer?.name || "",
        email: newer.customer?.email || older.customer?.email || "",
        phone: newer.customer?.phone || older.customer?.phone || "",
      },
    });
  }
  const now = Date.now();
  return [...map.values()]
    .filter((session) => now - sessionStamp(session) < SESSION_TTL)
    .sort((a, b) => sessionStamp(b) - sessionStamp(a))
    .slice(0, MAX_SESSIONS);
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
  const map = new Map<string, StoreOrder>();
  for (const order of [...left, ...right]) {
    const key = order.id || order.referenceId || order.transactionId || "";
    if (!key) continue;
    const current = map.get(key);
    if (!current || Date.parse(order.createdAt) >= Date.parse(current.createdAt)) map.set(key, { ...current, ...order });
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
    state.events = mergeEvents(disk.events, state.events);
    state.orders = mergeOrders(disk.orders, state.orders);
    if (!state.passwordHash && disk.passwordHash) {
      state.passwordHash = disk.passwordHash;
      state.passwordSalt = disk.passwordSalt;
      if (disk.passwordEnvFingerprint) state.passwordEnvFingerprint = disk.passwordEnvFingerprint;
    }
  }
  if (!Array.isArray(state.sessions)) state.sessions = [];
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
  mem.state = state;
  if (dirty) await saveState(state);
  return state;
}

async function persistState(state: AdminState): Promise<void> {
  memorySlot().state = state;
  await writeBackends(JSON.stringify(state));
}

async function saveState(state: AdminState): Promise<void> {
  try {
    const raw = await readBackends();
    if (raw) {
      const prev = normalizeState(JSON.parse(raw) as unknown);
      state.sessions = mergeSessions(prev.sessions, state.sessions);
      state.events = mergeEvents(prev.events, state.events);
      state.orders = mergeOrders(prev.orders, state.orders);
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
        ...(entry.clientId ? { clientId: entry.clientId } : {}),
        ...(entry.path ? { path: entry.path } : {}),
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
  const next = (incoming ?? "").trim();
  const weak = new Set(["", "direto", "direct", "other", "outro"]);
  if (weak.has(next.toLowerCase()) && base && !weak.has(base.toLowerCase())) return base;
  return next || base || "direto";
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

    const incomingCart = Array.isArray(fields.cart) && fields.cart.length > 0 ? fields.cart : base.cart;
    const next: LiveSession = {
      ...base,
      ...fields,
      title: filled(fields.title) ? fields.title : base.title,
      referrer: filled(fields.referrer) ? fields.referrer : base.referrer,
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
      cartValue: Array.isArray(fields.cart) && fields.cart.length > 0 ? Number(fields.cartValue ?? 0) : Number(base.cartValue || fields.cartValue || 0),
      orderId: fields.orderId || base.orderId,
      paymentStatus: fields.paymentStatus || base.paymentStatus,
      firstSeen: base.firstSeen,
      lastSeen: new Date().toISOString(),
      views: base.views + (fields.path && fields.path !== base.path ? 1 : base.views === 0 ? 1 : 0),
      trail: base.trail,
    };

    const labels: string[] = [];
    if (fields.path && fields.path !== base.path) labels.push(fields.path);
    else if (base.views === 0) labels.push(next.path);
    for (const hint of trailHints) {
      const path = hint.trim();
      if (path && !labels.includes(path)) labels.push(path);
    }
    if (labels.length) {
      next.trail = [...labels.map((label) => ({ at: next.lastSeen, label })), ...base.trail].slice(0, TRAIL_MAX);
    }

    const rest = list.filter((entry) => entry.id !== fields.id);
    state.sessions = mergeSessions(rest, [next]);
    saved = next;
  });
  return saved as unknown as LiveSession;
}

export async function listLiveSessions(): Promise<LiveSession[]> {
  const state = await getAdminState();
  const list = Array.isArray(state.sessions) ? state.sessions : [];
  return [...list].sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
}
