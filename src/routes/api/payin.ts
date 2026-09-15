import { createFileRoute } from "@tanstack/react-router";

import { handlePayinRequest } from "@/lib/legacy.server";

export const Route = createFileRoute("/api/payin")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify({ success: false, message: "Use POST para gerar o pagamento." }), {
          status: 405,
          headers: { "Content-Type": "application/json; charset=utf-8", Allow: "POST" },
        }),
      POST: async ({ request }) => handlePayinRequest(request),
    },
  },
});
