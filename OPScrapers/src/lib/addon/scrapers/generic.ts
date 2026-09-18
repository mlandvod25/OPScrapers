import * as cheerio from "cheerio";
import vendorJson from "../vendor/openscraper.json";
import { fetchFirst, fetchJson, fetchText } from "../http";
import {
  applyReplacements,
  decodeHtmlEntities,
  detectQuality,
  episodeCode,
  extractInfoHash,
  getPath,
  parseSeeders,
  parseSizeBytes,
  seasonCode,
  stripTags,
} from "../parse";
import type { MediaQuery, TorrentHit, VendorScraper } from "../types";

const vendor = vendorJson as Record<string, VendorScraper | { name?: string }>;

function asScraper(id: string): VendorScraper | null {
  const raw = vendor[id];
  if (!raw || typeof raw !== "object" || !("base_url" in raw)) return null;
  return raw as VendorScraper;
}

function pickQuery(scraper: VendorScraper, query: MediaQuery) {
  if (query.kind === "anime" && scraper.anime) return scraper.anime;
  if (query.season && query.episode && scraper.episode) return scraper.episode;
  if (query.season && scraper.season) return scraper.season;
  if (query.kind === "movie" && scraper.movie) return scraper.movie;
  return scraper.episode ?? scraper.movie ?? scraper.anime ?? scraper.season;
}

function interpolateKeywords(template: string, query: MediaQuery): string {
  return template
    .replaceAll("{imdbId}", query.imdbId ?? "")
    .replaceAll("{title}", query.title)
    .replaceAll("{year}", query.year ?? "")
    .replaceAll(
      "{episodeCode}",
      query.season && query.episode ? episodeCode(query.season, query.episode) : "",
    )
    .replaceAll("{seasonCode}", query.season ? seasonCode(query.season) : "")
    .replaceAll("{episode}", query.episode != null ? String(query.episode) : "")
    .replaceAll("{absoluteNumber}", query.absoluteNumber != null ? String(query.absoluteNumber) : "")
    .replaceAll("{title.it}", query.title)
    .replaceAll("{title.fr}", query.title)
    .replaceAll("{title.original}", query.title)
    .replace(/\s+/g, " ")
    .trim();
}

function joinQuery(keyword: string, separator: string | undefined): string {
  const sep = separator ?? "%20";
  if (sep === " " || sep === "%20") return encodeURIComponent(keyword);
  return keyword
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => encodeURIComponent(p))
    .join(sep);
}

export async function scrapeVendorGeneric(
  id: string,
  query: MediaQuery,
): Promise<TorrentHit[]> {
  const scraper = asScraper(id);
  if (!scraper) return [];
  if (scraper.token) return [];
  const spec = pickQuery(scraper, query);
  if (!spec) return [];

  const keywordList = Array.isArray(spec.keywords) ? spec.keywords : [spec.keywords];
  const primary = applyReplacements(
    interpolateKeywords(keywordList[0] ?? "{title}", query),
    scraper.title_replacement,
  );
  if (!primary) return [];
  const encoded = joinQuery(primary, scraper.separator);
  const letterMatch = primary.trim().match(/[a-z0-9]/i);
  const letter = (letterMatch?.[0] ?? "1").toLowerCase();
  const path = spec.query
    .replaceAll("{titleFirstLetter}", letter)
    .replaceAll("{query}", encoded)
    .replaceAll("{token}", "");
  const bases = [scraper.base_url, ...(scraper.fallback_urls ?? [])].filter(Boolean).slice(0, 3);
  const urls = bases.map((b) => `${b.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`);

  if (scraper.response_type === "json") {
    for (const url of urls.slice(0, 2)) {
      const data = await fetchJson<unknown>(url, 4000);
      if (data) {
        const hits = parseJsonHits(id, scraper, data);
        if (hits.length) return hits;
      }
    }
    return [];
  }

  const page = await fetchFirst(urls, 4000);
  if (!page?.text) return [];
  return parseHtmlHits(id, scraper, page.text, page.url || scraper.base_url);
}

function parseJsonHits(id: string, scraper: VendorScraper, data: unknown): TorrentHit[] {
  const fmt = scraper.json_format ?? {};
  let rows: unknown = fmt.results ? getPath(data, fmt.results) : data;
  if (!Array.isArray(rows)) rows = [];
  const hits: TorrentHit[] = [];
  for (const row of rows as Record<string, unknown>[]) {
    const sub = fmt.sub_results ? getPath(row, fmt.sub_results) : null;
    const groups = Array.isArray(sub) ? (sub as Record<string, unknown>[]) : [row];
    for (const item of groups) {
      const title = String(getPath(item, fmt.title) ?? getPath(row, fmt.title) ?? "");
      let urlOrHash = "";
      if (fmt.url?.includes("{hash}")) {
        const hash = String(getPath(item, fmt.hash) ?? "");
        urlOrHash = fmt.url.replaceAll("{hash}", hash);
      } else {
        urlOrHash = String(getPath(item, fmt.hash) ?? getPath(item, fmt.url) ?? "");
      }
      const hash = extractInfoHash(urlOrHash);
      if (!hash || !title || /no results/i.test(title)) continue;
      hits.push({
        scraperId: id,
        scraperName: scraper.name,
        title,
        infoHash: hash,
        seeders: parseSeeders(getPath(item, fmt.seeds)),
        peers: parseSeeders(getPath(item, fmt.peers)),
        sizeBytes: parseSizeBytes(getPath(item, fmt.size)),
        quality: detectQuality(title, fmt.quality ? String(getPath(item, fmt.quality) ?? "") : undefined),
      });
    }
  }
  return hits;
}

