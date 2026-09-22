import { fetchText } from "./http";
import { SCRAPER_CATALOG } from "./catalog";
import { resolveQuery } from "./cinemeta";
import { toHttpStremioStream, toStremioStream } from "./format";
import {
  scrapeAnimeTosho,
  scrapeBitsearch,
  scrapeEztv,
  scrapeLimeTorrents,
  scrapeNyaa,
  scrapePirateBay,
  scrapeYts,
} from "./scrapers/dedicated";
import {
  scrapeA111477,
  scrapeCineSu,
  scrapeRiveStream,
  scrapeVidLink,
  scrapeVidSrc,
} from "./scrapers/http";
import { scrapeVendorGeneric } from "./scrapers/generic";
import { detectQuality, episodeMatches, titleMatches } from "./parse";
import type {
  AddonConfig,
  HttpHit,
  MediaQuery,
  ScraperStat,
  StremioStream,
  TorrentHit,
} from "./types";

const DEDICATED: Record<string, (q: MediaQuery) => Promise<TorrentHit[]>> = {
  thepiratebay: scrapePirateBay,
  yts: scrapeYts,
  eztv: scrapeEztv,
  nyaa: (q) => scrapeNyaa(q, "nyaa"),
  nyaa2: (q) => scrapeNyaa(q, "nyaa2"),
  AnimeTosho: scrapeAnimeTosho,
  bitsearch: scrapeBitsearch,
  limetorrents: scrapeLimeTorrents,
};

const HTTP_DEDICATED: Record<string, (q: MediaQuery) => Promise<HttpHit[]>> = {
  rivestream: scrapeRiveStream,
  cinesu: scrapeCineSu,
  vidlink: scrapeVidLink,
  a111477: scrapeA111477,
  vidsrc: scrapeVidSrc,
};

const HTTP_IDS = new Set(Object.keys(HTTP_DEDICATED));
const SKIP_IDS = new Set(["torrentapi"]);
const SEARCH_BUDGET_MS = 9000;
const SCRAPER_TIMEOUT_MS = 5000;
const CONCURRENCY = 8;

export interface SearchResult {
  query: MediaQuery | null;
  streams: StremioStream[];
  stats: ScraperStat[];
}

