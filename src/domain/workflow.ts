// Workflow engine: every status here is derived from records, never from a button having been clicked.
import { STALL_THRESHOLDS } from "../data/seed";
import type { Company, Db } from "../data/types";
import { daysBetween } from "../lib/dates";
import {
  bestOpp,
  clientOf,
  contactsOf,
  currentResearch,
  dmOf,
  factOf,
  isValidOpportunity,
  isValidScan,
  isValidStrategy,
  lastTouch,
  meetingsOf,
  oppScore,
  oppValueOf,
  oppsOf,
  outcomeOf,
  outreachOf,
  proposalsOf,
  scansOf,
  score,
  sevRank,
  signalsOf,
  strategyOf,
  validScansOf,
} from "./queries";

export const MIN_SCANS = 3;
export const MIN_DESCRIPTION = 20;
/** Response outcomes that count as the prospect actually replying. */
export const REPLY_OUTCOMES = ["Replied", "Positive", "Neutral", "Negative", "Wrong person", "Not interested", "Meeting booked"];

export interface Check {
  ok: boolean;
  missing: string[];
}

/** Research is complete only with identity, a confirmed website, a real description and evidence. */
export function researchCheck(db: Db, c: Company): Check & { inProgress: boolean } {
  const r = currentResearch(db, c.id);
  const missing: string[] = [];
  if (!c.name.trim()) missing.push("Company name");
  const desc = factOf(r, "description");
  const site = factOf(r, "website");
  const websiteConfirmed =
    !!c.website &&
    !!r &&
    (r.sources.some((s) => s.sourceType === "website" || s.sourceType === "structured-data") ||
      r.verification?.type === "manual" ||
      r.verification?.type === "demo") &&
    (!site || site.status !== "Unknown");
  if (!c.website) missing.push("Website");
  else if (!websiteConfirmed) missing.push("Verified website (retrieved or confirmed by you)");
  if (!desc || desc.status === "Unknown" || desc.value.trim().length < MIN_DESCRIPTION)
    missing.push(`Company description (at least ${MIN_DESCRIPTION} characters)`);
  if (!r || (r.sources.length === 0 && r.verification?.type !== "manual" && r.verification?.type !== "demo"))
    missing.push("Source evidence or your confirmation that you verified the details");
  if (r && r.facts.some((f) => f.confidence === "Observed" && !f.source && f.sourceType !== "demo"))
    missing.push("A source for every Observed fact");
  // The description feeds every later step, so it must be sourced unless you confirm it yourself.
  if (desc && desc.status !== "Unknown" && !desc.source && desc.sourceType !== "demo" && r?.mode !== "demo" && r?.verification?.type !== "manual")
    missing.push("A source for the company description, or your confirmation that you verified it");
  const ok = !!r && r.status === "complete" && missing.length === 0;
  return { ok, missing: r?.status === "complete" || missing.length ? missing : ["Complete research"], inProgress: !!r && !ok };
}

export interface StepDef {
  key: string;
  n: number;
  name: string;
  done: boolean;
  prog: boolean;
  missing: string[];
  cta: string;
}

