export const ONLINE_MS = 5 * 60_000;
export const CLOCK_SKEW_MS = 60_000;

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
