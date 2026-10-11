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
import { getAdminState, findStoreOrder, listStoreOrders, listTrackingLogs, savePaymentSettings, saveTrackingSettings, upsertStoreOrder } from "@/lib/admin-store.server";
import { emptyAttribution } from "@/lib/ad-origin";
import { getLiveSnapshot } from "@/lib/live.server";
import { dispatchServerTrack } from "@/lib/tracking-capi.server";
import type { StoreOrder, TrackingSettings } from "@/lib/tracking-types";
import { emptyPaymentSettings, isPixGateway, type PaymentSettings, type PublicPaymentSettings } from "@/lib/payment-types";

/** Chave enviada pelo painel; valores mascarados (••••) ou vazios significam "manter a atual". */
function plainKey(raw: unknown): string {
  const rec = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const value = String(rec["apiKey"] ?? "").trim();
  return value.includes("•") ? "" : value;
}

/** Versão do pagamento sem segredos, para o navegador. */
async function publicPayment(payment: PaymentSettings): Promise<PublicPaymentSettings> {
  const { maskSecret } = await import("@/lib/payment-types");
  const { pixgateKeySource } = await import("@/lib/pixgate.server");
  const { sagacePayKeySource } = await import("@/lib/sagacepay.server");
  const [pixgateSource, sagaceSource] = await Promise.all([pixgateKeySource(), sagacePayKeySource()]);
  const { magicpay, pixgate, sagacepay, ...rest } = payment;
  return {
    ...rest,
    magicpay: { apiUrl: magicpay.apiUrl, configured: true, publicKeyMasked: maskSecret(magicpay.publicKey) },
    pixgate: { configured: pixgateSource !== null, apiKeyMasked: maskSecret(pixgate.apiKey) || (pixgateSource === "env" ? "variável de ambiente" : "") },
    sagacepay: { configured: sagaceSource !== null, apiKeyMasked: maskSecret(sagacepay.apiKey) || (sagaceSource === "env" ? "variável de ambiente" : "") },
  };
}

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
  const pushcut = raw["pushcut"] && typeof raw["pushcut"] === "object" ? (raw["pushcut"] as Record<string, unknown>) : {};
  const utmify = raw["utmify"] && typeof raw["utmify"] === "object" ? (raw["utmify"] as Record<string, unknown>) : {};
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
    pushcut: {
      pendingUrl: String(pushcut["pendingUrl"] ?? "").trim(),
      paidUrl: String(pushcut["paidUrl"] ?? "").trim(),
    },
    utmify: { apiToken: String(utmify["apiToken"] ?? "").trim() },
  };
}

