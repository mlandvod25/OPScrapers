import type { AddonConfig } from "./types";
import { DEFAULT_CONFIG } from "./config";

const KEY = "openscrapers-config-v1";

export function loadStoredConfig(): AddonConfig {
  if (typeof window === "undefined") return clone(DEFAULT_CONFIG);
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return clone(DEFAULT_CONFIG);
    const parsed = JSON.parse(raw) as AddonConfig;
    return {
      scrapers: parsed.scrapers?.length ? parsed.scrapers : [...DEFAULT_CONFIG.scrapers],
      minSeeders: parsed.minSeeders ?? DEFAULT_CONFIG.minSeeders,
      maxResults: parsed.maxResults ?? DEFAULT_CONFIG.maxResults,
      qualities: parsed.qualities?.length ? parsed.qualities : [...DEFAULT_CONFIG.qualities],
    };
  } catch {
    return clone(DEFAULT_CONFIG);
  }
}

export function saveStoredConfig(config: AddonConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(config));
}

function clone(c: AddonConfig): AddonConfig {
  return {
    scrapers: [...c.scrapers],
    minSeeders: c.minSeeders,
    maxResults: c.maxResults,
    qualities: [...c.qualities],
  };
}