export function steps13(db: Db, c: Company, today: string): StepDef[] {
  const cid = c.id;
  const rc = researchCheck(db, c);
  const scans = scansOf(db, cid), valid = validScansOf(db, cid);
  const opps = oppsOf(db, cid), validOpp = opps.some(isValidOpportunity);
  const dm = dmOf(db, cid), cts = contactsOf(db, cid);
  const st = strategyOf(db, cid), stOk = isValidStrategy(db, st);
  const outs = outreachOf(db, cid);
  const sent = outs.filter((o) => o.dateSent);
  const unsent = outs.filter((o) => !o.dateSent);
  const replied = outs.filter((o) => REPLY_OUTCOMES.includes(o.outcome));
  const followed = sent.filter((o) => o.touch >= 2);
  const mtgs = meetingsOf(db, cid);
  const held = mtgs.filter((m) => m.status === "Held");
  const props = proposalsOf(db, cid);
  const oc = outcomeOf(db, cid);
  const closed = (c.stage === "Won" || c.stage === "Lost") && !!oc;
  const scored = Object.values(c.scores).every((v) => v > 0);
  const stMissing = [
    !st?.problem.trim() && "Primary problem",
    !(st?.targetContactId || st?.target.trim()) && "Target person",
    !st?.valueProposition.trim() && "Value proposition",
    !st?.angle.trim() && "Outreach angle",
    !st?.channel.trim() && "Channel",
  ].filter(Boolean) as string[];
  return [
    { key: "company", n: 1, name: "Company", done: !!c.name.trim(), prog: false, missing: c.name.trim() ? [] : ["Company name"], cta: "Review company" },
    { key: "research", n: 2, name: "Research", done: rc.ok, prog: rc.inProgress, missing: rc.ok ? [] : rc.missing, cta: rc.ok ? "Review research" : "Research company" },
    {
      key: "assessment", n: 3, name: "Digital assessment", done: valid.length >= MIN_SCANS, prog: scans.length > 0 && valid.length < MIN_SCANS,
      missing: valid.length >= MIN_SCANS ? [] : [`${MIN_SCANS - valid.length} more evidenced assessment${MIN_SCANS - valid.length === 1 ? "" : "s"} (${valid.length} of ${MIN_SCANS})`],
      cta: scans.length ? "Add assessment" : "Start assessment",
    },
    {
      key: "opportunity", n: 4, name: "Opportunity", done: validOpp, prog: opps.length > 0 && !validOpp,
      missing: validOpp ? [] : opps.length ? ["Problem, opportunity, service, value and evidence on one opportunity"] : ["An opportunity record"],
      cta: opps.length ? "Review opportunity" : "Add opportunity",
    },
    {
      key: "contacts", n: 5, name: "Decision-maker", done: !!dm, prog: !dm && cts.length > 0,
      missing: dm ? [] : [cts.length ? "Mark the decision-maker among your contacts" : "A decision-maker contact"],
      cta: dm ? "Review contacts" : cts.length ? "Mark decision-maker" : "Add decision-maker",
    },
    { key: "prioritize", n: 6, name: "Prioritize", done: scored, prog: !scored && Object.values(c.scores).some((v) => v > 0), missing: scored ? [] : ["All five lead-score dimensions"], cta: "Review priority" },
    { key: "strategy", n: 7, name: "Strategy", done: stOk, prog: !!st && !stOk, missing: stOk ? [] : stMissing, cta: st ? "Edit strategy" : "Create strategy" },
    {
      key: "outreach", n: 8, name: "Outreach", done: sent.length > 0, prog: unsent.length > 0 && !sent.length,
      missing: sent.length ? [] : [unsent.length ? "Approve the message and mark it as sent" : "An outreach message marked as sent"],
      cta: sent.length ? "Review outreach" : unsent.length ? "Send outreach" : "Prepare outreach",
    },
    {
      key: "followup", n: 9, name: "Follow-up", done: followed.length > 0 || replied.length > 0 || held.length > 0, prog: sent.length > 0 && !followed.length && !replied.length,
      missing: followed.length || replied.length || held.length ? [] : ["A follow-up touch marked as sent, or a recorded reply"], cta: "Log follow-up",
    },
    { key: "response", n: 10, name: "Response", done: replied.length > 0, prog: sent.length > 0 && !replied.length, missing: replied.length ? [] : ["A recorded reply from the prospect"], cta: "Record response" },
    {
      key: "discovery", n: 11, name: "Discovery", done: held.length > 0, prog: mtgs.some((m) => m.status === "Scheduled"),
      missing: held.length ? [] : [mtgs.some((m) => m.status === "Scheduled") ? "Record the meeting as held, with notes" : "A discovery meeting"],
      cta: held.length ? "Review discovery" : mtgs.some((m) => m.status === "Scheduled") ? "Record discovery" : "Schedule discovery",
    },
    { key: "proposal", n: 12, name: "Proposal", done: props.length > 0, prog: false, missing: props.length ? [] : ["A proposal record"], cta: props.length ? "Review proposal" : "Create proposal" },
    { key: "outcome", n: 13, name: "Won / Lost", done: closed, prog: false, missing: closed ? [] : ["A recorded Won or Lost outcome"], cta: closed ? "Review outcome" : "Record outcome" },
  ].map((d) => ({ ...d, done: d.done, prog: !d.done && d.prog })).map((d) => (void today, d));
}

