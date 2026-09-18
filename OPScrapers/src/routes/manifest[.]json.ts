import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse, preflight } from "@/lib/addon/cors";
import { buildManifest, originFromRequest } from "@/lib/addon/manifest";

export const Route = createFileRoute("/manifest.json")({
  server: {
    handlers: {
      GET: ({ request }) => jsonResponse(buildManifest(originFromRequest(request), ""), 300),
      OPTIONS: () => preflight(),
    },
  },
});
