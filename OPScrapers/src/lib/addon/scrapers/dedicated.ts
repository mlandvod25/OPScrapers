import { fetchFirst, fetchJson, fetchText } from "../http";
import {
  decodeHtmlEntities,
  detectQuality,
  episodeCode,
  episodeMatches,
  extractInfoHash,
  parseSeeders,
  parseSizeBytes,
  seasonCode,
} from "../parse";
import type { MediaQuery, TorrentHit } from "../types";

function hit(
  scraperId: string,
  scraperName: string,
  title: string,
  hash: string | null,
  seeders: unknown,
  peers: unknown,
  size: unknown,
  quality?: string,
): TorrentHit | null {
  if (!hash) return null;
  return {
    scraperId,
    scraperName,
    title: title.replace(/\s+/g, " ").trim(),
    infoHash: hash,
    seeders: parseSeeders(seeders),
    peers: parseSeeders(peers),
    sizeBytes: parseSizeBytes(size),
    quality: detectQuality(title, quality),
  };
}

function searchTerms(query: MediaQuery): string[] {
  const title = query.title;
  const year = query.year ?? "";
  if (query.kind === "movie") {
    return [`${title} ${year}`.trim(), query.imdbId].filter((v): v is string => Boolean(v));
  }
  if (query.season && query.episode) {
    const ep = episodeCode(query.season, query.episode);
    return [`${title} ${ep}`, `${title} ${year} ${ep}`.trim()];
  }
  if (query.season) {
    const sn = seasonCode(query.season);
    return [`${title} ${sn}`, `${title} season ${query.season}`];
  }
  if (query.absoluteNumber) {
    return [`${title} ${query.absoluteNumber}`, title];
  }
  return [`${title} ${year}`.trim()];
}

export async function scrapePirateBay(query: MediaQuery): Promise<TorrentHit[]> {
  const terms = [...new Set(searchTerms(query))].slice(0, 2);
  const cat =
    query.kind === "movie" ? "207,202,201" : query.kind === "anime" ? "208,205,201" : "208,205";
  const payloads = await Promise.all(
    terms.map((term) =>
      fetchJson<Array<Record<string, string>>>(
        `https://apibay.org/q.php?q=${encodeURIComponent(term)}&cat=${cat}`,
        4000,
      ),
    ),
  );
  const hits: TorrentHit[] = [];
  const seen = new Set<string>();
  for (const data of payloads) {
    if (!data || !Array.isArray(data)) continue;
    for (const row of data) {
      if (!row?.name || row.id === "0" || /no results/i.test(row.name)) continue;
      if (
        query.imdbId &&
        row.imdb &&
        row.imdb !== query.imdbId &&
        row.imdb !== query.imdbId.replace(/^tt/, "")
      ) {
        continue;
      }
      const item = hit(
        "thepiratebay",
        "PirateBay",
        row.name,
        extractInfoHash(row.info_hash),
        row.seeders,
        row.leechers,
        row.size,
      );
      if (!item || seen.has(item.infoHash)) continue;
      if (query.season && query.episode && !episodeMatches(item.title, query.season, query.episode)) {
        continue;
      }
      seen.add(item.infoHash);
      hits.push(item);
    }
  }
  return hits;
}

interface YtsMovie {
  title_long?: string;
  title?: string;
  imdb_code?: string;
  torrents?: Array<{
    hash?: string;
    quality?: string;
    type?: string;
    video_codec?: string;
    seeds?: number;
    peers?: number;
    size?: string;
    size_bytes?: number;
  }>;
}

export async function scrapeYts(query: MediaQuery): Promise<TorrentHit[]> {
  if (query.kind === "series") return [];
  const term = query.imdbId || `${query.title} ${query.year ?? ""}`.trim();
  const path = `/list_movies.json?query_term=${encodeURIComponent(term)}&sort_by=seeds&order_by=desc`;
  const urls = [
    `https://movies-api.accel.li/api/v2${path}`,
    `https://yts.lt/api/v2${path}`,
    `https://yts.mx/api/v2${path}`,
    `https://yts.pm/api/v2${path}`,
  ];
  let payload: { data?: { movies?: YtsMovie[] } } | null = null;
  for (const url of urls) {
    payload = await fetchJson(url, 4000);
    if (payload?.data?.movies?.length) break;
  }
  const movies = payload?.data?.movies ?? [];
  const hits: TorrentHit[] = [];
  for (const movie of movies) {
    if (query.imdbId && movie.imdb_code && movie.imdb_code !== query.imdbId) continue;
    const baseTitle = movie.title_long || movie.title || query.title;
    for (const tor of movie.torrents ?? []) {
      const title = `${baseTitle} ${tor.quality ?? ""} ${tor.type ?? ""} ${tor.video_codec ?? ""}`
        .replace(/\s+/g, " ")
        .trim();
      const item = hit(
        "yts",
        "YTS",
        title,
        extractInfoHash(tor.hash),
        tor.seeds,
        tor.peers,
        tor.size_bytes ?? tor.size,
        tor.quality,
      );
      if (item) hits.push(item);
    }
  }
  return hits;
}

