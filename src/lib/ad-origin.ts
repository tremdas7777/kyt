import type { Attribution } from "@/lib/tracking-types";

export function emptyAttribution(): Attribution {
  return {
    fbp: "",
    fbc: "",
    fbclid: "",
    ttclid: "",
    ttp: "",
    gclid: "",
    gbraid: "",
    wbraid: "",
    clientId: "",
    utmSource: "",
    utmMedium: "",
  };
}

function paidMedium(medium: string) {
  return /cpc|ppc|paid|ads|display|cpm|remarketing/i.test(medium.trim());
}

function sourceIs(source: string, names: string[]) {
  const value = source.trim().toLowerCase();
  if (!value) return false;
  return names.some((name) => value === name || value.includes(name));
}

export function fromMetaAds(attr: Attribution): boolean {
  if ((attr.fbclid ?? "").trim() || (attr.fbc ?? "").trim()) return true;
  return sourceIs(attr.utmSource ?? "", ["facebook", "fb", "instagram", "ig", "meta"]) && paidMedium(attr.utmMedium ?? "");
}

export function fromTikTokAds(attr: Attribution): boolean {
  if ((attr.ttclid ?? "").trim()) return true;
  return sourceIs(attr.utmSource ?? "", ["tiktok", "tt"]);
}

export function fromGoogleAds(attr: Attribution): boolean {
  if ((attr.gclid ?? "").trim() || (attr.gbraid ?? "").trim() || (attr.wbraid ?? "").trim()) return true;
  return sourceIs(attr.utmSource ?? "", ["google", "googleads", "adwords", "youtube"]) && paidMedium(attr.utmMedium ?? "");
}

export type TrafficPlatform = "tiktok" | "meta" | "google" | "direct" | "other";

export function isOwnReferrer(referrer: string) {
  const ref = referrer.toLowerCase();
  if (!ref) return true;
  return (
    ref.includes("capacetekyt") ||
    ref.includes("localhost") ||
    ref.includes("127.0.0.1") ||
    ref.includes("lovable") ||
    ref.includes("workers.dev")
  );
}

export function trafficPlatformFrom(input: {
  attr?: Attribution;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  userAgent?: string;
}): TrafficPlatform {
  const attr = input.attr ?? emptyAttribution();
  if ((attr.ttclid ?? "").trim()) return "tiktok";
  if ((attr.fbclid ?? "").trim() || (attr.fbc ?? "").trim()) return "meta";
  if ((attr.gclid ?? "").trim() || (attr.gbraid ?? "").trim() || (attr.wbraid ?? "").trim()) return "google";

  const utmSource = attr.utmSource || input.utmSource || "";
  if (sourceIs(utmSource, ["tiktok", "tt"])) return "tiktok";
  if (sourceIs(utmSource, ["facebook", "fb", "instagram", "ig", "meta"])) return "meta";
  if (sourceIs(utmSource, ["google", "googleads", "adwords", "youtube"])) return "google";

  const ref = (input.referrer ?? "").toLowerCase();
  if (ref && !isOwnReferrer(ref)) {
    if (ref.includes("tiktok") || ref.includes("ttclid")) return "tiktok";
    if (ref.includes("facebook") || ref.includes("fbclid") || ref.includes("instagram") || ref.includes("l.facebook")) {
      return "meta";
    }
    if (ref.includes("google") || ref.includes("youtube") || ref.includes("googleadservices") || ref.includes("gclid")) {
      return "google";
    }
  }

  const ua = (input.userAgent ?? "").toLowerCase();
  if (ua.includes("tiktok") || ua.includes("musical_ly") || ua.includes("bytedance")) return "tiktok";
  if (ua.includes("fban") || ua.includes("fbav") || ua.includes("fb_iab") || ua.includes("instagram")) return "meta";

  if (!ref || isOwnReferrer(ref)) return "direct";
  return "other";
}

export function keepExternalReferrer(incoming: string | undefined, base: string): string {
  const next = (incoming ?? "").trim();
  const stored = (base ?? "").trim();
  if (isOwnReferrer(next) && stored && !isOwnReferrer(stored)) return stored;
  return next || stored;
}
