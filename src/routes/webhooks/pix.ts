import { createFileRoute } from "@tanstack/react-router";

// Postback da PixGate (?gw=pixgate) e da SagacePay (?gw=sagacepay).
// O corpo não é confiável: usamos só o id da transação e confirmamos o status na API autenticada
// do gateway antes de marcar o pedido como pago.
export const Route = createFileRoute("/webhooks/pix")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const gw = new URL(request.url).searchParams.get("gw");
        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        const nested = (key: string) =>
          body && body[key] && typeof body[key] === "object" ? (body[key] as Record<string, unknown>) : {};
        const rawId =
          gw === "pixgate"
            ? (body?.["transaction_id"] ?? body?.["id"] ?? nested("transaction")["id"] ?? nested("data")["id"])
            : (nested("data")["id"] ?? body?.["id"] ?? nested("sale")["id"]);
        const id = rawId == null ? "" : String(rawId);
        console.log("pix-webhook", gw, body?.["event"], id);
        if ((gw !== "pixgate" && gw !== "sagacepay") || !/^[\w-]{1,64}$/.test(id)) {
          return Response.json({ ok: true });
        }
        try {
          const result =
            gw === "pixgate"
              ? await (await import("@/lib/pixgate.server")).getPixgateStatus(id)
              : await (await import("@/lib/sagacepay.server")).getSagaceStatus(id);
          if (result.status === "paid") {
            const { runInBackground } = await import("@/lib/background.server");
            runInBackground("webhook-paid", async () => {
              const { confirmPaidOrder } = await import("@/lib/tracking-capi.server");
              await confirmPaidOrder({ transactionId: id, request, verifiedAmountCents: result.amountCents });
            });
          }
        } catch (error) {
          console.error("pix-webhook failed", error);
        }
        return Response.json({ ok: true });
      },
    },
  },
});
