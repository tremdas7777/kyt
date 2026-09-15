import { createFileRoute } from "@tanstack/react-router";

import { handlePixRequest } from "@/lib/legacy.server";

export const Route = createFileRoute("/api/pix")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify({ success: false, message: "Use POST para gerar o Pix." }), {
          status: 405,
          headers: { "Content-Type": "application/json; charset=utf-8", Allow: "POST" },
        }),
      POST: async ({ request }) => handlePixRequest(request),
    },
  },
});
