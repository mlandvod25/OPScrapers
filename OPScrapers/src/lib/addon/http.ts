const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export async function fetchText(
  url: string,
  timeoutMs = 5000,
  accept?: string,
): Promise<{ ok: boolean; status: number; text: string; url: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const origin = new URL(url).origin;
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "user-agent": UA,
        accept: accept ?? "text/html,application/json,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        referer: `${origin}/`,
      },
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, url: res.url };
  } catch {
    return { ok: false, status: 0, text: "", url };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T>(url: string, timeoutMs = 5000): Promise<T | null> {
  const res = await fetchText(url, timeoutMs, "application/json, */*;q=0.8");
  if (!res.ok || !res.text) return null;
  try {
    return JSON.parse(res.text) as T;
  } catch {
    return null;
  }
}

export async function fetchFirst(
  urls: string[],
  timeoutMs = 5000,
  accept?: string,
): Promise<{ ok: boolean; status: number; text: string; url: string } | null> {
  const slice = urls.filter(Boolean).slice(0, 3);
  if (!slice.length) return null;
  const results = await Promise.all(slice.map((url) => fetchText(url, timeoutMs, accept)));
  return results.find((res) => res.ok && res.text.length > 40) ?? null;
}
