import { createFileRoute } from "@tanstack/react-router";

import { handleLegacyWebhookRequest } from "@/lib/legacy.server";

export const Route = createFileRoute("/webhooks/legacy")({
  server: {
    handlers: {
      POST: async ({ request }) => handleLegacyWebhookRequest(request),
    },
  },
});