function cssFromQuerySelector(expr: string): string | null {
  const m = expr.match(/querySelectorAll\('([^']+)'\)/);
  return m?.[1] ?? null;
}

function pickExpr(expr: string): string {
  const ternary = expr.match(/\?\s*(row\.querySelector(?:All)?\('[^']+'\)[^:]*)\s*:/);
  if (ternary) return ternary[1].trim();
  return expr.trim();
}

function readExpr($: cheerio.CheerioAPI, el: unknown, expr: string): string {
  let source = pickExpr(expr);
  const magnetPrefix = source.match(/^'magnet:\?xt=urn:btih:'\s*\+\s*(.+)$/);
  if (magnetPrefix) {
    return `magnet:?xt=urn:btih:${readExpr($, el, magnetPrefix[1])}`;
  }
  source = source.replace(/^decodeURIComponent\((.*)\)\.replace\([^)]+\)\.trim\(\)$/s, "$1");
  source = source.replace(/^decodeURIComponent\((.*)\)$/s, "$1");
  source = source.replace(/\.innerText/g, ".textContent");

  const qs = source.match(/row\.querySelector(?:All)?\('([^']+)'\)(.*)$/);
  if (!qs) return "";
  const node = $(el as never).find(qs[1]).first();
  if (!node.length) return "";
  const rest = qs[2] ?? "";
  let value = "";
  const attr = rest.match(/getAttribute\('([^']+)'\)/);
  if (attr) value = node.attr(attr[1]) ?? "";
  else if (rest.includes(".value")) value = String(node.attr("value") ?? node.val() ?? "");
  else if (rest.includes("innerHTML")) value = node.html() ?? "";
  else value = node.text();

  if (rest.includes(".split('B')[0]")) {
    const i = value.indexOf("B");
    if (i >= 0) value = value.slice(0, i + 1);
  }
  for (const rep of rest.matchAll(/\.replace\('([^']*)','([^']*)'\)/g)) {
    value = value.split(rep[1]).join(rep[2]);
  }
  if (rest.includes(".trim()")) value = value.trim();
  return stripTags(decodeHtmlEntities(value)).trim();
}

async function parseHtmlHits(
  id: string,
  scraper: VendorScraper,
  html: string,
  baseUrl: string,
): Promise<TorrentHit[]> {
  const parser = scraper.html_parser;
  if (!parser) return [];
  const $ = cheerio.load(decodeHtmlEntities(html));
  const rowSel = cssFromQuerySelector(parser.row);
  if (!rowSel) return [];
  const nodes = $(rowSel).toArray().slice(0, 30);
  const pending: TorrentHit[] = [];
  const subpages: Array<{ title: string; url: string; seeds: string; peers: string; size: string }> = [];

  for (const el of nodes) {
    const title = readExpr($, el, parser.title);
    let url = readExpr($, el, parser.url);
    const rowHtml = $(el).toString();
    if (!title && !url) continue;
    if (url.startsWith("//")) url = `https:${url}`;
    else if (url.startsWith("/")) url = `${baseUrl.replace(/\/$/, "")}${url}`;
    let hash = extractInfoHash(url) || extractInfoHash(rowHtml);
    if (!hash && scraper.source_is_in_sub_page && url.startsWith("http") && subpages.length < 5) {
      subpages.push({
        title,
        url,
        seeds: readExpr($, el, parser.seeds),
        peers: readExpr($, el, parser.peers),
        size: readExpr($, el, parser.size),
      });
      continue;
    }
    if (!hash || !title) continue;
    pending.push({
      scraperId: id,
      scraperName: scraper.name,
      title,
      infoHash: hash,
      seeders: parseSeeders(readExpr($, el, parser.seeds)),
      peers: parseSeeders(readExpr($, el, parser.peers)),
      sizeBytes: parseSizeBytes(readExpr($, el, parser.size)),
      quality: detectQuality(title),
    });
    if (pending.length >= 20) break;
  }

  if (pending.length < 8 && subpages.length) {
    const extras = await Promise.all(
      subpages.slice(0, 4).map(async (row) => {
        const sub = await fetchText(row.url, 3500);
        const hash = sub.ok ? extractInfoHash(decodeHtmlEntities(sub.text)) : null;
        if (!hash) return null;
        return {
          scraperId: id,
          scraperName: scraper.name,
          title: row.title,
          infoHash: hash,
          seeders: parseSeeders(row.seeds),
          peers: parseSeeders(row.peers),
          sizeBytes: parseSizeBytes(row.size),
          quality: detectQuality(row.title),
        } satisfies TorrentHit;
      }),
    );
    for (const extra of extras) {
      if (extra) pending.push(extra);
    }
  }
  return pending;
}
