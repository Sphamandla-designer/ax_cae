// Every change to a workspace goes through one of these actions.
//
// An action is a pure function: (db, input, ctx) → { ok, db } or { ok: false, errors }. It validates
// first and never half-applies a change. The UI and the self-test call exactly the same functions.
import {
  CONTACT_ROLES,
  LEAD_SOURCES,
  LOST_REASONS,
  OUTCOME_NEXT,
  OUTREACH_OUTCOMES,
  SCAN_CATEGORIES,
  SCAN_STATUSES,
  SERVICE_GROUPS,
  SEVERITIES,
  STAGES,
  TOUCH_PURPOSES,
} from "../data/seed";
import {
  COMPANY_COLLECTIONS,
  type Activity,
  type Company,
  type Confidence,
  type Contact,
  type Db,
  type Fact,
  type FactStatus,
  type Meeting,
  type Opportunity,
  type Outreach,
  type Proposal,
  type ProposalStatus,
  type Research,
  type Scan,
  type Stage,
  type Strategy,
} from "../data/types";
import { addDays, daysBetween } from "../lib/dates";
import { hostOf, isEmail, normalizeWebsite, validOptionalUrl } from "../lib/url";
import type { ResearchResult } from "../research/provider";
import {
  bestOpp,
  clientOf,
  companyOf,
  currentResearch,
  dmOf,
  factOf,
  oppScore,
  outcomeOf,
  outreachOf,
} from "./queries";
import { acq, nextBest, readiness, REPLY_OUTCOMES, researchCheck } from "./workflow";

export interface Ctx {
  today: string;
  now: string;
  uid: (prefix: string) => string;
  /** True in the demo workspace: new records are flagged demo too. */
  demo: boolean;
}

export type Result = { ok: true; db: Db; id?: string; message?: string } | { ok: false; errors: string[] };

const fail = (...errors: string[]): Result => ({ ok: false, errors });
const t = (s: unknown) => (typeof s === "string" ? s.trim() : "");
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (s: string) => ISO.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
const CONFIDENCES: Confidence[] = ["Observed", "Indicated", "Assumption"];
export const CHANNELS = ["Email", "LinkedIn", "Phone", "WhatsApp", "In person"];
export const OPP_TYPES = Object.values(SERVICE_GROUPS as Record<string, string[]>).flat();
export const PROPOSAL_TRANSITIONS: Record<string, ProposalStatus[]> = {
  Draft: ["Sent"],
  Sent: ["Viewed", "Negotiation", "Accepted", "Rejected"],
  Viewed: ["Negotiation", "Accepted", "Rejected"],
  Negotiation: ["Accepted", "Rejected"],
  Expired: ["Sent"],
  Accepted: [],
  Rejected: [],
};
/** Follow-up spacing after each touch is sent (touch 4 closes the loop). */
const FOLLOW_UP_DAYS: Record<number, number> = { 1: 3, 2: 4, 3: 6 };

// ---------- helpers ----------

function activity(db: Db, ctx: Ctx, cid: string, kind: string, text: string): Db {
  const c = companyOf(db, cid);
  const a: Activity = { id: ctx.uid("a"), ts: ctx.now, companyId: cid, isDemo: c ? c.isDemo : ctx.demo, kind, text };
  return { ...db, activities: [a, ...db.activities] };
}

function patchCompany(db: Db, cid: string, ctx: Ctx, fn: (c: Company) => Company): Db {
  return { ...db, companies: db.companies.map((c) => (c.id === cid ? { ...fn(c), updatedAt: ctx.now } : c)) };
}

function stageIndex(s: string) {
  return (STAGES as string[]).indexOf(s);
}

/** Move a company forward to `stage` (never backwards, never to Won/Lost). */
function advanceStage(db: Db, cid: string, stage: Stage, ctx: Ctx): Db {
  const c = companyOf(db, cid);
  if (!c || stageIndex(c.stage) >= stageIndex(stage) || c.stage === "Won" || c.stage === "Lost") return db;
  return activity(patchCompany(db, cid, ctx, (x) => ({ ...x, stage, stageSince: ctx.today })), ctx, cid, "Stage change", c.name + " moved to " + stage + ".");
}

function resolveNotReady(db: Db, cid: string, reason: string, ctx: Ctx): Db {
  const c = companyOf(db, cid);
  return c && c.notReadyReason === reason ? patchCompany(db, cid, ctx, (x) => ({ ...x, notReadyReason: null })) : db;
}

function closeTasks(db: Db, pred: (x: Db["tasks"][number]) => boolean): Db {
  return { ...db, tasks: db.tasks.map((x) => (x.status !== "Done" && pred(x) ? { ...x, status: "Done" } : x)) };
}

/** Keep the logged next action equal to the engine's next best action (due date: follow-up date or today). */
export function syncNextAction(db: Db, cid: string, ctx: Ctx): Db {
  const c = companyOf(db, cid);
  if (!c) return db;
  const nb = nextBest(db, c, ctx.today);
  const followUp = outreachOf(db, cid).filter((o) => o.followUpDate).map((o) => o.followUpDate!).sort()[0];
  const due = nb.focus === "followup" && followUp ? followUp : c.nextAction.label === nb.label ? c.nextAction.due : ctx.today;
  if (c.nextAction.label === nb.label && c.nextAction.due === due) return db;
  return { ...db, companies: db.companies.map((x) => (x.id === cid ? { ...x, nextAction: { label: nb.label, due } } : x)) };
}

const done = (db: Db, ctx: Ctx, cid: string | null, extra: { id?: string; message?: string } = {}): Result => ({
  ok: true,
  db: cid ? syncNextAction(db, cid, ctx) : db,
  ...extra,
});

function needCompany(db: Db, cid: string): Company | null {
  return companyOf(db, cid);
}

// ---------- companies ----------

export interface CompanyInput {
  name: string;
  website?: string;
  industry?: string;
  subIndustry?: string;
  location?: string;
  size?: string;
  leadSource?: string;
  campaign?: string;
  linkedin?: string;
  priority?: string;
  description?: string;
  contactName?: string;
  contactTitle?: string;
  email?: string;
}

function validateCompany(db: Db, input: CompanyInput, selfId: string | null): { errors: string[]; website: string } {
  const errors: string[] = [];
  const name = t(input.name);
  if (!name) errors.push("Company name is required.");
  else if (db.companies.some((c) => c.id !== selfId && c.name.trim().toLowerCase() === name.toLowerCase()))
    errors.push(`A prospect called "${name}" already exists.`);
  let website = "";
  if (t(input.website)) {
    const r = normalizeWebsite(input.website!);
    if (!r.ok) errors.push(r.error);
    else {
      website = r.url;
      const dup = db.companies.find((c) => c.id !== selfId && c.website && hostOf(c.website) === r.host);
      if (dup) errors.push(`${r.host} is already the website of "${dup.name}".`);
    }
  }
  const li = validOptionalUrl(input.linkedin || "");
  if (li) errors.push("LinkedIn: " + li);
  if (input.leadSource && !(LEAD_SOURCES as string[]).includes(input.leadSource)) errors.push("Choose a lead source from the list.");
  return { errors, website };
}

