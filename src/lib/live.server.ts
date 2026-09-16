import { getAdminState, updateAdminState } from "@/lib/admin-store.server";
import type {
  AbandonedCart,
  AbandonedProduct,
  Attribution,
  CartStatusBucket,
  FunnelStage,
  FunnelWindow,
  LiveCartLine,
  LivePageHit,
  LiveSession,
  LiveSnapshot,
  SourceFunnels,
  TrafficSource,
} from "@/lib/tracking-types";

function attributionFromUnknown(value: unknown): Attribution {
  const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    fbp: String(rec["fbp"] ?? ""),
    fbc: String(rec["fbc"] ?? ""),
    fbclid: String(rec["fbclid"] ?? ""),
    ttclid: String(rec["ttclid"] ?? ""),
    ttp: String(rec["ttp"] ?? ""),
    gclid: String(rec["gclid"] ?? ""),
    gbraid: String(rec["gbraid"] ?? ""),
    wbraid: String(rec["wbraid"] ?? ""),
    clientId: String(rec["clientId"] ?? rec["client_id"] ?? ""),
  };
}
export const ONLINE_MS = 90_000;
export const SESSION_GAP_MS = 30 * 60 * 1000;
export const ABANDON_MS = 15 * 60 * 1000;
const MAX_SESSIONS = 800;
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || "";
}

function deviceFromUa(ua: string): LiveSession["device"] {
  return /mobile|android|iphone|ipad|ipod/i.test(ua) ? "mobile" : "desktop";
}

export function sourceFrom(attr: Attribution, referrer: string): TrafficSource {
  if (attr.ttclid || attr.ttp) return "tiktok";
  if (attr.fbclid || attr.fbc) return "meta";
  if (attr.gclid || attr.gbraid || attr.wbraid) return "google";
  const ref = referrer.toLowerCase();
  if (ref.includes("tiktok") || ref.includes("ttclid")) return "tiktok";
  if (ref.includes("facebook") || ref.includes("instagram") || ref.includes("fbclid")) return "meta";
  if (ref.includes("google") || ref.includes("youtube") || ref.includes("gclid")) return "google";
  if (!ref) return "direct";
  return "other";
}

function mergeSource(current: TrafficSource, next: TrafficSource): TrafficSource {
  if (next === "direct" || next === "other") return current;
  return next;
}

export function stageFromPath(path: string, purchased: boolean): FunnelStage {
  if (purchased) return "paid";
  if (path.startsWith("/pedido")) return "payment";
  if (path.startsWith("/checkout")) return "checkout";
  if (path.startsWith("/carrinho")) return "cart";
  if (path.startsWith("/produtos/") && path.length > 10) return "product";
  if (path.startsWith("/produtos")) return "listing";
  return "home";
}

function asLines(value: unknown): LiveCartLine[] {
  if (!Array.isArray(value)) return [];
  const lines: LiveCartLine[] = [];
  for (const raw of value) {
    const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const productId = String(item["productId"] ?? item["id"] ?? "").trim();
    const name = String(item["name"] ?? item["titulo"] ?? "").trim();
    if (!productId && !name) continue;
    const qty = Math.max(1, Number(item["quantity"] ?? item["quantidade"] ?? 1) || 1);
    const price = Number(item["price"] ?? item["preco"] ?? 0) || 0;
    lines.push({
      id: String(item["id"] ?? `${productId}::${String(item["color"] ?? "")}::${String(item["size"] ?? "")}`),
      productId: productId || name,
      name: name || productId,
      color: String(item["color"] ?? ""),
      size: String(item["size"] ?? ""),
      quantity: qty,
      price,
      image: String(item["image"] ?? ""),
    });
  }
  return lines;
}

