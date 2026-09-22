import { useEffect, useMemo, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { Check, Copy, ExternalLink, LoaderCircle, Radio, Search } from "lucide-react";
import { GROUP_LABEL, SCRAPER_CATALOG } from "@/lib/addon/catalog";
import { decodeConfig, DEFAULT_CONFIG, encodeConfig } from "@/lib/addon/config";
import { loadStoredConfig, saveStoredConfig } from "@/lib/addon/client-config";
import type { AddonConfig, ScraperStat, StremioStream } from "@/lib/addon/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface HealthProbe {
  id: string;
  name: string;
  ok: boolean;
  ms: number;
  detail: string;
}

const SAMPLES = [
  { label: "Fight Club", type: "movie", id: "tt0137523" },
  { label: "Breaking Bad S01E01", type: "series", id: "tt0903747:1:1" },
  { label: "Spirited Away", type: "movie", id: "tt0245429" },
];

const QUALITIES = ["2160p", "1080p", "720p", "480p"];

export function Configurator() {
  const params = useParams({ strict: false }) as { config?: string };
  const [config, setConfig] = useState<AddonConfig>(() => ({
    scrapers: [...DEFAULT_CONFIG.scrapers],
    minSeeders: DEFAULT_CONFIG.minSeeders,
    maxResults: DEFAULT_CONFIG.maxResults,
    qualities: [...DEFAULT_CONFIG.qualities],
  }));
  const [origin, setOrigin] = useState("");
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedStremio, setCopiedStremio] = useState(false);
  const [probes, setProbes] = useState<HealthProbe[] | null>(null);
  const [searchId, setSearchId] = useState("tt0137523");
  const [searchType, setSearchType] = useState("movie");
  const [searching, setSearching] = useState(false);
  const [streams, setStreams] = useState<StremioStream[] | null>(null);
  const [stats, setStats] = useState<ScraperStat[] | null>(null);
  const [queryTitle, setQueryTitle] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    if (params.config) {
      setConfig(decodeConfig(params.config));
    } else {
      setConfig(loadStoredConfig());
    }
    setReady(true);
  }, [params.config]);

  useEffect(() => {
    if (ready) saveStoredConfig(config);
  }, [config, ready]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((r) => r.json())
      .then((d: { probes: HealthProbe[] }) => {
        if (!cancelled) setProbes(d.probes);
      })
      .catch(() => {
        if (!cancelled) setProbes([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const encoded = useMemo(() => encodeConfig(config), [config]);
  const manifest = origin ? `${origin}/${encoded}/manifest.json` : `/${encoded}/manifest.json`;
  const stremioLink = origin
    ? `stremio://${origin.replace(/^https?:\/\//, "")}/${encoded}/manifest.json`
    : "";

  function toggleScraper(id: string) {
    setConfig((c) => {
      const on = c.scrapers.includes(id);
      return {
        ...c,
        scrapers: on ? c.scrapers.filter((s) => s !== id) : [...c.scrapers, id],
      };
    });
  }

  function setGroup(group: string, on: boolean) {
    const ids = SCRAPER_CATALOG.filter((s) => s.group === group).map((s) => s.id);
    setConfig((c) => {
      const next = new Set(c.scrapers);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return { ...c, scrapers: [...next] };
    });
  }

  function recommended() {
    setConfig({
      scrapers: [...DEFAULT_CONFIG.scrapers],
      minSeeders: DEFAULT_CONFIG.minSeeders,
      maxResults: DEFAULT_CONFIG.maxResults,
      qualities: [...DEFAULT_CONFIG.qualities],
    });
  }

  async function copy(text: string, which: "manifest" | "stremio") {
    try {
      await navigator.clipboard.writeText(text);
      if (which === "manifest") {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      } else {
        setCopiedStremio(true);
        setTimeout(() => setCopiedStremio(false), 1600);
      }
    } catch {
      /* ignore */
    }
  }

  async function runSearch() {
    setSearching(true);
    setSearchError(null);
    setStreams(null);
    setStats(null);
    try {
      const url = `/api/search?type=${encodeURIComponent(searchType)}&id=${encodeURIComponent(searchId)}&config=${encoded}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const data = (await res.json()) as {
        query?: { title?: string };
        streams: StremioStream[];
        stats: ScraperStat[];
        error?: string;
      };
      if (data.error) throw new Error(data.error);
      setStreams(data.streams ?? []);
      setStats(data.stats ?? []);
      setQueryTitle(data.query?.title ?? searchId);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  const groups = ["core", "anime", "indexers", "regional", "http", "offline"] as const;
  const liveCount = probes?.filter((p) => p.ok).length ?? null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(80%_50%_at_12%_-8%,color-mix(in_oklab,var(--color-signal)_14%,transparent),transparent_55%)]" />
      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
        <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <p className="font-mono text-xs tracking-[0.22em] text-signal uppercase">
              SynclerScrapers · AIOStreams addon
            </p>
            <h1 className="text-4xl font-medium tracking-[-0.04em] text-foreground sm:text-5xl">
              OpenScrapers
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              All 29 indexers from the OpenScrapers Express vendor pack, served as a
              Stremio stream addon. Copy the manifest into AIOStreams as a custom
              addon — hashes come back in Torrentio form so StremThru can debrid them.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {liveCount != null && (
              <Badge tone={liveCount ? "live" : "warn"}>
                {liveCount}/{probes?.length ?? 0} core APIs live
              </Badge>
            )}
            <Badge>{config.scrapers.length} scrapers on</Badge>
          </div>
        </header>

        <Card className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium">AIOStreams manifest</h2>
              <p className="text-xs text-muted-foreground">
                Addons → Marketplace → Custom addon → paste this URL
              </p>
            </div>
            <Radio className="size-4 text-signal" />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <code className="block min-h-11 flex-1 overflow-x-auto rounded-md border border-border bg-muted px-3 py-3 font-mono text-xs leading-tight text-signal break-all">
              {manifest}
            </code>
            <Button onClick={() => copy(manifest, "manifest")} className="sm:w-36">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy URL"}
            </Button>
          </div>
          <ol className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
            <li className="rounded-lg bg-muted/70 p-3">
              <span className="font-mono text-xs text-signal">01</span>
              <p className="mt-1 text-foreground">Copy the configured manifest URL.</p>
            </li>
            <li className="rounded-lg bg-muted/70 p-3">
              <span className="font-mono text-xs text-signal">02</span>
              <p className="mt-1 text-foreground">In AIOStreams open Addons, then Marketplace, then Custom.</p>
            </li>
            <li className="rounded-lg bg-muted/70 p-3">
              <span className="font-mono text-xs text-signal">03</span>
              <p className="mt-1 text-foreground">Paste, install, save. Debrid keys stay in AIOStreams.</p>
            </li>
          </ol>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button variant="secondary" asChild disabled={!stremioLink}>
              <a href={stremioLink || undefined}>
                <ExternalLink className="size-4" />
                Install in Stremio
              </a>
            </Button>
            <Button
              variant="outline"
              onClick={() => copy(stremioLink, "stremio")}
              disabled={!stremioLink}
            >
              {copiedStremio ? "Stremio link copied" : "Copy Stremio link"}
            </Button>
            <p className="self-center text-xs text-muted-foreground">
              Returns <span className="font-mono text-foreground">infoHash</span> streams
              AIOStreams can cache on Real-Debrid, TorBox, Premiumize and friends.
            </p>
          </div>
        </Card>

        <section className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={recommended}>
                Recommended
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setConfig((c) => ({ ...c, scrapers: SCRAPER_CATALOG.map((s) => s.id) }))
                }
              >
                Enable all
              </Button>
            </div>
            {groups.map((group) => {
              const items = SCRAPER_CATALOG.filter((s) => s.group === group);
              const onCount = items.filter((s) => config.scrapers.includes(s.id)).length;
              return (
                <Card key={group} className="p-4 sm:p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-medium">{GROUP_LABEL[group]}</h2>
                      <p className="text-xs text-muted-foreground">
                        {onCount}/{items.length} enabled
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setGroup(group, true)}>
                        All
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setGroup(group, false)}>
                        None
                      </Button>
                    </div>
                  </div>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {items.map((s) => {
                      const on = config.scrapers.includes(s.id);
                      const probe = probes?.find((p) => p.id === s.id);
                      return (
                        <li key={s.id}>
                          <div
                            className={cn(
                              "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left",
                              on ? "border-border bg-muted/40" : "border-transparent bg-muted/20",
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => toggleScraper(s.id)}
                              className="min-w-0 flex-1 text-left"
                            >
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-medium">{s.name}</p>
                                {probe && (
                                  <Badge tone={probe.ok ? "live" : "down"}>
                                    {probe.ok ? "live" : "down"}
                                  </Badge>
                                )}
                              </div>
                              <p className="truncate text-xs text-muted-foreground">{s.note}</p>
                            </button>
                            <Switch
                              checked={on}
                              onCheckedChange={() => toggleScraper(s.id)}
                              aria-label={s.name}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              );
            })}
          </div>

          <aside className="flex flex-col gap-6">
            <Card className="p-4 sm:p-5">
              <h2 className="text-sm font-medium">Filters</h2>
              <label className="mt-4 block text-xs text-muted-foreground">
                Minimum seeders · {config.minSeeders}
                <input
                  type="range"
                  min={0}
                  max={50}
                  value={config.minSeeders}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, minSeeders: Number(e.target.value) }))
                  }
                  className="mt-2 w-full accent-signal"
                />
              </label>
              <label className="mt-4 block text-xs text-muted-foreground">
                Max results · {config.maxResults}
                <input
                  type="range"
                  min={20}
                  max={200}
                  step={10}
                  value={config.maxResults}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, maxResults: Number(e.target.value) }))
                  }
                  className="mt-2 w-full accent-signal"
                />
              </label>
              <p className="mt-4 text-xs text-muted-foreground">Qualities</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {QUALITIES.map((q) => {
                  const on = config.qualities.includes(q);
                  return (
                    <button
                      key={q}
                      type="button"
                      onClick={() =>
                        setConfig((c) => ({
                          ...c,
                          qualities: on
                            ? c.qualities.filter((x) => x !== q)
                            : [...c.qualities, q],
                        }))
                      }
                      className={cn(
                        "h-11 rounded-full border px-3 font-mono text-xs",
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {q}
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card className="p-4 sm:p-5">
              <h2 className="flex items-center gap-2 text-sm font-medium">
                <Search className="size-4 text-signal" />
                Stream lab
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Hits this addon the same way AIOStreams will.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SAMPLES.map((s) => (
                  <Button
                    key={s.id}
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSearchId(s.id);
                      setSearchType(s.type);
                    }}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
              <div className="mt-3 grid gap-2">
                <select
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value)}
                  className="h-11 rounded-md border border-input bg-card px-3 text-sm"
                >
                  <option value="movie">movie</option>
                  <option value="series">series</option>
                  <option value="anime">anime</option>
                </select>
                <Input
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  placeholder="tt0137523 or tt0903747:1:1"
                  className="font-mono"
                />
                <Button onClick={runSearch} disabled={searching || !searchId}>
                  {searching ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Search className="size-4" />
                  )}
                  {searching ? "Scraping…" : "Search scrapers"}
                </Button>
              </div>
              {searchError && (
                <p className="mt-3 text-xs text-destructive">{searchError}</p>
              )}
              {queryTitle && streams && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {queryTitle} · {streams.length} unique hashes
                </p>
              )}
              <ul className="mt-3 max-h-80 space-y-2 overflow-auto">
                {streams?.slice(0, 12).map((s) => (
                  <li
                    key={s.infoHash}
                    className="rounded-lg bg-muted/60 px-3 py-2 font-mono text-xs leading-relaxed"
                  >
                    <p className="text-foreground">{s.name.replace("\n", " · ")}</p>
                    <p className="whitespace-pre-wrap text-muted-foreground">{s.description}</p>
                  </li>
                ))}
                {streams && streams.length === 0 && (
                  <li className="text-xs text-muted-foreground">
                    No hashes for this title with the current filters. Try lowering min seeders or enabling more indexers.
                  </li>
                )}
              </ul>
              {stats && (
                <ul className="mt-3 space-y-1">
                  {stats.map((s) => (
                    <li key={s.id} className="flex justify-between font-mono text-xs text-muted-foreground">
                      <span>{s.name}</span>
                      <span className={s.ok ? "text-success" : "text-destructive"}>
                        {s.ok ? `${s.count} in ${s.ms}ms` : s.error ?? "fail"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </aside>
        </section>

        <footer className="border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground">
          Ported from the{" "}
          <a
            className="text-foreground underline decoration-border underline-offset-4"
            href="https://github.com/SynclerScrapers/vendor.synclerscrapers"
            target="_blank"
            rel="noreferrer"
          >
            vendor.synclerscrapers
          </a>{" "}
          OpenScrapers Express pack. This addon discovers public torrent indexes and
          returns info hashes — it does not host files. Use it with a debrid service
          inside AIOStreams.
        </footer>
      </main>
    </div>
  );
}