export function addCompany(db: Db, input: CompanyInput, ctx: Ctx): Result {
  const { errors, website } = validateCompany(db, input, null);
  if (t(input.contactName) && !t(input.contactTitle)) errors.push("Add the contact's job title (or leave the contact empty).");
  if (t(input.email) && !isEmail(input.email!)) errors.push(`"${t(input.email)}" is not a valid email address.`);
  if (errors.length) return fail(...errors);
  const cid = ctx.uid("c");
  const company: Company = {
    id: cid,
    isDemo: ctx.demo,
    name: t(input.name),
    website,
    industry: t(input.industry),
    subIndustry: t(input.subIndustry),
    location: t(input.location),
    size: t(input.size),
    linkedin: t(input.linkedin),
    description: "",
    leadSource: t(input.leadSource),
    dateDiscovered: ctx.today,
    owner: "",
    campaign: t(input.campaign),
    stage: "New",
    stageSince: ctx.today,
    priority: input.priority || "Medium",
    scores: { problem: 0, pay: 0, need: 0, access: 0, growth: 0 },
    nextAction: { label: "Research company", due: ctx.today },
    notReadyReason: null,
    overrideNotReady: false,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
  let next: Db = { ...db, companies: [company, ...db.companies] };
  // Anything typed into "Description" is an unverified note until research confirms it.
  if (t(input.description) || website) {
    const facts: Fact[] = [];
    if (website) facts.push(manualFact("website", website, "Unverified", "Assumption", "", ctx));
    if (t(input.description)) facts.push(manualFact("description", t(input.description), "Unverified", "Assumption", "", ctx));
    next = { ...next, research: [...next.research, newResearch(cid, 1, "manual", "Manual", facts, ctx)] };
  }
  if (t(input.contactName)) {
    next = {
      ...next,
      contacts: [
        ...next.contacts,
        blankContact(ctx, cid, { name: t(input.contactName), title: t(input.contactTitle), email: t(input.email), preferredChannel: t(input.email) ? "Email" : "" }),
      ],
    };
  }
  next = activity(next, ctx, cid, "Prospect added", company.name + " added.");
  return done(next, ctx, cid, { id: cid });
}

export function updateCompany(db: Db, cid: string, input: CompanyInput, ctx: Ctx): Result {
  const c = needCompany(db, cid);
  if (!c) return fail("This prospect no longer exists.");
  const { errors, website } = validateCompany(db, input, cid);
  if (errors.length) return fail(...errors);
  const next = patchCompany(db, cid, ctx, (x) => ({
    ...x,
    name: t(input.name),
    website,
    industry: t(input.industry),
    subIndustry: t(input.subIndustry),
    location: t(input.location),
    size: t(input.size),
    leadSource: t(input.leadSource),
    campaign: t(input.campaign),
    linkedin: t(input.linkedin),
    priority: input.priority || x.priority,
  }));
  const changedSite = website !== c.website;
  return done(activity(next, ctx, cid, "Company updated", "Company details edited" + (changedSite ? "; website changed — research must confirm the new site." : ".")), ctx, cid);
}

/** Deletes a prospect and every record that belongs to it (no orphans are left behind). */
export function deleteCompany(db: Db, cid: string): Result {
  if (!companyOf(db, cid)) return fail("This prospect no longer exists.");
  const next: Db = { ...db, companies: db.companies.filter((c) => c.id !== cid), notes: { ...db.notes } };
  for (const k of COMPANY_COLLECTIONS) (next as any)[k] = (db as any)[k].filter((r: { companyId: string }) => r.companyId !== cid);
  delete next.notes[cid];
  return { ok: true, db: next };
}

/** Pipeline stage change for open stages. Won/Lost need an outcome record (recordOutcome). */
export function setStage(db: Db, cid: string, stage: Stage, ctx: Ctx): Result {
  const c = needCompany(db, cid);
  if (!c) return fail("This prospect no longer exists.");
  if (!(STAGES as string[]).includes(stage)) return fail(`"${stage}" is not a pipeline stage.`);
  if (stage === "Won" || stage === "Lost") return fail("Record the outcome to close a prospect as Won or Lost.");
  if (c.stage === "Won" || c.stage === "Lost") return fail(`${c.name} is closed as ${c.stage}. Its outcome record stays; reopening is not supported.`);
  if (c.stage === stage) return done(db, ctx, cid);
  const next = activity(patchCompany(db, cid, ctx, (x) => ({ ...x, stage, stageSince: ctx.today })), ctx, cid, "Stage change", c.name + " moved to " + stage + ".");
  return done(next, ctx, cid);
}

export function setScore(db: Db, cid: string, key: keyof Company["scores"], value: number, ctx: Ctx): Result {
  if (!needCompany(db, cid)) return fail("This prospect no longer exists.");
  if (!Number.isInteger(value) || value < 0 || value > 5) return fail("Scores run from 0 to 5.");
  return done(patchCompany(db, cid, ctx, (x) => ({ ...x, scores: { ...x.scores, [key]: value } })), ctx, cid);
}

export const NOT_READY_REASONS = ["Insufficient research", "No decision-maker", "Opportunity unclear", "Weak AX-Channels fit", "No evidence of need", "Poor timing", "Need more information"];

export function setNotReady(db: Db, cid: string, reason: string | null, ctx: Ctx): Result {
  const c = needCompany(db, cid);
  if (!c) return fail("This prospect no longer exists.");
  if (reason && !NOT_READY_REASONS.includes(reason)) return fail("Choose a reason from the list.");
  const next = patchCompany(db, cid, ctx, (x) => ({ ...x, notReadyReason: reason, overrideNotReady: false }));
  return done(activity(next, ctx, cid, reason ? "Marked not ready" : "Not-ready cleared", reason ? "Do not contact yet: " + reason + "." : "Cleared the not-ready state."), ctx, cid);
}

export function overrideNotReady(db: Db, cid: string, ctx: Ctx): Result {
  const c = needCompany(db, cid);
  if (!c || !c.notReadyReason) return fail("There is no not-ready state to override.");
  const next = patchCompany(db, cid, ctx, (x) => ({ ...x, overrideNotReady: true }));
  return done(activity(next, ctx, cid, "Override", "Outreach allowed despite: " + c.notReadyReason + "."), ctx, cid);
}

export function setNote(db: Db, cid: string, text: string): Result {
  if (!companyOf(db, cid)) return fail("This prospect no longer exists.");
  return { ok: true, db: { ...db, notes: { ...db.notes, [cid]: text } } };
}

// ---------- research ----------

export const RESEARCH_FIELDS: { field: string; label: string; required?: boolean; long?: boolean }[] = [
  { field: "name", label: "Company name", required: true },
  { field: "legalName", label: "Legal / registered name" },
  { field: "website", label: "Website", required: true },
  { field: "industry", label: "Industry" },
  { field: "subIndustry", label: "Sub-industry" },
  { field: "location", label: "Location" },
  { field: "description", label: "Company description", required: true, long: true },
  { field: "products", label: "Products / services", long: true },
  { field: "targetCustomers", label: "Target customers" },
  { field: "size", label: "Company size" },
  { field: "markets", label: "Markets served" },
  { field: "keyOfferings", label: "Key offerings" },
  { field: "signals", label: "Recent signals", long: true },
  { field: "digitalPresence", label: "Digital presence", long: true },
  { field: "websiteObservations", label: "Website observations", long: true },
  { field: "mobileObservations", label: "Mobile observations", long: true },
  { field: "socialPresence", label: "Social presence" },
  { field: "problems", label: "Potential business problems", long: true },
  { field: "opportunities", label: "Potential UX / digital opportunities", long: true },
  { field: "dmClues", label: "Decision-maker clues", long: true },
  { field: "contactDetails", label: "Public contact details" },
  { field: "relevantUrls", label: "Relevant URLs", long: true },
];
const FIELD_NAMES = RESEARCH_FIELDS.map((f) => f.field);

function manualFact(field: string, value: string, status: FactStatus, confidence: Confidence, source: string, ctx: Ctx): Fact {
  return { field, value, status: value ? status : "Unknown", confidence, source, sourceType: "manual", retrievedAt: source ? ctx.now : "", evidence: "" };
}

function newResearch(cid: string, version: number, mode: Research["mode"], provider: string, facts: Fact[], ctx: Ctx): Research {
  return {
    id: ctx.uid("rs"),
    companyId: cid,
    isDemo: ctx.demo,
    version,
    mode,
    provider,
    status: "draft",
    createdAt: ctx.now,
    updatedAt: ctx.now,
    retrievedAt: "",
    facts,
    sources: [],
    lastError: null,
    verification: null,
    completedAt: "",
    notes: "",
  };
}

/** The research version to edit: the current draft, or a new version copied from the completed one. */
function draftFor(db: Db, cid: string, ctx: Ctx, mode: Research["mode"], provider: string): { db: Db; r: Research } {
  const cur = currentResearch(db, cid);
  if (cur && cur.status === "draft" && cur.mode === mode) return { db, r: cur };
  const facts = cur && mode === "manual" ? cur.facts.map((f) => ({ ...f })) : [];
  const r = newResearch(cid, (cur ? cur.version : 0) + 1, mode, provider, facts, ctx);
  if (cur && mode === "manual") r.notes = cur.notes;
  return { db: { ...db, research: [...db.research, r] }, r };
}

export interface FactInput {
  field: string;
  value: string;
  status: FactStatus;
  confidence: Confidence;
  source: string;
  evidence?: string;
}

/** Save the research being edited (manual entry, or corrections to automated results). */
export function saveResearch(db: Db, cid: string, input: { facts: FactInput[]; notes: string }, ctx: Ctx): Result {
  const c = needCompany(db, cid);
  if (!c) return fail("This prospect no longer exists.");
  const errors: string[] = [];
  const label = (f: string) => RESEARCH_FIELDS.find((x) => x.field === f)?.label || f;
  for (const f of input.facts) {
    if (!FIELD_NAMES.includes(f.field)) errors.push(`Unknown research field "${f.field}".`);
    if (!CONFIDENCES.includes(f.confidence)) errors.push(`${label(f.field)}: choose a confidence level.`);
    const src = validOptionalUrl(f.source);
    if (src) errors.push(`${label(f.field)} source: ${src}`);
    if (t(f.value) && f.confidence === "Observed" && !t(f.source)) errors.push(`${label(f.field)} is marked Observed but has no source. Add the URL you checked, or lower the confidence.`);
    if (f.field === "website" && t(f.value)) {
      const w = normalizeWebsite(f.value);
      if (!w.ok) errors.push("Website: " + w.error);
    }
  }
  if (errors.length) return fail(...errors);
  const cur = currentResearch(db, cid);
  const mode = cur && cur.status === "draft" ? cur.mode : "manual";
  const { db: base, r } = draftFor(db, cid, ctx, mode, mode === "manual" ? "Manual" : cur!.provider);
  const prev = new Map(r.facts.map((f) => [f.field, f]));
  const facts: Fact[] = input.facts.map((f) => {
    const value = f.field === "website" && t(f.value) ? (normalizeWebsite(f.value) as { url: string }).url : t(f.value);
    const old = prev.get(f.field);
    const unchanged = old && old.value === value && old.source === t(f.source) && old.confidence === f.confidence;
    if (unchanged) return { ...old!, status: value ? f.status : "Unknown" };
    // A user edit is a manual fact, even when it corrects an automated one.
    return { ...manualFact(f.field, value, f.status, f.confidence, t(f.source), ctx), evidence: t(f.evidence) };
  });
  const updated: Research = { ...r, facts, notes: input.notes, updatedAt: ctx.now };
  let next: Db = { ...base, research: base.research.map((x) => (x.id === r.id ? updated : x)) };
  const site = facts.find((f) => f.field === "website" && f.value);
  if (site && site.value !== c.website) {
    const dup = next.companies.find((x) => x.id !== cid && x.website && hostOf(x.website) === hostOf(site.value));
    if (dup) return fail(`${hostOf(site.value)} is already the website of "${dup.name}".`);
    next = patchCompany(next, cid, ctx, (x) => ({ ...x, website: site.value }));
  }
  return done(activity(next, ctx, cid, "Research updated", `Research v${updated.version} saved (${updated.mode}).`), ctx, cid, { id: updated.id });
}

/** Record what a research provider returned. Failures are stored as failures — no facts are added. */
export function applyResearchResult(db: Db, cid: string, result: ResearchResult, ctx: Ctx): Result {
  const c = needCompany(db, cid);
  if (!c) return fail("This prospect no longer exists.");
  if (!result.success) {
    const { db: base, r } = draftFor(db, cid, ctx, "manual", "Manual");
    const err = { code: result.code, message: result.error, at: ctx.now };
    const next = { ...base, research: base.research.map((x) => (x.id === r.id ? { ...x, lastError: err, updatedAt: ctx.now } : x)) };
    return done(activity(next, ctx, cid, "Research failed", `${result.provider || "Research provider"}: ${result.error}`), ctx, cid);
  }
  const cur = currentResearch(db, cid);
  const r = newResearch(cid, (cur ? cur.version : 0) + 1, "automated", result.provider, [], ctx);
  r.retrievedAt = result.retrievedAt;
  r.sources = result.sources;
  r.facts = result.facts
    .filter((f) => FIELD_NAMES.includes(f.field) && t(f.value))
    .map((f) => ({
      field: f.field,
      // Keep exactly what was observed (e.g. http:// when the site has no working https).
      value: t(f.value),
      // Provider facts are only Observed when they carry the page they came from.
      status: "Unverified",
      confidence: f.source ? (CONFIDENCES.includes(f.confidence) ? f.confidence : "Indicated") : "Assumption",
      source: f.source || "",
      sourceType: f.sourceType || "website",
      retrievedAt: f.retrievedAt || result.retrievedAt,
      evidence: f.evidence || "",
    }));
  if (!r.facts.some((f) => f.field === "name")) r.facts.unshift(manualFact("name", c.name, "Unverified", "Assumption", "", ctx));
  if (result.partial) r.lastError = { code: "PARTIAL", message: result.partialReason || "Only part of the site could be read.", at: ctx.now };
  let next: Db = { ...db, research: [...db.research, r] };
  const canonical = normalizeWebsite(result.website || c.website);
  if (canonical.ok && canonical.url !== c.website) next = patchCompany(next, cid, ctx, (x) => ({ ...x, website: canonical.url }));
  const msg = `${result.provider} retrieved ${r.facts.length} fact${r.facts.length === 1 ? "" : "s"} from ${result.sources.length} source${result.sources.length === 1 ? "" : "s"}${result.partial ? " (partial)" : ""}. Review before completing.`;
  return done(activity(next, ctx, cid, "Research retrieved", msg), ctx, cid, { id: r.id, message: msg });
}

/** Complete the current research version — only when the evidence rule is met. */
export function completeResearch(db: Db, cid: string, input: { confirmManual: boolean }, ctx: Ctx): Result {
  const c = needCompany(db, cid);
  if (!c) return fail("This prospect no longer exists.");
  const r = currentResearch(db, cid);
  if (!r) return fail("Cannot complete research: nothing has been researched yet.", "Run research or enter it manually first.");
  if (r.status === "complete") return fail("This research version is already complete. Refresh research to start a new version.");
  const verification =
    r.mode === "automated" && r.sources.length && !input.confirmManual
      ? { type: "automated" as const, confirmedAt: ctx.now }
      : input.confirmManual
        ? { type: "manual" as const, confirmedAt: ctx.now }
        : null;
  const candidate: Research = { ...r, status: "complete", verification, completedAt: ctx.now, updatedAt: ctx.now };
  const trial: Db = { ...db, research: db.research.map((x) => (x.id === r.id ? candidate : x)) };
  const check = researchCheck(trial, c);
  if (!check.ok) return fail("Cannot complete research. Missing:", ...check.missing.map((m) => "• " + m));
  // Confirmed facts flow into the company record; unknown fields stay unknown.
  const val = (f: string) => {
    const x = factOf(candidate, f);
    return x && x.status !== "Unknown" ? x.value : "";
  };
  let next = patchCompany(trial, cid, ctx, (x) => ({
    ...x,
    description: val("description") || x.description,
    industry: val("industry") || x.industry,
    subIndustry: val("subIndustry") || x.subIndustry,
    location: val("location") || x.location,
    size: val("size") || x.size,
  }));
  next = resolveNotReady(next, cid, "Insufficient research", ctx);
  next = advanceStage(next, cid, "Researching", ctx);
  const how = verification?.type === "manual" ? "manual research, verified by you" : "automated research with " + r.sources.length + " source(s)";
  return done(activity(next, ctx, cid, "Research complete", `Research v${r.version} completed (${how}).`), ctx, cid);
}

// ---------- digital assessment ----------

export interface ScanInput {
  category: string;
  status: string;
  severity: string;
  problem: string;
  evidence: string;
  confidence: Confidence;
  source: string;
  opportunity: string;
  impact: string;
}

const UNREACHABLE = ["DNS_FAILURE", "SITE_UNAVAILABLE", "TIMEOUT", "HTTP_ERROR", "BLOCKED"];

export function addScan(db: Db, cid: string, input: ScanInput, ctx: Ctx): Result {
  const c = needCompany(db, cid);
  if (!c) return fail("This prospect no longer exists.");
  const errors: string[] = [];
  if (!(SCAN_CATEGORIES as string[]).includes(input.category)) errors.push("Choose what you assessed (category).");
  if (!(SCAN_STATUSES as string[]).includes(input.status)) errors.push("Choose a status for this category.");
  if (!(SEVERITIES as string[]).includes(input.severity)) errors.push("Choose a severity.");
  if (t(input.problem).length < 5) errors.push("Describe the problem specifically (not just “bad website”).");
  if (t(input.evidence).length < 10) errors.push("Record the evidence — what you actually saw, where.");
  if (!CONFIDENCES.includes(input.confidence)) errors.push("Choose a confidence level.");
  const src = validOptionalUrl(input.source);
  if (src) errors.push("Source: " + src);
  if (input.confidence === "Observed" && !t(input.source)) errors.push("Observed findings need a source — the URL of the page you inspected.");
  if (input.confidence === "Observed" && t(input.source) && c.website && hostOf(normalizeWebsite(input.source).ok ? (normalizeWebsite(input.source) as any).url : "") === hostOf(c.website)) {
    const r = currentResearch(db, cid);
    const reached = db.research.some((x) => x.companyId === cid && x.sources.some((s) => hostOf(s.url) === hostOf(c.website)));
    // Only while the site is unconfirmed: once research is completed (e.g. you verified it by hand) the block lifts.
    if (!reached && r?.lastError && UNREACHABLE.includes(r.lastError.code) && r.status !== "complete")
      errors.push("The company website could not be retrieved, so this cannot be marked Observed from it. Use Indicated or Assumption, or record where you saw it.");
  }
  if (errors.length) return fail(...errors);
  const url = t(input.source) ? (normalizeWebsite(input.source) as { url: string }).url : "";
  const scan: Scan = {
    id: ctx.uid("sc"),
    companyId: cid,
    isDemo: c.isDemo,
    category: input.category,
    status: input.status,
    severity: input.severity,
    problem: t(input.problem),
    evidence: t(input.evidence),
    opportunity: t(input.opportunity),
    impact: t(input.impact),
    confidence: input.confidence,
    source: url,
    sourceType: url && c.website && hostOf(url) === hostOf(c.website) ? "website" : "manual",
    assessedAt: ctx.now,
  };
  let next: Db = { ...db, scans: [...db.scans, scan] };
  if (scan.confidence === "Observed") next = resolveNotReady(next, cid, "No evidence of need", ctx);
  return done(activity(next, ctx, cid, "Assessment added", `${scan.category}: ${scan.status} (${scan.confidence}) — ${scan.problem}`), ctx, cid, { id: scan.id });
}

export function deleteScan(db: Db, id: string, ctx: Ctx): Result {
  const s = db.scans.find((x) => x.id === id);
  if (!s) return fail("This assessment no longer exists.");
  const next: Db = {
    ...db,
    scans: db.scans.filter((x) => x.id !== id),
    opportunities: db.opportunities.map((o) => (o.evidenceScanIds.includes(id) ? { ...o, evidenceScanIds: o.evidenceScanIds.filter((x) => x !== id) } : o)),
  };
  return done(activity(next, ctx, s.companyId, "Assessment removed", s.category + " assessment removed."), ctx, s.companyId);
}

// ---------- opportunity ----------

export interface OpportunityInput {
  problems: string;
  consequence: string;
  opportunity: string;
  type: string;
  estValue: string;
  complexity: string;
  severity: number;
  impact: number;
  likelihood: number;
  fit: number;
  evidenceScanIds: string[];
  evidenceNote: string;
  confirmAssumption?: boolean;
}

export function saveOpportunity(db: Db, cid: string, input: OpportunityInput, ctx: Ctx, id?: string): Result {
  const c = needCompany(db, cid);
  if (!c) return fail("This prospect no longer exists.");
  const errors: string[] = [];
  const problems = input.problems.split(",").map((s) => s.trim()).filter(Boolean);
  if (!problems.length) errors.push("Name the problem this opportunity solves.");
  if (!t(input.consequence)) errors.push("Describe the business consequence of the problem.");
  if (!t(input.opportunity)) errors.push("Describe the opportunity (what AX-Channels would do).");
  if (!OPP_TYPES.includes(input.type)) errors.push("Choose the recommended service from the list.");
  const value = Number(String(input.estValue).replace(/[\s,R]/gi, ""));
  if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) errors.push("Estimated value must be a whole number of rand greater than 0.");
  for (const [k, v] of [["Severity", input.severity], ["Impact", input.impact], ["Likelihood", input.likelihood], ["Service fit", input.fit]] as const)
    if (!Number.isInteger(v) || v < 1 || v > 5) errors.push(`${k} must be between 1 and 5.`);
  if (!["Low", "High"].includes(input.complexity)) errors.push("Choose a complexity.");
  const own = new Set(db.scans.filter((s) => s.companyId === cid).map((s) => s.id));
  const ev = input.evidenceScanIds.filter((x) => own.has(x));
  if (!ev.length && !t(input.evidenceNote)) errors.push("Link at least one assessment as evidence, or describe the evidence.");
  const evScans = db.scans.filter((s) => ev.includes(s.id));
  const basis: Confidence = evScans.some((s) => s.confidence === "Observed") ? "Observed" : evScans.length ? "Indicated" : "Assumption";
  if (!errors.length && basis === "Assumption" && value >= 250000 && !input.confirmAssumption)
    errors.push("This high-value opportunity rests only on assumptions. Tick “Based on assumptions — validate during discovery” to save it anyway.");
  if (errors.length) return fail(...errors);
  const group = Object.entries(SERVICE_GROUPS as Record<string, string[]>).find(([, items]) => items.includes(input.type));
  const rec: Opportunity = {
    id: id || ctx.uid("o"),
    companyId: cid,
    isDemo: c.isDemo,
    problems,
    consequence: t(input.consequence),
    opportunity: t(input.opportunity),
    service: input.type,
    type: input.type,
    group: group ? group[0] : "Other",
    valueBand: value >= 250000 ? "High" : value >= 100000 ? "Medium" : "Low",
    estValue: value,
    complexity: input.complexity,
    scores: { severity: input.severity, impact: input.impact, fit: input.fit, budget: 3, likelihood: input.likelihood },
    evidenceScanIds: ev,
    evidenceNote: t(input.evidenceNote),
    basis,
  };
  if (id && !db.opportunities.some((o) => o.id === id && o.companyId === cid)) return fail("This opportunity no longer exists.");
  let next: Db = { ...db, opportunities: id ? db.opportunities.map((o) => (o.id === id ? rec : o)) : [...db.opportunities, rec] };
  next = resolveNotReady(next, cid, "Opportunity unclear", ctx);
  const note = basis === "Assumption" ? " Assumption — validate during discovery." : "";
  return done(activity(next, ctx, cid, id ? "Opportunity updated" : "Opportunity created", `${rec.type} — R${rec.estValue} (${basis}).${note}`), ctx, cid, { id: rec.id });
}

