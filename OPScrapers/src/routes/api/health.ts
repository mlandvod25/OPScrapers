import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse, preflight } from "@/lib/addon/cors";
import { healthCheck } from "@/lib/addon/search";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async () => jsonResponse({ probes: await healthCheck() }),
    },
  },
});
