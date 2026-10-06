// Research provider architecture.
//
//   researchCompany({ companyName, website, location }) → ResearchResult
//
// Providers:
//   manual — no automated research. The UI says so and the user researches by hand.
//   proxy  — POST to a backend you run (see server/research-proxy.mjs) that fetches public pages.
//   api    — POST to a hosted, browser-safe endpoint implementing the same contract.
// Only proxy/api results may be labelled automated research. No API keys ever live in this file:
// anything that needs a secret belongs behind the proxy.
import type { Confidence, ResearchSource, SourceType } from "../data/types";
import type { ResearchSettings } from "../lib/storage";
import { normalizeWebsite } from "../lib/url";

export interface ResearchRequest {
  companyName: string;
  website: string;
  location: string;
}

export interface ProviderFact {
  field: string;
  value: string;
  source: string;
  sourceType?: SourceType;
  retrievedAt?: string;
  confidence: Confidence;
  evidence?: string;
}

export type ResearchErrorCode =
  | "INVALID_DOMAIN"
  | "NOT_CONFIGURED"
  | "OFFLINE"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "DNS_FAILURE"
  | "SITE_UNAVAILABLE"
  | "HTTP_ERROR"
  | "BLOCKED"
  | "JS_ONLY"
  | "RATE_LIMITED"
  | "PROVIDER_ERROR"
  | "MALFORMED_RESPONSE"
  | "EMPTY_RESULT"
  | "UNSAFE_CONFIG";

export type ResearchResult =
  | {
      success: true;
      provider: string;
      website: string;
      retrievedAt: string;
      facts: ProviderFact[];
      sources: ResearchSource[];
      confidence: Confidence;
      partial: boolean;
      partialReason?: string;
    }
  | { success: false; provider: string; code: ResearchErrorCode; error: string; retryable: boolean };

/** What the user is told for each failure: what happened and what they can do. */
export const ERROR_HELP: Record<ResearchErrorCode, { title: string; detail: string; retryable: boolean }> = {
  INVALID_DOMAIN: { title: "Invalid website", detail: "Check the address — it should look like example.co.za.", retryable: false },
  NOT_CONFIGURED: { title: "Live company research is not configured", detail: "Research manually, or connect a research proxy in Settings.", retryable: false },
  OFFLINE: { title: "You are offline", detail: "Live research needs a network connection. Everything else keeps working offline.", retryable: true },
  NETWORK_ERROR: { title: "Research service unreachable", detail: "The research endpoint could not be reached (network or CORS). Check the endpoint in Settings.", retryable: true },
  TIMEOUT: { title: "Research timed out", detail: "The website or research service took too long to respond.", retryable: true },
  DNS_FAILURE: { title: "Domain not found", detail: "The domain does not resolve — it may be misspelt or no longer registered.", retryable: false },
  SITE_UNAVAILABLE: { title: "Website unavailable", detail: "We couldn't reach this company's website.", retryable: true },
  HTTP_ERROR: { title: "Website returned an error", detail: "The site responded with an HTTP error.", retryable: true },
  BLOCKED: { title: "Website blocked automated access", detail: "The site refused the request (for example a bot wall).", retryable: false },
  JS_ONLY: { title: "Website needs JavaScript", detail: "The page has almost no readable content without running scripts.", retryable: false },
  RATE_LIMITED: { title: "Rate limited", detail: "Too many research requests — wait a minute and retry.", retryable: true },
  PROVIDER_ERROR: { title: "Research provider error", detail: "The research service reported an internal error.", retryable: true },
  MALFORMED_RESPONSE: { title: "Unreadable research response", detail: "The research service answered in an unexpected format.", retryable: true },
  EMPTY_RESULT: { title: "Nothing found", detail: "The site was reached but no usable company information was found.", retryable: false },
  UNSAFE_CONFIG: { title: "Unsafe research configuration", detail: "API keys must not be placed in the front end. Use proxy mode and keep secrets on the server.", retryable: false },
};

export interface ProviderInfo {
  mode: ResearchSettings["mode"];
  endpoint: string;
  timeoutMs: number;
  /** Where the configuration came from. */
  origin: "settings" | "CAE_CONFIG" | "default";
  automated: boolean;
  label: string;
  problem: string | null;
}

declare global {
  interface Window {
    CAE_CONFIG?: { researchProvider?: Partial<ResearchSettings> & Record<string, unknown> };
  }
}

const SECRET_KEYS = /key|secret|token|password|auth/i;

/** Resolve the active provider: Settings override → window.CAE_CONFIG → manual. */
export function providerInfo(override: ResearchSettings | null): ProviderInfo {
  const cfg = (typeof window !== "undefined" && window.CAE_CONFIG?.researchProvider) || null;
  const origin: ProviderInfo["origin"] = override ? "settings" : cfg ? "CAE_CONFIG" : "default";
  const src = (override || cfg || { mode: "manual" }) as Partial<ResearchSettings> & Record<string, unknown>;
  const mode = src.mode === "proxy" || src.mode === "api" ? src.mode : "manual";
  const endpoint = typeof src.endpoint === "string" ? src.endpoint.trim() : "";
  const timeoutMs = Number(src.timeoutMs) > 0 ? Number(src.timeoutMs) : 25000;
  let problem: string | null = null;
  if (Object.keys(src).some((k) => k !== "endpoint" && SECRET_KEYS.test(k))) problem = ERROR_HELP.UNSAFE_CONFIG.detail;
  else if (mode !== "manual") {
    try {
      const u = new URL(endpoint);
      if (u.protocol !== "https:" && u.hostname !== "localhost" && u.hostname !== "127.0.0.1") problem = "The research endpoint must use https (http is only allowed for localhost).";
      if (u.search && SECRET_KEYS.test(u.search)) problem = ERROR_HELP.UNSAFE_CONFIG.detail;
    } catch {
      problem = "The research endpoint is not a valid URL.";
    }
  }
  const automated = mode !== "manual" && !problem;
  const label = mode === "manual" ? "Manual research" : (mode === "proxy" ? "Research proxy" : "Research API") + " · " + endpoint;
  return { mode, endpoint, timeoutMs, origin, automated, label, problem };
}