// ---------- contacts ----------

export interface ContactInput {
  name: string;
  title: string;
  department: string;
  email: string;
  phone: string;
  linkedin: string;
  role: string;
  influence: string;
  relationship: string;
  preferredChannel: string;
  notes: string;
  source: string;
  confidence: Confidence;
}

function blankContact(ctx: Ctx, cid: string, p: Partial<Contact>): Contact {
  return {
    id: ctx.uid("p"),
    companyId: cid,
    isDemo: ctx.demo,
    name: "",
    title: "",
    department: "",
    email: "",
    phone: "",
    linkedin: "",
    decisionMaker: false,
    role: "Unknown",
    influence: "Medium",
    relationship: "New — not contacted",
    lastContacted: null,
    preferredChannel: "",
    notes: "",
    source: "",
    confidence: "Assumption",
    ...p,
  };
}

export function saveContact(db: Db, cid: string, input: ContactInput, ctx: Ctx, id?: string): Result {
  const c = needCompany(db, cid);
  if (!c) return fail("This prospect no longer exists.");
  const errors: string[] = [];
  if (!t(input.name)) errors.push("Contact name is required.");
  if (!t(input.title)) errors.push("Job title is required.");
  if (t(input.email) && !isEmail(input.email)) errors.push(`"${t(input.email)}" is not a valid email address.`);
  if (t(input.phone) && !/^[+()\d\s-]{7,20}$/.test(t(input.phone))) errors.push("Phone numbers may only contain digits, spaces, +, - and brackets.");
  const li = validOptionalUrl(input.linkedin);
  if (li) errors.push("LinkedIn: " + li);
  const src = validOptionalUrl(input.source);
  if (src) errors.push("Source: " + src);
  if (!(CONTACT_ROLES as string[]).includes(input.role)) errors.push("Choose a decision-making role.");
  if (t(input.preferredChannel) && !CHANNELS.includes(input.preferredChannel)) errors.push("Choose a preferred channel from the list.");
  if (input.confidence === "Observed" && !t(input.source)) errors.push("A contact marked Observed needs a source (for example their LinkedIn or team page).");
  const others = db.contacts.filter((p) => p.companyId === cid && p.id !== id);
  if (others.some((p) => p.name.toLowerCase() === t(input.name).toLowerCase())) errors.push(`${t(input.name)} is already a contact here.`);
  if (t(input.email) && others.some((p) => p.email.toLowerCase() === t(input.email).toLowerCase())) errors.push(`${t(input.email)} already belongs to another contact.`);
  if (id && !db.contacts.some((p) => p.id === id && p.companyId === cid)) errors.push("This contact no longer exists.");
  if (errors.length) return fail(...errors);
  const fields = {
    name: t(input.name),
    title: t(input.title),
    department: t(input.department),
    email: t(input.email),
    phone: t(input.phone),
    linkedin: t(input.linkedin),
    role: input.role,
    // Decision-maker status is only ever the explicit choice of the user.
    decisionMaker: input.role === "Decision Maker",
    influence: input.influence || "Medium",
    relationship: t(input.relationship),
    preferredChannel: input.preferredChannel,
    notes: input.notes || "",
    source: t(input.source) ? (normalizeWebsite(input.source) as { url: string }).url : "",
    confidence: input.confidence,
  };
  const rec = id ? { ...db.contacts.find((p) => p.id === id)!, ...fields } : blankContact({ ...ctx, demo: c.isDemo }, cid, fields);
  let next: Db = { ...db, contacts: id ? db.contacts.map((p) => (p.id === id ? rec : p)) : [...db.contacts, rec] };
  if (rec.decisionMaker) next = resolveNotReady(next, cid, "No decision-maker", ctx);
  return done(activity(next, ctx, cid, id ? "Contact updated" : "Contact added", `${rec.name} (${rec.role}) ${id ? "updated" : "added"}.`), ctx, cid, { id: rec.id });
}