interface EztvTorrent {
  hash?: string;
  filename?: string;
  title?: string;
  seeders?: number;
  peers?: number;
  size_bytes?: number;
  season?: number | string;
  episode?: number | string;
}

export async function scrapeEztv(query: MediaQuery): Promise<TorrentHit[]> {
  if (query.kind === "movie") return [];
  const imdb = query.imdbId?.replace(/^tt/, "");
  if (!imdb) return [];
  const data = await fetchJson<{ torrents?: EztvTorrent[] }>(
    `https://eztv.re/api/get-torrents?imdb_id=${imdb}&limit=100&page=1`,
    4000,
  );
  const hits: TorrentHit[] = [];
  for (const row of data?.torrents ?? []) {
    const title = row.filename || row.title || "";
    if (query.season && Number(row.season) && Number(row.season) !== query.season) continue;
    if (query.episode && Number(row.episode) && Number(row.episode) !== query.episode) continue;
    if (
      query.season &&
      query.episode &&
      !row.season &&
      !episodeMatches(title, query.season, query.episode)
    ) {
      continue;
    }
    const item = hit(
      "eztv",
      "EZTV",
      title,
      extractInfoHash(row.hash),
      row.seeders,
      row.peers,
      row.size_bytes,
    );
    if (item) hits.push(item);
  }
  return hits;
}

export async function scrapeNyaa(query: MediaQuery, scraperId = "nyaa"): Promise<TorrentHit[]> {
  const term =
    query.kind === "movie"
      ? `${query.title} ${query.year ?? ""}`.trim()
      : query.season && query.episode
        ? `${query.title} ${episodeCode(query.season, query.episode)}`
        : query.absoluteNumber
          ? `${query.title} ${query.absoluteNumber}`
          : query.title;
  const url = `https://nyaa.si/?page=rss&q=${encodeURIComponent(term)}&c=1_2&f=0`;
  const res = await fetchText(url, 5000, "application/rss+xml, application/xml, */*;q=0.8");
  if (!res.ok) return [];
  return parseNyaaRss(res.text, scraperId);
}

function parseNyaaRss(xml: string, scraperId: string): TorrentHit[] {
  const items = xml.split(/<item>/i).slice(1);
  const hits: TorrentHit[] = [];
  for (const block of items) {
    const title = decodeXml(tag(block, "title"));
    const hash =
      extractInfoHash(tag(block, "nyaa:infoHash")) ||
      extractInfoHash(tag(block, "infoHash"));
    const seeds = tag(block, "nyaa:seeders") || tag(block, "seeders");
    const peers = tag(block, "nyaa:leechers") || tag(block, "leechers");
    const size = tag(block, "nyaa:size") || tag(block, "size");
    const item = hit(scraperId, scraperId === "nyaa2" ? "Nyaa 2" : "Nyaa", title, hash, seeds, peers, size);
    if (item) hits.push(item);
  }
  return hits;
}

function tag(block: string, name: string): string {
  const re = new RegExp(`<${name.replace(":", "\\:")}[^>]*>([^<]*)</${name.replace(":", "\\:")}>`, "i");
  return block.match(re)?.[1]?.trim() ?? "";
}

