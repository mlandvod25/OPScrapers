import type { AddonConfig } from "./types";
import { SCRAPER_CATALOG } from "./catalog";

export const DEFAULT_CONFIG: AddonConfig = {
  scrapers: SCRAPER_CATALOG.filter((s) => s.defaultOn).map((s) => s.id),
  minSeeders: 0,
  maxResults: 80,
  qualities: ["2160p", "1080p", "720p", "480p"],
};

function bytesToBase64Url(json: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(json, "utf8").toString("base64url");
  }
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToString(raw: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(raw, "base64url").toString("utf8");
  }
  const padded = raw.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return atob(padded + pad);
}

export function encodeConfig(config: AddonConfig): string {
  const compact = {
    s: config.scrapers,
    m: config.minSeeders,
    n: config.maxResults,
    q: config.qualities,
  };
  return bytesToBase64Url(JSON.stringify(compact));
}

export function decodeConfig(raw: string | undefined | null): AddonConfig {
  if (!raw || raw === "manifest.json") {
    return { ...DEFAULT_CONFIG, scrapers: [...DEFAULT_CONFIG.scrapers] };
  }
  try {
    const json = base64UrlToString(raw);
    const parsed = JSON.parse(json) as {
      s?: string[];
      m?: number;
      n?: number;
      q?: string[];
    };
    const known = new Set(SCRAPER_CATALOG.map((s) => s.id));
    const scrapers = (parsed.s ?? DEFAULT_CONFIG.scrapers).filter((id) => known.has(id));
    return {
      scrapers: scrapers.length ? scrapers : [...DEFAULT_CONFIG.scrapers],
      minSeeders: clamp(parsed.m ?? DEFAULT_CONFIG.minSeeders, 0, 500),
      maxResults: clamp(parsed.n ?? DEFAULT_CONFIG.maxResults, 10, 250),
      qualities: (parsed.q ?? DEFAULT_CONFIG.qualities).filter((q) =>
        ["2160p", "1080p", "720p", "480p", "360p"].includes(q),
      ),
    };
  } catch {
    return { ...DEFAULT_CONFIG, scrapers: [...DEFAULT_CONFIG.scrapers] };
  }
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.floor(n)));
}