export function markDecisionMaker(db: Db, cid: string, pid: string, ctx: Ctx): Result {
  const p = db.contacts.find((x) => x.id === pid && x.companyId === cid);
  if (!p) return fail("This contact no longer exists.");
  let next: Db = { ...db, contacts: db.contacts.map((x) => (x.id === pid ? { ...x, role: "Decision Maker", decisionMaker: true } : x)) };
  next = resolveNotReady(next, cid, "No decision-maker", ctx);
  return done(activity(next, ctx, cid, "Decision-maker identified", p.name + " marked as decision-maker."), ctx, cid);
}

export function logContactTouch(db: Db, cid: string, pid: string, ctx: Ctx): Result {
  const p = db.contacts.find((x) => x.id === pid && x.companyId === cid);
  if (!p) return fail("This contact no longer exists.");
  const next: Db = { ...db, contacts: db.contacts.map((x) => (x.id === pid ? { ...x, lastContacted: ctx.today } : x)) };
  return done(activity(next, ctx, cid, "Contact touched", "Spoke with " + p.name + "."), ctx, cid);
}

// ---------- signals ----------

export function addSignal(db: Db, cid: string, input: { label: string; confidence: Confidence; source: string }, ctx: Ctx): Result {
  const c = needCompany(db, cid);
  if (!c) return fail("This prospect no longer exists.");
  const errors: string[] = [];
  if (t(input.label).length < 4) errors.push("Describe the signal.");
  if (!CONFIDENCES.includes(input.confidence)) errors.push("Choose a confidence level.");
  const src = validOptionalUrl(input.source);
  if (src) errors.push("Source: " + src);
  if (input.confidence === "Observed" && !t(input.source)) errors.push("Observed signals need a source URL.");
  if (errors.length) return fail(...errors);
  const sig = { id: ctx.uid("sg"), companyId: cid, isDemo: c.isDemo, label: t(input.label), confidence: input.confidence, source: t(input.source) ? (normalizeWebsite(input.source) as { url: string }).url : "", recordedAt: ctx.now };
  return done(activity({ ...db, signals: [...db.signals, sig] }, ctx, cid, "Signal added", `${sig.label} (${sig.confidence}).`), ctx, cid);
}

