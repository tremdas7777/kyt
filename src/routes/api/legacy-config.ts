import { createFileRoute } from "@tanstack/react-router";

import { handleLegacyConfigRequest } from "@/lib/legacy.server";

export const Route = createFileRoute("/api/legacy-config")({
  server: {
    handlers: {
      GET: async () => handleLegacyConfigRequest(),
    },
  },
});