export type StepStatus = "COMPLETE" | "IN PROGRESS" | "BLOCKED" | "READY" | "LOCKED";
export const STATUS_COLORS: Record<StepStatus, [string, string, string]> = {
  COMPLETE: ["#2e7d5b", "#e8f2ec", "#bcdccb"],
  "IN PROGRESS": ["#a8863d", "#f6f0e0", "#e0cf9e"],
  READY: ["#0c1220", "#ffffff", "#0c1220"],
  LOCKED: ["#a39d8f", "#faf9f5", "#e6e2d8"],
  BLOCKED: ["#8a3b34", "#f6e6e4", "#e3c3bf"],
};

/** Status per step. Locked = an earlier step is unfinished (still navigable); blocked = NOT READY. */
export function stepStatuses(db: Db, c: Company, today: string) {
  let prevDone = true;
  return steps13(db, c, today).map((d) => {
    const blocked = d.n >= 8 && !d.done && !!c.notReadyReason && !c.overrideNotReady;
    const status: StepStatus = d.done ? "COMPLETE" : d.prog ? "IN PROGRESS" : blocked ? "BLOCKED" : prevDone ? "READY" : "LOCKED";
    // Prioritise is a judgement call and does not gate the later steps.
    if (d.key !== "prioritize") prevDone = prevDone && d.done;
    return { ...d, status };
  });
}

export interface ReadinessItem {
  k: string;
  ok: boolean;
  target: string;
}

export function readiness(db: Db, c: Company) {
  const cid = c.id;
  const rc = researchCheck(db, c);
  const valid = validScansOf(db, cid);
  const st = strategyOf(db, cid);
  const dm = dmOf(db, cid);
  const items: ReadinessItem[] = [
    { k: "Company researched", ok: rc.ok, target: "research" },
    { k: "Digital problem identified", ok: valid.length > 0, target: "assessment" },
    { k: "Evidence recorded (observed)", ok: valid.some((s) => s.confidence === "Observed"), target: "assessment" },
    { k: "Primary opportunity identified", ok: oppsOf(db, cid).some(isValidOpportunity), target: "opportunity" },
    { k: "Decision-maker identified", ok: !!dm, target: "contacts" },
    { k: "Acquisition strategy created", ok: isValidStrategy(db, st), target: "strategy" },
    { k: "Outreach angle defined", ok: !!st?.angle.trim(), target: "strategy" },
    { k: "Channel selected", ok: !!(st?.channel.trim() || dm?.preferredChannel), target: "strategy" },
  ];
  const done = items.filter((x) => x.ok).length;
  const pct = Math.round((done / items.length) * 100);
  const missing = items.filter((x) => !x.ok);
  const blocked = !!c.notReadyReason && !c.overrideNotReady;
  return { pct, items, missing, ready: missing.length === 0 && !blocked, blocked, reason: c.notReadyReason };
}

export interface NextAction {
  label: string;
  why: string;
  focus: string;
}