// ---------- strategy ----------

export interface StrategyInput {
  problem: string;
  opportunity: string;
  targetContactId: string;
  service: string;
  valueProposition: string;
  entryOffer: string;
  angle: string;
  channel: string;
  cta: string;
  proof: string;
  nextStep: string;
  dealValue: string;
  difficulty: string;
}

export function saveStrategy(db: Db, cid: string, input: StrategyInput, ctx: Ctx): Result {
  const c = needCompany(db, cid);
  if (!c) return fail("This prospect no longer exists.");
  const errors: string[] = [];
  const target = db.contacts.find((p) => p.id === input.targetContactId && p.companyId === cid);
  if (!t(input.problem)) errors.push("Primary problem is required.");
  if (!target) errors.push("Choose the target person from this prospect's contacts.");
  if (!t(input.valueProposition)) errors.push("Value proposition is required.");
  if (!t(input.angle)) errors.push("Outreach angle is required — it drives the message.");
  if (!CHANNELS.includes(input.channel)) errors.push("Choose the outreach channel.");
  if (!["Easy", "Moderate", "Difficult"].includes(input.difficulty)) errors.push("Choose the expected sales difficulty.");
  if (errors.length) return fail(...errors);
  const existing = db.strategies.find((s) => s.companyId === cid);
  const rec: Strategy = {
    id: existing ? existing.id : ctx.uid("st"),
    companyId: cid,
    isDemo: c.isDemo,
    problem: t(input.problem),
    opportunity: t(input.opportunity),
    targetContactId: target!.id,
    target: target!.name + " (" + target!.title + ")",
    service: t(input.service),
    valueProposition: t(input.valueProposition),
    entryOffer: t(input.entryOffer),
    angle: t(input.angle),
    channel: input.channel,
    cta: t(input.cta),
    proof: t(input.proof),
    nextStep: t(input.nextStep),
    dealValue: t(input.dealValue),
    difficulty: input.difficulty,
    updatedAt: ctx.now,
  };
  const next: Db = { ...db, strategies: existing ? db.strategies.map((s) => (s.id === existing.id ? rec : s)) : [...db.strategies, rec] };
  return done(activity(next, ctx, cid, existing ? "Strategy updated" : "Strategy created", "Acquisition strategy " + (existing ? "updated" : "created") + "."), ctx, cid);
}

// ---------- outreach ----------

export const INSUFFICIENT = "Insufficient verified information to personalize this message.";

export interface OutreachInput {
  contactId: string;
  channel: string;
  message: string;
  purpose?: string;
}

