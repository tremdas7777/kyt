import { createFileRoute } from "@tanstack/react-router";

import { upsertStoreOrder } from "@/lib/admin-store.server";
import { json } from "@/lib/admin-auth.server";
import { attributionFromUnknown, maybeMarkGeneratedAsPaid, sendPendingOrderPurchase } from "@/lib/tracking-capi.server";
import type { StoreOrder } from "@/lib/tracking-types";
import { emptyAttr } from "@/lib/admin-store.server";

export const Route = createFileRoute("/api/orders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Record<string, unknown>;
          const customer = (body["customer"] && typeof body["customer"] === "object" ? body["customer"] : {}) as StoreOrder["customer"];
          const items = Array.isArray(body["items"]) ? (body["items"] as StoreOrder["items"]) : [];
          const ip =
            request.headers.get("cf-connecting-ip") ||
            request.headers.get("x-real-ip") ||
            (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ||
            "";
          const order: StoreOrder = {
            id: String(body["id"] ?? `KYT-${Date.now().toString(36).toUpperCase()}`),
            createdAt: String(body["createdAt"] ?? new Date().toISOString()),
            items,
            customer,
            subtotal: Number(body["subtotal"] ?? 0),
            shipping: Number(body["shipping"] ?? 0),
            total: Number(body["total"] ?? 0),
            discount: Number(body["discount"] ?? 0),
            paymentStatus: (body["paymentStatus"] as StoreOrder["paymentStatus"]) || "pending",
            eventId: String(body["eventId"] ?? `pur_${String(body["id"] ?? "")}`),
            attribution: { ...emptyAttr(), ...attributionFromUnknown(body["attribution"]) },
            userAgent: String(body["userAgent"] ?? request.headers.get("user-agent") ?? ""),
            ip,
            purchaseSent: body["purchaseSent"] === true,
          };
          if (typeof body["transactionId"] === "string" && body["transactionId"]) order.transactionId = body["transactionId"];
          if (typeof body["referenceId"] === "string" && body["referenceId"]) order.referenceId = body["referenceId"];
          if (body["pix"] && typeof body["pix"] === "object") {
            order.pix = body["pix"] as NonNullable<StoreOrder["pix"]>;
          }
          if (typeof body["installments"] === "number") order.installments = body["installments"];
          const { isPixGateway } = await import("@/lib/payment-types");
          if (isPixGateway(body["paymentGateway"])) {
            order.paymentGateway = body["paymentGateway"];
          }
          if (typeof body["parentOrderId"] === "string" && body["parentOrderId"].trim()) {
            order.parentOrderId = body["parentOrderId"].trim().slice(0, 64);
          }
          if (body["shippingMethod"] === "full" || body["shippingMethod"] === "gratis") {
            order.shippingMethod = body["shippingMethod"];
          }
          if (typeof body["errorMessage"] === "string" && body["errorMessage"].trim()) {
            order.errorMessage = body["errorMessage"].trim().slice(0, 280);
          }
          const saved = await upsertStoreOrder(order);
          try {
            const { notifyPushcutOrder } = await import("@/lib/pushcut.server");
            if (saved.paymentStatus === "paid") await notifyPushcutOrder(saved, "paid");
            else if (saved.paymentStatus === "pending") await notifyPushcutOrder(saved, "pending");
          } catch {
            // aviso Pushcut não pode bloquear o pedido
          }
          try {
            const { reportOrderToUtmify } = await import("@/lib/utmify.server");
            if (saved.paymentStatus === "paid") await reportOrderToUtmify(saved, "paid");
            else if (saved.paymentStatus === "pending") await reportOrderToUtmify(saved, "waiting_payment");
          } catch {
            // UTMify não pode bloquear o pedido
          }
          try {
            await maybeMarkGeneratedAsPaid(saved, request);
            await sendPendingOrderPurchase(saved, request);
          } catch {
            // pedido já está salvo; tracking não pode impedir o painel de ver a compra
          }
          try {
            const { ingestLive, markLiveOrder } = await import("@/lib/live.server");
            const paid = saved.paymentStatus === "paid";
            await ingestLive(request, {
              clientId: saved.attribution.clientId || saved.id,
              path: paid ? `/obrigado/${saved.id}` : `/pedido/${saved.id}`,
              referrer: "",
              event: paid ? "Purchase" : saved.paymentStatus === "pending" ? "CompletePayment" : "AddPaymentInfo",
              cartItems: saved.items.map((item) => ({
                id: item.id,
                productId: item.productId,
                name: item.name,
                color: item.color,
                size: item.size,
                quantity: item.quantity,
                price: item.price,
                image: item.image,
              })),
              attribution: saved.attribution,
              customerName: saved.customer.name,
              customerEmail: saved.customer.email,
              customerPhone: saved.customer.phone,
              orderId: saved.id,
              paymentStatus: saved.paymentStatus,
            });
            await markLiveOrder({
              clientId: saved.attribution.clientId || saved.id,
              orderId: saved.id,
              email: saved.customer.email,
              paymentStatus: saved.paymentStatus,
            });
          } catch {
            // mesmo se o live falhar, o pedido permanece no painel
          }
          return json(200, { ok: true, id: saved.id });
        } catch (error) {
          return json(400, { ok: false, message: error instanceof Error ? error.message : "Pedido inválido." });
        }
      },
    },
  },
});