/** The first genuinely unfinished dependency — never a later step while an earlier one is open. */
export function nextBest(db: Db, c: Company, today: string): NextAction {
  const cid = c.id;
  const mk = (label: string, why: string, focus: string): NextAction => ({ label, why, focus });
  const props = proposalsOf(db, cid);
  const accepted = props.find((p) => p.status === "Accepted");
  const isClient = !!clientOf(db, cid);
  if (c.stage === "Won") return isClient ? mk("Plan growth review", "Client active — expand the account", "outcome") : mk("Convert to client", "Won — create the client record", "outcome");
  if (c.stage === "Lost") return mk("Nurture", "Closed lost — keep a light touch for re-entry", "outcome");
  if (accepted && !isClient) return mk("Record won outcome", "Proposal accepted — record the win", "outcome");

  const s = Object.fromEntries(steps13(db, c, today).map((d) => [d.key, d]));
  if (!s.research.done) {
    const r = currentResearch(db, cid);
    const desc = factOf(r, "description");
    const failed = r?.lastError && r.lastError.code !== "PARTIAL" ? r.lastError.code : null;
    // Research already retrieved or entered: the next step is to review and complete it, not to research again.
    if (r && r.status === "draft" && (r.mode === "automated" || (desc && desc.status !== "Unknown")))
      return mk("Review and complete research", s.research.missing.filter((m) => m !== "Complete research")[0] || "Check the facts, then complete research", "research");
    return mk("Research company", failed ? `Automated research failed (${failed}) — retry or research manually` : s.research.missing[0] || "Research not complete", "research");
  }
  if (!s.assessment.done) return mk("Assess digital experience", s.assessment.missing[0], "assessment");
  if (!s.opportunity.done) return mk("Identify primary opportunity", s.opportunity.missing[0], "opportunity");
  if (!s.contacts.done) return mk("Identify decision-maker", s.contacts.missing[0], "contacts");
  if (!s.strategy.done) return mk("Create acquisition strategy", "Missing: " + s.strategy.missing.join(", "), "strategy");

  const outs = outreachOf(db, cid);
  const sent = outs.filter((o) => o.dateSent);
  const pending = outs.filter((o) => !o.dateSent && o.status !== "Replied");
  if (!sent.length) {
    if (pending.some((o) => o.status === "Approved" || o.status === "Scheduled")) return mk("Send initial outreach", "Message approved, not sent yet", "outreach");
    if (pending.length) return mk("Send initial outreach", "Draft ready — approve it and mark it as sent", "outreach");
    return mk("Prepare initial outreach", "Strategy ready, no outreach yet", "outreach");
  }
  const open = props.find((p) => ["Sent", "Viewed", "Negotiation"].includes(p.status));
  if (open) return mk("Follow up on proposal", "Proposal " + open.status.toLowerCase() + (open.expiry ? " · expires " + open.expiry : ""), "proposal");
  const draftProp = props.find((p) => p.status === "Draft");
  if (draftProp) return mk("Send proposal", "Proposal drafted, not sent", "proposal");
  const mtgs = meetingsOf(db, cid);
  const held = mtgs.filter((m) => m.status === "Held");
  if (held.length && !props.length) return mk("Prepare proposal", "Discovery held, no proposal yet", "proposal");
  const scheduled = mtgs.find((m) => m.status === "Scheduled" && m.date);
  if (scheduled) return scheduled.date <= today ? mk("Record discovery", "Meeting date reached — record what was discussed", "discovery") : mk("Prepare for discovery", "Discovery booked for " + scheduled.date, "discovery");
  const latestReply = outs.filter((o) => REPLY_OUTCOMES.includes(o.outcome)).sort((a, b) => (b.respondedAt || "").localeCompare(a.respondedAt || ""))[0];
  if (latestReply) {
    if (["Positive", "Meeting booked", "Replied"].includes(latestReply.outcome)) return mk("Schedule discovery", latestReply.outcome + " response received", "discovery");
    if (latestReply.outcome === "Wrong person") return mk("Identify correct decision-maker", "Reply says this is the wrong person", "contacts");
    if (["Not interested", "Negative"].includes(latestReply.outcome)) return mk("Record outcome", latestReply.outcome + " — close as lost or set a nurture date", "outcome");
  }
  const due = outs.find((o) => o.followUpDate && o.followUpDate <= today);
  if (due) return mk("Follow up with decision-maker", "Touch " + (due.touch + 1) + " due" + (due.followUpDate! < today ? " (overdue)" : " today"), "followup");
  const next = outs.filter((o) => o.followUpDate).map((o) => o.followUpDate!).sort()[0];
  return mk("Await reply", next ? "Next follow-up due " + next : "No follow-up scheduled — log the next touch", "followup");
}

export function stall(c: Company, today: string) {
  const th = (STALL_THRESHOLDS as Record<string, number>)[c.stage];
  if (!th || c.stage === "Won" || c.stage === "Lost") return null;
  const d = daysBetween(c.stageSince || c.dateDiscovered, today);
  return d > th ? { days: d, threshold: th } : null;
}

export const daysSince = (d: string | null, today: string) => (d ? daysBetween(d, today) : 999);

