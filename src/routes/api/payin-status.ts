import { createFileRoute } from "@tanstack/react-router";

import { handlePayinStatusRequest } from "@/lib/legacy.server";

export const Route = createFileRoute("/api/payin-status")({
  server: {
    handlers: {
      GET: async ({ request }) => handlePayinStatusRequest(request),
    },
  },
});
