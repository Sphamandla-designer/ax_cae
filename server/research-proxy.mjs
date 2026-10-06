#!/usr/bin/env node
// AX-Channels CAE — reference research proxy (Node 18+, no dependencies).
//
// Fetches a company's public website (home page plus up to three linked About / Services / Contact
// pages) and returns only what those pages actually say, each fact with its source URL, retrieval time
// and a supporting quote. It never guesses: anything it cannot find is simply not returned and the
// CAE shows it as Unknown.
//
//   node server/research-proxy.mjs                 # http://localhost:8787/research
//   PORT=9000 ALLOWED_ORIGIN=https://cae.example node server/research-proxy.mjs
//
// Then in the CAE: Settings → Research provider → Proxy, endpoint http://localhost:8787/research
// (or set window.CAE_CONFIG in the HTML file). Secrets for any paid provider you add belong here,
// in environment variables — never in the HTML.
import http from "node:http";
import dns from "node:dns/promises";
import net from "node:net";

const PORT = Number(process.env.PORT || 8787);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const ALLOW_PRIVATE = process.env.ALLOW_PRIVATE === "1"; // only for local testing
// Local testing only: map a hostname to another origin, e.g. {"acme.test":"http://localhost:8901"}.
const HOST_OVERRIDES = JSON.parse(process.env.HOST_OVERRIDES || "{}");
const PAGE_TIMEOUT = Number(process.env.PAGE_TIMEOUT_MS || 12000);
const MAX_BYTES = 1_500_000;
const UA = "AX-Channels-CAE-Research/1.0 (+company research; respects robots.txt)";
const PROVIDER = "AX research proxy";

// ---------- helpers ----------

const HOST_RE = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))*\.[a-z]{2,63}$/i;
function normalize(input) {
  let s = String(input || "").trim();
  if (!s || /\s/.test(s)) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (!HOST_RE.test(host) && !(ALLOW_PRIVATE && (host === "localhost" || net.isIP(host)))) return null;
    return u;
  } catch {
    return null;
  }
}

