#!/usr/bin/env node
// AX-Channels CAE — reference research proxy (Node 18+, no dependencies).
//
// Fetches a company's public website (home page plus up to three linked About / Services / Contact
// pages) and returns only what those pages actually say, each fact with its source URL, retrieval time
// and a supporting quote. It never guesses: anything it cannot find is simply not returned and the
// CAE shows it as Unknown.
//
//   node server/research-proxy.mjs                 # http://localhost:8787/research (this machine only)
//   PORT=9000 ALLOWED_ORIGIN=https://cae.example node server/research-proxy.mjs
//   HOST=0.0.0.0 …                                  # listen on the network (put it behind your own auth)
//
// Safety: only public http(s) sites on ports 80/443 are fetched. Every connection — including each
// redirect hop — is checked after DNS resolution, so private, loopback, link-local and cloud-metadata
// addresses are refused (no SSRF). Requests from a browser origin other than ALLOWED_ORIGIN are refused.
//
// Then in the CAE: Settings → Research provider → Proxy, endpoint http://localhost:8787/research
// (or set window.CAE_CONFIG in the HTML file). Secrets for any paid provider you add belong here,
// in environment variables — never in the HTML.
import http from "node:http";
import https from "node:https";
import dns from "node:dns/promises";
import net from "node:net";
import zlib from "node:zlib";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
// "*" (default) allows any browser origin; otherwise a comma-separated list, e.g. "https://cae.example,null"
// ("null" is what a page opened from file:// sends).
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || "*").split(",").map((s) => s.trim()).filter(Boolean);
const ALLOW_PRIVATE = process.env.ALLOW_PRIVATE === "1"; // only for local testing
// Local testing only (needs ALLOW_PRIVATE=1): map a hostname to another origin, e.g. {"acme.test":"http://localhost:8901"}.
const HOST_OVERRIDES = ALLOW_PRIVATE ? JSON.parse(process.env.HOST_OVERRIDES || "{}") : {};
const PAGE_TIMEOUT = Number(process.env.PAGE_TIMEOUT_MS || 12000);
// The whole research run must finish before the CAE's own timeout (25s by default).
const TOTAL_TIMEOUT = Number(process.env.TOTAL_TIMEOUT_MS || 20000);
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
  ip = ip.toLowerCase();
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) ip = mapped[1];
  if (net.isIPv4(ip)) {
    const [a, b, c] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
      (a === 169 && b === 254) || // link-local, cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  return ip === "::" || ip === "::1" || /^(fc|fd|fe[89ab]|ff)/.test(ip) || ip.startsWith("::ffff:") || ip.startsWith("64:ff9b:");
}

/** Refuse anything but a public http(s) page on a standard port. Runs for the start URL and every redirect. */
function checkTarget(u) {
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Fail("BLOCKED", "Only http and https pages can be researched.");
  if (u.username || u.password) throw new Fail("BLOCKED", "Addresses with credentials cannot be researched.");
  if (ALLOW_PRIVATE) return;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) throw new Fail("BLOCKED", "IP addresses cannot be researched — use the company's domain name.");
  if (!HOST_RE.test(host)) throw new Fail("INVALID_DOMAIN", `"${host}" is not a valid public domain.`);
  if (u.port && u.port !== "80" && u.port !== "443") throw new Fail("BLOCKED", "Only standard web ports (80 and 443) can be researched.");
}

/** DNS lookup used for every connection: the address actually connected to is the one checked. */
function guardedLookup(hostname, options, cb) {
  dns.lookup(hostname, { all: true }).then(
    (addrs) => {
      if (!ALLOW_PRIVATE && addrs.some((a) => isPrivate(a.address))) return cb(Object.assign(new Error("private address"), { code: "EPRIVATE" }));
      if (options && options.all) cb(null, addrs);
      else cb(null, addrs[0].address, addrs[0].family);
    },
    (err) => cb(err),
  );
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

/** One HTTP GET without following redirects. Body capped at MAX_BYTES; total time capped at timeoutMs. */
function request(u, timeoutMs, accept) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, v) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(v);
    };
    const req = (u.protocol === "https:" ? https : http).get(u, { headers: { "User-Agent": UA, Accept: accept, "Accept-Encoding": "gzip, deflate, br" }, lookup: guardedLookup }, (res) => {
      const head = { status: res.statusCode || 0, headers: res.headers };
      if (head.status >= 300 && head.status < 400) {
        res.resume();
        return finish(resolve, { ...head, body: "" });
      }
      const enc = String(res.headers["content-encoding"] || "").toLowerCase();
      const stream = enc === "gzip" ? res.pipe(zlib.createGunzip()) : enc === "deflate" ? res.pipe(zlib.createInflate()) : enc === "br" ? res.pipe(zlib.createBrotliDecompress()) : res;
      const chunks = [];
      let size = 0;
      const done = () => finish(resolve, { ...head, body: Buffer.concat(chunks).toString("utf8") });
      stream.on("data", (c) => {
        size += c.length;
        if (size <= MAX_BYTES) chunks.push(c);
        else {
          done();
          req.destroy();
        }
      });
      stream.on("end", done);
      stream.on("error", (e) => finish(reject, e));
    });
    const timer = setTimeout(() => {
      req.destroy();
      finish(reject, Object.assign(new Error("timeout"), { code: "ETIMEOUT" }));
    }, Math.max(1, timeoutMs));
    req.on("error", (e) => finish(reject, e));
  });
}

