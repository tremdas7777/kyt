import { createFileRoute } from "@tanstack/react-router";

import { json } from "@/lib/admin-auth.server";
import { ingestLive, pingFromUnknown } from "@/lib/live.server";
import { dispatchServerTrack } from "@/lib/tracking-capi.server";
import { attributionFromUnknown } from "@/lib/tracking-capi.server";
import type { PixelContent, TrackPayload } from "@/lib/tracking-types";

export const Route = createFileRoute("/api/track")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Record<string, unknown>;
          const event = String(body["event"] ?? "").trim();
          if (!event) return json(400, { ok: false, message: "Evento ausente." });
          const ping = pingFromUnknown(body, request);
          ping.event = event;
          const attribution = attributionFromUnknown(body["attribution"]);
          if (!attribution.clientId) attribution.clientId = ping.clientId;
          await ingestLive(request, { ...ping, attribution }, {
            utm: {
              source: attribution.utmSource,
              medium: attribution.utmMedium,
              campaign: "",
              content: "",
              term: "",
            },
          });
          const contents = Array.isArray(body["contents"]) ? (body["contents"] as PixelContent[]) : [];
          const customerRaw =
            body["customer"] && typeof body["customer"] === "object" ? (body["customer"] as Record<string, string>) : {};
          const origin = new URL(request.url).origin;
          const rawSource = String(body["sourceUrl"] ?? body["path"] ?? "").trim();
          const payload: TrackPayload = {
            event,
            eventId: String(body["eventId"] ?? crypto.randomUUID()),
            value: Number(body["value"] ?? 0),
            currency: "BRL",
            contents,
            attribution,
            userAgent: request.headers.get("user-agent") ?? "",
          };
          const orderId = String(body["orderId"] ?? "").trim();
          if (orderId) payload.orderId = orderId;
          if (rawSource) {
            payload.sourceUrl = rawSource.startsWith("http") ? rawSource : new URL(rawSource, origin).href;
          }
          if (customerRaw["email"] || customerRaw["phone"]) {
            payload.customer = {
              name: String(customerRaw["name"] ?? ""),
              email: String(customerRaw["email"] ?? ""),
              phone: String(customerRaw["phone"] ?? ""),
              cpf: String(customerRaw["cpf"] ?? ""),
              city: String(customerRaw["city"] ?? ""),
              state: String(customerRaw["state"] ?? ""),
              cep: String(customerRaw["cep"] ?? ""),
            };
          }
          await dispatchServerTrack(payload, request);
          return json(200, { ok: true });
        } catch (error) {
          return json(400, { ok: false, message: error instanceof Error ? error.message : "Falha no rastreio." });
        }
      },
    },
  },
});
