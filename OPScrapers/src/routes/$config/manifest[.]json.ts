import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse, preflight } from "@/lib/addon/cors";
import { buildManifest, originFromRequest } from "@/lib/addon/manifest";

export const Route = createFileRoute("/$config/manifest.json")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        jsonResponse(buildManifest(originFromRequest(request), params.config), 300),
      OPTIONS: () => preflight(),
    },
  },
});
