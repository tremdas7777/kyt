import { createFileRoute } from "@tanstack/react-router";

import {
  clearSessionCookie,
  createSessionCookie,
  isAdminRequest,
  json,
  requireAdmin,
  setAdminPassword,
  setupRequired,
  verifyAdminPassword,
} from "@/lib/admin-auth.server";
import { getAdminState, listStoreOrders, listTrackingLogs, savePaymentSettings, saveTrackingSettings } from "@/lib/admin-store.server";
import { emptyAttribution } from "@/lib/ad-origin";
import { getLiveSnapshot } from "@/lib/live.server";
import { dispatchServerTrack } from "@/lib/tracking-capi.server";
import type { TrackingSettings } from "@/lib/tracking-types";
import { emptyPaymentSettings, isPixGateway, type PaymentSettings } from "@/lib/payment-types";

export const Route = createFileRoute("/api/admin/$action")({
  server: {
    handlers: {
      GET: async ({ request, params }) => handleAdmin(request, params.action, "GET"),
      POST: async ({ request, params }) => handleAdmin(request, params.action, "POST"),
      PUT: async ({ request, params }) => handleAdmin(request, params.action, "PUT"),
    },
  },
});

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const raw = await request.text();
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function asTracking(raw: Record<string, unknown>): TrackingSettings {
  const tiktok = raw["tiktok"] && typeof raw["tiktok"] === "object" ? (raw["tiktok"] as Record<string, unknown>) : {};
  const meta = raw["meta"] && typeof raw["meta"] === "object" ? (raw["meta"] as Record<string, unknown>) : {};
  const google = raw["google"] && typeof raw["google"] === "object" ? (raw["google"] as Record<string, unknown>) : {};
  const pixelIds = Array.isArray(tiktok["pixelIds"])
    ? tiktok["pixelIds"].map((id) => String(id).trim()).filter(Boolean)
    : String(tiktok["pixelId"] ?? "")
        .split(/[,\s]+/)
        .map((id) => id.trim())
        .filter(Boolean);
  return {
    tiktok: {
      enabled: tiktok["enabled"] !== false && (tiktok["enabled"] === true || pixelIds.length > 0),
      pixelIds,
      accessToken: String(tiktok["accessToken"] ?? ""),
      testEventCode: String(tiktok["testEventCode"] ?? ""),
      markAsPaidOnPixCreate: tiktok["markAsPaidOnPixCreate"] === true,
    },
    meta: {
      enabled: meta["enabled"] !== false && (meta["enabled"] === true || Boolean(String(meta["pixelId"] ?? "").trim())),
      pixelId: String(meta["pixelId"] ?? "").trim(),
      accessToken: String(meta["accessToken"] ?? "").trim(),
      testEventCode: String(meta["testEventCode"] ?? "").trim(),
    },
    google: {
      enabled:
        google["enabled"] !== false &&
        (google["enabled"] === true || Boolean(String(google["measurementId"] ?? google["adsId"] ?? "").trim())),
      measurementId: String(google["measurementId"] ?? "").trim(),
      apiSecret: String(google["apiSecret"] ?? "").trim(),
      adsId: String(google["adsId"] ?? "").trim(),
      adsPurchaseLabel: String(google["adsPurchaseLabel"] ?? "").trim(),
    },
  };
}