function isPrivate(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  return ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80");
}

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
const clean = (s) => decode(String(s || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const meta = (html, attr, name) => {
  const re = new RegExp(`<meta[^>]+${attr}=["']${name}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  return tag ? clean(tag.match(/content=["']([^"']*)["']/i)?.[1] || "") : "";
};

class Fail extends Error {
  constructor(code, message, retryable = false) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

async function fetchPage(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PAGE_TIMEOUT);
  try {
    const res = await fetch(url, { redirect: "follow", signal: ctrl.signal, headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" } });
    if (res.status === 401 || res.status === 403 || res.status === 451) throw new Fail("BLOCKED", `The site refused access (HTTP ${res.status}).`);
    if (res.status === 429) throw new Fail("RATE_LIMITED", "The site is rate limiting requests (HTTP 429).", true);
    if (!res.ok) throw new Fail("HTTP_ERROR", `The site answered HTTP ${res.status}.`, res.status >= 500);
    const type = res.headers.get("content-type") || "";
    if (!/html|xml/i.test(type)) throw new Fail("EMPTY_RESULT", `The page is not HTML (${type || "unknown type"}).`);
    const buf = await res.arrayBuffer();
    return { url: res.url || String(url), html: new TextDecoder().decode(buf.slice(0, MAX_BYTES)), status: res.status, at: new Date().toISOString() };
  } catch (e) {
    if (e instanceof Fail) throw e;
    if (e.name === "AbortError") throw new Fail("TIMEOUT", `The site did not respond within ${PAGE_TIMEOUT / 1000}s.`, true);
    const code = e.cause?.code || e.code || "";
    if (code === "ENOTFOUND" || code === "EAI_AGAIN") throw new Fail("DNS_FAILURE", "The domain does not resolve (DNS lookup failed).");
    throw new Fail("SITE_UNAVAILABLE", `The site could not be reached (${code || e.message}).`, true);
  } finally {
    clearTimeout(timer);
  }
}

async function robotsAllows(origin) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(origin + "/robots.txt", { signal: ctrl.signal, headers: { "User-Agent": UA } });
    clearTimeout(timer);
    if (!res.ok) return true;
    const lines = (await res.text()).split(/\r?\n/).map((l) => l.replace(/#.*/, "").trim());
    let applies = false;
    for (const l of lines) {
      const [k, ...rest] = l.split(":");
      const v = rest.join(":").trim();
      if (/^user-agent$/i.test(k)) applies = v === "*" || /ax-channels/i.test(v);
      else if (applies && /^disallow$/i.test(k) && v === "/") return false;
    }
    return true;
  } catch {
    return true;
  }
}

function jsonLd(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const v = JSON.parse(m[1].trim());
      const items = Array.isArray(v) ? v : v["@graph"] ? v["@graph"] : [v];
      for (const it of items) if (it && /Organization|Corporation|LocalBusiness|Company/i.test(String(it["@type"]))) out.push(it);
    } catch {
      // ignore malformed structured data
    }
  }
  return out;
}

function links(html, base) {
  const out = [];
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      out.push({ url: new URL(decode(m[1]), base).toString(), text: clean(m[2]) });
    } catch {
      // ignore bad hrefs
    }
  }
  return out;
}

// ---------- research ----------

async function research({ companyName, website }) {
  let start = normalize(website);
  if (!start) throw new Fail("INVALID_DOMAIN", `"${website}" is not a valid website address.`);
  if (HOST_OVERRIDES[start.hostname.replace(/^www\./, "")]) start = new URL(HOST_OVERRIDES[start.hostname.replace(/^www\./, "")]);
  if (!ALLOW_PRIVATE) {
    try {
      const addrs = await dns.lookup(start.hostname, { all: true });
      if (addrs.some((a) => isPrivate(a.address))) throw new Fail("BLOCKED", "Private or internal addresses cannot be researched.");
    } catch (e) {
      if (e instanceof Fail) throw e;
      if (e.code === "ENOTFOUND") throw new Fail("DNS_FAILURE", "The domain does not resolve (DNS lookup failed).");
      // other resolver errors: let fetch report the real failure
    }
  }
  if (!(await robotsAllows(start.origin))) throw new Fail("BLOCKED", "The site's robots.txt disallows automated access.");

  const home = await fetchPage(start.toString());
  const homeUrl = new URL(home.url);
  const facts = [];
  const sources = [{ url: home.url, title: clean(home.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ""), retrievedAt: home.at, sourceType: "website" }];
  const add = (field, value, source, confidence, evidence, sourceType = "website") => {
    value = clean(value);
    if (value && !facts.some((f) => f.field === field)) facts.push({ field, value: value.slice(0, 1500), source, sourceType, retrievedAt: home.at, confidence, evidence: clean(evidence).slice(0, 300) });
  };

  add("website", homeUrl.origin, home.url, "Observed", `HTTP ${home.status} from ${home.url}`);
  const org = jsonLd(home.html)[0];
  if (org) {
    sources.push({ url: home.url + "#structured-data", title: "Structured data (schema.org)", retrievedAt: home.at, sourceType: "structured-data" });
    if (org.name) add("name", org.name, home.url, "Observed", 'schema.org Organization name: "' + org.name + '"', "structured-data");
    if (org.legalName) add("legalName", org.legalName, home.url, "Observed", "schema.org legalName", "structured-data");
    if (org.description) add("description", org.description, home.url, "Observed", "schema.org description", "structured-data");
    const a = Array.isArray(org.address) ? org.address[0] : org.address;
    if (a && typeof a === "object") {
      const loc = [a.addressLocality, a.addressRegion, a.addressCountry?.name || a.addressCountry].filter(Boolean).join(", ");
      add("location", loc, home.url, "Observed", "schema.org address: " + [a.streetAddress, loc].filter(Boolean).join(", "), "structured-data");
    }
    const emp = org.numberOfEmployees?.value || org.numberOfEmployees?.minValue || (typeof org.numberOfEmployees === "number" ? org.numberOfEmployees : null);
    if (emp) add("size", String(emp) + " employees (as published)", home.url, "Observed", "schema.org numberOfEmployees", "structured-data");
    if (org.industry || org.knowsAbout) add("industry", [].concat(org.industry || org.knowsAbout).join(", "), home.url, "Indicated", "schema.org industry/knowsAbout", "structured-data");
  }
  const siteName = meta(home.html, "property", "og:site_name");
  if (siteName) add("name", siteName, home.url, "Observed", `og:site_name "${siteName}"`);
  const title = sources[0].title;
  if (title) add("name", title.split(/\s[|\-–—:]\s/)[0], home.url, "Indicated", `Page title "${title}"`);
  const desc = meta(home.html, "name", "description") || meta(home.html, "property", "og:description");
  if (desc) add("description", desc, home.url, "Observed", `Meta description: "${desc}"`);

  // Linked About / Services / Contact pages on the same site.
  const all = links(home.html, home.url);
  const sameSite = all.filter((l) => {
    try {
      return new URL(l.url).hostname.replace(/^www\./, "") === homeUrl.hostname.replace(/^www\./, "");
    } catch {
      return false;
    }
  });
  const pick = (re) => sameSite.find((l) => re.test(l.text) || re.test(new URL(l.url).pathname));
  const wanted = [
    ["about", pick(/about|who[- ]we[- ]are|our[- ]story|company/i)],
    ["services", pick(/services|solutions|what[- ]we[- ]do|products/i)],
    ["contact", pick(/contact/i)],
  ].filter(([, l]) => l && l.url !== home.url);
  const relevant = [];
  for (const [kind, l] of wanted) {
    let page;
    try {
      page = await fetchPage(l.url);
    } catch {
      continue; // a missing secondary page does not fail the research
    }
    relevant.push(page.url);
    sources.push({ url: page.url, title: clean(page.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ""), retrievedAt: page.at, sourceType: "website" });
    if (kind === "about") {
      const para = [...page.html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => clean(m[1])).find((p) => p.length >= 80);
      if (para) {
        // Only used when the home page published no description; never re-labelled as another field.
        if (!facts.some((f) => f.field === "description")) add("description", para, page.url, "Observed", `About page: "${para.slice(0, 200)}"`);
      }
    }
    if (kind === "services") {
      const heads = [...page.html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)].map((m) => clean(m[1])).filter((h) => h.length > 2 && h.length < 80).slice(0, 12);
      if (heads.length) facts.push({ field: "keyOfferings", value: heads.join("; "), source: page.url, sourceType: "website", retrievedAt: page.at, confidence: "Observed", evidence: "Headings on " + page.url });
    }
    if (kind === "contact") all.push(...links(page.html, page.url));
  }

  // Social profiles and public contact details.
  const social = [...new Set(all.map((l) => l.url).filter((u) => /linkedin\.com\/company|facebook\.com\/|instagram\.com\/|twitter\.com\/|x\.com\/|youtube\.com\//i.test(u)))].slice(0, 8);
  if (social.length) add("socialPresence", social.join(" · "), home.url, "Observed", "Links found on the website");
  const li = social.find((u) => /linkedin\.com\/company/i.test(u));
  if (li) add("relevantUrls", li, home.url, "Observed", "LinkedIn company page linked from the website");
  const emails = [...new Set(all.map((l) => l.url).filter((u) => u.startsWith("mailto:")).map((u) => u.slice(7).split("?")[0]))].slice(0, 3);
  const phones = [...new Set(all.map((l) => l.url).filter((u) => u.startsWith("tel:")).map((u) => decodeURIComponent(u.slice(4))))].slice(0, 3);
  if (emails.length || phones.length) add("contactDetails", [...emails, ...phones].join(" · "), home.url, "Observed", "mailto:/tel: links on the website");
  if (relevant.length) {
    const i = facts.findIndex((f) => f.field === "relevantUrls");
    if (i >= 0) facts[i].value += " · " + relevant.join(" · ");
    else add("relevantUrls", relevant.join(" · "), home.url, "Observed", "Pages linked from the home page");
  }

  // Objective website observations (what the HTML shows — no judgement).
  const obs = [];
  obs.push(homeUrl.protocol === "https:" ? "Served over HTTPS" : "Served over plain HTTP (no HTTPS)");
  const copy = home.html.match(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/i)?.[1];
  if (copy) obs.push(`Copyright year shown: ${copy}`);
  const navCount = (home.html.match(/<nav[\s\S]*?<\/nav>/i)?.[0].match(/<a\b/gi) || []).length;
  if (navCount) obs.push(`${navCount} links in the main navigation`);
  add("websiteObservations", obs.join(". ") + ".", home.url, "Observed", obs.join("; "));
  const vp = home.html.match(/<meta[^>]+name=["']viewport["'][^>]*>/i)?.[0];
  add(
    "mobileObservations",
    vp ? "Declares a responsive viewport (" + clean(vp.match(/content=["']([^"']*)/i)?.[1] || "") + ")." : "No viewport meta tag found — the home page does not declare mobile scaling.",
    home.url,
    "Observed",
    vp ? "viewport meta: " + (vp.match(/content=["\']([^"\']*)/i)?.[1] || "") : "The home page HTML has no viewport meta tag",
  );

  const text = clean(home.html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " "));
  // Structured data (application/ld+json) is not rendering code, so it does not count as JavaScript.
  const scripts = (home.html.match(/<script\b(?![^>]*application\/ld\+json)/gi) || []).length;
  const jsOnly = text.length < 200 && scripts > 0;
  const meaningful = facts.filter((f) => !["website", "websiteObservations", "mobileObservations"].includes(f.field));
  if (jsOnly && !meaningful.length) throw new Fail("JS_ONLY", "The home page renders its content with JavaScript, so there is almost no readable text.");
  if (!meaningful.length) throw new Fail("EMPTY_RESULT", "The site was reached but published no usable company information (no description, structured data or about page).");

  return {
    success: true,
    provider: PROVIDER,
    website: homeUrl.origin,
    retrievedAt: home.at,
    confidence: "Observed",
    facts,
    sources,
    company: Object.fromEntries(facts.map((f) => [f.field, f.value])),
    partial: jsOnly || !facts.some((f) => f.field === "description"),
    partialReason: jsOnly ? "Most of the page is rendered by JavaScript; only metadata could be read." : !facts.some((f) => f.field === "description") ? "No company description was published on the pages read." : undefined,
  };
}

// ---------- server ----------

const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 20;
}

function send(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true, provider: PROVIDER });
  if (req.method !== "POST" || !req.url.startsWith("/research")) return send(res, 404, { success: false, code: "PROVIDER_ERROR", error: "Use POST /research", retryable: false });
  if (limited(req.socket.remoteAddress)) return send(res, 429, { success: false, code: "RATE_LIMITED", error: "Too many research requests — wait a minute.", retryable: true });
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 10000) return send(res, 413, { success: false, code: "PROVIDER_ERROR", error: "Request too large", retryable: false });
  }
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return send(res, 400, { success: false, code: "PROVIDER_ERROR", error: "Request body must be JSON.", retryable: false });
  }
  try {
    const result = await research(input || {});
    console.log(new Date().toISOString(), "ok", input.website, result.facts.length, "facts");
    send(res, 200, result);
  } catch (e) {
    const f = e instanceof Fail ? e : new Fail("PROVIDER_ERROR", "Unexpected error: " + e.message, true);
    console.log(new Date().toISOString(), "fail", input?.website, f.code, f.message);
    send(res, 200, { success: false, code: f.code, error: f.message, retryable: f.retryable });
  }
});

server.listen(PORT, () => console.log(`CAE research proxy on http://localhost:${PORT}/research (origin ${ALLOWED_ORIGIN})`));