export async function searchStreams(
  type: string,
  rawId: string,
  config: AddonConfig,
): Promise<SearchResult> {
  const query = await resolveQuery(type, rawId);
  if (!query) {
    return { query: null, streams: [], stats: [] };
  }

  const enabled = new Set(config.scrapers);
  const runners = SCRAPER_CATALOG.filter((s) => enabled.has(s.id) && !SKIP_IDS.has(s.id));
  const deadline = Date.now() + SEARCH_BUDGET_MS;
  const stats: ScraperStat[] = [];
  const torrentBatches: TorrentHit[][] = [];
  const httpBatches: HttpHit[][] = [];

  await mapPool(runners, CONCURRENCY, async (info) => {
    const remaining = deadline - Date.now();
    if (remaining < 400) {
      stats.push({ id: info.id, name: info.name, ok: false, count: 0, ms: 0, error: "budget" });
      return;
    }
    const started = Date.now();
    try {
      if (HTTP_IDS.has(info.id)) {
        const fn = HTTP_DEDICATED[info.id]!;
        const hits = await withTimeout(fn(query), Math.min(SCRAPER_TIMEOUT_MS, remaining));
        stats.push({
          id: info.id,
          name: info.name,
          ok: true,
          count: hits.length,
          ms: Date.now() - started,
        });
        httpBatches.push(hits);
      } else {
        const fn = DEDICATED[info.id] ?? ((q: MediaQuery) => scrapeVendorGeneric(info.id, q));
        const hits = await withTimeout(fn(query), Math.min(SCRAPER_TIMEOUT_MS, remaining));
        stats.push({
          id: info.id,
          name: info.name,
          ok: true,
          count: hits.length,
          ms: Date.now() - started,
        });
        torrentBatches.push(hits);
      }
    } catch (err) {
      stats.push({
        id: info.id,
        name: info.name,
        ok: false,
        count: 0,
        ms: Date.now() - started,
        error: err instanceof Error ? err.message : "failed",
      });
    }
  });

  // ── Torrent merge ──────────────────────────────────────────
  const merged: TorrentHit[] = [];
  const seen = new Set<string>();
  for (const hits of torrentBatches) {
    for (const hit of hits) {
      if (!hit.infoHash || seen.has(hit.infoHash)) continue;
      if (hit.seeders < config.minSeeders) continue;
      hit.quality = hit.quality ?? detectQuality(hit.title);
      if (config.qualities.length && hit.quality && !config.qualities.includes(hit.quality)) {
        continue;
      }
      const trusted =
        hit.scraperId === "yts" ||
        hit.scraperId === "eztv" ||
        hit.scraperId === "thepiratebay";
      if (!trusted && !titleMatches(hit.title, query.title, query.year)) continue;
      if (
        query.season &&
        query.episode &&
        hit.scraperId !== "eztv" &&
        !episodeMatches(hit.title, query.season, query.episode) &&
        query.kind !== "anime"
      ) {
        continue;
      }
      seen.add(hit.infoHash);
      merged.push(hit);
    }
  }

  merged.sort((a, b) => b.seeders - a.seeders || b.sizeBytes - a.sizeBytes);
  const limited = merged.slice(0, config.maxResults);

  // ── HTTP merge ─────────────────────────────────────────────
  const httpMerged: HttpHit[] = [];
  const seenUrls = new Set<string>();
  for (const hits of httpBatches) {
    for (const hit of hits) {
      if (!hit.url || seenUrls.has(hit.url)) continue;
      if (config.qualities.length && hit.quality && !config.qualities.includes(hit.quality)) {
        // Keep "Auto" streams even when quality filter is set
        if (hit.quality !== "Auto") continue;
      }
      seenUrls.add(hit.url);
      httpMerged.push(hit);
    }
  }

  stats.sort((a, b) => a.name.localeCompare(b.name));
  return {
    query,
    streams: [
      ...limited.map(toStremioStream),
      ...httpMerged.map(toHttpStremioStream),
    ],
    stats,
  };
}

async function mapPool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  const n = Math.max(1, Math.min(limit, items.length || 1));
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (index < items.length) {
        const item = items[index];
        index += 1;
        if (item !== undefined) await worker(item);
      }
    }),
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export async function healthCheck(): Promise<
  Array<{ id: string; name: string; ok: boolean; ms: number; detail: string }>
> {
  const probes: Array<{ id: string; name: string; url: string }> = [
    { id: "yts", name: "YTS", url: "https://movies-api.accel.li/api/v2/list_movies.json?query_term=tt0137523" },
    { id: "eztv", name: "EZTV", url: "https://eztv.re/api/get-torrents?imdb_id=0944947&limit=1" },
    { id: "nyaa", name: "Nyaa", url: "https://nyaa.si/?page=rss&q=Frieren&c=1_2&f=0" },
    { id: "AnimeTosho", name: "AnimeTosho", url: "https://feed.animetosho.org/json?only_tor=1&q=Frieren" },
    { id: "bitsearch", name: "BitSearch", url: "https://bitsearch.eu/search?q=Frieren" },
    { id: "rivestream", name: "RiveStream", url: "https://scrapper.rivestream.app/api/providers" },
  ];
  return Promise.all(
    probes.map(async (p) => {
      const t = Date.now();
      const res = await fetchText(p.url, 4000, "application/json, application/xml, */*;q=0.8");
      return {
        id: p.id,
        name: p.name,
        ok: res.ok && res.text.length > 20,
        ms: Date.now() - t,
        detail: res.ok ? `HTTP ${res.status}` : res.status ? `HTTP ${res.status}` : "unreachable",
      };
    }),
  );
}
