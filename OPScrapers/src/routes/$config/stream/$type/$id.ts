import { createFileRoute } from "@tanstack/react-router";
import { decodeConfig } from "@/lib/addon/config";
import { jsonResponse, preflight } from "@/lib/addon/cors";
import { searchStreams } from "@/lib/addon/search";

export const Route = createFileRoute("/$config/stream/$type/$id")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ params }) => {
        const config = decodeConfig(params.config);
        const result = await searchStreams(params.type, params.id, config);
        return jsonResponse({ streams: result.streams }, 120);
      },
    },
  },
});
