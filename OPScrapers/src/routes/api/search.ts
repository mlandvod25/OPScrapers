import { createFileRoute } from "@tanstack/react-router";
import { decodeConfig, DEFAULT_CONFIG } from "@/lib/addon/config";
import { jsonResponse, preflight } from "@/lib/addon/cors";
import { searchStreams } from "@/lib/addon/search";

export const Route = createFileRoute("/api/search")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const type = url.searchParams.get("type") || "movie";
        const id = url.searchParams.get("id") || "";
        const configRaw = url.searchParams.get("config");
        if (!id) return jsonResponse({ error: "Missing id" });
        const config = configRaw ? decodeConfig(configRaw) : DEFAULT_CONFIG;
        const result = await searchStreams(type, id, config);
        return jsonResponse(result);
      },
    },
  },
});