const fault = (provider: string, code: ResearchErrorCode, error?: string): ResearchResult => ({
  success: false,
  provider,
  code,
  error: error || ERROR_HELP[code].title + " — " + ERROR_HELP[code].detail,
  retryable: ERROR_HELP[code].retryable,
});

/** Validate a provider response against the contract. Anything off-contract is MALFORMED_RESPONSE. */
export function parseProviderResponse(body: unknown, provider: string): ResearchResult {
  if (!body || typeof body !== "object") return fault(provider, "MALFORMED_RESPONSE");
  const b = body as Record<string, any>;
  if (b.success === false) {
    const code = (Object.keys(ERROR_HELP) as ResearchErrorCode[]).includes(b.code) ? (b.code as ResearchErrorCode) : "PROVIDER_ERROR";
    return { success: false, provider, code, error: typeof b.error === "string" && b.error ? b.error : ERROR_HELP[code].title, retryable: typeof b.retryable === "boolean" ? b.retryable : ERROR_HELP[code].retryable };
  }
  if (b.success !== true || !Array.isArray(b.sources) || typeof b.retrievedAt !== "string") return fault(provider, "MALFORMED_RESPONSE");
  const sources: ResearchSource[] = b.sources
    .filter((s: any) => s && typeof s.url === "string" && /^https?:\/\//.test(s.url))
    .map((s: any) => ({ url: s.url, title: typeof s.title === "string" ? s.title : "", retrievedAt: s.retrievedAt || b.retrievedAt, sourceType: s.sourceType === "structured-data" ? "structured-data" : "website" }));
  const raw: any[] = Array.isArray(b.facts) ? b.facts : b.company && typeof b.company === "object" ? Object.entries(b.company).map(([field, value]) => ({ field, value, source: sources[0]?.url || "", confidence: "Indicated" })) : [];
  const facts: ProviderFact[] = raw
    .filter((f) => f && typeof f.field === "string" && typeof f.value === "string" && f.value.trim())
    .map((f) => ({
      field: f.field,
      value: f.value.trim().slice(0, 2000),
      // A fact is only ever as good as its source: no source → Assumption, never Observed.
      source: typeof f.source === "string" && /^https?:\/\//.test(f.source) ? f.source : "",
      sourceType: f.sourceType === "structured-data" ? "structured-data" : "website",
      retrievedAt: typeof f.retrievedAt === "string" ? f.retrievedAt : b.retrievedAt,
      confidence: ["Observed", "Indicated", "Assumption"].includes(f.confidence) ? f.confidence : "Indicated",
      evidence: typeof f.evidence === "string" ? f.evidence.slice(0, 500) : "",
    }))
    .map((f): ProviderFact => (f.source ? (f as ProviderFact) : ({ ...f, confidence: "Assumption" } as ProviderFact)));
  if (!facts.length || !sources.length) return fault(provider, "EMPTY_RESULT");
  return {
    success: true,
    provider: typeof b.provider === "string" ? b.provider : provider,
    website: typeof b.website === "string" ? b.website : "",
    retrievedAt: b.retrievedAt,
    facts,
    sources,
    confidence: "Observed",
    partial: !!b.partial,
    partialReason: typeof b.partialReason === "string" ? b.partialReason : undefined,
  };
}

/** Run research with the configured provider. Never throws; every failure is a typed result. */
export async function researchCompany(req: ResearchRequest, info: ProviderInfo, fetchImpl: typeof fetch = fetch): Promise<ResearchResult> {
  const provider = info.mode === "manual" ? "Manual" : info.mode === "proxy" ? "Research proxy" : "Research API";
  const site = normalizeWebsite(req.website);
  if (!site.ok) return fault(provider, "INVALID_DOMAIN", site.error);
  if (info.problem) return fault(provider, info.problem === ERROR_HELP.UNSAFE_CONFIG.detail ? "UNSAFE_CONFIG" : "NOT_CONFIGURED", info.problem);
  if (!info.automated) return fault(provider, "NOT_CONFIGURED");
  if (typeof navigator !== "undefined" && navigator.onLine === false) return fault(provider, "OFFLINE");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), info.timeoutMs);
  try {
    const res = await fetchImpl(info.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ companyName: req.companyName, website: site.url, location: req.location }),
      signal: ctrl.signal,
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (res.status === 429) return fault(provider, "RATE_LIMITED");
    if (!res.ok && !(body && (body as any).success === false)) return fault(provider, "PROVIDER_ERROR", `The research service answered HTTP ${res.status}.`);
    return parseProviderResponse(body, provider);
  } catch (e) {
    if ((e as Error).name === "AbortError") return fault(provider, "TIMEOUT");
    return fault(provider, "NETWORK_ERROR", `Could not reach ${info.endpoint} (${(e as Error).message}).`);
  } finally {
    clearTimeout(timer);
  }
}