export function saveOutreachDraft(db: Db, cid: string, input: OutreachInput, ctx: Ctx, id?: string): Result {
  const c = needCompany(db, cid);
  if (!c) return fail("This prospect no longer exists.");
  const errors: string[] = [];
  const msg = t(input.message);
  if (msg.length < 20) errors.push("Write the message before saving (at least 20 characters).");
  if (msg.includes(INSUFFICIENT)) errors.push("The message still contains the “insufficient information” notice. Personalise it with verified details first.");
  if (!CHANNELS.includes(input.channel)) errors.push("Choose a channel.");
  if (!db.contacts.some((p) => p.id === input.contactId && p.companyId === cid)) errors.push("Choose who the message is for.");
  const existing = id ? db.outreach.find((o) => o.id === id && o.companyId === cid) : null;
  if (id && !existing) errors.push("This draft no longer exists.");
  if (existing && existing.dateSent) errors.push("This message was already sent and cannot be edited.");
  if (errors.length) return fail(...errors);
  if (existing) {
    const next: Db = { ...db, outreach: db.outreach.map((o) => (o.id === id ? { ...o, message: msg, channel: input.channel, contactId: input.contactId, status: "Draft", approvedAt: null } : o)) };
    return done(activity(next, ctx, cid, "Draft updated", `Touch ${existing.touch} draft edited (needs approval again).`), ctx, cid, { id });
  }
  const touch = outreachOf(db, cid).filter((o) => o.dateSent).length + 1;
  const rec: Outreach = {
    id: ctx.uid("r"),
    companyId: cid,
    isDemo: c.isDemo,
    contactId: input.contactId,
    channel: input.channel,
    touch,
    purpose: input.purpose || (TOUCH_PURPOSES as Record<number, string>)[touch] || "Follow-up",
    message: msg,
    status: "Draft",
    createdAt: ctx.now,
    approvedAt: null,
    dateScheduled: null,
    dateSent: null,
    outcome: "",
    responseNotes: "",
    response: "",
    respondedAt: null,
    followUpDate: null,
    followUpSkipped: false,
  };
  return done(activity({ ...db, outreach: [...db.outreach, rec] }, ctx, cid, "Draft saved", `Touch ${touch} ${rec.channel} draft saved.`), ctx, cid, { id: rec.id });
}

export function approveOutreach(db: Db, id: string, ctx: Ctx): Result {
  const o = db.outreach.find((x) => x.id === id);
  if (!o) return fail("This message no longer exists.");
  if (o.status !== "Draft") return fail(`Only drafts can be approved (this one is ${o.status}).`);
  if (t(o.message).length < 20) return fail("The message is empty — edit it before approving.");
  const next: Db = { ...db, outreach: db.outreach.map((x) => (x.id === id ? { ...x, status: "Approved", approvedAt: ctx.now } : x)) };
  return done(activity(next, ctx, o.companyId, "Outreach approved", `Touch ${o.touch} approved — not sent yet.`), ctx, o.companyId);
}

export function scheduleOutreach(db: Db, id: string, date: string, ctx: Ctx): Result {
  const o = db.outreach.find((x) => x.id === id);
  if (!o) return fail("This message no longer exists.");
  if (o.status !== "Approved") return fail("Approve the message before scheduling it.");
  if (!validDate(date) || date < ctx.today) return fail("Choose a valid send date, today or later.");
  const next: Db = { ...db, outreach: db.outreach.map((x) => (x.id === id ? { ...x, status: "Scheduled", dateScheduled: date } : x)) };
  return done(activity(next, ctx, o.companyId, "Outreach scheduled", `Touch ${o.touch} scheduled to send on ${date}.`), ctx, o.companyId);
}

/** The only way an outreach becomes Sent. Creates exactly one follow-up task for the touch. */
export function markOutreachSent(db: Db, id: string, ctx: Ctx, opts: { overrideReadiness?: boolean } = {}): Result {
  const o = db.outreach.find((x) => x.id === id);
  if (!o) return fail("This message no longer exists.");
  const c = companyOf(db, o.companyId);
  if (!c) return fail("This prospect no longer exists.");
  if (o.dateSent) return fail("This message is already marked as sent.");
  if (o.status !== "Approved" && o.status !== "Scheduled") return fail("Approve the message before marking it as sent.");
  if (t(o.message).length < 20) return fail("Cannot mark as sent: the message is empty.");
  if (o.touch === 1 && !opts.overrideReadiness) {
    const r = readiness(db, c);
    if (!r.ready) return fail("Not ready for outreach. Missing:", ...(r.blocked ? ["• Do not contact yet: " + r.reason] : []), ...r.missing.map((m) => "• " + m.k));
  }
  const gap = FOLLOW_UP_DAYS[o.touch];
  const fu = gap ? addDays(ctx.today, gap) : null;
  let next: Db = {
    ...db,
    outreach: db.outreach.map((x) => {
      if (x.id === id) return { ...x, status: "Sent", dateSent: ctx.today, followUpDate: fu, outcome: x.outcome || "Sent" };
      // Sending this touch is the follow-up the earlier touches were waiting for.
      if (x.companyId === o.companyId && x.dateSent && x.followUpDate) return { ...x, followUpDate: null };
      return x;
    }),
    contacts: db.contacts.map((p) => (p.id === o.contactId ? { ...p, lastContacted: ctx.today } : p)),
  };
  next = closeTasks(next, (x) => x.companyId === o.companyId && x.type === "Follow-up" && !!x.outreachId && x.outreachId !== id);
  if (fu && !next.tasks.some((x) => x.outreachId === id && x.type === "Follow-up")) {
    next = {
      ...next,
      tasks: [
        ...next.tasks,
        {
          id: ctx.uid("t"),
          companyId: o.companyId,
          isDemo: c.isDemo,
          title: `Follow up ${c.name} — touch ${o.touch + 1}: ${(TOUCH_PURPOSES as Record<number, string>)[o.touch + 1] || "close the loop"}`,
          type: "Follow-up",
          priority: "High",
          due: fu,
          status: "Open",
          notes: `Created when touch ${o.touch} was marked sent.`,
          outreachId: id,
        },
      ],
    };
  }
  if (o.touch === 1 && c.notReadyReason && opts.overrideReadiness) next = patchCompany(next, c.id, ctx, (x) => ({ ...x, overrideNotReady: true }));
  next = advanceStage(next, o.companyId, "Outreach", ctx);
  next = activity(next, ctx, o.companyId, "Outreach sent", `Touch ${o.touch} sent via ${o.channel}${fu ? "; follow-up due " + fu : "; cadence complete"}.`);
  return done(next, ctx, o.companyId);
}

export function deleteOutreachDraft(db: Db, id: string, ctx: Ctx): Result {
  const o = db.outreach.find((x) => x.id === id);
  if (!o) return fail("This message no longer exists.");
  if (o.dateSent) return fail("Sent messages are part of the history and cannot be deleted.");
  return done(activity({ ...db, outreach: db.outreach.filter((x) => x.id !== id) }, ctx, o.companyId, "Draft discarded", `Touch ${o.touch} draft discarded.`), ctx, o.companyId);
}

export function recordResponse(db: Db, id: string, outcome: string, notes: string, ctx: Ctx): Result {
  const o = db.outreach.find((x) => x.id === id);
  if (!o) return fail("This message no longer exists.");
  if (!o.dateSent) return fail("Responses can only be recorded for messages that were sent.");
  if (!(OUTREACH_OUTCOMES as string[]).includes(outcome) || outcome === "Sent") return fail("Choose what happened.");
  if (REPLY_OUTCOMES.includes(outcome) && t(notes).length < 3) return fail("Add response notes — what did they actually say?");
  const replied = REPLY_OUTCOMES.includes(outcome);
  const rec = (OUTCOME_NEXT as Record<string, string>)[outcome] || "Follow up";
  let next: Db = {
    ...db,
    outreach: db.outreach.map((x) =>
      x.id === id
        ? { ...x, outcome, status: replied ? "Replied" : "Sent", responseNotes: t(notes), response: t(notes), respondedAt: replied ? ctx.now : x.respondedAt, followUpDate: replied ? null : x.followUpDate }
        : x,
    ),
  };
  if (replied) {
    next = closeTasks(next, (x) => x.outreachId === id && x.type === "Follow-up");
    next = advanceStage(next, o.companyId, "Responded", ctx);
  }
  const key = id + ":response";
  const taskExists = next.tasks.some((x) => x.outreachId === key && x.status !== "Done");
  if (replied && !taskExists)
    next = {
      ...next,
      tasks: [
        ...next.tasks,
        {
          id: ctx.uid("t"),
          companyId: o.companyId,
          isDemo: o.isDemo,
          title: rec,
          type: ["Not interested", "Negative"].includes(outcome) ? "Nurture" : "Follow-up",
          priority: ["Not interested", "Negative"].includes(outcome) ? "Low" : "High",
          due: ctx.today,
          status: "Open",
          notes: t(notes),
          outreachId: key,
        },
      ],
    };
  return done(activity(next, ctx, o.companyId, "Response recorded", `${outcome} — ${t(notes) || "no notes"} → ${rec}.`), ctx, o.companyId);
}