function cartValueOf(lines: LiveCartLine[]): number {
  return Math.round(lines.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100;
}

function emptySession(clientId: string, now: string): LiveSession {
  return {
    id: crypto.randomUUID(),
    clientId,
    startedAt: now,
    lastAt: now,
    path: "/",
    referrer: "",
    source: "direct",
    device: "desktop",
    stage: "home",
    pageViews: 0,
    sawProduct: false,
    addedCart: false,
    startedCheckout: false,
    addedPayment: false,
    purchased: false,
    cartValue: 0,
    cartItems: [],
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    orderId: "",
    paymentStatus: "",
    ip: "",
    userAgent: "",
  };
}

export type LivePing = {
  clientId: string;
  path: string;
  referrer: string;
  event: string;
  cartItems: LiveCartLine[];
  attribution: Attribution;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  orderId: string;
  paymentStatus: LiveSession["paymentStatus"];
};

export function pingFromUnknown(body: Record<string, unknown>, request: Request): LivePing {
  const attr = attributionFromUnknown(body["attribution"] ?? body);
  const customer = body["customer"] && typeof body["customer"] === "object" ? (body["customer"] as Record<string, unknown>) : {};
  const paymentRaw = String(body["paymentStatus"] ?? "").trim();
  const paymentStatus: LiveSession["paymentStatus"] =
    paymentRaw === "paid" || paymentRaw === "pending" || paymentRaw === "failed" ? paymentRaw : "";
  return {
    clientId: String(body["clientId"] ?? attr.clientId ?? "").trim() || attr.clientId,
    path: String(body["path"] ?? "").trim() || "/",
    referrer: String(body["referrer"] ?? "").trim(),
    event: String(body["event"] ?? "").trim(),
    cartItems: asLines(body["cartItems"] ?? body["contents"] ?? body["items"]),
    attribution: attr,
    customerName: String(customer["name"] ?? body["customerName"] ?? ""),
    customerEmail: String(customer["email"] ?? body["customerEmail"] ?? ""),
    customerPhone: String(customer["phone"] ?? body["customerPhone"] ?? ""),
    orderId: String(body["orderId"] ?? ""),
    paymentStatus,
  };
}

function applyEvent(session: LiveSession, event: string) {
  if (event === "PageView") session.pageViews += 1;
  if (event === "ViewContent") session.sawProduct = true;
  if (event === "AddToCart") session.addedCart = true;
  if (event === "InitiateCheckout") session.startedCheckout = true;
  if (event === "AddPaymentInfo") session.addedPayment = true;
  if (event === "Purchase" || event === "CompletePayment") session.purchased = true;
}

export async function ingestLive(request: Request, ping: LivePing): Promise<void> {
  const clientId = ping.clientId || ping.attribution.clientId;
  if (!clientId) return;
  if (ping.path.startsWith("/admin")) return;
  const now = new Date().toISOString();
  const nowMs = Date.now();
  const ua = request.headers.get("user-agent") ?? "";
  const ip = clientIp(request);

  await updateAdminState((state) => {
    const sessions = state.sessions;
    let current = sessions.find((entry) => entry.clientId === clientId && nowMs - Date.parse(entry.lastAt) < SESSION_GAP_MS && !entry.purchased);
    if (!current) {
      current = emptySession(clientId, now);
      current.referrer = ping.referrer;
      current.source = sourceFrom(ping.attribution, ping.referrer);
      current.device = deviceFromUa(ua);
      current.ip = ip;
      current.userAgent = ua;
      sessions.unshift(current);
    }

    current.lastAt = now;
    current.path = ping.path || current.path;
    if (ping.referrer && !current.referrer) current.referrer = ping.referrer;
    current.source = mergeSource(current.source, sourceFrom(ping.attribution, current.referrer || ping.referrer));
    current.device = deviceFromUa(ua || current.userAgent);
    if (ip) current.ip = ip;
    if (ua) current.userAgent = ua;
    if (ping.cartItems.length > 0) {
      current.cartItems = ping.cartItems;
      current.cartValue = cartValueOf(ping.cartItems);
      current.addedCart = true;
    } else if (!current.startedCheckout && !current.purchased && ping.event !== "AddToCart") {
      current.cartItems = [];
      current.cartValue = 0;
    }
    if (ping.customerName) current.customerName = ping.customerName;
    if (ping.customerEmail) current.customerEmail = ping.customerEmail;
    if (ping.customerPhone) current.customerPhone = ping.customerPhone;
    if (ping.orderId) current.orderId = ping.orderId;
    if (ping.paymentStatus) current.paymentStatus = ping.paymentStatus;
    applyEvent(current, ping.event);
    if (current.cartValue > 0) current.addedCart = true;
    current.stage = stageFromPath(current.path, current.purchased);
    if (current.stage === "product" || current.stage === "listing") current.sawProduct = true;
    if (current.stage === "checkout" || current.stage === "payment") current.startedCheckout = true;
    if (current.stage === "payment") current.addedPayment = true;
    if (current.purchased) current.stage = "paid";

    const cutoff = nowMs - KEEP_MS;
    state.sessions = sessions.filter((entry) => Date.parse(entry.lastAt) >= cutoff).slice(0, MAX_SESSIONS);
  });
}

export async function markLivePurchased(input: {
  clientId?: string;
  orderId?: string;
  email?: string;
}): Promise<void> {
  await updateAdminState((state) => {
    for (const session of state.sessions) {
      const matchClient = input.clientId && session.clientId === input.clientId;
      const matchOrder = input.orderId && session.orderId === input.orderId;
      const matchEmail = input.email && session.customerEmail && session.customerEmail === input.email;
      if (!matchClient && !matchOrder && !matchEmail) continue;
      session.purchased = true;
      session.stage = "paid";
      session.paymentStatus = "paid";
      session.lastAt = new Date().toISOString();
      if (input.orderId) session.orderId = input.orderId;
    }
  });
}

function inWindow(iso: string, since: number): boolean {
  return Date.parse(iso) >= since;
}

function funnelOf(sessions: LiveSession[], since: number, label: string): FunnelWindow {
  const slice = sessions.filter((session) => inWindow(session.startedAt, since) || inWindow(session.lastAt, since));
  const purchaseSessions = slice.filter((session) => session.purchased);
  return {
    label,
    visit: slice.length,
    product: slice.filter((session) => session.sawProduct).length,
    cart: slice.filter((session) => session.addedCart).length,
    checkout: slice.filter((session) => session.startedCheckout).length,
    purchase: purchaseSessions.length,
    revenue: purchaseSessions.reduce((sum, session) => sum + session.cartValue, 0),
  };
}

const SOURCE_KEYS: TrafficSource[] = ["tiktok", "meta", "google", "direct", "other"];

function sourceFunnelsOf(sessions: LiveSession[], since: number): SourceFunnels {
  const result = {} as SourceFunnels;
  for (const source of SOURCE_KEYS) {
    result[source] = funnelOf(
      sessions.filter((session) => session.source === source),
      since,
      source,
    );
  }
  return result;
}

function abandonStatus(session: LiveSession, now: number, online: boolean): AbandonedCart["status"] {
  if (session.purchased) return "quente";
  if (session.paymentStatus === "pending") return "pix";
  const idle = now - Date.parse(session.lastAt);
  if (online && session.cartValue > 0) return "quente";
  if (idle >= 24 * 60 * 60 * 1000) return "perdido";
  if (idle >= ABANDON_MS) return "abandonado";
  return "quente";
}

function emptyBucket(): CartStatusBucket {
  return { count: 0, value: 0 };
}

function groupPages(online: LiveSession[]): LivePageHit[] {
  const map = new Map<string, LivePageHit>();
  for (const visitor of online) {
    const path = visitor.path || "/";
    const current = map.get(path) ?? { path, count: 0, cartValue: 0 };
    current.count += 1;
    current.cartValue += visitor.cartValue;
    map.set(path, current);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.cartValue - a.cartValue).slice(0, 8);
}

function topAbandonedProducts(carts: AbandonedCart[]): AbandonedProduct[] {
  const map = new Map<string, AbandonedProduct>();
  for (const cart of carts) {
    if (cart.status === "quente") continue;
    for (const item of cart.cartItems) {
      const key = item.name || item.productId;
      const current = map.get(key) ?? { name: key, quantity: 0, value: 0 };
      current.quantity += item.quantity;
      current.value += item.price * item.quantity;
      map.set(key, current);
    }
  }
  return [...map.values()].sort((a, b) => b.value - a.value).slice(0, 6);
}

export function buildLiveSnapshot(state: {
  sessions: LiveSession[];
  orders: { id?: string; paymentStatus: string; createdAt: string; total: number; customer: { email: string } }[];
}): LiveSnapshot {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const sessions = state.sessions.filter((session) => !session.path.startsWith("/admin"));
  const online = sessions
    .filter((session) => now - Date.parse(session.lastAt) <= ONLINE_MS)
    .sort((a, b) => Date.parse(b.lastAt) - Date.parse(a.lastAt));

  const carts: AbandonedCart[] = sessions
    .filter((session) => session.addedCart && session.cartValue > 0 && !session.purchased)
    .map((session) => {
      const idleMs = Math.max(0, now - Date.parse(session.lastAt));
      const isOnline = idleMs <= ONLINE_MS;
      return { ...session, idleMs, status: abandonStatus(session, now, isOnline) };
    })
    .sort((a, b) => b.cartValue - a.cartValue || a.idleMs - b.idleMs);

  const abandonedToday = carts.filter((cart) => cart.status === "abandonado" && now - Date.parse(cart.lastAt) < day);
  const todayFunnel = funnelOf(sessions, now - day, "Hoje");
  const sources: Record<TrafficSource, number> = { tiktok: 0, meta: 0, google: 0, direct: 0, other: 0 };
  for (const visitor of online) sources[visitor.source] += 1;

  const cartStatus: Record<AbandonedCart["status"], CartStatusBucket> = {
    quente: emptyBucket(),
    abandonado: emptyBucket(),
    pix: emptyBucket(),
    perdido: emptyBucket(),
  };
  for (const cart of carts) {
    cartStatus[cart.status].count += 1;
    cartStatus[cart.status].value += cart.cartValue;
  }

  const pixOrderIds = new Set(carts.filter((cart) => cart.status === "pix" && cart.orderId).map((cart) => cart.orderId));
  const pendingOrders = state.orders.filter((order) => order.paymentStatus === "pending" && (!order.id || !pixOrderIds.has(order.id)));

  return {
    generatedAt: new Date().toISOString(),
    online,
    onlineCount: online.length,
    inCheckout: online.filter((session) => session.stage === "checkout" || session.stage === "payment").length,
    activeCarts: online.filter((session) => session.cartValue > 0 && !session.purchased).length,
    awaitingPix: carts.filter((cart) => cart.status === "pix").length + pendingOrders.length,
    abandonedToday: abandonedToday.length,
    abandonedValueToday: abandonedToday.reduce((sum, cart) => sum + cart.cartValue, 0),
    conversionToday: todayFunnel.visit > 0 ? todayFunnel.purchase / todayFunnel.visit : 0,
    funnel: {
      today: todayFunnel,
      week: funnelOf(sessions, now - 7 * day, "7 dias"),
      month: funnelOf(sessions, now - 30 * day, "30 dias"),
    },
    sourceFunnels: {
      today: sourceFunnelsOf(sessions, now - day),
      week: sourceFunnelsOf(sessions, now - 7 * day),
      month: sourceFunnelsOf(sessions, now - 30 * day),
    },
    pages: groupPages(online),
    carts,
    cartStatus,
    topAbandoned: topAbandonedProducts(carts),
    sources,
  };
}

export async function getLiveSnapshot(): Promise<LiveSnapshot> {
  const state = await getAdminState();
  return buildLiveSnapshot(state);
}