async function handleAdmin(request: Request, action: string, method: string): Promise<Response> {
  if (action === "session" && method === "GET") {
    const authenticated = await isAdminRequest(request);
    return json(200, {
      ok: true,
      authenticated,
      setupRequired: authenticated ? false : await setupRequired(),
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
    return json(200, { ok: true, payment: await publicPayment(state.payment ?? emptyPaymentSettings()) });
  }

  if (action === "payment" && (method === "POST" || method === "PUT")) {
    const body = await readJson(request);
    const magic = body["magicpay"] && typeof body["magicpay"] === "object" ? (body["magicpay"] as Record<string, unknown>) : {};
    const payment: PaymentSettings = {
      pixGateway: isPixGateway(body["pixGateway"]) ? body["pixGateway"] : "magicpay",
      pixGatewayChosen: true,
      cardEnabled: body["cardEnabled"] === true,
      cardEnabledChosen: true,
      magicpay: {
        publicKey: String(magic["publicKey"] ?? "").trim(),
        secretKey: String(magic["secretKey"] ?? "").trim(),
        apiUrl: String(magic["apiUrl"] ?? "").trim() || emptyPaymentSettings().magicpay.apiUrl,
      },
      pixgate: { apiKey: plainKey(body["pixgate"]) },
      sagacepay: { apiKey: plainKey(body["sagacepay"]) },
    };
    const saved = await savePaymentSettings(payment);
    return json(200, { ok: true, payment: await publicPayment(saved) });
  }

  if (action === "gateway-key" && method === "DELETE") {
    const body = await readJson(request);
    const gateway = body["gateway"];
    if (gateway !== "pixgate" && gateway !== "sagacepay") return json(400, { ok: false, message: "Gateway inválido." });
    const { clearGatewayKey } = await import("@/lib/admin-store.server");
    const saved = await clearGatewayKey(gateway);
    return json(200, { ok: true, payment: await publicPayment(saved) });
  }

  if (action === "test-gateway" && method === "POST") {
    const body = await readJson(request);
    const gateway = body["gateway"];
    try {
      if (gateway === "pixgate") {
        const { testPixgateKey } = await import("@/lib/pixgate.server");
        const result = await testPixgateKey();
        return json(result.ok ? 200 : 400, result);
      }
      if (gateway === "sagacepay") {
        const { testSagacePayKey } = await import("@/lib/sagacepay.server");
        const result = await testSagacePayKey();
        return json(result.ok ? 200 : 400, result);
      }
      if (gateway === "magicpay") {
        const { testMagicPayConnection } = await import("@/lib/magicpay.server");
        const result = await testMagicPayConnection();
        return json(result.ok ? 200 : 400, result);
      }
      return json(400, { ok: false, message: "Gateway inválido." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao testar o gateway.";
      return json(400, { ok: false, message });
    }
  }

  if (action === "test-magicpay" && method === "POST") {
    try {
      const { testMagicPayConnection } = await import("@/lib/magicpay.server");
      const result = await testMagicPayConnection();
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

  if (action === "test-utmify" && method === "POST") {
    const body = await readJson(request);
    const status = body["status"] === "waiting_payment" ? "waiting_payment" : "paid";
    try {
      const { testUtmify } = await import("@/lib/utmify.server");
      const result = await testUtmify(status);
      return json(result.ok ? 200 : 400, { ok: result.ok, message: result.message });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao testar a UTMify.";
      return json(400, { ok: false, message });
    }
  }

  if (action === "test-pushcut" && method === "POST") {
    const body = await readJson(request);
    const kind = body["kind"] === "paid" ? "paid" : "pending";
    try {
      const { testPushcut } = await import("@/lib/pushcut.server");
      const result = await testPushcut(kind);
      return json(result.ok ? 200 : 400, { ok: result.ok, message: result.message });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao testar o Pushcut.";
      return json(400, { ok: false, message });
    }
  }

  if (action === "pushcut-order" && method === "POST") {
    const body = await readJson(request);
    const kind = body["kind"] === "paid" ? "paid" : "pending";
    const pendingUrl = String(body["pendingUrl"] ?? "").trim();
    const paidUrl = String(body["paidUrl"] ?? "").trim();
    try {
      if (pendingUrl || paidUrl) {
        const state = await getAdminState();
        await saveTrackingSettings({
          ...state.tracking,
          pushcut: {
            pendingUrl: pendingUrl || state.tracking.pushcut.pendingUrl,
            paidUrl: paidUrl || state.tracking.pushcut.paidUrl,
          },
        });
      }
      const snapshot = body["order"] && typeof body["order"] === "object" ? (body["order"] as StoreOrder) : null;
      const id = String(body["orderId"] ?? snapshot?.id ?? "").trim();
      let order = id ? await findStoreOrder({ id }) : undefined;
      if (!order && snapshot?.id) order = await upsertStoreOrder(snapshot);
      if (!order) return json(404, { ok: false, message: "Pedido não encontrado." });
      const { notifyPushcutOrder } = await import("@/lib/pushcut.server");
      const saved = await notifyPushcutOrder(order, kind, { pendingUrl, paidUrl });
      const sent = kind === "paid" ? Boolean(saved.pushcutPaidSent) : Boolean(saved.pushcutPendingSent);
      return json(sent ? 200 : 400, {
        ok: sent,
        message: sent ? "Aviso enviado ao Pushcut." : "Não foi possível enviar o Pushcut. Confira a URL em Integrações.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao enviar o Pushcut.";
      return json(400, { ok: false, message });
    }
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
