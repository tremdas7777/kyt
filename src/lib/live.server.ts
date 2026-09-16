import { getAdminState, updateAdminState, upsertLiveSession } from "@/lib/admin-store.server";
import { trafficPlatformFrom } from "@/lib/ad-origin";
import { funnelFlags, funnelStageFromPath, inLivePeriod, lastActivityAt, ONLINE_MS } from "@/lib/live-window";
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
  StoreOrder,
  TrackingLog,
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

export { ONLINE_MS };
export const ABANDON_MS = 15 * 60 * 1000;

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || "";
}

export function sourceFrom(
  attr: Attribution,
  referrer: string,
  utm?: { source?: string; medium?: string },
  userAgent?: string,
): TrafficSource {
  return trafficPlatformFrom({
    attr,
    referrer,
    utmSource: utm?.source,
    utmMedium: utm?.medium,
    userAgent,
  });
}

export function stageFromPath(path: string, purchased: boolean): FunnelStage {
  return funnelStageFromPath(path, purchased);
}

function liveStageFrom(path: string, purchased: boolean, cartSize: number, event: string): LiveStage {
  if (purchased || event === "Purchase") return "ordered";
  if (path.startsWith("/pedido") || path.startsWith("/obrigado")) return "ordered";
  if (event === "InitiateCheckout" || event === "CompletePayment" || path.startsWith("/checkout")) return "checkout";
  if (event === "AddToCart" || cartSize > 0 || path.startsWith("/carrinho")) return "cart";
  return "browsing";
}

function osOf(ua: string): string {
  if (/iphone|ipad|ios/i.test(ua)) return "iOS";
  if (/android/i.test(ua)) return "Android";
  if (/mac os/i.test(ua)) return "macOS";
  if (/windows/i.test(ua)) return "Windows";
  if (/linux/i.test(ua)) return "Linux";
  return "";
}

