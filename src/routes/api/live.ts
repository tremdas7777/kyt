import { createFileRoute } from "@tanstack/react-router";

import { upsertLiveSession } from "@/lib/admin-store.server";
import { json } from "@/lib/admin-auth.server";
import { ingestLive, pingFromUnknown } from "@/lib/live.server";
import type { Attribution, LiveCartItem, LiveSession, LiveStage } from "@/lib/tracking-types";

export const Route = createFileRoute("/api/live")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Record<string, unknown> = {};
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return json(400, { ok: false });
        }

        try {
          await ingestLive(request, pingFromUnknown(body, request));
        } catch {
          // snapshot ingest is best-effort
        }

        const id = String(body["sessionId"] ?? body["clientId"] ?? "").trim();
        if (!id) return json(400, { ok: false, message: "Sessão ausente." });

        const headers = request.headers;
        const userAgent = headers.get("user-agent") ?? "";
        const cart = normalizeCart(body["cart"] ?? body["cartItems"]);
        const cartValue = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const stage = normalizeStage(body["stage"], cart.length, String(body["path"] ?? ""));
        const referrer = String(body["referrer"] ?? "").trim();
        const utmRaw = body["utm"] && typeof body["utm"] === "object" ? (body["utm"] as Record<string, unknown>) : {};
        const utm = {
          source: String(utmRaw["source"] ?? ""),
          medium: String(utmRaw["medium"] ?? ""),
          campaign: String(utmRaw["campaign"] ?? ""),
          content: String(utmRaw["content"] ?? ""),
          term: String(utmRaw["term"] ?? ""),
        };
        const attribution =
          body["attribution"] && typeof body["attribution"] === "object" ? (body["attribution"] as Partial<Attribution>) : {};
        const customerRaw =
          body["customer"] && typeof body["customer"] === "object" ? (body["customer"] as Record<string, unknown>) : {};

        const patch: Partial<LiveSession> & { id: string } = {
          id,
          path: String(body["path"] ?? "/"),
          title: String(body["title"] ?? "").slice(0, 120),
          stage,
          device: deviceOf(userAgent),
          os: osOf(userAgent),
          browser: browserOf(userAgent),
          referrer,
          source: sourceOf(referrer, utm, attribution),
          utm,
          city: headers.get("cf-ipcity") ?? headers.get("x-vercel-ip-city") ?? "",
          region: headers.get("cf-region-code") ?? headers.get("x-vercel-ip-country-region") ?? "",
          country: headers.get("cf-ipcountry") ?? headers.get("x-vercel-ip-country") ?? "",
          ip: headers.get("cf-connecting-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "",
          userAgent,
          cart,
          cartValue,
          customer: {
            name: String(customerRaw["name"] ?? body["customerName"] ?? ""),
            email: String(customerRaw["email"] ?? body["customerEmail"] ?? ""),
            phone: String(customerRaw["phone"] ?? body["customerPhone"] ?? ""),
          },
          attribution: attribution as Attribution,
        };

        const orderId = String(body["orderId"] ?? "").trim();
        if (orderId) patch.orderId = orderId;
        const status = String(body["paymentStatus"] ?? "").trim();
        if (status === "pending" || status === "paid" || status === "failed") patch.paymentStatus = status;

        await upsertLiveSession(patch);
        return json(200, { ok: true });
      },
    },
  },
});

function normalizeCart(raw: unknown): LiveCartItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 20).map((entry) => {
    const item = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
    return {
      productId: String(item["productId"] ?? item["id"] ?? ""),
      name: String(item["name"] ?? ""),
      color: String(item["color"] ?? ""),
      size: String(item["size"] ?? ""),
      quantity: Number(item["quantity"] ?? 1) || 1,
      price: Number(item["price"] ?? 0) || 0,
      image: String(item["image"] ?? ""),
    };
  });
}

function normalizeStage(raw: unknown, cartSize: number, path: string): LiveStage {
  const value = String(raw ?? "");
  if (path.startsWith("/pedido") || path.startsWith("/obrigado")) return "ordered";
  if (path.startsWith("/checkout")) return "checkout";
  if (value === "ordered" || value === "checkout" || value === "cart" || value === "browsing") {
    if (value === "browsing" && cartSize > 0) return "cart";
    return value;
  }
  return cartSize > 0 || path.startsWith("/carrinho") ? "cart" : "browsing";
}

function deviceOf(ua: string): "mobile" | "tablet" | "desktop" {
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/mobile|android|iphone/i.test(ua)) return "mobile";
  return "desktop";
}

function osOf(ua: string): string {
  if (/iphone|ipad|ios/i.test(ua)) return "iOS";
  if (/android/i.test(ua)) return "Android";
  if (/mac os/i.test(ua)) return "macOS";
  if (/windows/i.test(ua)) return "Windows";
  if (/linux/i.test(ua)) return "Linux";
  return "—";
}

function browserOf(ua: string): string {
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "Facebook App";
  if (/Instagram/i.test(ua)) return "Instagram";
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\//i.test(ua)) return "Opera";
  if (/Chrome\//i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua)) return "Safari";
  if (/Firefox\//i.test(ua)) return "Firefox";
  return "—";
}

function sourceOf(referrer: string, utm: { source: string; medium: string }, attribution: Partial<Attribution>): string {
  if (attribution.fbclid || /facebook|instagram/i.test(utm.source) || /fb|meta|ig/i.test(utm.source)) return "Meta Ads";
  if (attribution.ttclid || /tiktok/i.test(utm.source)) return "TikTok";
  if (attribution.gclid || attribution.gbraid || attribution.wbraid || /google.*(cpc|ads)/i.test(`${utm.source}${utm.medium}`))
    return "Google Ads";
  if (utm.source) return utm.source;
  if (!referrer) return "direto";
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    if (/facebook|instagram/.test(host)) return "Meta (orgânico)";
    if (/tiktok/.test(host)) return "TikTok (orgânico)";
    if (/google/.test(host)) return "Google (orgânico)";
    return host;
  } catch {
    return "direto";
  }
}
