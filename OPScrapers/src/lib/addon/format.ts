import { formatSize } from "./parse";
import { DEFAULT_TRACKERS } from "./trackers";
import type { StremioStream, TorrentHit } from "./types";

export function toStremioStream(hit: TorrentHit): StremioStream {
  const quality = hit.quality;
  const filename = hit.title.replace(/\s+/g, " ").trim();
  const description = `${filename}\n💾 ${formatSize(hit.sizeBytes)} 👤 ${hit.seeders} ⚙️ ${hit.scraperName}`;
  return {
    name: quality ? `OpenScrapers\n${quality}` : "OpenScrapers",
    title: description,
    description,
    infoHash: hit.infoHash,
    sources: DEFAULT_TRACKERS,
    behaviorHints: {
      bingeGroup: `openscrapers|${quality ?? "any"}`,
      filename,
      videoSize: hit.sizeBytes || undefined,
    },
  };
}
