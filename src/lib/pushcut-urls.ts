const KEY = "kyt-pushcut-urls";

export type PushcutUrls = { pendingUrl: string; paidUrl: string };

export function readPushcutUrls(): PushcutUrls {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { pendingUrl: "", paidUrl: "" };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      pendingUrl: String(parsed["pendingUrl"] ?? "").trim(),
      paidUrl: String(parsed["paidUrl"] ?? "").trim(),
    };
  } catch {
    return { pendingUrl: "", paidUrl: "" };
  }
}

export function storePushcutUrls(pendingUrl?: string, paidUrl?: string): PushcutUrls {
  const prev = readPushcutUrls();
  const next: PushcutUrls = {
    pendingUrl: String(pendingUrl ?? "").trim() || prev.pendingUrl,
    paidUrl: String(paidUrl ?? "").trim() || prev.paidUrl,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // modo privado
  }
  return next;
}
