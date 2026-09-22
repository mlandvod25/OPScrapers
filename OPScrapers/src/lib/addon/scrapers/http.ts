import { env } from "../../env.server";
import { fetchJson } from "../http";
import type { HttpHit, MediaQuery } from "../types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Resolve TMDb numeric ID from IMDb via the public TMDb find API. */
async function resolveTmdbId(query: MediaQuery): Promise<number | null> {
  if (!query.imdbId) return null;
  const apiKey = env("TMDB_API_KEY");
  if (!apiKey) return null;
  const imdb = query.imdbId.startsWith("tt") ? query.imdbId : `tt${query.imdbId}`;
  const data = await fetchJson<{
    movie_results?: Array<{ id: number }>;
    tv_results?: Array<{ id: number }>;
  }>(
    `https://api.themoviedb.org/3/find/${imdb}?api_key=${encodeURIComponent(apiKey)}&external_source=imdb_id`,
    4000,
  );
  if (!data) return null;
  if (query.kind === "movie") return data.movie_results?.[0]?.id ?? null;
  return data.tv_results?.[0]?.id ?? data.movie_results?.[0]?.id ?? null;
}

// ─── RiveStream ───────────────────────────────────────────────
export async function scrapeRiveStream(query: MediaQuery): Promise<HttpHit[]> {
  const tmdbId = await resolveTmdbId(query);
  if (!tmdbId) return [];

  const isTv = query.kind !== "movie";
  const providers = [
    "apex", "pulse", "solstice", "quasar", "primevids", "flowcast",
    "citadel", "guru", "asiacloud", "horizon",
  ];
  const headers = {
    "User-Agent": UA,
    Referer: "https://www.rivestream.app/",
    Origin: "https://www.rivestream.app",
    Accept: "application/json",
  };
  const hits: HttpHit[] = [];
  const seen = new Set<string>();

  await Promise.all(
    providers.map(async (provider) => {
      try {
        const path = isTv
          ? `/api/provider?provider=${provider}&id=${tmdbId}&season=${query.season ?? 1}&episode=${query.episode ?? 1}`
          : `/api/provider?provider=${provider}&id=${tmdbId}`;
        const data = await fetchJson<{
          data?: { sources?: Array<{ url?: string; quality?: string; source?: string }> };
        }>(`https://scrapper.rivestream.app${path}`, 5000);
        for (const src of data?.data?.sources ?? []) {
          const url = (src.url ?? "").trim();
          if (!url.startsWith("http") || seen.has(url)) continue;
          seen.add(url);
          hits.push({ scraperId: "rivestream", scraperName: "RiveStream", title: `[Rive - ${src.source ?? provider}] ${src.quality ?? "Auto"}`, url, quality: src.quality ?? "Auto", headers });
        }
      } catch { /* skip provider */ }
    }),
  );
  return hits.slice(0, 12);
}

// ─── CineSu ───────────────────────────────────────────────────
function cineSuMasterUrl(tmdbId: number, season?: number, episode?: number): string {
  const isTv = season != null && episode != null;
  const nD = "4860ac8bfddb";
  const aD = "224eff10e662e9635c9f671cf46351dcd69af42b1edd56f5e5fa21751f44b9c8";
  const ls = [17, 91, 203, 44, 8, 177, 62, 239, 119, 3, 154, 81, 28, 210, 101, 7];
  const wa = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const ab = (e: number) => { let t = e >>> 0; t ^= t >>> 16; t = Math.imul(t, 2146121005) >>> 0; t ^= t >>> 15; t = Math.imul(t, 2221713035) >>> 0; return (t ^ (t >>> 16)) >>> 0; };
  const str = `${nD}:${isTv ? "s" : "m"}:${tmdbId}:${isTv ? season : 0}:${isTv ? episode : 0}`;
  const a = new TextEncoder().encode(str);
  const sArr = new Uint8Array(Math.min(128, Math.max(32, a.length + 17)));
  let acc = 2166136261;
  const keyBytes = new TextEncoder().encode(aD);
  for (let i = 0; i < sArr.length; i++) { acc ^= keyBytes[i % keyBytes.length]; acc = ab((acc + ls[i % ls.length] + Math.imul(2654435761, i)) >>> 0); sArr[i] = acc & 255; }
  const out = new Uint8Array(a.length + 2);
  out[0] = a.length & 255; out[1] = (a.length >> 8) & 255;
  let o = (2654435769 ^ a.length) >>> 0;
  for (let i = 0; i < a.length; i++) { o = ab((o + sArr[i % sArr.length] + ls[i % ls.length] + i) >>> 0); out[i + 2] = (a[i] ^ (o & 255)) ^ sArr[(7 * i + 3) % sArr.length]; }
  let b64 = "";
  for (let i = 0; i < out.length; i += 3) { const n = out[i]; const a2 = i + 1 < out.length ? out[i + 1] : null; const s = i + 2 < out.length ? out[i + 2] : null; b64 += wa[n >> 2]; b64 += wa[((3 & n) << 4) | ((a2 ?? 0) >> 4)]; if (a2 == null) break; b64 += wa[((15 & a2) << 2) | ((s ?? 0) >> 6)]; if (s == null) break; b64 += wa[63 & s]; }
  return `https://glendale-plumbing.com/c/v1/${b64}/master.m3u8`;
}

