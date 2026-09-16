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
