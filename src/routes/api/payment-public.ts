import { createFileRoute } from "@tanstack/react-router";

import { getPaymentSettings } from "@/lib/admin-store.server";

export const Route = createFileRoute("/api/payment-public")({
  server: {
    handlers: {
      GET: async () => {
        const payment = await getPaymentSettings();
        return new Response(
          JSON.stringify({
            cardEnabled: payment.cardEnabled !== false,
            pixGateway: payment.pixGateway,
            magicpayConfigured: Boolean(payment.magicpay.publicKey && payment.magicpay.secretKey),
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
          },
        );
      },
    },
  },
});