/** Acquisition score (0–100) with its parts, so it can always be explained. */
export function acq(db: Db, c: Company, today: string) {
  const lead = score(c);
  const bo = bestOpp(db, c.id);
  const opp = bo ? oppScore(bo) : 0;
  const cts = contactsOf(db, c.id), dm = dmOf(db, c.id);
  let access = 0;
  if (dm) {
    access = 6;
    if (dm.influence === "High") access += 2;
    if (/warm|positive|strong|client/i.test(dm.relationship || "")) access += 2;
  } else access = cts.some((x) => x.role === "Gatekeeper" || x.role === "Influencer") ? 3 : cts.length ? 1 : 0;
  if (cts.some((x) => x.role === "Champion")) access += 1;
  access = Math.min(10, access);
  const scans = validScansOf(db, c.id);
  const worst = scans.length ? Math.max(...scans.map((s) => sevRank(s.severity))) : 0;
  const urgency = Math.min(10, Math.round(worst * 1.6 + signalsOf(db, c.id).length * 1.6));
  const fit = bo ? bo.scores.fit * 2 : 0;
  const v = oppValueOf(db, c.id);
  const value = v >= 350000 ? 10 : v >= 250000 ? 8 : v >= 150000 ? 6 : v >= 80000 ? 4 : v > 0 ? 2 : 0;
  const dsl = daysSince(lastTouch(db, c.id), today);
  const recency = dsl <= 3 ? 10 : dsl <= 7 ? 8 : dsl <= 14 ? 6 : dsl <= 30 ? 4 : 2;
  const total = lead + opp + access + urgency + fit + value + recency;
  const band = total >= 80 ? "Priority" : total >= 60 ? "Pursue" : total >= 40 ? "Nurture" : "Low priority";
  const bandColor = total >= 80 ? "#8a3b34" : total >= 60 ? "#a8863d" : total >= 40 ? "#6b6f78" : "#a39d8f";
  const bandBg = total >= 80 ? "#f6e6e4" : total >= 60 ? "#f6f0e0" : total >= 40 ? "#f0ede4" : "#f6f4ef";
  const parts = [
    { label: "Lead quality", val: lead, max: 25 },
    { label: "Opportunity strength", val: opp, max: 25 },
    { label: "Decision-maker access", val: access, max: 10 },
    { label: "Business urgency", val: urgency, max: 10 },
    { label: "Service fit", val: fit, max: 10 },
    { label: "Potential value", val: value, max: 10 },
    { label: "Recency & activity", val: recency, max: 10 },
  ];
  const weakest = parts.slice().sort((a, b) => a.val / a.max - b.val / b.max)[0];
  const strongest = parts.slice().sort((a, b) => b.val / b.max - a.val / a.max)[0];
  const reason =
    "Strongest signal is " + strongest.label.toLowerCase() + " (" + strongest.val + "/" + strongest.max + "); the limiting factor is " +
    weakest.label.toLowerCase() + " (" + weakest.val + "/" + weakest.max + ").";
  return { total, parts, band, bandColor, bandBg, reason, weakest: weakest.label };
}

const DX_MAP: Record<string, string[]> = {
  Website: ["Website"],
  Mobile: ["Mobile experience", "Mobile app"],
  UX: ["Website", "Digital brand / Trust"],
  Conversion: ["Booking / Lead generation", "E-commerce", "Website"],
  "Digital infrastructure": ["Dashboard / Reporting", "Customer portal"],
  "Internal systems": ["Internal systems"],
  "Customer experience": ["Customer portal", "Booking / Lead generation"],
  "AI / automation maturity": ["Automation", "AI opportunities"],
};
const DX_POINTS: Record<string, number> = { Excellent: 100, Good: 80, Average: 55, Weak: 25, Missing: 5 };

