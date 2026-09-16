export const ONLINE_MS = 5 * 60_000;
export const CLOCK_SKEW_MS = 60_000;
export const HISTORY_MS = 30 * 24 * 60 * 60_000;

export type FunnelFlags = {
  visit: boolean;
  product: boolean;
  cart: boolean;
  checkout: boolean;
  purchase: boolean;
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

export function activityTimes(session: {
  startedAt?: string;
  lastAt?: string;
  trail?: { at?: string }[];
}): number[] {
  const times = [parseLiveTs(session.startedAt), parseLiveTs(session.lastAt)];
  for (const entry of session.trail ?? []) times.push(parseLiveTs(entry.at));
  return times.filter((time) => time > 0);
}

export function lastActivityAt(session: {
  startedAt?: string;
  lastAt?: string;
  trail?: { at?: string }[];
}): number {
  const times = activityTimes(session);
  return times.length ? Math.max(...times) : 0;
}

export function inLivePeriod(
  session: { startedAt?: string; lastAt?: string; trail?: { at?: string }[] },
  since: number,
  now: number,
): boolean {
  const end = now + CLOCK_SKEW_MS;
  return activityTimes(session).some((time) => time >= since && time <= end);
}

export function funnelFlags(
  session: {
    sawProduct?: boolean;
    addedCart?: boolean;
    startedCheckout?: boolean;
    purchased?: boolean;
    path?: string;
    startedAt?: string;
    lastAt?: string;
    trail?: { at?: string; path?: string }[];
  },
  since: number,
  now: number,
): FunnelFlags {
  if (!inLivePeriod(session, since, now)) {
    return { visit: false, product: false, cart: false, checkout: false, purchase: false };
  }
  const end = now + CLOCK_SKEW_MS;
  const paths = [session.path ?? ""];
  for (const entry of session.trail ?? []) {
    const at = parseLiveTs(entry.at);
    if (at >= since && at <= end && entry.path) paths.push(entry.path);
  }
  const hit = (test: (path: string) => boolean) => paths.some(test);
  const purchase = session.purchased === true;
  const checkout =
    purchase ||
    session.startedCheckout === true ||
    hit((path) => path.startsWith("/checkout") || path.startsWith("/pedido") || path.startsWith("/obrigado"));
  const cart = checkout || session.addedCart === true || hit((path) => path.startsWith("/carrinho"));
  const product = cart || session.sawProduct === true || hit((path) => path.startsWith("/produtos"));
  return { visit: true, product, cart, checkout, purchase };
}
