import { createFileRoute } from "@tanstack/react-router";

import { BUILD_ID } from "@/lib/build-info";

// Público e sem dados sensíveis: só diz qual versão da loja está publicada.
export const Route = createFileRoute("/api/versao")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify({ versao: BUILD_ID }), {
          status: 200,
          headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
        }),
    },
  },
});
