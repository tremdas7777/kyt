import { emptyAttribution, trafficPlatformFrom } from "@/lib/ad-origin";
import { ingestLive, type LivePing } from "@/lib/live.server";
import { appendTrackingLog } from "@/lib/admin-store.server";
import type { Attribution } from "@/lib/tracking-types";

const CID_COOKIE = "kyt-cid";
const BOT =
  /bot|crawl|spider|slurp|facebookexternalhit|facebot|preview|whatsapp|telegram|discordbot|linkedinbot|embedly|quora|pinterest|skype|vkshare|w3c_validator|google-inspectiontool/i;

function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

function clickIdFromFbc(fbc: string): string {
  const parts = fbc.split(".");
  return parts.length >= 4 ? parts.slice(3).join(".") : "";
}

function attributionFromRequest(url: URL, cookies: Record<string, string>, clientId: string): Attribution {
  const fbclid = url.searchParams.get("fbclid") || clickIdFromFbc(cookies["_fbc"] ?? "") || "";
  const fbc = cookies["_fbc"] || (fbclid ? `fb.1.${Date.now()}.${fbclid}` : "");
  return {
    ...emptyAttribution(),
    clientId,
    fbclid,
    fbc,
    fbp: cookies["_fbp"] ?? "",
    ttclid: url.searchParams.get("ttclid") || cookies["ttclid"] || "",
    ttp: cookies["_ttp"] ?? "",
    gclid: url.searchParams.get("gclid") || cookies["_kyt_gclid"] || "",
    gbraid: url.searchParams.get("gbraid") ?? "",
    wbraid: url.searchParams.get("wbraid") ?? "",
    utmSource: url.searchParams.get("utm_source") ?? "",
    utmMedium: url.searchParams.get("utm_medium") ?? "",
  };
}

function isDocumentGet(request: Request): boolean {
  if (request.method !== "GET") return false;
  const accept = request.headers.get("accept") ?? "";
  if (accept && !accept.includes("text/html") && !accept.includes("*/*")) return false;
  try {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path.startsWith("/api") || path.startsWith("/admin") || path.startsWith("/webhooks")) return false;
    if (/\.(js|css|png|jpe?g|webp|svg|ico|gif|woff2?|map|json|txt|xml)$/i.test(path)) return false;
    return true;
  } catch {
    return false;
  }
}

export function prepareDocumentVisit(request: Request): { cookie?: string; ingest: () => Promise<void> } | null {
  if (!isDocumentGet(request)) return null;
  const ua = request.headers.get("user-agent") ?? "";
  if (!ua || BOT.test(ua)) return null;

  const url = new URL(request.url);
  const cookies = parseCookies(request.headers.get("cookie") ?? "");
  let clientId = (cookies[CID_COOKIE] ?? "").trim();
  let cookie: string | undefined;
  if (!clientId) {
    clientId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const secure = url.protocol === "https:" ? "; Secure" : "";
    cookie = `${CID_COOKIE}=${clientId}; Path=/; Max-Age=${730 * 24 * 3600}; SameSite=Lax${secure}`;
  }

  const attribution = attributionFromRequest(url, cookies, clientId);
  const referrer = request.headers.get("referer") ?? "";
  const source = trafficPlatformFrom({ attr: attribution, referrer, userAgent: ua });
  const path = url.pathname || "/";
  const ping: LivePing = {
    clientId,
    path,
    referrer,
    event: "PageView",
    cartItems: [],
    cartSpecified: false,
    attribution,
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    orderId: "",
    paymentStatus: "",
  };

  return {
    ...(cookie ? { cookie } : {}),
    ingest: async () => {
      try {
        await ingestLive(request, ping, {
          source,
          utm: {
            source: attribution.utmSource,
            medium: attribution.utmMedium,
            campaign: url.searchParams.get("utm_campaign") ?? "",
            content: url.searchParams.get("utm_content") ?? "",
            term: url.searchParams.get("utm_term") ?? "",
          },
        });
        await appendTrackingLog({
          event: "PageView",
          source: "server",
          eventId: `hit_${clientId.slice(0, 8)}`,
          orderId: "",
          value: 0,
          ok: true,
          detail: source,
          clientId,
          path,
          platform: source,
          ...(attribution.fbclid ? { fbclid: attribution.fbclid } : {}),
        });
      } catch {
        // visit tracking must never break the storefront
      }
    },
  };
}
