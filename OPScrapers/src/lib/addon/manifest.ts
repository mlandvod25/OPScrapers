import { ADDON_DESCRIPTION, ADDON_ID, ADDON_NAME, ADDON_VERSION } from "./catalog";
import type { AddonConfig } from "./types";

export function buildManifest(origin: string, configPath: string) {
  const configured = Boolean(configPath);
  const prefix = configured ? `/${configPath}` : "";
  return {
    id: ADDON_ID,
    version: ADDON_VERSION,
    name: ADDON_NAME,
    description: ADDON_DESCRIPTION,
    logo: `${origin}/favicon.svg`,
    background: `${origin}/og.jpg`,
    catalogs: [] as unknown[],
    resources: [
      {
        name: "stream",
        types: ["movie", "series", "anime"],
        idPrefixes: ["tt", "kitsu"],
      },
    ],
    types: ["movie", "series", "anime"],
    idPrefixes: ["tt", "kitsu"],
    behaviorHints: {
      adult: false,
      configurable: true,
      configurationRequired: false,
      configurationURL: `${origin}${prefix}/configure`,
    },
  };
}

export function originFromRequest(request: Request): string {
  const url = new URL(request.url);
  const forwarded = request.headers.get("x-forwarded-host");
  const proto =
    request.headers.get("x-forwarded-proto") ||
    (url.protocol === "https:" ? "https" : url.protocol.replace(":", ""));
  const host = forwarded || request.headers.get("host") || url.host;
  return `${proto}://${host}`;
}

export function manifestUrl(origin: string, config: AddonConfig, encode: (c: AddonConfig) => string): string {
  return `${origin}/${encode(config)}/manifest.json`;
}
