// Website validation and canonicalisation.
//   "example.co.za", "www.example.co.za", "https://example.co.za/" → "https://example.co.za"

export type UrlResult = { ok: true; url: string; host: string } | { ok: false; error: string };

const HOST_RE = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))*\.[a-z]{2,63}$/i;

export function normalizeWebsite(input: string): UrlResult {
  const raw = (input || "").trim();
  if (!raw) return { ok: false, error: "Enter the company website." };
  if (/\s/.test(raw)) return { ok: false, error: "A website address cannot contain spaces." };
  let candidate = raw;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) candidate = "https://" + candidate;
  let u: URL;
  try {
    u = new URL(candidate);
  } catch {
    return { ok: false, error: `"${raw}" is not a valid website address.` };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, error: "Use an http or https website address." };
  if (u.username || u.password) return { ok: false, error: "Website addresses with credentials are not allowed." };
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  if (!HOST_RE.test(host)) return { ok: false, error: `"${raw}" is not a valid domain (expected something like example.co.za).` };
  const path = u.pathname.replace(/\/+$/, "");
  return { ok: true, url: "https://" + host + path, host };
}

/** Optional URL field (sources, LinkedIn): empty is fine, otherwise it must be a valid http(s) URL. */
export function validOptionalUrl(input: string): string | null {
  const v = (input || "").trim();
  if (!v) return null;
  const r = normalizeWebsite(v);
  return r.ok ? null : r.error;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test((s || "").trim());
