import { createFileRoute } from "@tanstack/react-router";

import { json } from "@/lib/admin-auth.server";
import { ingestLive, pingFromUnknown } from "@/lib/live.server";

export const Route = createFileRoute("/api/live")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Record<string, unknown>;
          await ingestLive(request, pingFromUnknown(body, request));
          return json(200, { ok: true });
        } catch (error) {
          return json(400, { ok: false, message: error instanceof Error ? error.message : "Falha no live." });
        }
      },
    },
  },
});
