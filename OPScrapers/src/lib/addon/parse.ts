const MAGNET_HASH =
  /(?:urn:btih:|btih:\/?|btih=)([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i;
const HEX40 = /\b([a-fA-F0-9]{40})\b/;

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&/g, "&")
    .replace(/&#x3[dD];/g, "=")
    .replace(/&#0*61;/g, "=")
    .replace(/"/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/'/g, "'")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCharCode(code) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => {
      const code = parseInt(n, 16);
      return Number.isFinite(code) ? String.fromCharCode(code) : _;
    });
}

export function extractInfoHash(value: string | undefined | null): string | null {
  if (!value) return null;
  const decoded = decodeHtmlEntities(value);
  const magnet = decoded.match(MAGNET_HASH);
  if (magnet?.[1]) return normalizeHash(magnet[1]);
  const torrentFile = decoded.match(/\/torrent\/([a-fA-F0-9]{40})\.torrent/i);
  if (torrentFile?.[1]) return normalizeHash(torrentFile[1]);
  const hex = decoded.match(HEX40);
  if (hex?.[1]) return normalizeHash(hex[1]);
  return normalizeHash(decoded.trim());
}

export function normalizeHash(raw: string): string | null {
  const value = raw.trim();
  if (/^0{40}$/.test(value)) return null;
  if (/^[a-fA-F0-9]{40}$/.test(value)) return value.toLowerCase();
  return null;
}

export function parseSizeBytes(input: unknown): number {
  if (typeof input === "number" && Number.isFinite(input)) return Math.max(0, input);
  if (typeof input !== "string") return 0;
  const trimmed = decodeHtmlEntities(input).replace(/,/g, "").trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const match = trimmed.match(/([\d.]+)\s*(TB|GB|MB|KB|TiB|GiB|MiB|KiB|B)?/i);
  if (!match) return 0;
  const n = Number(match[1]);
  const unit = (match[2] ?? "B").toUpperCase();
  const mul: Record<string, number> = {
    B: 1,
    KB: 1024,
    KIB: 1024,
    MB: 1024 ** 2,
    MIB: 1024 ** 2,
    GB: 1024 ** 3,
    GIB: 1024 ** 3,
    TB: 1024 ** 4,
    TIB: 1024 ** 4,
  };
  return Math.round(n * (mul[unit] ?? 1));
}

export function formatSize(bytes: number): string {
  if (!bytes || bytes < 0) return "–";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n >= 10 || i === 0 ? n.toFixed(0) : n.toFixed(1)} ${units[i]}`;
}

export function parseSeeders(input: unknown): number {
  if (typeof input === "number" && Number.isFinite(input)) return Math.max(0, Math.floor(input));
  if (typeof input !== "string") return 0;
  const cleaned = decodeHtmlEntities(input).replace(/,/g, "").trim();
  const k = cleaned.match(/^([\d.]+)\s*k$/i);
  if (k) return Math.round(Number(k[1]) * 1000);
  const n = parseInt(cleaned.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

export function detectQuality(title: string, explicit?: string): string | undefined {
  const blob = `${explicit ?? ""} ${title}`.toLowerCase();
  if (/\b(2160p|4k|uhd|3840x2160)\b/.test(blob)) return "2160p";
  if (/\b(1080p|fullhd|1920x1080)\b/.test(blob)) return "1080p";
  if (/\b(720p|1280x720)\b/.test(blob)) return "720p";
  if (/\b(480p|sd|dvdrip|pdvd)\b/.test(blob)) return "480p";
  if (/\b360p\b/.test(blob)) return "360p";
  return explicit || undefined;
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function episodeCode(season: number, episode: number): string {
  return `S${pad2(season)}E${pad2(episode)}`;
}

export function seasonCode(season: number): string {
  return `S${pad2(season)}`;
}

export function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function titleMatches(hitTitle: string, queryTitle: string, year?: string): boolean {
  const hit = normalizeTitle(hitTitle);
  const words = normalizeTitle(queryTitle)
    .split(" ")
    .filter((w) => w.length > 2 && !STOP.has(w));
  if (words.length === 0) return hit.includes(normalizeTitle(queryTitle));
  const hits = words.filter((w) => hit.includes(w)).length;
  if (hits < Math.ceil(words.length * 0.6)) return false;
  void year;
  return true;
}

const STOP = new Set([
  "the",
  "and",
  "for",
  "der",
  "die",
  "das",
  "les",
  "une",
  "des",
]);

export function episodeMatches(hitTitle: string, season: number, episode: number): boolean {
  const t = hitTitle.toLowerCase();
  const s = pad2(season);
  const e = pad2(episode);
  const patterns = [
    new RegExp(`s${s}e${e}\\b`),
    new RegExp(`\\b${season}x${e}\\b`),
    new RegExp(`\\b${season}x${episode}\\b`),
    new RegExp(`season\\s*${season}\\s*episode\\s*${episode}\\b`),
  ];
  return patterns.some((re) => re.test(t));
}

export function applyReplacements(query: string, map?: Record<string, string>): string {
  if (!map) return query;
  let out = query;
  for (const [from, to] of Object.entries(map)) out = out.split(from).join(to);
  return out;
}

export function getPath(obj: unknown, path: string | undefined): unknown {
  if (!path) return obj;
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}
