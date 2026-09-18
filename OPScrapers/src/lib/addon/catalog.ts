import type { ScraperInfo } from "./types";

export const SCRAPER_CATALOG: ScraperInfo[] = [
  { id: "thepiratebay", name: "PirateBay", group: "core", languages: ["en"], kinds: ["movie", "series", "anime"], defaultOn: true, note: "apibay.org JSON API" },
  { id: "yts", name: "YTS", group: "core", languages: ["en"], kinds: ["movie"], defaultOn: true, note: "YTS / Accel movie API" },
  { id: "eztv", name: "EZTV", group: "core", languages: ["en"], kinds: ["series"], defaultOn: true, note: "EZTV TV API" },
  { id: "nyaa", name: "Nyaa", group: "anime", languages: ["en", "ja"], kinds: ["anime", "movie", "series"], defaultOn: true, note: "Nyaa.si RSS" },
  { id: "AnimeTosho", name: "AnimeTosho", group: "anime", languages: ["en", "ja"], kinds: ["anime", "movie", "series"], defaultOn: true, note: "AnimeTosho JSON feed" },
  { id: "bitsearch", name: "BitSearch", group: "indexers", languages: ["en"], kinds: ["movie", "series", "anime"], defaultOn: true, note: "BitSearch magnet index" },
  { id: "limetorrents", name: "LimeTorrents", group: "indexers", languages: ["en"], kinds: ["movie", "series", "anime"], defaultOn: true, note: "LimeTorrents hash index" },
  { id: "_1337x", name: "1337x", group: "indexers", languages: ["en"], kinds: ["movie", "series", "anime"], defaultOn: false, note: "1337x HTML (often Cloudflare)" },
  { id: "torrentgalaxy", name: "TorrentGalaxy", group: "indexers", languages: ["en"], kinds: ["movie", "series", "anime"], defaultOn: false, note: "TorrentGalaxy HTML" },
  { id: "nyaa2", name: "Nyaa 2", group: "anime", languages: ["en", "ja"], kinds: ["anime", "movie", "series"], defaultOn: false, note: "Alternate Nyaa parser" },
  { id: "AniDex", name: "AniDex", group: "anime", languages: ["en"], kinds: ["anime", "movie", "series"], defaultOn: false, note: "AniDex HTML" },
  { id: "anirena", name: "AniRena", group: "anime", languages: ["en"], kinds: ["anime", "movie", "series"], defaultOn: false, note: "AniRena HTML" },
  { id: "kickass", name: "Kickass", group: "indexers", languages: ["en"], kinds: ["movie", "series", "anime"], defaultOn: false, note: "Kickass clones" },
  { id: "magnetdl", name: "MagnetDL", group: "indexers", languages: ["en"], kinds: ["movie", "series"], defaultOn: false, note: "MagnetDL HTML" },
  { id: "glodls", name: "GloDLS", group: "indexers", languages: ["en"], kinds: ["movie", "series"], defaultOn: false, note: "GloDLS HTML" },
  { id: "Torlock", name: "TorLock", group: "indexers", languages: ["en"], kinds: ["movie", "series", "anime"], defaultOn: false, note: "TorLock HTML" },
  { id: "torrentdownload", name: "TorrentDownload", group: "indexers", languages: ["en"], kinds: ["movie", "series", "anime"], defaultOn: false, note: "TorrentDownload HTML" },
  { id: "torrentdownloads", name: "TorrentDownloads", group: "indexers", languages: ["en"], kinds: ["movie", "series", "anime"], defaultOn: false, note: "TorrentDownloads HTML" },
  { id: "bitlord", name: "Bitlord", group: "indexers", languages: ["en"], kinds: ["movie", "series", "anime"], defaultOn: false, note: "Bitlord search" },
  { id: "extratorrents", name: "ExtraTorrent", group: "indexers", languages: ["en"], kinds: ["movie", "series", "anime"], defaultOn: false, note: "ExtraTorrent clones" },
  { id: "zooqle", name: "Zooqle", group: "offline", languages: ["en"], kinds: ["movie", "series", "anime"], defaultOn: false, note: "Index often offline" },
  { id: "skytorrents", name: "SkyTorrents", group: "offline", languages: ["en"], kinds: ["movie", "series", "anime"], defaultOn: false, note: "Index often offline" },
  { id: "pirateiro", name: "Pirateiro", group: "indexers", languages: ["en"], kinds: ["movie", "series", "anime"], defaultOn: false, note: "Pirateiro HTML" },
  { id: "7torr", name: "SevenTorrents", group: "indexers", languages: ["en"], kinds: ["movie", "series", "anime"], defaultOn: false, note: "7torr HTML" },
  { id: "rutor", name: "RuTor", group: "regional", languages: ["ru"], kinds: ["movie", "series"], defaultOn: false, note: "Russian index" },
  { id: "torrent9", name: "Torrent9", group: "regional", languages: ["fr"], kinds: ["movie", "series"], defaultOn: false, note: "French index" },
  { id: "oxtorrent", name: "OxTorrent", group: "regional", languages: ["fr"], kinds: ["movie", "series", "anime"], defaultOn: false, note: "French index" },
  { id: "ilcorsaronero", name: "IlCorsaroNero", group: "regional", languages: ["it"], kinds: ["movie", "series"], defaultOn: false, note: "Italian index" },
  { id: "torrentapi", name: "RARBG", group: "offline", languages: ["en"], kinds: ["movie", "series"], defaultOn: false, note: "RARBG shut down in 2023" },
];

export const GROUP_LABEL: Record<ScraperInfo["group"], string> = {
  core: "Core APIs",
  indexers: "HTML indexers",
  anime: "Anime",
  regional: "Regional",
  offline: "Retired / unstable",
};

export const ADDON_NAME = "OpenScrapers";
export const ADDON_ID = "com.synclerscrapers.openscrapers";
export const ADDON_VERSION = "1.1.0";
export const ADDON_DESCRIPTION =
  "SynclerScrapers OpenScrapers torrent indexers, packaged as a Stremio stream addon for AIOStreams.";