export async function scrapeCineSu(query: MediaQuery): Promise<HttpHit[]> {
  const tmdbId = await resolveTmdbId(query);
  if (!tmdbId) return [];
  return [{ scraperId: "cinesu", scraperName: "CineSu", title: "CineSu · Direct Master · 1080p", url: cineSuMasterUrl(tmdbId, query.season, query.episode), quality: "1080p", headers: { "User-Agent": UA, Referer: "https://cine.su/", Origin: "https://cine.su" } }];
}

// ─── VidLink ──────────────────────────────────────────────────
export async function scrapeVidLink(query: MediaQuery): Promise<HttpHit[]> {
  const tmdbId = await resolveTmdbId(query);
  if (!tmdbId) return [];
  const enc = await fetchJson<{ status?: number; result?: string }>(`https://enc-dec.app/api/enc-vidlink?text=${tmdbId}`, 5000);
  if (!enc?.result) return [];
  const isTv = query.kind !== "movie";
  const endpoint = isTv ? `https://vidlink.pro/api/b/tv/${enc.result}/${query.season ?? 1}/${query.episode ?? 1}` : `https://vidlink.pro/api/b/movie/${enc.result}`;
  const data = await fetchJson<{ stream?: { playlist?: string; qualities?: Record<string, { url?: string }> } }>(endpoint, 6000);
  if (!data?.stream) return [];
  const headers = { "User-Agent": UA, Origin: "https://vidlink.pro", Referer: "https://vidlink.pro/" };
  const hits: HttpHit[] = [];
  if (data.stream.playlist) hits.push({ scraperId: "vidlink", scraperName: "VidLink", title: "VidLink · Master HLS · 1080p", url: data.stream.playlist, quality: "1080p", headers });
  for (const q of ["1080", "720", "480"]) { const u = data.stream.qualities?.[q]?.url; if (u) { hits.push({ scraperId: "vidlink", scraperName: "VidLink", title: `VidLink · ${q}p`, url: u, quality: `${q}p`, headers }); break; } }
  return hits;
}

// ─── 111477 ───────────────────────────────────────────────────
export async function scrapeA111477(query: MediaQuery): Promise<HttpHit[]> {
  if (!query.imdbId) return [];
  const config = "https://a.111477.xyz/::sort=file-desc::limit=3";
  const b64 = Buffer.from(config, "utf8").toString("base64url").replace(/=+$/, "");
  const base = `https://st.111477.xyz/config/${b64}`;
  const isTv = query.kind !== "movie";
  const path = isTv ? `/stream/series/${query.imdbId}:${query.season ?? 1}:${query.episode ?? 1}.json` : `/stream/movie/${query.imdbId}.json`;
  const data = await fetchJson<{ streams?: Array<{ url?: string; title?: string; name?: string }> }>(`${base}${path}`, 8000);
  if (!data?.streams?.length) return [];
  const hits: HttpHit[] = []; const seen = new Set<string>();
  for (const s of data.streams) { const url = (s.url ?? "").trim(); if (!url.startsWith("http") || seen.has(url)) continue; seen.add(url); hits.push({ scraperId: "a111477", scraperName: "111477", title: s.title || s.name || "111477 · Direct", url, quality: "Auto", headers: { "User-Agent": UA, Accept: "application/json" } }); }
  return hits.slice(0, 6);
}

// ─── VidSrc ───────────────────────────────────────────────────
export async function scrapeVidSrc(query: MediaQuery): Promise<HttpHit[]> {
  const tmdbId = await resolveTmdbId(query);
  if (!tmdbId) return [];
  const isTv = query.kind !== "movie";
  const params = new URLSearchParams({ type: isTv ? "tv" : "movie", tmdb: String(tmdbId), stream_urls: "" });
  if (isTv) { params.set("season", String(query.season ?? 1)); params.set("episode", String(query.episode ?? 1)); }
  const data = await fetchJson<{ status_code?: string | number; data?: { stream_urls?: string[] } }>(`https://data.vidsrcme.ru/api.php?${params}`, 5000);
  const urls = data?.data?.stream_urls ?? [];
  const headers = { "User-Agent": UA, Referer: "https://cloudorchestranova.com/" };
  return urls.filter((u) => typeof u === "string" && u.startsWith("http")).slice(0, 4).map((url, i) => ({ scraperId: "vidsrc", scraperName: "VidSrc", title: urls.length > 1 ? `VidSrc ${i + 1}` : "VidSrc", url, quality: "Auto", headers }));
}