function decodeXml(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/"/g, '"')
      .replace(/&#34;/g, '"')
      .replace(/'/g, "'")
      .replace(/&#39;/g, "'"),
  );
}

interface ToshoItem {
  title?: string;
  torrent_name?: string;
  info_hash?: string;
  magnet_uri?: string;
  seeders?: number;
  leechers?: number;
  total_size?: number;
}

export async function scrapeAnimeTosho(query: MediaQuery): Promise<TorrentHit[]> {
  const term =
    query.season && query.episode
      ? `${query.title} ${episodeCode(query.season, query.episode)}`
      : query.absoluteNumber
        ? `${query.title} ${query.absoluteNumber}`
        : `${query.title} ${query.year ?? ""}`.trim();
  const data = await fetchJson<ToshoItem[]>(
    `https://feed.animetosho.org/json?only_tor=1&q=${encodeURIComponent(term)}`,
    4000,
  );
  if (!Array.isArray(data)) return [];
  const hits: TorrentHit[] = [];
  for (const row of data) {
    const title = row.title || row.torrent_name || "";
    const item = hit(
      "AnimeTosho",
      "AnimeTosho",
      title,
      extractInfoHash(row.info_hash) || extractInfoHash(row.magnet_uri),
      row.seeders,
      row.leechers,
      row.total_size,
    );
    if (item) hits.push(item);
  }
  return hits;
}

export async function scrapeBitsearch(query: MediaQuery): Promise<TorrentHit[]> {
  const term = searchTerms(query)[0] ?? query.title;
  const encoded = encodeURIComponent(term);
  const res = await fetchFirst(
    [
      `https://bitsearch.eu/search?q=${encoded}&sort=seeders`,
      `https://bitsearch.to/search?q=${encoded}&sort=seeders`,
    ],
    5000,
  );
  if (!res?.text) return [];
  const html = decodeHtmlEntities(res.text);
  const hits: TorrentHit[] = [];
  const seen = new Set<string>();
  const magRe = /href="(magnet:\?xt=urn:btih:[^"]+)"/gi;
  let match: RegExpExecArray | null;
  while ((match = magRe.exec(html)) && hits.length < 25) {
    const magnet = match[1];
    const hash = extractInfoHash(magnet);
    if (!hash || seen.has(hash)) continue;
    seen.add(hash);
    const around = html.slice(Math.max(0, match.index - 2000), match.index + 80);
    const dn = magnet.match(/[?&]dn=([^&]+)/i)?.[1];
    let title = dn
      ? decodeURIComponent(dn.replace(/\+/g, " ")).replace(/^\[Bitsearch[^\]]*\]\s*/i, "")
      : "";
    if (!title) {
      const titled = around.match(/[?&]title=([^"&]+)/i)?.[1];
      title = titled ? decodeURIComponent(titled.replace(/\+/g, " ")) : query.title;
    }
    const seeds = around.match(/>(\d+)\s*<\/span>\s*<span>\s*seeders/i)?.[1]
      ?? around.match(/(\d+)\s*seeders/i)?.[1];
    const peers = around.match(/>(\d+)\s*<\/span>\s*<span>\s*leechers/i)?.[1];
    const size = around.match(/>([\d.]+\s*(?:GB|MB|TB|KB))</i)?.[1];
    const item = hit("bitsearch", "BitSearch", decodeHtml(title), hash, seeds, peers, size);
    if (item) hits.push(item);
  }
  return hits;
}

export async function scrapeLimeTorrents(query: MediaQuery): Promise<TorrentHit[]> {
  const term = (searchTerms(query)[0] ?? query.title).replace(/\s+/g, "-");
  const cat = query.kind === "movie" ? "movies" : query.kind === "anime" ? "anime" : "tv";
  const path = `/search/${cat}/${encodeURIComponent(term)}/seeds/1/`;
  const res = await fetchFirst(
    [
      `https://www.limetorrents.lol${path}`,
      `https://www.limetorrents.fun${path}`,
      `https://www.limetorrents.pro${path}`,
    ],
    5000,
  );
  if (!res?.text) return [];
  const html = decodeHtmlEntities(res.text);
  const hits: TorrentHit[] = [];
  const seen = new Set<string>();
  const re = /itorrents\.net\/torrent\/([A-Fa-f0-9]{40})\.torrent\?title=([^"'&]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) && hits.length < 25) {
    const hash = extractInfoHash(match[1]);
    if (!hash || seen.has(hash)) continue;
    seen.add(hash);
    const title = decodeURIComponent(match[2].replace(/\+/g, " ").replace(/-/g, " "));
    const around = html.slice(Math.max(0, match.index - 400), match.index + 400);
    const seeds = around.match(/tdseed[^>]*>([\d,.]+)/i)?.[1];
    const size = around.match(/tdnormal[^>]*>([\d.]+\s*(?:GB|MB|TB|KB))/i)?.[1];
    const item = hit("limetorrents", "LimeTorrents", decodeHtml(title), hash, seeds, 0, size);
    if (item) hits.push(item);
  }
  return hits;
}

function decodeHtml(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/&nbsp;/g, " ")
    .trim();
}

export { searchTerms };