function browserOf(ua: string): string {
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "Facebook App";
  if (/Instagram/i.test(ua)) return "Instagram";
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\//i.test(ua)) return "Opera";
  if (/Chrome\//i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua)) return "Safari";
  if (/Firefox\//i.test(ua)) return "Firefox";
  return "";
}

function pathFromSourceUrl(url: string): string {
  const value = url.trim();
  if (!value) return "";
  try {
    return new URL(value, "https://capacetekyt.com.br").pathname || "/";
  } catch {
    return value.startsWith("/") ? value : "";
  }
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

export type LiveSessionExtras = Partial<Pick<LiveSession, "title" | "utm" | "source">>;

export async function ingestLive(request: Request, ping: LivePing, extra?: LiveSessionExtras): Promise<void> {
  const clientId = ping.clientId || ping.attribution.clientId;
  if (!clientId) return;
  if (ping.path.startsWith("/admin")) return;
  const ua = request.headers.get("user-agent") ?? "";
  const purchased = ping.event === "Purchase" || ping.paymentStatus === "paid";
  const patch: Parameters<typeof upsertLiveSession>[0] = {
    id: clientId,
    path: ping.path || "/",
    stage: liveStageFrom(ping.path, purchased, ping.cartItems.length, ping.event),
    device: deviceOf(ua),
    os: osOf(ua),
    browser: browserOf(ua),
    referrer: ping.referrer,
    source: extra?.source || sourceFrom(ping.attribution, ping.referrer, extra?.utm, ua),
    ip: clientIp(request),
    userAgent: ua,
    city: request.headers.get("cf-ipcity") ?? request.headers.get("x-vercel-ip-city") ?? "",
    region: request.headers.get("cf-region-code") ?? request.headers.get("x-vercel-ip-country-region") ?? "",
    country: request.headers.get("cf-ipcountry") ?? request.headers.get("x-vercel-ip-country") ?? "",
    customer: {
      name: ping.customerName,
      email: ping.customerEmail,
      phone: ping.customerPhone,
    },
    attribution: ping.attribution,
  };
  if (extra?.title) patch.title = extra.title;
  if (extra?.utm) patch.utm = extra.utm;
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
  const trailHints = trailHintsForEvent(ping.event, ping.path);
  await upsertLiveSession(trailHints.length ? { ...patch, trailHints } : patch);
}

function trailHintsForEvent(event: string, path: string): string[] {
  if (event === "ViewContent") return [path.startsWith("/produtos") ? path : "/produtos"];
  if (event === "AddToCart") return ["/carrinho"];
  if (event === "InitiateCheckout" || event === "CompletePayment" || event === "AddPaymentInfo") return ["/checkout"];
  if (event === "Purchase") return ["/obrigado"];
  return [];
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
      const trail = Array.isArray(session.trail) ? session.trail : [];
      session.trail = [{ at: now, label: "/obrigado" }, ...trail].slice(0, 80);
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
  const trailRaw = Array.isArray(rec["trail"]) ? (rec["trail"] as { at?: string; label?: string; path?: string }[]) : [];
  const trail = trailRaw
    .map((entry) => ({
      at: String(entry.at ?? ""),
      path: String(entry.path ?? entry.label ?? ""),
    }))
    .filter((entry) => entry.at && entry.path);
  const paths = [String(rec["path"] ?? session.path ?? "/"), ...trail.map((entry) => entry.path)];
  const cartItems = asLines(rec["cartItems"] ?? session.cart ?? []);
  const startedAt = String(rec["startedAt"] ?? session.firstSeen ?? session.lastSeen ?? "");
  const lastAt = String(rec["lastAt"] ?? session.lastSeen ?? startedAt);
  const purchased = rec["purchased"] === true || session.paymentStatus === "paid";
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
    trail,
  };
}

function funnelOf(sessions: LiveVisitor[], since: number, label: string): FunnelWindow {
  const now = Date.now();
  let visit = 0;
  let product = 0;
  let cart = 0;
  let checkout = 0;
  let purchase = 0;
  let revenue = 0;
  for (const session of sessions) {
    const flags = funnelFlags(session, since, now);
    if (!flags.visit) continue;
    visit += 1;
    if (flags.product) product += 1;
    if (flags.cart) cart += 1;
    if (flags.checkout) checkout += 1;
    if (flags.purchase) {
      purchase += 1;
      revenue += session.cartValue;
    }
  }
  return { label, visit, product, cart, checkout, purchase, revenue };
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
  const idle = now - lastActivityAt(session);
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

const HISTORY_EVENTS = new Set([
  "PageView",
  "ViewContent",
  "AddToCart",
  "InitiateCheckout",
  "AddPaymentInfo",
  "CompletePayment",
  "Purchase",
]);

function emptyVisitor(id: string, at: string, path: string): LiveVisitor {
  return {
    id,
    clientId: id,
    startedAt: at,
    lastAt: at,
    path,
    referrer: "",
    source: "direct",
    device: "desktop",
    stage: stageFromPath(path, false),
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
    trail: [],
  };
}

function eventPath(event: TrackingLog): string {
  const fromLog = pathFromSourceUrl(event.path ?? "");
  if (fromLog) return fromLog;
  if (event.event === "ViewContent") return "/produtos";
  if (event.event === "AddToCart") return "/carrinho";
  if (event.event === "InitiateCheckout" || event.event === "CompletePayment" || event.event === "AddPaymentInfo") return "/checkout";
  if (event.event === "Purchase") return "/obrigado";
  return "/";
}

function applyTrail(visitor: LiveVisitor, at: string, path: string) {
  const exists = visitor.trail.some((entry) => entry.at === at && entry.path === path);
  if (!exists) visitor.trail = [{ at, path }, ...visitor.trail].slice(0, 40);
  if (Date.parse(at) < Date.parse(visitor.startedAt)) visitor.startedAt = at;
  if (Date.parse(at) >= Date.parse(visitor.lastAt)) {
    visitor.lastAt = at;
    visitor.path = path;
  }
  visitor.pageViews += 1;
  if (path.startsWith("/produtos/") || path === "/produtos") visitor.sawProduct = true;
  if (path.startsWith("/carrinho")) visitor.addedCart = true;
  if (path.startsWith("/checkout") || path.startsWith("/pedido") || path.startsWith("/obrigado")) visitor.startedCheckout = true;
  visitor.stage = stageFromPath(visitor.path, visitor.purchased);
}

function hydrateFromEvents(visitors: LiveVisitor[], events: TrackingLog[]): LiveVisitor[] {
  const byId = new Map(visitors.map((visitor) => [visitor.clientId || visitor.id, visitor]));
  const extra: LiveVisitor[] = [];
  for (const event of events) {
    if (!HISTORY_EVENTS.has(event.event)) continue;
    const path = eventPath(event);
    const clientId = (event.clientId ?? "").trim();
    if (clientId) {
      const current = byId.get(clientId) ?? emptyVisitor(clientId, event.at, path);
      applyTrail(current, event.at, path);
      if (event.event === "ViewContent") current.sawProduct = true;
      if (event.event === "AddToCart") current.addedCart = true;
      if (event.event === "InitiateCheckout" || event.event === "CompletePayment") current.startedCheckout = true;
      if (event.event === "AddPaymentInfo" || event.event === "CompletePayment") current.addedPayment = true;
      if (event.event === "Purchase") {
        current.purchased = true;
        current.paymentStatus = "paid";
        current.addedPayment = true;
        current.startedCheckout = true;
      }
      if (event.event === "CompletePayment" && !current.purchased) current.paymentStatus = current.paymentStatus || "pending";
      if (["AddToCart", "InitiateCheckout", "AddPaymentInfo", "CompletePayment", "Purchase"].includes(event.event) && event.value > current.cartValue) {
        current.cartValue = event.value;
      }
      if (event.orderId) current.orderId = event.orderId;
      current.stage = stageFromPath(current.path, current.purchased);
      if (!byId.has(clientId)) {
        byId.set(clientId, current);
        extra.push(current);
      }
      continue;
    }
    const synthetic = emptyVisitor(`evt:${event.id}`, event.at, path);
    applyTrail(synthetic, event.at, path);
    synthetic.sawProduct = event.event === "ViewContent" || path.startsWith("/produtos");
    synthetic.addedCart = event.event === "AddToCart" || event.value > 0 && event.event !== "ViewContent" && event.event !== "PageView";
    synthetic.startedCheckout = event.event === "InitiateCheckout" || event.event === "CompletePayment" || event.event === "Purchase";
    synthetic.addedPayment = event.event === "AddPaymentInfo" || event.event === "CompletePayment" || event.event === "Purchase";
    synthetic.purchased = event.event === "Purchase";
    synthetic.paymentStatus = event.event === "Purchase" ? "paid" : event.event === "CompletePayment" ? "pending" : "";
    synthetic.cartValue = ["AddToCart", "InitiateCheckout", "AddPaymentInfo", "CompletePayment", "Purchase"].includes(event.event)
      ? event.value
      : 0;
    synthetic.orderId = event.orderId;
    synthetic.stage = stageFromPath(path, synthetic.purchased);
    extra.push(synthetic);
  }
  return [...visitors, ...extra];
}

function hydrateFromOrders(visitors: LiveVisitor[], orders: StoreOrder[]): LiveVisitor[] {
  const extra: LiveVisitor[] = [];
  for (const order of orders) {
    const paid = order.paymentStatus === "paid";
    const path = paid ? `/obrigado/${order.id}` : `/pedido/${order.id}`;
    const clientId = order.attribution?.clientId || "";
    const match =
      visitors.find((visitor) => visitor.orderId && visitor.orderId === order.id) ||
      (clientId ? visitors.find((visitor) => visitor.clientId === clientId || visitor.id === clientId) : undefined) ||
      (order.customer.email ? visitors.find((visitor) => visitor.customerEmail && visitor.customerEmail === order.customer.email) : undefined);
    const cartItems = asLines(order.items);
    if (match) {
      applyTrail(match, order.createdAt, path);
      match.addedCart = true;
      match.startedCheckout = true;
      match.addedPayment = true;
      match.purchased = paid || match.purchased;
      match.paymentStatus = order.paymentStatus || match.paymentStatus;
      match.orderId = order.id;
      match.customerName = match.customerName || order.customer.name;
      match.customerEmail = match.customerEmail || order.customer.email;
      match.customerPhone = match.customerPhone || order.customer.phone;
      if (cartItems.length) match.cartItems = cartItems;
      if (order.total > match.cartValue) match.cartValue = order.total;
      match.stage = stageFromPath(match.path, match.purchased);
      if (match.source === "direct" || match.source === "other") {
        const next = sourceFrom(order.attribution, "", undefined, order.userAgent);
        if (next !== "direct" && next !== "other") match.source = next;
      }
      continue;
    }
    const visitor = emptyVisitor(clientId || order.id, order.createdAt, path);
    visitor.orderId = order.id;
    visitor.purchased = paid;
    visitor.paymentStatus = order.paymentStatus;
    visitor.addedCart = true;
    visitor.startedCheckout = true;
    visitor.addedPayment = true;
    visitor.sawProduct = true;
    visitor.cartItems = cartItems;
    visitor.cartValue = order.total;
    visitor.customerName = order.customer.name;
    visitor.customerEmail = order.customer.email;
    visitor.customerPhone = order.customer.phone;
    visitor.userAgent = order.userAgent;
    visitor.ip = order.ip;
    visitor.source = sourceFrom(order.attribution, "", undefined, order.userAgent);
    applyTrail(visitor, order.createdAt, "/checkout");
    applyTrail(visitor, order.createdAt, path);
    extra.push(visitor);
  }
  return [...visitors, ...extra];
}

export function buildLiveSnapshot(state: {
  sessions: LiveSession[];
  orders: StoreOrder[];
  events?: TrackingLog[];
}): LiveSnapshot {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const sessions = hydrateFromOrders(
    hydrateFromEvents(
      state.sessions.map(asVisitor).filter((session) => !session.path.startsWith("/admin")),
      state.events ?? [],
    ),
    state.orders,
  );
  const online = sessions
    .filter((session) => inLivePeriod(session, now - ONLINE_MS, now))
    .sort((a, b) => lastActivityAt(b) - lastActivityAt(a));

  const carts: AbandonedCart[] = sessions
    .filter((session) => session.addedCart && session.cartValue > 0 && !session.purchased)
    .map((session) => {
      const idleMs = Math.max(0, now - lastActivityAt(session));
      const isOnline = inLivePeriod(session, now - ONLINE_MS, now);
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
    visitors: sessions.sort((a, b) => lastActivityAt(b) - lastActivityAt(a)),
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