export function rescheduleFollowUp(db: Db, id: string, days: number, ctx: Ctx): Result {
  const o = db.outreach.find((x) => x.id === id);
  if (!o || !o.followUpDate) return fail("There is no follow-up scheduled on this touch.");
  const nd = addDays(o.followUpDate > ctx.today ? o.followUpDate : ctx.today, days);
  const next: Db = {
    ...db,
    outreach: db.outreach.map((x) => (x.id === id ? { ...x, followUpDate: nd } : x)),
    tasks: db.tasks.map((x) => (x.outreachId === id && x.type === "Follow-up" && x.status !== "Done" ? { ...x, due: nd } : x)),
  };
  return done(activity(next, ctx, o.companyId, "Follow-up rescheduled", `Touch ${o.touch + 1} moved to ${nd}.`), ctx, o.companyId);
}

export function skipFollowUp(db: Db, id: string, ctx: Ctx): Result {
  const o = db.outreach.find((x) => x.id === id);
  if (!o || !o.followUpDate) return fail("There is no follow-up scheduled on this touch.");
  let next: Db = { ...db, outreach: db.outreach.map((x) => (x.id === id ? { ...x, followUpDate: null, followUpSkipped: true } : x)) };
  next = closeTasks(next, (x) => x.outreachId === id && x.type === "Follow-up");
  return done(activity(next, ctx, o.companyId, "Follow-up skipped", `Touch ${o.touch + 1} skipped deliberately.`), ctx, o.companyId);
}

// ---------- discovery ----------

export interface MeetingInput {
  date: string;
  time: string;
  type: string;
  attendees: string;
  decisionMakerAttended: boolean;
  notes: string;
  painPoints: string;
  requirements: string;
  budget: string;
  timeline: string;
  nextStep: string;
}

export function scheduleMeeting(db: Db, cid: string, input: MeetingInput, ctx: Ctx, id?: string): Result {
  const c = needCompany(db, cid);
  if (!c) return fail("This prospect no longer exists.");
  const errors: string[] = [];
  if (!validDate(input.date)) errors.push("Choose the meeting date.");
  else if (input.date < ctx.today) errors.push("A scheduled meeting cannot be in the past — use “Record discovery” for a meeting that already happened.");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) errors.push("Enter the time as HH:MM.");
  if (!t(input.type)) errors.push("Choose the meeting type.");
  if (id && !db.meetings.some((m) => m.id === id && m.companyId === cid && m.status === "Scheduled")) errors.push("This scheduled meeting no longer exists.");
  if (errors.length) return fail(...errors);
  const rec: Meeting = {
    ...(id ? db.meetings.find((m) => m.id === id)! : {}),
    id: id || ctx.uid("m"),
    companyId: cid,
    isDemo: c.isDemo,
    status: "Scheduled",
    date: input.date,
    time: input.time,
    type: input.type,
    attendees: t(input.attendees),
    decisionMakerAttended: false,
    notes: t(input.notes),
    painPoints: "",
    requirements: "",
    budget: "",
    timeline: "",
    nextStep: "",
    heldAt: null,
  } as Meeting;
  const next: Db = { ...db, meetings: id ? db.meetings.map((m) => (m.id === id ? rec : m)) : [...db.meetings, rec] };
  return done(activity(next, ctx, cid, "Meeting booked", `${rec.type} ${id ? "moved to" : "scheduled for"} ${rec.date} ${rec.time}.`), ctx, cid, { id: rec.id });
}

/** A held meeting needs what was learned — date reached, attendees, notes, pain points, requirements, next step. */
export function recordMeetingHeld(db: Db, cid: string, input: MeetingInput, ctx: Ctx, id?: string): Result {
  const c = needCompany(db, cid);
  if (!c) return fail("This prospect no longer exists.");
  const errors: string[] = [];
  if (!validDate(input.date)) errors.push("Enter the date the meeting took place.");
  else if (input.date > ctx.today) errors.push("That date is in the future — a meeting can only be recorded once it has happened.");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) errors.push("Enter the time as HH:MM.");
  if (!t(input.attendees)) errors.push("List who attended.");
  if (t(input.notes).length < 10) errors.push("Add meeting notes — what was discussed.");
  if (!t(input.painPoints)) errors.push("Record the pain points you heard.");
  if (!t(input.requirements)) errors.push("Record their requirements (or write “None identified yet”).");
  if (!t(input.nextStep)) errors.push("Record the agreed next step.");
  if (id && !db.meetings.some((m) => m.id === id && m.companyId === cid)) errors.push("This meeting no longer exists.");
  if (errors.length) return fail(...errors);
  const rec: Meeting = {
    id: id || ctx.uid("m"),
    companyId: cid,
    isDemo: c.isDemo,
    status: "Held",
    date: input.date,
    time: input.time,
    type: input.type || "Discovery",
    attendees: t(input.attendees),
    decisionMakerAttended: !!input.decisionMakerAttended,
    notes: t(input.notes),
    painPoints: t(input.painPoints),
    requirements: t(input.requirements),
    budget: t(input.budget),
    timeline: t(input.timeline),
    nextStep: t(input.nextStep),
    heldAt: ctx.now,
  };
  let next: Db = { ...db, meetings: id ? db.meetings.map((m) => (m.id === id ? rec : m)) : [...db.meetings, rec] };
  next = advanceStage(next, cid, "Discovery", ctx);
  return done(activity(next, ctx, cid, "Discovery held", `${rec.type} on ${rec.date}: ${rec.notes}`), ctx, cid, { id: rec.id });
}

export function cancelMeeting(db: Db, id: string, ctx: Ctx): Result {
  const m = db.meetings.find((x) => x.id === id);
  if (!m || m.status !== "Scheduled") return fail("Only scheduled meetings can be cancelled.");
  const next: Db = { ...db, meetings: db.meetings.map((x) => (x.id === id ? { ...x, status: "Cancelled" } : x)) };
  return done(activity(next, ctx, m.companyId, "Meeting cancelled", `${m.type} on ${m.date} cancelled.`), ctx, m.companyId);
}

// ---------- proposals ----------

export interface ProposalInput {
  project: string;
  opportunityId: string;
  service: string;
  scope: string;
  value: string;
  expiry: string;
  notes: string;
}

export function saveProposal(db: Db, cid: string, input: ProposalInput, ctx: Ctx, id?: string): Result {
  const c = needCompany(db, cid);
  if (!c) return fail("This prospect no longer exists.");
  const errors: string[] = [];
  if (!t(input.project)) errors.push("Proposal title is required.");
  const opp = db.opportunities.find((o) => o.id === input.opportunityId && o.companyId === cid);
  if (!opp) errors.push("Link the proposal to one of this prospect's opportunities.");
  if (!t(input.scope)) errors.push("Describe the scope.");
  const value = Number(String(input.value).replace(/[\s,R]/gi, ""));
  if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) errors.push("Proposal value must be a whole number of rand greater than 0.");
  if (t(input.expiry) && (!validDate(input.expiry) || input.expiry < ctx.today)) errors.push("Expiry must be a valid date, today or later.");
  const existing = id ? db.proposals.find((p) => p.id === id && p.companyId === cid) : null;
  if (id && !existing) errors.push("This proposal no longer exists.");
  if (existing && existing.status !== "Draft") errors.push("Only draft proposals can be edited.");
  if (errors.length) return fail(...errors);
  const rec: Proposal = {
    id: id || ctx.uid("q"),
    companyId: cid,
    isDemo: c.isDemo,
    opportunityId: opp!.id,
    project: t(input.project),
    service: t(input.service) || opp!.type || opp!.service,
    scope: t(input.scope),
    value,
    status: "Draft",
    date: existing ? existing.date : ctx.today,
    sentDate: null,
    expiry: t(input.expiry),
    probability: 0.4,
    notes: t(input.notes),
    decidedAt: null,
  };
  const next: Db = { ...db, proposals: id ? db.proposals.map((p) => (p.id === id ? rec : p)) : [...db.proposals, rec] };
  return done(activity(next, ctx, cid, id ? "Proposal updated" : "Proposal created", `${rec.project} — R${rec.value} (draft).`), ctx, cid, { id: rec.id });
}

