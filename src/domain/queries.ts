// Read-only lookups over a workspace. Pure functions: (db, …) → value.
import type { Company, Contact, Db, Opportunity, Research, Scan, Strategy } from "../data/types";

export const companyOf = (db: Db, cid: string) => db.companies.find((c) => c.id === cid) || null;
export const contactsOf = (db: Db, cid: string) => db.contacts.filter((p) => p.companyId === cid);
/** The explicitly marked decision-maker (never inferred from title or order). */
export const dmOf = (db: Db, cid: string): Contact | null => contactsOf(db, cid).find((p) => p.decisionMaker) || null;
export const scansOf = (db: Db, cid: string) => db.scans.filter((s) => s.companyId === cid);
export const signalsOf = (db: Db, cid: string) => db.signals.filter((s) => s.companyId === cid);
export const oppsOf = (db: Db, cid: string) => db.opportunities.filter((o) => o.companyId === cid);
export const strategyOf = (db: Db, cid: string): Strategy | null => db.strategies.find((s) => s.companyId === cid) || null;
export const whyOf = (db: Db, cid: string) => db.whys.find((w) => w.companyId === cid) || null;
export const outreachOf = (db: Db, cid: string) => db.outreach.filter((o) => o.companyId === cid);
export const meetingsOf = (db: Db, cid: string) => db.meetings.filter((m) => m.companyId === cid);
export const proposalsOf = (db: Db, cid: string) => db.proposals.filter((p) => p.companyId === cid);
export const outcomeOf = (db: Db, cid: string) => db.outcomes.find((o) => o.companyId === cid) || null;
export const clientOf = (db: Db, cid: string) => db.clients.find((c) => c.companyId === cid) || null;

/** Every research version for a company, newest first. */
export const researchHistory = (db: Db, cid: string): Research[] =>
  db.research.filter((r) => r.companyId === cid).sort((a, b) => b.version - a.version);
export const currentResearch = (db: Db, cid: string): Research | null => researchHistory(db, cid)[0] || null;
export const factOf = (r: Research | null, field: string) => (r ? r.facts.find((f) => f.field === field) || null : null);

export const score = (c: Company) => c.scores.problem + c.scores.pay + c.scores.need + c.scores.access + c.scores.growth;
export const grade = (n: number) => (n >= 20 ? "A" : n >= 15 ? "B" : n >= 10 ? "C" : "—");
export const oppScore = (o: Opportunity) =>
  o.scores.severity + o.scores.impact + o.scores.fit + o.scores.budget + o.scores.likelihood;
export const sevRank = (s: string) => ({ Critical: 4, High: 3, Medium: 2, Low: 1 })[s] || 0;

export const bestOpp = (db: Db, cid: string): Opportunity | null =>
  oppsOf(db, cid)
    .slice()
    .sort((a, b) => oppScore(b) - oppScore(a) || b.estValue - a.estValue)[0] || null;
export const oppValueOf = (db: Db, cid: string) => {
  const os = oppsOf(db, cid);
  return os.length ? Math.max(...os.map((o) => o.estValue || 0)) : 0;
};

/** Scans that meet the evidence rule: problem, concrete evidence, and a source when marked Observed. */
export const isValidScan = (s: Scan) =>
  s.problem.trim().length >= 5 &&
  s.evidence.trim().length >= 10 &&
  (s.confidence !== "Observed" || !!s.source || s.sourceType === "demo");
export const validScansOf = (db: Db, cid: string) => scansOf(db, cid).filter(isValidScan);

export const isValidOpportunity = (o: Opportunity) =>
  o.problems.length > 0 &&
  !!o.opportunity.trim() &&
  !!(o.type || o.service) &&
  o.estValue > 0 &&
  (o.evidenceScanIds.length > 0 || o.evidenceNote.trim().length > 0);

export const isValidStrategy = (db: Db, s: Strategy | null) =>
  !!s &&
  !!s.problem.trim() &&
  (!!(s.targetContactId && db.contacts.some((p) => p.id === s.targetContactId)) || !!s.target.trim()) &&
  !!s.valueProposition.trim() &&
  !!s.angle.trim() &&
  !!s.channel.trim();

export const lastTouch = (db: Db, cid: string): string | null => {
  const ds = [
    ...db.activities.filter((a) => a.companyId === cid).map((a) => a.ts.slice(0, 10)),
    ...db.outreach.filter((o) => o.companyId === cid && o.dateSent).map((o) => o.dateSent as string),
  ];
  return ds.sort().pop() || null;
};
