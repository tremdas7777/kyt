import { createFileRoute } from "@tanstack/react-router";

import { getTrackingSettings } from "@/lib/admin-store.server";

export const Route = createFileRoute("/api/tracking-public")({
  server: {
    handlers: {
      GET: async () => {
        const tracking = await getTrackingSettings();
        return new Response(
          JSON.stringify({
            tiktok: {
              enabled: tracking.tiktok.enabled && tracking.tiktok.pixelIds.length > 0,
              pixelIds: tracking.tiktok.pixelIds,
            },
            meta: {
              enabled: tracking.meta.enabled && Boolean(tracking.meta.pixelId),
              pixelId: tracking.meta.pixelId,
            },
            google: {
              enabled: tracking.google.enabled && Boolean(tracking.google.measurementId || tracking.google.adsId),
              measurementId: tracking.google.measurementId,
              adsId: tracking.google.adsId,
              adsPurchaseLabel: tracking.google.adsPurchaseLabel,
            },
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