/** Proposals past their expiry while still open read as Expired. */
export function effectiveProposalStatus(p: Proposal, today: string): ProposalStatus {
  return p.expiry && p.expiry < today && ["Sent", "Viewed", "Negotiation"].includes(p.status) ? "Expired" : p.status;
}

export function setProposalStatus(db: Db, id: string, status: ProposalStatus, ctx: Ctx): Result {
  const p = db.proposals.find((x) => x.id === id);
  if (!p) return fail("This proposal no longer exists.");
  const from = effectiveProposalStatus(p, ctx.today);
  if (!(PROPOSAL_TRANSITIONS[from] || []).includes(status)) return fail(`A ${from.toLowerCase()} proposal cannot be marked ${status.toLowerCase()}.`);
  const prob: Record<string, number> = { Sent: 0.5, Viewed: 0.6, Negotiation: 0.7, Accepted: 1, Rejected: 0 };
  let next: Db = {
    ...db,
    proposals: db.proposals.map((x) =>
      x.id === id
        ? {
            ...x,
            status,
            probability: prob[status] ?? x.probability,
            sentDate: status === "Sent" ? ctx.today : x.sentDate,
            expiry: status === "Sent" && (!x.expiry || x.expiry < ctx.today) ? addDays(ctx.today, 21) : x.expiry,
            decidedAt: status === "Accepted" || status === "Rejected" ? ctx.now : x.decidedAt,
          }
        : x,
    ),
  };
  if (status === "Sent") next = advanceStage(next, p.companyId, "Proposal", ctx);
  if (status === "Negotiation") next = advanceStage(next, p.companyId, "Negotiation", ctx);
  return done(activity(next, ctx, p.companyId, "Proposal " + status.toLowerCase(), `${p.project} marked ${status.toLowerCase()}.`), ctx, p.companyId);
}

// ---------- outcome ----------

export interface OutcomeInput {
  kind: "Won" | "Lost";
  value: string;
  service: string;
  source: string;
  campaign: string;
  reason: string;
  notes: string;
  competitor: string;
  reEntryDate: string;
}

/** Close a prospect. History (research, outreach, proposals) is kept; an outcome record is added. */
export function recordOutcome(db: Db, cid: string, input: OutcomeInput, ctx: Ctx): Result {
  const c = needCompany(db, cid);
  if (!c) return fail("This prospect no longer exists.");
  if (outcomeOf(db, cid)) return fail("An outcome is already recorded for this prospect.");
  const errors: string[] = [];
  const won = input.kind === "Won";
  const value = Number(String(input.value).replace(/[\s,R]/gi, ""));
  if (won) {
    if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) errors.push("Final project value must be a whole number of rand greater than 0.");
    if (!t(input.service)) errors.push("Record the service purchased.");
    if (!t(input.reason)) errors.push("Record why AX-Channels won.");
  } else {
    if (!(LOST_REASONS as string[]).includes(input.reason)) errors.push("Choose why the prospect was lost.");
    if (t(input.reEntryDate) && (!validDate(input.reEntryDate) || input.reEntryDate <= ctx.today)) errors.push("Re-entry date must be a future date.");
  }
  if (errors.length) return fail(...errors);
  const a = acq(db, c, ctx.today), r = readiness(db, c), bo = bestOpp(db, cid);
  const outcome = {
    companyId: cid,
    isDemo: c.isDemo,
    result: input.kind,
    recordedAt: ctx.now,
    acqAtClose: a.total,
    oppAtClose: bo ? oppScore(bo) : 0,
    readinessAtClose: r.pct,
    industry: c.industry,
    service: won ? t(input.service) : bo ? bo.type || bo.service : "",
    value: won ? value : bo ? bo.estValue : 0,
    source: t(input.source) || c.leadSource,
    campaign: t(input.campaign) || c.campaign,
    daysToClose: daysBetween(c.dateDiscovered, ctx.today),
    reason: t(input.reason),
    notes: t(input.notes),
    competitor: won ? "" : t(input.competitor),
    reEntryDate: !won && t(input.reEntryDate) ? input.reEntryDate : null,
  };
  let next: Db = { ...db, outcomes: [...db.outcomes, outcome] };
  next = patchCompany(next, cid, ctx, (x) => ({ ...x, stage: input.kind, stageSince: ctx.today }));
  if (won && !clientOf(next, cid)) {
    next = {
      ...next,
      clients: [
        ...next.clients,
        { id: ctx.uid("cl"), companyId: cid, isDemo: c.isDemo, startDate: ctx.today, revenue: value, services: [t(input.service)], status: "Active — onboarding", growthOps: [], referral: "" },
      ],
    };
  }
  if (!won && outcome.reEntryDate)
    next = {
      ...next,
      tasks: [...next.tasks, { id: ctx.uid("t"), companyId: cid, isDemo: c.isDemo, title: `Re-engage ${c.name}`, type: "Nurture", priority: "Low", due: outcome.reEntryDate, status: "Open", notes: "Lost: " + outcome.reason, outreachId: null }],
    };
  next = closeTasks(next, (x) => x.companyId === cid && x.type === "Follow-up");
  next = {
    ...next,
    outreach: next.outreach.map((o) => (o.companyId === cid && o.followUpDate ? { ...o, followUpDate: null } : o)),
  };
  next = activity(next, ctx, cid, input.kind, `${c.name} marked ${input.kind.toLowerCase()} — ${won ? "R" + value + ", " + t(input.service) : outcome.reason}.`);
  return done(next, ctx, cid);
}

export function convertToClient(db: Db, cid: string, ctx: Ctx): Result {
  const c = needCompany(db, cid);
  if (!c) return fail("This prospect no longer exists.");
  if (c.stage !== "Won" || !outcomeOf(db, cid)) return fail("Record the won outcome first — it creates the client.");
  if (clientOf(db, cid)) return fail(`${c.name} is already a client.`);
  const oc = outcomeOf(db, cid)!;
  const next: Db = {
    ...db,
    clients: [...db.clients, { id: ctx.uid("cl"), companyId: cid, isDemo: c.isDemo, startDate: ctx.today, revenue: oc.value, services: [oc.service], status: "Active — onboarding", growthOps: [], referral: "" }],
  };
  return done(activity(next, ctx, cid, "Converted to client", c.name + " converted to client."), ctx, cid);
}

// ---------- tasks & settings ----------

export function toggleTask(db: Db, id: string, ctx: Ctx): Result {
  const x = db.tasks.find((k) => k.id === id);
  if (!x) return fail("This task no longer exists.");
  const status = x.status === "Done" ? "Open" : "Done";
  let next: Db = { ...db, tasks: db.tasks.map((k) => (k.id === id ? { ...k, status } : k)) };
  next = activity(next, ctx, x.companyId, status === "Done" ? "Task done" : "Task reopened", x.title);
  return done(next, ctx, x.companyId);
}

export function rescheduleTask(db: Db, id: string, days: number, ctx: Ctx): Result {
  const x = db.tasks.find((k) => k.id === id);
  if (!x) return fail("This task no longer exists.");
  const nd = addDays(x.due > ctx.today ? x.due : ctx.today, days);
  return done(activity({ ...db, tasks: db.tasks.map((k) => (k.id === id ? { ...k, due: nd } : k)) }, ctx, x.companyId, "Task rescheduled", `${x.title} moved to ${nd}.`), ctx, x.companyId);
}

export function setTarget(db: Db, key: string, raw: string): Result {
  const v = Number(raw);
  if (!(key in db.targets)) return fail("Unknown target.");
  if (!Number.isInteger(v) || v < 0 || v > 100) return fail("Targets must be whole numbers between 0 and 100.");
  return { ok: true, db: { ...db, targets: { ...db.targets, [key]: v } } };
}

export { validDate };
