import { createFileRoute } from "@tanstack/react-router";

import { json } from "@/lib/admin-auth.server";
import { ingestLive, pingFromUnknown } from "@/lib/live.server";

export const Route = createFileRoute("/api/live")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Record<string, unknown> = {};
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return json(400, { ok: false });
        }

        const ping = pingFromUnknown(body, request);
        if (!ping.clientId) return json(400, { ok: false, message: "Sessão ausente." });

        const utmRaw = body["utm"] && typeof body["utm"] === "object" ? (body["utm"] as Record<string, unknown>) : {};
        const utm = {
          source: String(utmRaw["source"] ?? ""),
          medium: String(utmRaw["medium"] ?? ""),
          campaign: String(utmRaw["campaign"] ?? ""),
          content: String(utmRaw["content"] ?? ""),
          term: String(utmRaw["term"] ?? ""),
        };

        const pingSource = String(body["source"] ?? "").trim().toLowerCase();
        const source =
          pingSource === "tiktok" || pingSource === "meta" || pingSource === "google" || pingSource === "direct" || pingSource === "other"
            ? pingSource
            : undefined;
        try {
          await ingestLive(request, ping, {
            title: String(body["title"] ?? "").slice(0, 120),
            utm,
            ...(source ? { source } : {}),
          });
        } catch {
          return json(200, { ok: true });
        }
        return json(200, { ok: true });
      },
    },
  },
});
