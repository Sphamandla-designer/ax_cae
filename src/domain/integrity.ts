// Relationship and value integrity checks, used by Diagnostics and the self-test.
import { COMPANY_COLLECTIONS, type Db } from "../data/types";

export interface IntegrityReport {
  orphans: { collection: string; id: string; companyId: string }[];
  duplicateIds: { collection: string; id: string }[];
  invalid: { collection: string; id: string; problem: string }[];
  ok: boolean;
}

const ISO = /^\d{4}-\d{2}-\d{2}/;

export function checkIntegrity(db: Db): IntegrityReport {
  const ids = new Set(db.companies.map((c) => c.id));
  const orphans: IntegrityReport["orphans"] = [];
  const duplicateIds: IntegrityReport["duplicateIds"] = [];
  const invalid: IntegrityReport["invalid"] = [];
  const seen = (collection: string, list: { id?: string }[]) => {
    const s = new Set<string>();
    for (const r of list) {
      if (!r.id) continue;
      if (s.has(r.id)) duplicateIds.push({ collection, id: r.id });
      s.add(r.id);
    }
  };
  seen("companies", db.companies);
  for (const k of COMPANY_COLLECTIONS) {
    const list = (db as any)[k] as { id?: string; companyId: string }[];
    seen(k, list);
    for (const r of list) if (!ids.has(r.companyId)) orphans.push({ collection: k, id: r.id || "(no id)", companyId: r.companyId });
  }
  for (const c of db.companies) {
    if (!c.name || !c.name.trim()) invalid.push({ collection: "companies", id: c.id, problem: "empty name" });
    if (!ISO.test(c.dateDiscovered || "")) invalid.push({ collection: "companies", id: c.id, problem: "invalid discovery date" });
  }
  for (const o of db.opportunities) if (!Number.isFinite(o.estValue) || o.estValue < 0) invalid.push({ collection: "opportunities", id: o.id, problem: "invalid value" });
  for (const p of db.proposals) {
    if (!Number.isFinite(p.value) || p.value <= 0) invalid.push({ collection: "proposals", id: p.id, problem: "invalid value" });
    if (p.opportunityId && !db.opportunities.some((o) => o.id === p.opportunityId)) invalid.push({ collection: "proposals", id: p.id, problem: "linked opportunity missing" });
  }
  for (const o of db.outreach) {
    if (o.dateSent && !ISO.test(o.dateSent)) invalid.push({ collection: "outreach", id: o.id, problem: "invalid sent date" });
    if ((o.status === "Sent" || o.status === "Replied") && !o.dateSent) invalid.push({ collection: "outreach", id: o.id, problem: "marked sent without a sent date" });
  }
  for (const t of db.tasks) if (!ISO.test(t.due || "")) invalid.push({ collection: "tasks", id: t.id, problem: "invalid due date" });
  return { orphans, duplicateIds, invalid, ok: !orphans.length && !duplicateIds.length && !invalid.length };
}

/** Remove records that point at companies that no longer exist. */
export function removeOrphans(db: Db): Db {
  const ids = new Set(db.companies.map((c) => c.id));
  const next = { ...db } as any;
  for (const k of COMPANY_COLLECTIONS) next[k] = (db as any)[k].filter((r: { companyId: string }) => ids.has(r.companyId));
  return next as Db;
}
