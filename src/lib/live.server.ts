import { getAdminState, updateAdminState, upsertLiveSession } from "@/lib/admin-store.server";
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
  LiveStage,
  LiveVisitor,
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
export const ABANDON_MS = 15 * 60 * 1000;

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || "";
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

export function stageFromPath(path: string, purchased: boolean): FunnelStage {
  if (purchased) return "paid";
  if (path.startsWith("/pedido") || path.startsWith("/obrigado")) return "payment";
  if (path.startsWith("/checkout")) return "checkout";
  if (path.startsWith("/carrinho")) return "cart";
  if (path.startsWith("/produtos/") && path.length > 10) return "product";
  if (path.startsWith("/produtos")) return "listing";
  return "home";
}

function liveStageFrom(path: string, purchased: boolean, cartSize: number, event: string): LiveStage {
  if (purchased || event === "Purchase" || event === "CompletePayment") return "ordered";
  if (path.startsWith("/pedido") || path.startsWith("/obrigado")) return "ordered";
  if (event === "InitiateCheckout" || path.startsWith("/checkout")) return "checkout";
  if (event === "AddToCart" || cartSize > 0 || path.startsWith("/carrinho")) return "cart";
  return "browsing";
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
  paymentStatus: "" | "pending" | "paid" | "failed";
};

export function pingFromUnknown(body: Record<string, unknown>, request: Request): LivePing {
  const attr = attributionFromUnknown(body["attribution"] ?? body);
  const customer = body["customer"] && typeof body["customer"] === "object" ? (body["customer"] as Record<string, unknown>) : {};
  const paymentRaw = String(body["paymentStatus"] ?? "").trim();
  const paymentStatus: LivePing["paymentStatus"] =
    paymentRaw === "paid" || paymentRaw === "pending" || paymentRaw === "failed" ? paymentRaw : "";
  return {
    clientId: String(body["sessionId"] ?? body["clientId"] ?? attr.clientId ?? "").trim() || attr.clientId,
    path: String(body["path"] ?? "").trim() || "/",
    referrer: String(body["referrer"] ?? "").trim(),
    event: String(body["event"] ?? "").trim(),
    cartItems: asLines(body["cartItems"] ?? body["cart"] ?? body["contents"] ?? body["items"]),
    attribution: attr,
    customerName: String(customer["name"] ?? body["customerName"] ?? ""),
    customerEmail: String(customer["email"] ?? body["customerEmail"] ?? ""),
    customerPhone: String(customer["phone"] ?? body["customerPhone"] ?? ""),
    orderId: String(body["orderId"] ?? ""),
    paymentStatus,
  };
}

function deviceOf(ua: string): LiveSession["device"] {
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/mobile|android|iphone/i.test(ua)) return "mobile";
  return "desktop";
}

export async function ingestLive(request: Request, ping: LivePing): Promise<void> {
  const clientId = ping.clientId || ping.attribution.clientId;
  if (!clientId) return;
  if (ping.path.startsWith("/admin")) return;
  const ua = request.headers.get("user-agent") ?? "";
  const purchased = ping.event === "Purchase" || ping.event === "CompletePayment" || ping.paymentStatus === "paid";
  const patch: Parameters<typeof upsertLiveSession>[0] = {
    id: clientId,
    path: ping.path || "/",
    stage: liveStageFrom(ping.path, purchased, ping.cartItems.length, ping.event),
    device: deviceOf(ua),
    referrer: ping.referrer,
    source: sourceFrom(ping.attribution, ping.referrer),
    ip: clientIp(request),
    userAgent: ua,
    customer: {
      name: ping.customerName,
      email: ping.customerEmail,
      phone: ping.customerPhone,
    },
    attribution: ping.attribution,
  };
  if (ping.cartItems.length > 0) {
    patch.cart = ping.cartItems.map(({ productId, name, color, size, quantity, price, image }) => ({
      productId,
      name,
      color,
      size,
      quantity,
      price,
      image,
    }));
    patch.cartValue = cartValueOf(ping.cartItems);
  }
  if (ping.orderId) patch.orderId = ping.orderId;
  if (ping.paymentStatus) patch.paymentStatus = ping.paymentStatus;
  await upsertLiveSession(patch);
}