async function handleAdmin(request: Request, action: string, method: string): Promise<Response> {
  if (action === "session" && method === "GET") {
    return json(200, {
      ok: true,
      authenticated: await isAdminRequest(request),
      setupRequired: await setupRequired(),
    });
  }

  if (action === "setup" && method === "POST") {
    if (!(await setupRequired())) return json(400, { ok: false, message: "A senha já foi criada." });
    const body = await readJson(request);
    const password = String(body["password"] ?? "");
    if (password.length < 6) return json(400, { ok: false, message: "Use pelo menos 6 caracteres." });
    await setAdminPassword(password);
    return json(200, { ok: true }, { "Set-Cookie": await createSessionCookie() });
  }

  if (action === "login" && method === "POST") {
    const body = await readJson(request);
    const password = String(body["password"] ?? "");
    if (!(await verifyAdminPassword(password))) {
      return json(401, { ok: false, message: "Senha incorreta." });
    }
    return json(200, { ok: true }, { "Set-Cookie": await createSessionCookie() });
  }

  if (action === "logout" && (method === "POST" || method === "GET")) {
    return json(200, { ok: true }, { "Set-Cookie": clearSessionCookie() });
  }

  const denied = await requireAdmin(request);
  if (denied) return denied;

  if (action === "tracking" && method === "GET") {
    const state = await getAdminState();
    return json(200, { ok: true, tracking: state.tracking });
  }

  if (action === "tracking" && (method === "POST" || method === "PUT")) {
    const body = await readJson(request);
    const tracking = asTracking(body);
    const saved = await saveTrackingSettings(tracking);
    return json(200, { ok: true, tracking: saved });
  }

  if (action === "payment" && method === "GET") {
    const state = await getAdminState();
    return json(200, { ok: true, payment: state.payment ?? emptyPaymentSettings() });
  }

  if (action === "payment" && (method === "POST" || method === "PUT")) {
    const body = await readJson(request);
    const magic = body["magicpay"] && typeof body["magicpay"] === "object" ? (body["magicpay"] as Record<string, unknown>) : {};
    const payment: PaymentSettings = {
      pixGateway: isPixGateway(body["pixGateway"]) ? body["pixGateway"] : "legacy",
      pixGatewayChosen: true,
      magicpay: {
        publicKey: String(magic["publicKey"] ?? "").trim(),
        secretKey: String(magic["secretKey"] ?? "").trim(),
        apiUrl: String(magic["apiUrl"] ?? "").trim() || emptyPaymentSettings().magicpay.apiUrl,
      },
    };
    const saved = await savePaymentSettings(payment);
    return json(200, { ok: true, payment: saved });
  }

  if (action === "test-magicpay" && method === "POST") {
    try {
      const body = await readJson(request);
      const { testMagicPayConnection } = await import("@/lib/magicpay.server");
      const magic = body["magicpay"] && typeof body["magicpay"] === "object" ? (body["magicpay"] as Record<string, unknown>) : {};
      const result = await testMagicPayConnection({
        publicKey: String(magic["publicKey"] ?? body["publicKey"] ?? "").trim(),
        secretKey: String(magic["secretKey"] ?? body["secretKey"] ?? "").trim(),
        apiUrl: String(magic["apiUrl"] ?? body["apiUrl"] ?? "").trim(),
      });
      return json(result.ok ? 200 : 400, { ok: result.ok, message: result.message });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao testar a MagicPay.";
      return json(400, { ok: false, message });
    }
  }

  if (action === "test-pixel" && method === "POST") {
    const body = await readJson(request);
    const event = String(body["event"] ?? "ViewContent");
    await dispatchServerTrack(
      {
        event,
        eventId: `test_${crypto.randomUUID().slice(0, 8)}`,
        value: 297,
        currency: "BRL",
        contents: [{ id: "d-city", name: "D-City", quantity: 1, price: 297 }],
        attribution: { ...emptyAttribution(), clientId: "kyt-admin-test" },
      },
      request,
      { force: true },
    );
    return json(200, { ok: true, message: "Evento de teste enviado." });
  }

  if (action === "orders" && method === "GET") {
    const orders = await listStoreOrders();
    return json(200, { ok: true, orders });
  }

  if (action === "live" && method === "GET") {
    const live = await getLiveSnapshot();
    return json(200, { ok: true, ...live });
  }

  if (action === "events" && method === "GET") {
    const events = await listTrackingLogs();
    return json(200, { ok: true, events });
  }

  if (action === "dashboard" && method === "GET") {
    const [state, orders, events] = await Promise.all([getAdminState(), listStoreOrders(), listTrackingLogs()]);
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const paid = orders.filter((order) => order.paymentStatus === "paid");
    const todayPaid = paid.filter((order) => now - new Date(order.createdAt).getTime() < day);
    const pending = orders.filter((order) => order.paymentStatus === "pending");
    const revenue = paid.reduce((sum, order) => sum + order.total, 0);
    const revenueToday = todayPaid.reduce((sum, order) => sum + order.total, 0);
    const live = await getLiveSnapshot();
    return json(200, {
      ok: true,
      stats: {
        orders: orders.length,
        paid: paid.length,
        pending: pending.length,
        revenue,
        revenueToday,
        todayPaid: todayPaid.length,
        online: live.onlineCount,
        abandonedToday: live.abandonedToday,
        abandonedValueToday: live.abandonedValueToday,
        conversionToday: live.conversionToday,
        pixels: {
          tiktok: state.tracking.tiktok.enabled && state.tracking.tiktok.pixelIds.length > 0,
          meta: state.tracking.meta.enabled && Boolean(state.tracking.meta.pixelId),
          google: state.tracking.google.enabled && Boolean(state.tracking.google.measurementId || state.tracking.google.adsId),
          capi: Boolean(state.tracking.meta.accessToken),
          tiktokApi: Boolean(state.tracking.tiktok.accessToken),
        },
      },
      recentOrders: orders.slice(0, 8),
      recentAbandoned: live.carts.slice(0, 8),
      recentEvents: events.slice(0, 8),
    });
  }

  return json(404, { ok: false, message: "Rota do painel não encontrada." });
}
