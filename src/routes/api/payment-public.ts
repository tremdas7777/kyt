import { createFileRoute } from "@tanstack/react-router";

import { getPaymentSettings } from "@/lib/admin-store.server";
import { STOREFRONT_ALLOWS_CARD } from "@/lib/payment-types";

export const Route = createFileRoute("/api/payment-public")({
  server: {
    handlers: {
      GET: async () => {
        const payment = await getPaymentSettings();
        return new Response(
          JSON.stringify({
            cardEnabled: STOREFRONT_ALLOWS_CARD && payment.cardEnabled === true,
            pixGateway: payment.pixGateway,
            magicpayConfigured: true,
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
