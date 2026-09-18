export type MediaKind = "movie" | "series" | "anime";

export type ScraperGroup = "core" | "indexers" | "anime" | "regional" | "offline";

export interface AddonConfig {
  scrapers: string[];
  minSeeders: number;
  maxResults: number;
  qualities: string[];
}

export interface MediaQuery {
  kind: MediaKind;
  rawId: string;
  imdbId?: string;
  title: string;
  year?: string;
  season?: number;
  episode?: number;
  absoluteNumber?: number;
}

export interface TorrentHit {
  scraperId: string;
  scraperName: string;
  title: string;
  infoHash: string;
  seeders: number;
  peers: number;
  sizeBytes: number;
  quality?: string;
}

export interface ScraperStat {
  id: string;
  name: string;
  ok: boolean;
  count: number;
  ms: number;
  error?: string;
}

export interface ScraperInfo {
  id: string;
  name: string;
  group: ScraperGroup;
  languages: string[];
  kinds: MediaKind[];
  defaultOn: boolean;
  note: string;
}

export interface StremioStream {
  name: string;
  title: string;
  description: string;
  infoHash: string;
  sources?: string[];
  behaviorHints?: {
    bingeGroup?: string;
    filename?: string;
    videoSize?: number;
  };
}

export interface VendorQuery {
  query: string;
  keywords: string | string[];
}

export interface VendorScraper {
  name: string;
  enabled?: boolean;
  languages?: string[];
  base_url: string;
  fallback_urls?: string[];
  response_type: "json" | "text";
  separator?: string;
  source_is_in_sub_page?: boolean;
  trust_results?: boolean;
  token?: unknown;
  movie?: VendorQuery;
  episode?: VendorQuery;
  season?: VendorQuery;
  anime?: VendorQuery;
  json_format?: Record<string, string>;
  html_parser?: {
    row: string;
    title: string;
    peers: string;
    seeds: string;
    size: string;
    url: string;
  };
  title_replacement?: Record<string, string>;
}
