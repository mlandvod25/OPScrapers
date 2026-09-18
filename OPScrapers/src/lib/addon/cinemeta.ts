import { fetchJson } from "./http";
import type { MediaKind, MediaQuery } from "./types";

interface CinemetaMeta {
  meta?: {
    name?: string;
    year?: string;
    releaseInfo?: string;
    imdb_id?: string;
    imdbid?: string;
    type?: string;
  };
}

export function parseResourceId(type: string, rawId: string): {
  kind: MediaKind;
  imdbId?: string;
  kitsuId?: string;
  season?: number;
  episode?: number;
} {
  const kind: MediaKind =
    type === "anime" ? "anime" : type === "series" ? "series" : "movie";
  const id = rawId.replace(/\.json$/i, "");
  const kitsu = id.match(/^kitsu:(\d+)(?::(\d+):(\d+))?$/i);
  if (kitsu) {
    return {
      kind: "anime",
      kitsuId: kitsu[1],
      season: kitsu[2] ? Number(kitsu[2]) : undefined,
      episode: kitsu[3] ? Number(kitsu[3]) : undefined,
    };
  }
  const parts = id.split(":");
  const head = parts[0] ?? "";
  const imdb = head.startsWith("tt") ? head : head.match(/^(\d+)$/) ? `tt${head}` : undefined;
  if (parts.length >= 3) {
    return {
      kind: kind === "movie" ? "series" : kind,
      imdbId: imdb,
      season: Number(parts[1]),
      episode: Number(parts[2]),
    };
  }
  return { kind, imdbId: imdb };
}

export async function resolveQuery(
  type: string,
  rawId: string,
): Promise<MediaQuery | null> {
  const parsed = parseResourceId(type, rawId);
  const rawClean = rawId.replace(/\.json$/i, "");

  if (parsed.kitsuId) {
    const kitsu = await fetchJson<{
      data?: { attributes?: { canonicalTitle?: string; startDate?: string; episodeCount?: number } };
    }>(`https://kitsu.io/api/edge/anime/${parsed.kitsuId}`);
    const title = kitsu?.data?.attributes?.canonicalTitle;
    if (!title) return null;
    const year = kitsu.data?.attributes?.startDate?.slice(0, 4);
    return {
      kind: "anime",
      rawId: rawClean,
      title,
      year,
      season: parsed.season,
      episode: parsed.episode,
      absoluteNumber: parsed.episode,
    };
  }

  if (!parsed.imdbId) return null;

  const metaType = parsed.kind === "movie" ? "movie" : "series";
  const data = await fetchJson<CinemetaMeta>(
    `https://v3-cinemeta.strem.io/meta/${metaType}/${parsed.imdbId}.json`,
  );
  const name = data?.meta?.name;
  if (!name) {
    return {
      kind: parsed.kind,
      rawId: rawClean,
      imdbId: parsed.imdbId,
      title: parsed.imdbId,
      season: parsed.season,
      episode: parsed.episode,
    };
  }
  const year =
    data?.meta?.year ||
    (data?.meta?.releaseInfo ? String(data.meta.releaseInfo).slice(0, 4) : undefined);
  return {
    kind: parsed.kind,
    rawId: rawClean,
    imdbId: parsed.imdbId,
    title: name,
    year,
    season: parsed.season,
    episode: parsed.episode,
    absoluteNumber: parsed.kind === "anime" ? parsed.episode : undefined,
  };
}