export async function markLivePurchased(input: {
  clientId?: string;
  orderId?: string;
  email?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await updateAdminState((state) => {
    for (const session of state.sessions) {
      const visitor = asVisitor(session);
      const matchClient = Boolean(input.clientId && (visitor.clientId === input.clientId || visitor.id === input.clientId));
      const matchOrder = Boolean(input.orderId && visitor.orderId === input.orderId);
      const matchEmail = Boolean(input.email && visitor.customerEmail && visitor.customerEmail === input.email);
      if (!matchClient && !matchOrder && !matchEmail) continue;
      session.paymentStatus = "paid";
      session.stage = "ordered";
      session.lastSeen = now;
      session.orderId = input.orderId || session.orderId;
    }
  });
}

function asRecord(value: LiveSession): Record<string, unknown> {
  return value as unknown as Record<string, unknown>;
}

function trafficSourceOf(raw: unknown): TrafficSource {
  const value = String(raw ?? "").toLowerCase();
  if (value.includes("tiktok")) return "tiktok";
  if (value.includes("meta") || value.includes("facebook") || value.includes("instagram")) return "meta";
  if (value.includes("google")) return "google";
  if (value.includes("direct") || value.includes("direto") || !value) return "direct";
  return "other";
}

function asVisitor(session: LiveSession): LiveVisitor {
  const rec = asRecord(session);
  const trail = Array.isArray(rec["trail"]) ? (rec["trail"] as { label?: string }[]) : [];
  const paths = [String(rec["path"] ?? session.path ?? "/"), ...trail.map((entry) => String(entry.label ?? ""))];
  const cartItems = asLines(rec["cartItems"] ?? session.cart ?? []);
  const lastAt = String(rec["lastAt"] ?? session.lastSeen ?? new Date().toISOString());
  const startedAt = String(rec["startedAt"] ?? session.firstSeen ?? lastAt);
  const purchased = rec["purchased"] === true || session.paymentStatus === "paid" || session.stage === "ordered";
  const path = String(rec["path"] ?? session.path ?? "/");
  const customer = session.customer ?? { name: "", email: "", phone: "" };
  return {
    id: session.id,
    clientId: String(rec["clientId"] ?? session.attribution?.clientId ?? session.id),
    startedAt,
    lastAt,
    path,
    referrer: String(rec["referrer"] ?? session.referrer ?? ""),
    source: trafficSourceOf(rec["source"] ?? session.source),
    device: session.device === "mobile" || session.device === "tablet" || rec["device"] === "mobile" ? "mobile" : "desktop",
    stage: stageFromPath(path, purchased),
    pageViews: Number(rec["pageViews"] ?? rec["views"] ?? session.views ?? 0) || 0,
    sawProduct: rec["sawProduct"] === true || paths.some((entry) => entry.startsWith("/produtos/")),
    addedCart: rec["addedCart"] === true || cartItems.length > 0 || session.cartValue > 0,
    startedCheckout:
      rec["startedCheckout"] === true || paths.some((entry) => entry.startsWith("/checkout") || entry.startsWith("/pedido")),
    addedPayment: rec["addedPayment"] === true || Boolean(session.paymentStatus) || Boolean(session.orderId),
    purchased,
    cartValue: Number(rec["cartValue"] ?? session.cartValue ?? cartValueOf(cartItems)) || 0,
    cartItems,
    customerName: String(rec["customerName"] ?? customer.name ?? ""),
    customerEmail: String(rec["customerEmail"] ?? customer.email ?? ""),
    customerPhone: String(rec["customerPhone"] ?? customer.phone ?? ""),
    orderId: String(rec["orderId"] ?? session.orderId ?? ""),
    paymentStatus: session.paymentStatus || "",
    ip: String(rec["ip"] ?? session.ip ?? ""),
    userAgent: String(rec["userAgent"] ?? session.userAgent ?? ""),
  };
}

function inWindow(iso: string, since: number): boolean {
  return Date.parse(iso) >= since;
}

function funnelOf(sessions: LiveVisitor[], since: number, label: string): FunnelWindow {
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

function sourceFunnelsOf(sessions: LiveVisitor[], since: number): SourceFunnels {
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

function abandonStatus(session: LiveVisitor, now: number, online: boolean): AbandonedCart["status"] {
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

function groupPages(online: LiveVisitor[]): LivePageHit[] {
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
  const sessions = state.sessions.map(asVisitor).filter((session) => !session.path.startsWith("/admin"));
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
