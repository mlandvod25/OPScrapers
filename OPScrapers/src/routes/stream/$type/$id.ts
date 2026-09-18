import { createFileRoute } from "@tanstack/react-router";
import { DEFAULT_CONFIG } from "@/lib/addon/config";
import { jsonResponse, preflight } from "@/lib/addon/cors";
import { searchStreams } from "@/lib/addon/search";

export const Route = createFileRoute("/stream/$type/$id")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ params }) => {
        const result = await searchStreams(params.type, params.id, DEFAULT_CONFIG);
        return jsonResponse({ streams: result.streams }, 120);
      },
    },
  },
});
