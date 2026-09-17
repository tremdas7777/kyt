export const ONLINE_MS = 5 * 60_000;
export const CLOCK_SKEW_MS = 2 * 60 * 60_000;
export const HISTORY_MS = 30 * 24 * 60 * 60_000;

export type FunnelFlags = {
  visit: boolean;
  product: boolean;
  cart: boolean;
  checkout: boolean;
  purchase: boolean;
};

export type FunnelHit = {
  at: number;
  path: string;
};

type LiveStamp = {
  startedAt?: string;
  lastAt?: string;
  path?: string;
  trail?: { at?: string; path?: string; label?: string }[];
};

type FunnelSession = LiveStamp & {
  sawProduct?: boolean;
  addedCart?: boolean;
  startedCheckout?: boolean;
  purchased?: boolean;
  paymentStatus?: string;
  orderId?: string;
  cartValue?: number;
};

export function parseLiveTs(value: string | number | undefined | null): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) return parsed;
  const asNumber = Number(raw);
  return Number.isFinite(asNumber) ? asNumber : 0;
}

export function activityTimes(session: LiveStamp): number[] {
  const times = [parseLiveTs(session.startedAt), parseLiveTs(session.lastAt)];
  for (const entry of session.trail ?? []) times.push(parseLiveTs(entry.at));
  return times.filter((time) => time > 0);
}

export function lastActivityAt(session: LiveStamp): number {
  const times = activityTimes(session);
  return times.length ? Math.max(...times) : 0;
}

export function inLivePeriod(session: LiveStamp, since: number, now: number): boolean {
  const times = activityTimes(session);
  if (!times.length) return false;
  const start = Math.min(...times);
  const last = Math.max(...times);
  const end = now + CLOCK_SKEW_MS;
  const clampedLast = Math.min(last, end);
  return clampedLast >= since && start <= end;
}

export function lastActivityInWindow(session: LiveStamp, since: number, now: number): number {
  const end = now + CLOCK_SKEW_MS;
  const times = activityTimes(session).filter((time) => time >= since && time <= end);
  return times.length ? Math.max(...times) : 0;
}

function trailPath(entry: { path?: string; label?: string } | undefined): string {
  const path = String(entry?.path || entry?.label || "").trim();
  return path;
}

function syntheticHits(session: FunnelSession, since: number, now: number): FunnelHit[] {
  const started = parseLiveTs(session.startedAt);
  const last = parseLiveTs(session.lastAt) || started;
  const end = now + CLOCK_SKEW_MS;
  if (!started && !last) return [];
  const inWindow = (at: number) => at >= since && at <= end;
  const stamp = inWindow(started) ? started : inWindow(last) ? last : 0;
  if (!stamp) return [];
  const hits: FunnelHit[] = [];
  if (session.sawProduct) hits.push({ at: stamp, path: "/produtos" });
  if (session.addedCart || (Number(session.cartValue) || 0) > 0) hits.push({ at: stamp, path: "/carrinho" });
  if (session.startedCheckout || session.paymentStatus === "pending") hits.push({ at: stamp, path: "/checkout" });
  if (session.purchased === true || session.paymentStatus === "paid") hits.push({ at: stamp, path: "/obrigado" });
  else if (session.orderId && session.paymentStatus === "pending") hits.push({ at: stamp, path: `/pedido/${session.orderId}` });
  return hits;
}

export function hitsInWindow(session: FunnelSession, since: number, now: number): FunnelHit[] {
  const end = now + CLOCK_SKEW_MS;
  const hits: FunnelHit[] = [];
  const seen = new Set<string>();
  const push = (at: number, path: string) => {
    if (!path || at < since || at > end) return;
    const key = `${at}|${path}`;
    if (seen.has(key)) return;
    seen.add(key);
    hits.push({ at, path });
  };

  for (const entry of session.trail ?? []) {
    push(parseLiveTs(entry.at), trailPath(entry));
  }

  const last = parseLiveTs(session.lastAt);
  const started = parseLiveTs(session.startedAt);
  const path = session.path ?? "";
  if (last) push(last, path);
  if (started && started !== last) push(started, path);
  if (hits.filter((hit) => hit.path && hit.path !== "/").length === 0) {
    for (const hit of syntheticHits(session, since, now)) push(hit.at, hit.path);
  }

  return hits.sort((a, b) => b.at - a.at);
}

function isProductPath(path: string) {
  return path.startsWith("/produtos");
}

function isCartPath(path: string) {
  return path.startsWith("/carrinho");
}

function isCheckoutPath(path: string) {
  return path.startsWith("/checkout") || path.startsWith("/pedido") || path.startsWith("/obrigado");
}

function isSalePath(path: string) {
  return path.startsWith("/obrigado") || path.startsWith("/pedido");
}

export function funnelFlags(session: FunnelSession, since: number, now: number): FunnelFlags {
  const visit = inLivePeriod(session, since, now);
  if (!visit) {
    return { visit: false, product: false, cart: false, checkout: false, purchase: false };
  }

  const hits = hitsInWindow(session, since, now);
  const hit = (test: (path: string) => boolean) => hits.some((entry) => test(entry.path));
  const started = parseLiveTs(session.startedAt);
  const arrivedInWindow = started >= since && started <= now + CLOCK_SKEW_MS;
  const journey = arrivedInWindow || hits.some((entry) => entry.path && entry.path !== "/");

  const placed = Boolean(session.orderId) && session.paymentStatus !== "failed";
  const paid = session.purchased === true || session.paymentStatus === "paid";
  const purchase = hit(isSalePath) || (journey && paid);
  const checkout =
    purchase ||
    hit(isCheckoutPath) ||
    (journey && (session.startedCheckout === true || session.paymentStatus === "pending" || placed));
  const cart =
    checkout || hit(isCartPath) || (journey && (session.addedCart === true || (Number(session.cartValue) || 0) > 0));
  const product = cart || hit(isProductPath) || (journey && session.sawProduct === true);

  return { visit: true, product, cart, checkout, purchase };
}

export function funnelStageFromPath(path: string, purchased: boolean, paymentStatus?: string) {
  if (purchased || paymentStatus === "paid") return "paid" as const;
  if (paymentStatus === "pending" || path.startsWith("/pedido") || path.startsWith("/obrigado")) return "payment" as const;
  if (path.startsWith("/checkout")) return "checkout" as const;
  if (path.startsWith("/carrinho")) return "cart" as const;
  if (path.startsWith("/produtos/") && path.length > 10) return "product" as const;
  if (path.startsWith("/produtos")) return "listing" as const;
  return "home" as const;
}
