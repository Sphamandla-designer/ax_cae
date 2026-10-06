// Deterministic workflow self-test. Runs the real action functions against a temporary, isolated
// workspace — it never reads or writes the user's data — and reports PASS/FAIL with a reason.
import { demoDb, emptyDb } from "../data/seed";
import { migrateLegacy } from "../data/migrate";
import type { Db } from "../data/types";
import { parseEnvelope, SCHEMA_VERSION } from "../lib/storage";
import { addDays } from "../lib/dates";
import * as A from "./actions";
import { draftMessage } from "./generate";
import { checkIntegrity } from "./integrity";
import { companyOf, outreachOf } from "./queries";
import { nextBest, readiness, researchCheck, steps13 } from "./workflow";

export interface TestResult {
  name: string;
  ok: boolean;
  note: string;
}

export function runSelfTest(today: string): TestResult[] {
  const results: TestResult[] = [];
  let n = 0;
  const ctx: A.Ctx = { today, now: today + "T09:00:00.000Z", uid: (p) => p + "-qa" + n++, demo: false };
  let db: Db = emptyDb();
  const check = (name: string, ok: boolean, pass: string, failNote: string) => results.push({ name, ok, note: ok ? pass : failNote });
  const apply = (r: A.Result) => {
    if (r.ok) db = r.db;
    return r;
  };
  const expectFail = (name: string, r: A.Result, pass: string) => check(name, !r.ok, pass, "the action was accepted but should have been rejected");
  const expectOk = (name: string, r: A.Result, pass: string) => check(name, r.ok, pass, r.ok ? "" : "rejected: " + r.errors.join(" "));
  let cid = "";
  const step = (key: string) => steps13(db, companyOf(db, cid)!, today).find((s) => s.key === key)!;
  const nba = () => nextBest(db, companyOf(db, cid)!, today).label;

  try {
    // 1. Prospect
    expectFail("Invalid website is rejected", A.addCompany(db, { name: "QA Invalid", website: "not a domain" }, ctx), "“not a domain” was refused with a validation error");
    const created = apply(A.addCompany(db, { name: "QA Grain Co", website: "www.qa-grain.co.za/", location: "Bethal" }, ctx));
    expectOk("Create prospect", created, "prospect created");
    cid = created.ok ? created.id! : "";
    check("Website is normalised", companyOf(db, cid)?.website === "https://qa-grain.co.za", "www.qa-grain.co.za/ → https://qa-grain.co.za", "website was " + companyOf(db, cid)?.website);
    expectFail("Duplicate prospect is rejected", A.addCompany(db, { name: "qa grain co" }, ctx), "a second “QA Grain Co” was refused");
    check("New prospect starts at research", nba() === "Research company", "next best action is Research company", "next best action was " + nba());

    // 2. Research
    apply(A.applyResearchResult(db, cid, { success: false, provider: "QA provider", code: "SITE_UNAVAILABLE", error: "unreachable", retryable: true }, ctx));
    const afterFail = db.research.filter((r) => r.companyId === cid);
    check(
      "Failed research adds no facts",
      afterFail.every((r) => r.facts.every((f) => f.sourceType === "manual")) && !researchCheck(db, companyOf(db, cid)!).ok && afterFail.some((r) => r.lastError?.code === "SITE_UNAVAILABLE"),
      "the failure is recorded, no facts were created and research is still incomplete",
      "failed research changed the research state",
    );
    expectFail(
      "Observed fact without a source is rejected",
      A.saveResearch(db, cid, { facts: [{ field: "description", value: "Grain storage operator with twelve silo sites.", status: "Verified", confidence: "Observed", source: "" }], notes: "" }, ctx),
      "Observed requires a source URL",
    );
    apply(A.saveResearch(db, cid, { facts: [{ field: "website", value: "qa-grain.co.za", status: "Verified", confidence: "Indicated", source: "" }, { field: "description", value: "Grain storage operator with twelve silo sites.", status: "Verified", confidence: "Indicated", source: "" }], notes: "" }, ctx));
    const blocked = A.completeResearch(db, cid, { confirmManual: false }, ctx);
    check("Research completion blocked without evidence", !blocked.ok && blocked.errors.join(" ").includes("verified"), "manual research cannot complete until you confirm you verified it", blocked.ok ? "research completed without evidence" : "wrong reason: " + blocked.errors.join(" "));
    const done = apply(A.completeResearch(db, cid, { confirmManual: true }, ctx));
    expectOk("Research completes with manual verification", done, "complete, recorded as manual research");
    check("Research recorded as manual, not automated", db.research.find((r) => r.companyId === cid && r.status === "complete")?.verification?.type === "manual", "verificationType = manual", "verification type was wrong");
    check("Next action moves to assessment", nba() === "Assess digital experience", "Assess digital experience", "was " + nba());

    // 3. Assessment
    const scan = (category: string, extra: Partial<A.ScanInput> = {}): A.ScanInput => ({ category, status: "Weak", severity: "High", problem: category + " friction on key journey", evidence: "Inspected on a phone: three taps to reach the form", confidence: "Observed", source: "https://qa-grain.co.za", opportunity: "Redesign", impact: "Lost enquiries", ...extra });
    expectFail("Observed assessment without a source is rejected", A.addScan(db, cid, scan("Website", { source: "" }), ctx), "Observed needs the inspected URL");
    expectFail("Assessment without evidence is rejected", A.addScan(db, cid, scan("Website", { evidence: "bad" }), ctx), "“bad” is not evidence");
    ["Website", "Mobile experience", "Customer portal"].forEach((cat) => apply(A.addScan(db, cid, scan(cat), ctx)));
    check("Three evidenced assessments complete the step", step("assessment").done, "3 of 3 evidenced assessments", "assessment step not complete");

    // 4. Opportunity
    const opp: A.OpportunityInput = { problems: "No customer portal", consequence: "Staff field status calls all day", opportunity: "Silo booking portal", type: "Customer portal", estValue: "180000", complexity: "Low", severity: 4, impact: 4, likelihood: 3, fit: 4, evidenceScanIds: [], evidenceNote: "" };
    expectFail("Opportunity without evidence is rejected", A.saveOpportunity(db, cid, opp, ctx), "evidence is required");
    expectFail("Opportunity with a non-numeric value is rejected", A.saveOpportunity(db, cid, { ...opp, estValue: "lots", evidenceScanIds: db.scans.map((s) => s.id) }, ctx), "value must be a whole number");
    apply(A.saveOpportunity(db, cid, { ...opp, evidenceScanIds: db.scans.map((s) => s.id) }, ctx));
    check("Opportunity complete, basis Observed", step("opportunity").done && db.opportunities[0]?.basis === "Observed", "valid opportunity backed by observed assessments", "opportunity step not complete");

    // 5. Decision-maker
    const contact: A.ContactInput = { name: "Thabo QA", title: "Operations Director", department: "", email: "thabo@qa-grain.co.za", phone: "", linkedin: "", role: "Unknown", influence: "High", relationship: "", preferredChannel: "Email", notes: "", source: "", confidence: "Indicated" };
    expectFail("Invalid email is rejected", A.saveContact(db, cid, { ...contact, email: "thabo@" }, ctx), "“thabo@” was refused");
    const added = apply(A.saveContact(db, cid, contact, ctx));
    check("Adding a contact does not make them decision-maker", !step("contacts").done, "decision-maker still not identified", "contact became decision-maker automatically");
    apply(A.markDecisionMaker(db, cid, added.ok ? added.id! : "", ctx));
    check("Explicit decision-maker completes the step", step("contacts").done, "marked explicitly", "decision-maker step not complete");

    // 6. Strategy
    const strat: A.StrategyInput = { problem: "Manual silo bookings", opportunity: "Booking portal", targetContactId: added.ok ? added.id! : "", service: "Customer portal", valueProposition: "", entryOffer: "", angle: "Show the cost of the phone queue", channel: "Email", cta: "a 15-minute call", proof: "", nextStep: "", dealValue: "", difficulty: "Moderate" };
    expectFail("Strategy without a value proposition is rejected", A.saveStrategy(db, cid, strat, ctx), "value proposition required");
    apply(A.saveStrategy(db, cid, { ...strat, valueProposition: "Bookings without phone calls" }, ctx));
    const rd = readiness(db, companyOf(db, cid)!);
    check("Readiness reaches 100%", rd.pct === 100 && rd.ready, "ready for outreach", `readiness ${rd.pct}% — missing ${rd.missing.map((m) => m.k).join(", ")}`);
    check("Generated message uses only recorded facts", !draftMessage(db, cid, "Email").insufficient && draftMessage(db, cid, "Email").text.includes("three taps"), "message cites the recorded evidence", "generator did not use the recorded evidence");

    // 7. Outreach
    const draft = apply(A.saveOutreachDraft(db, cid, { contactId: strat.targetContactId, channel: "Email", message: draftMessage(db, cid, "Email").text }, ctx));
    const oid = draft.ok ? draft.id! : "";
    check("Generating/saving a draft is not sending", !step("outreach").done && db.outreach.find((o) => o.id === oid)?.status === "Draft", "draft saved, outreach step still open", "a draft counted as sent");
    expectFail("Unapproved draft cannot be marked sent", A.markOutreachSent(db, oid, ctx), "approval is required first");
    expectFail("Empty message cannot be saved", A.saveOutreachDraft(db, cid, { contactId: strat.targetContactId, channel: "Email", message: " " }, ctx), "empty message refused");
    apply(A.approveOutreach(db, oid, ctx));
    const sent = apply(A.markOutreachSent(db, oid, ctx));
    expectOk("Approved message marked as sent", sent, "sent with timestamp, channel and touch number");
    const fuTasks = () => db.tasks.filter((t) => t.outreachId === oid && t.type === "Follow-up");
    check("Exactly one follow-up task created", fuTasks().length === 1 && fuTasks()[0].due === addDays(today, 3), "one task due in 3 days", fuTasks().length + " follow-up tasks");
    expectFail("A message cannot be sent twice", A.markOutreachSent(db, oid, ctx), "second send refused");
    check("No duplicate follow-up tasks", fuTasks().length === 1, "still one task", fuTasks().length + " tasks");
    check("Next action waits for the reply", nba() === "Await reply", "Await reply (follow-up not due yet)", "was " + nba());

    // 8. Response
    expectFail("Reply without notes is rejected", A.recordResponse(db, oid, "Positive", "", ctx), "notes required for a reply");
    apply(A.recordResponse(db, oid, "Positive", "Keen to talk next week", ctx));
    check("Positive reply → schedule discovery", nba() === "Schedule discovery" && fuTasks()[0].status === "Done", "follow-up closed, next action Schedule discovery", "was " + nba());
    check("Follow-up and response steps complete", step("followup").done && step("response").done, "reply recorded", "steps not complete");

    // 9. Discovery
    const mtg: A.MeetingInput = { date: addDays(today, -1), time: "10:00", type: "Discovery", attendees: "Thabo QA", decisionMakerAttended: true, notes: "", painPoints: "", requirements: "", budget: "", timeline: "", nextStep: "" };
    expectFail("A meeting cannot be scheduled in the past", A.scheduleMeeting(db, cid, mtg, ctx), "past date refused");
    apply(A.scheduleMeeting(db, cid, { ...mtg, date: addDays(today, 2) }, ctx));
    check("Scheduled meeting does not complete discovery", !step("discovery").done && nba() === "Prepare for discovery", "booked, not complete", "discovery completed by scheduling");
    expectFail("Held meeting without notes is rejected", A.recordMeetingHeld(db, cid, mtg, ctx), "notes, pain points, requirements and next step required");
    expectFail("A future meeting cannot be recorded as held", A.recordMeetingHeld(db, cid, { ...mtg, date: addDays(today, 2), notes: "Discussed the portal scope.", painPoints: "Phone queue", requirements: "Booking flow", nextStep: "Proposal" }, ctx), "future date refused");
    const mid = db.meetings.find((m) => m.companyId === cid)!.id;
    apply(A.recordMeetingHeld(db, cid, { ...mtg, notes: "Discussed the portal scope.", painPoints: "Phone queue", requirements: "Booking flow", nextStep: "Proposal" }, ctx, mid));
    check("Discovery recorded → prepare proposal", step("discovery").done && nba() === "Prepare proposal" && companyOf(db, cid)?.stage === "Discovery", "stage Discovery, next action Prepare proposal", "was " + nba());

    // 10. Proposal
    const prop: A.ProposalInput = { project: "Silo booking portal", opportunityId: db.opportunities[0].id, service: "Customer portal", scope: "Phase 1 booking portal", value: "-5", expiry: "", notes: "" };
    expectFail("Proposal with an invalid value is rejected", A.saveProposal(db, cid, prop, ctx), "negative value refused");
    const pr = apply(A.saveProposal(db, cid, { ...prop, value: "185000" }, ctx));
    const pid = pr.ok ? pr.id! : "";
    check("Draft proposal → send it", step("proposal").done && nba() === "Send proposal", "proposal record exists", "was " + nba());
    expectFail("Draft proposal cannot jump to accepted", A.setProposalStatus(db, pid, "Accepted", ctx), "must be sent first");
    apply(A.setProposalStatus(db, pid, "Sent", ctx));
    apply(A.setProposalStatus(db, pid, "Accepted", ctx));
    check("Accepted proposal → record the win", nba() === "Record won outcome" && companyOf(db, cid)?.stage === "Proposal", "next action Record won outcome", "was " + nba());

    // 11. Outcome
    const oc: A.OutcomeInput = { kind: "Won", value: "", service: "Customer portal", source: "", campaign: "", reason: "Clear ROI", notes: "", competitor: "", reEntryDate: "" };
    expectFail("Won without a value is rejected", A.recordOutcome(db, cid, oc, ctx), "value required");
    expectFail("Pipeline cannot be dragged straight to Won", A.setStage(db, cid, "Won", ctx), "Won needs an outcome record");
    apply(A.recordOutcome(db, cid, { ...oc, value: "185000" }, ctx));
    const histOk = db.research.some((r) => r.companyId === cid) && outreachOf(db, cid).length > 0 && db.proposals.some((p) => p.companyId === cid);
    check("Won creates a client and keeps history", companyOf(db, cid)?.stage === "Won" && db.clients.some((x) => x.companyId === cid) && histOk, "client created; research, outreach and proposals kept", "outcome lost history or no client");
    check("Live records are never demo", [...db.companies, ...db.research, ...db.contacts, ...db.outreach].every((r: any) => r.isDemo === false), "every record isDemo = false", "a live record was flagged demo");

    // 12. Persistence & rehydration
    const env = { schemaVersion: SCHEMA_VERSION, updatedAt: ctx.now, active: "live" as const, workspaces: { live: db, demo: null }, settings: { research: null, firstRunDone: true } };
    const back = parseEnvelope(JSON.stringify(env));
    check("Workspace survives save and reload", JSON.stringify(back.workspaces.live) === JSON.stringify(db), "serialised and re-hydrated identically", "re-hydrated data differs");
    const reNba = nextBest(back.workspaces.live!, back.workspaces.live!.companies.find((c) => c.id === cid)!, today).label;
    check("Derived state is the same after reload", reNba === nba(), "next best action unchanged after reload", "after reload: " + reNba);
    let corruptHandled = false;
    try {
      parseEnvelope('{"schemaVersion":3,"active":"live","workspaces":{"live":{"companies":5}}');
    } catch {
      corruptHandled = true;
    }
    check("Corrupt storage is detected, not loaded", corruptHandled, "unreadable data raises a recoverable error", "corrupt data was accepted");
    const legacy = migrateLegacy({ companies: [{ id: "c9", name: "Old Co", website: "old.co.za", stage: "Qualified", scores: { problem: 1, pay: 1, need: 1, access: 1, growth: 1 } }], scans: [{ id: "s1", companyId: "c9", category: "Website", status: "Weak", problem: "Old site layout", evidence: "Seen on the home page", confidence: "Observed" }], templates: [] }, false, today);
    check("V2.5 data migrates without inventing evidence", legacy.scans[0].confidence === "Indicated" && legacy.research.every((r) => r.status === "draft"), "legacy Observed (no source) became Indicated; legacy research stays a draft", "migration upgraded unverified data");

    // 13. Integrity & deletion
    check("No orphans or duplicate IDs", checkIntegrity(db).ok, "integrity check clean", JSON.stringify(checkIntegrity(db)).slice(0, 200));
    const del = A.deleteCompany(db, cid);
    check("Deleting a prospect removes all its records", del.ok && checkIntegrity(del.db).ok && !del.db.contacts.length && !del.db.outreach.length && !del.db.tasks.length && !del.db.activities.length, "cascade delete left no orphans", "records were left behind");
    const demo = demoDb(today);
    check("Demo data is flagged demo everywhere", [...demo.companies, ...demo.research, ...demo.contacts, ...demo.scans, ...demo.outreach].every((r: any) => r.isDemo === true) && demo.research.every((r) => r.mode === "demo"), "every demo record isDemo = true", "a demo record is not flagged");
    check("Demo data has no integrity problems", checkIntegrity(demo).ok, "demo workspace clean", JSON.stringify(checkIntegrity(demo)).slice(0, 200));
  } catch (e) {
    results.push({ name: "Self-test crashed", ok: false, note: String((e as Error).stack || e).slice(0, 300) });
  }
  return results;
}
