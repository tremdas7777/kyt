import { createFileRoute } from "@tanstack/react-router";

import { handleMagicPayWebhookRequest } from "@/lib/magicpay.server";

export const Route = createFileRoute("/webhooks/magicpay")({
  server: {
    handlers: {
      POST: async ({ request }) => handleMagicPayWebhookRequest(request),
    },
  },
});