/** Digital Experience dimensions. Unassessed dimensions have no value and are left out of the score. */
export function dxDims(db: Db, cid: string) {
  const scans = validScansOf(db, cid);
  return Object.entries(DX_MAP).map(([dim, cats]) => {
    const rel = scans.filter((s) => cats.includes(s.category));
    const assessed = rel.length > 0;
    const val = assessed ? Math.round(rel.reduce((a, s) => a + (DX_POINTS[s.status] ?? 50), 0) / rel.length) : null;
    return { dim, val, assessed };
  });
}
export function dxScore(db: Db, cid: string): number | null {
  const d = dxDims(db, cid).filter((x) => x.assessed);
  return d.length ? Math.round(d.reduce((a, x) => a + (x.val as number), 0) / d.length) : null;
}
export function dxConfidence(db: Db, cid: string) {
  const dims = dxDims(db, cid), n = dims.filter((d) => d.assessed).length, total = dims.length;
  const pct = Math.round((n / total) * 100);
  const label = n === 0 ? "None" : n <= 2 ? "Low" : pct >= 100 ? "High" : pct >= 63 ? "Medium" : "Low";
  return { n, total, pct, label, fg: label === "High" ? "#2e7d5b" : label === "Medium" ? "#a8863d" : "#b0453c" };
}

export function whyConfidence(db: Db, c: Company) {
  const scans = validScansOf(db, c.id), obs = scans.filter((s) => s.confidence === "Observed").length;
  const sigObs = signalsOf(db, c.id).filter((s) => s.confidence === "Observed").length;
  const pts = (obs >= 3 ? 2 : obs >= 1 ? 1 : 0) + (sigObs >= 1 ? 1 : 0) + (oppsOf(db, c.id).some(isValidOpportunity) ? 1 : 0) + (dmOf(db, c.id) ? 1 : 0) + (researchCheck(db, c).ok ? 1 : 0);
  const label = pts >= 5 ? "High" : pts >= 3 ? "Medium" : scans.length === 0 ? "Insufficient" : "Low";
  return { label, fg: label === "High" ? "#2e7d5b" : label === "Medium" ? "#a8863d" : "#b0453c", insufficient: label === "Insufficient" };
}

export function whyNow(db: Db, cid: string) {
  const order: Record<string, number> = { Observed: 0, Indicated: 1, Assumption: 2 };
  const sig = signalsOf(db, cid).slice().sort((a, b) => order[a.confidence] - order[b.confidence]);
  if (sig.length) return { text: sig[0].label, conf: sig[0].confidence };
  const worst = validScansOf(db, cid).slice().sort((a, b) => sevRank(b.severity) - sevRank(a.severity))[0];
  if (worst && sevRank(worst.severity) >= 3) return { text: worst.severity.toLowerCase() + " problem in " + worst.category.toLowerCase(), conf: worst.confidence };
  return { text: "No urgency signal recorded", conf: null };
}

/** Profile completeness: required items for the current stage vs. recommended items. */
export function completeness(db: Db, c: Company) {
  const cid = c.id, scans = scansOf(db, cid);
  const checks = [
    { k: "Research complete", ok: researchCheck(db, c).ok, required: true },
    { k: "Decision-maker identified", ok: !!dmOf(db, cid), required: true },
    { k: "Website assessment", ok: validScansOf(db, cid).some((s) => s.category === "Website"), required: false },
    { k: `Digital scan (${MIN_SCANS}+ evidenced categories)`, ok: validScansOf(db, cid).length >= MIN_SCANS, required: true },
    { k: "Opportunity with evidence", ok: oppsOf(db, cid).some(isValidOpportunity), required: true },
    { k: "Lead score complete", ok: Object.values(c.scores).every((v) => v > 0), required: false },
    { k: "Why-now signal", ok: signalsOf(db, cid).length > 0, required: false },
    { k: "Acquisition strategy", ok: isValidStrategy(db, strategyOf(db, cid)), required: true },
  ];
  void scans;
  const done = checks.filter((x) => x.ok).length;
  return { pct: Math.round((done / checks.length) * 100), missing: checks.filter((x) => !x.ok).map((x) => x.k), checks };
}

export const quadrant = (o: { scores: { impact: number; severity: number }; complexity: string }) => {
  const hi = o.scores.impact + o.scores.severity >= 8;
  const cx = o.complexity === "High";
  return hi ? (cx ? "Strategic" : "Quick Win") : cx ? "Avoid" : "Low Priority";
};

export { isValidScan };