/** GET with redirects followed by hand (max 5), each hop re-checked. */
async function get(url, timeoutMs, accept = "text/html,application/xhtml+xml") {
  let u = new URL(url);
  for (let hop = 0; hop <= 5; hop++) {
    checkTarget(u);
    const r = await request(u, timeoutMs, accept);
    if (r.status >= 300 && r.status < 400 && r.headers.location) {
      u = new URL(r.headers.location, u);
      continue;
    }
    return { ...r, url: u.toString() };
  }
  throw new Fail("SITE_UNAVAILABLE", "The site redirected too many times.");
}

async function fetchPage(url, deadline) {
  const timeout = Math.min(PAGE_TIMEOUT, deadline - Date.now());
  if (timeout <= 0) throw new Fail("TIMEOUT", "Research ran out of time.", true);
  try {
    const res = await get(url, timeout);
    if (res.status === 401 || res.status === 403 || res.status === 451) throw new Fail("BLOCKED", `The site refused access (HTTP ${res.status}).`);
    if (res.status === 429) throw new Fail("RATE_LIMITED", "The site is rate limiting requests (HTTP 429).", true);
    if (res.status < 200 || res.status >= 300) throw new Fail("HTTP_ERROR", `The site answered HTTP ${res.status}.`, res.status >= 500);
    const type = String(res.headers["content-type"] || "");
    if (!/html|xml/i.test(type)) throw new Fail("EMPTY_RESULT", `The page is not HTML (${type || "unknown type"}).`);
    return { url: res.url, html: res.body, status: res.status, at: new Date().toISOString() };
  } catch (e) {
    if (e instanceof Fail) throw e;
    const code = e.code || e.cause?.code || "";
    if (code === "ETIMEOUT") throw new Fail("TIMEOUT", `The site did not respond within ${Math.round(timeout / 1000)}s.`, true);
    if (code === "EPRIVATE") throw new Fail("BLOCKED", "The domain points to a private or internal address, which cannot be researched.");
    if (code === "ENOTFOUND" || code === "EAI_AGAIN" || code === "ENODATA") throw new Fail("DNS_FAILURE", "The domain does not resolve (DNS lookup failed).");
    throw new Fail("SITE_UNAVAILABLE", `The site could not be reached (${code || e.message}).`, true);
  }
}

async function robotsAllows(origin) {
  try {
    const res = await get(origin + "/robots.txt", 5000, "text/plain");
    if (res.status < 200 || res.status >= 300) return true;
    const lines = res.body.split(/\r?\n/).map((l) => l.replace(/#.*/, "").trim());
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
  checkTarget(start);
  const deadline = Date.now() + TOTAL_TIMEOUT;
  // Fetch the home page first so DNS, private-address and reachability failures are reported as such.
  let home;
  try {
    home = await fetchPage(start.toString(), deadline);
  } catch (e) {
    // Some company sites still have no working https: try plain http once (recorded in the observations).
    if (!(e instanceof Fail && e.code === "SITE_UNAVAILABLE" && start.protocol === "https:")) throw e;
    const plain = new URL(start);
    plain.protocol = "http:";
    home = await fetchPage(plain.toString(), deadline);
  }
  if (!(await robotsAllows(new URL(home.url).origin))) throw new Fail("BLOCKED", "The site's robots.txt disallows automated access.");
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
      page = await fetchPage(l.url, deadline);
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
  // A name guessed from the page title alone ("Under construction", "Home") is not company information.
  const meaningful = facts.filter((f) => !["website", "websiteObservations", "mobileObservations"].includes(f.field) && !(f.field === "name" && f.confidence === "Indicated"));
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
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < 60000)) hits.delete(k);
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 20;
}

const originAllowed = (origin) => ALLOWED_ORIGINS.includes("*") || origin === undefined || ALLOWED_ORIGINS.includes(origin);

function sendJson(res, status, body, origin) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes("*") ? "*" : originAllowed(origin) && origin ? origin : ALLOWED_ORIGINS[0],
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const send = (status, body) => sendJson(res, status, body, origin);
  if (!originAllowed(origin)) return send(403, { success: false, code: "PROVIDER_ERROR", error: `Origin ${origin} is not allowed by this research proxy (ALLOWED_ORIGIN).`, retryable: false });
  if (req.method === "OPTIONS") return send(204, {});
  if (req.method === "GET" && req.url === "/health") return send(200, { ok: true, provider: PROVIDER });
  if (req.method !== "POST" || !req.url.startsWith("/research")) return send(404, { success: false, code: "PROVIDER_ERROR", error: "Use POST /research", retryable: false });
  if (limited(req.socket.remoteAddress)) return send(429, { success: false, code: "RATE_LIMITED", error: "Too many research requests — wait a minute.", retryable: true });
  if (!/application\/json/i.test(req.headers["content-type"] || "")) return send(415, { success: false, code: "PROVIDER_ERROR", error: "Send the request as application/json.", retryable: false });
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 10000) return send(413, { success: false, code: "PROVIDER_ERROR", error: "Request too large", retryable: false });
  }
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return send(400, { success: false, code: "PROVIDER_ERROR", error: "Request body must be JSON.", retryable: false });
  }
  if (!input || typeof input !== "object" || typeof input.website !== "string") return send(400, { success: false, code: "INVALID_DOMAIN", error: "The request must include a website.", retryable: false });
  try {
    const result = await research(input);
    console.log(new Date().toISOString(), "ok", input.website, result.facts.length, "facts");
    send(200, result);
  } catch (e) {
    const f = e instanceof Fail ? e : new Fail("PROVIDER_ERROR", "Unexpected error: " + e.message, true);
    console.log(new Date().toISOString(), "fail", input?.website, f.code, f.message);
    send(200, { success: false, code: f.code, error: f.message, retryable: f.retryable });
  }
});

server.requestTimeout = 60000;
server.listen(PORT, HOST, () => console.log(`CAE research proxy on http://${HOST}:${PORT}/research (origins ${ALLOWED_ORIGINS.join(", ")})`));
