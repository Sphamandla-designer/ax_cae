// Deterministic workflow self-test. Runs the real action functions against a temporary, isolated
// workspace — it never reads or writes the user's data — and reports PASS/FAIL with a reason.
import { demoDb, emptyDb, LOST_REASONS } from "../data/seed";
import { migrateLegacy } from "../data/migrate";
import type { Db } from "../data/types";
import { parseEnvelope, SCHEMA_VERSION } from "../lib/storage";
import { addDays } from "../lib/dates";
import * as A from "./actions";
import { draftMessage } from "./generate";
import { checkIntegrity } from "./integrity";
import { companyOf, outcomeOf, outreachOf, parseRand } from "./queries";
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

    // 13b. Tracking rules found in the production audit
    const prep = (name: string, site: string) => {
      const r = apply(A.addCompany(db, { name, website: site }, ctx));
      const id = r.ok ? r.id! : "";
      apply(A.saveResearch(db, id, { facts: [{ field: "website", value: site, status: "Verified", confidence: "Indicated", source: "" }, { field: "description", value: "Regional logistics operator with three depots.", status: "Verified", confidence: "Indicated", source: "" }], notes: "" }, ctx));
      apply(A.completeResearch(db, id, { confirmManual: true }, ctx));
      ["Website", "Mobile experience", "Customer portal"].forEach((cat) => apply(A.addScan(db, id, scan(cat, { source: "https://" + site }), ctx)));
      apply(A.saveOpportunity(db, id, { ...opp, evidenceScanIds: db.scans.filter((x) => x.companyId === id).map((x) => x.id) }, ctx));
      const ct = apply(A.saveContact(db, id, { ...contact, email: "ops@" + site }, ctx));
      apply(A.markDecisionMaker(db, id, ct.ok ? ct.id! : "", ctx));
      apply(A.saveStrategy(db, id, { ...strat, targetContactId: ct.ok ? ct.id! : "", valueProposition: "Fewer phone calls" }, ctx));
      return { id, contactId: ct.ok ? ct.id! : "" };
    };
    const q = prep("QA Tracking Co", "qa-tracking.co.za");
    check("Outreach-ready prospect moves to Qualified", companyOf(db, q.id)?.stage === "Qualified", "stage Qualified once the readiness checklist is complete", "stage was " + companyOf(db, q.id)?.stage);
    const c2 = apply(A.saveContact(db, q.id, { ...contact, name: "Second QA", email: "second@qa-tracking.co.za" }, ctx));
    apply(A.markDecisionMaker(db, q.id, c2.ok ? c2.id! : "", ctx));
    check("Only one decision-maker at a time", db.contacts.filter((x) => x.companyId === q.id && x.decisionMaker).length === 1 && db.contacts.find((x) => x.id === (c2.ok ? c2.id : ""))?.decisionMaker === true, "the new decision-maker replaces the old one", "several contacts marked decision-maker");
    apply(A.markDecisionMaker(db, q.id, q.contactId, ctx));
    const oq = db.opportunities.find((o) => o.companyId === q.id)!;
    apply(A.saveOpportunity(db, q.id, { ...opp, budget: 5, evidenceScanIds: oq.evidenceScanIds }, ctx, oq.id));
    apply(A.saveOpportunity(db, q.id, { ...opp, evidenceScanIds: oq.evidenceScanIds }, ctx, oq.id));
    check("Editing an opportunity keeps its budget score", db.opportunities.find((o) => o.id === oq.id)?.scores.budget === 5, "budget 5 kept on edit", "budget became " + db.opportunities.find((o) => o.id === oq.id)?.scores.budget);
    const msg = "Hello — a short note about the booking flow we looked at on your site.";
    const d1 = apply(A.saveOutreachDraft(db, q.id, { contactId: q.contactId, channel: "Email", message: msg }, ctx));
    const d2 = apply(A.saveOutreachDraft(db, q.id, { contactId: q.contactId, channel: "Email", message: msg + " (second)" }, ctx));
    const [o1, o2] = [d1.ok ? d1.id! : "", d2.ok ? d2.id! : ""];
    [o1, o2].forEach((id) => { apply(A.approveOutreach(db, id, ctx)); apply(A.markOutreachSent(db, id, ctx)); });
    const touchOf = (id: string) => db.outreach.find((o) => o.id === id)?.touch;
    check("Drafts prepared ahead get their touch number when sent", touchOf(o1) === 1 && touchOf(o2) === 2, "touch 1 then touch 2", `touches ${touchOf(o1)}, ${touchOf(o2)}`);
    const fu2 = db.tasks.find((t) => t.outreachId === o2 && t.status !== "Done")!;
    expectFail("Ticking a follow-up task is refused (send or skip the touch instead)", A.toggleTask(db, fu2.id, ctx), "the task stays open until the touch is sent or skipped");
    apply(A.rescheduleTask(db, fu2.id, 3, ctx));
    const o2r = db.outreach.find((o) => o.id === o2)!;
    check("Rescheduling a follow-up task moves the follow-up too", o2r.followUpDate === db.tasks.find((t) => t.id === fu2.id)!.due, "task and outreach share the new date", `task ${db.tasks.find((t) => t.id === fu2.id)!.due} vs outreach ${o2r.followUpDate}`);
    apply(A.recordResponse(db, o1, "Positive", "Replied to the first email", ctx));
    check("A reply on an earlier touch clears every pending follow-up", !db.outreach.some((o) => o.companyId === q.id && o.followUpDate) && !db.tasks.some((t) => t.companyId === q.id && t.type === "Follow-up" && !t.outreachId!.endsWith(":response") && t.status !== "Done"), "no follow-up due after the reply", "a follow-up was still due");
    const respTask = () => db.tasks.find((t) => t.outreachId === o1 + ":response")!;
    const d3 = apply(A.saveOutreachDraft(db, q.id, { contactId: q.contactId, channel: "Email", message: msg + " (reply)" }, ctx));
    apply(A.approveOutreach(db, d3.ok ? d3.id! : "", ctx));
    apply(A.markOutreachSent(db, d3.ok ? d3.id! : "", ctx));
    check("Sending a message does not close the reply task", respTask().status === "Open", "“Schedule discovery” stays open", "the reply task was closed by sending");
    apply(A.recordResponse(db, o1, "Not interested", "Changed their mind", ctx));
    check("Changing the reply updates its task", respTask().type === "Nurture" && db.tasks.filter((t) => t.outreachId === o1 + ":response").length === 1, "one task, now a nurture task", "task was " + respTask().type + " / count " + db.tasks.filter((t) => t.outreachId === o1 + ":response").length);
    apply(A.recordResponse(db, o1, "Positive", "Back on — wants a call", ctx));
    apply(A.scheduleMeeting(db, q.id, { ...mtg, date: addDays(today, 2) }, ctx));
    const mt = db.tasks.find((t) => t.companyId === q.id && t.meetingId && t.status !== "Done");
    check("Scheduling a meeting creates its task", !!mt && mt.due === addDays(today, 2), "meeting task due on the meeting date", "no meeting task");
    expectFail("A meeting task cannot be ticked done", A.toggleTask(db, mt!.id, ctx), "it completes when the meeting is recorded");
    check("Booking the meeting closes the “Schedule discovery” task", respTask().status === "Done", "reply task done", "reply task still open");
    const mid2 = db.meetings.find((m) => m.companyId === q.id)!.id;
    apply(A.recordMeetingHeld(db, q.id, { ...mtg, notes: "Walked through bookings.", painPoints: "Phone queue", requirements: "Portal", nextStep: "Proposal" }, ctx, mid2));
    check("Recording the meeting closes its task", db.tasks.find((t) => t.id === mt!.id)?.status === "Done", "meeting task done", "meeting task still open");
    const pr2 = apply(A.saveProposal(db, q.id, { ...prop, value: "120 000", opportunityId: db.opportunities.find((o) => o.companyId === q.id)!.id }, ctx));
    apply(A.setProposalStatus(db, pr2.ok ? pr2.id! : "", "Sent", ctx));
    apply(A.setProposalStatus(db, pr2.ok ? pr2.id! : "", "Rejected", ctx));
    check("Rejected proposal → revise or close (not “Schedule discovery”)", nextBest(db, companyOf(db, q.id)!, today).label === "Revise proposal or record outcome", "Revise proposal or record outcome", "was " + nextBest(db, companyOf(db, q.id)!, today).label);
    const pr3 = apply(A.saveProposal(db, q.id, { ...prop, value: "90000", opportunityId: db.opportunities.find((o) => o.companyId === q.id)!.id }, ctx));
    apply(A.setProposalStatus(db, pr3.ok ? pr3.id! : "", "Sent", ctx));
    apply(A.recordOutcome(db, q.id, { ...oc, kind: "Lost", reason: (LOST_REASONS as string[])[0], value: "", reEntryDate: addDays(today, 30) }, ctx));
    check("Closing as Lost closes its open proposal", db.proposals.find((p) => p.id === (pr3.ok ? pr3.id : ""))?.status === "Rejected", "open proposal marked rejected", "proposal still " + db.proposals.find((p) => p.id === (pr3.ok ? pr3.id : ""))?.status);
    expectOk("A Lost prospect can be reopened", apply(A.reopenCompany(db, q.id, ctx)), "back in the pipeline");
    check("Reopening keeps the Lost outcome as history", !outcomeOf(db, q.id) && db.outcomes.some((o) => o.companyId === q.id && o.supersededAt) && companyOf(db, q.id)?.stage === "Proposal", "stage Proposal (from records), old outcome superseded", "stage " + companyOf(db, q.id)?.stage);
    check("Rand amounts parse as typed", parseRand("180.000") === 180000 && parseRand("R180 000") === 180000 && parseRand("180,000") === 180000 && Number.isNaN(parseRand("")), "180.000 / R180 000 / 180,000 → 180000", "parsed " + parseRand("180.000"));
    apply(A.applyResearchResult(db, q.id, { success: false, provider: "QA", code: "TIMEOUT", error: "timed out", retryable: true }, ctx));
    check("A failed research refresh does not undo completed research", researchCheck(db, companyOf(db, q.id)!).ok, "research still complete", "research fell back to incomplete");
    const r2 = apply(A.addCompany(db, { name: "QA Stage Co", website: "qa-stage.co.za" }, ctx));
    expectFail("Moving forward without the stage's record is refused", A.setStage(db, r2.ok ? r2.id! : "", "Proposal", ctx), "Proposal needs a sent proposal");
    const liveLegacy = migrateLegacy({ companies: [{ id: "c8", name: "Old Meeting Co", stage: "Discovery" }], meetings: [{ id: "m8", companyId: "c8", status: "Scheduled", date: addDays(today, -5), time: "09:00", type: "Discovery" }], templates: [] }, false, today);
    check("Old scheduled meetings are not imported as held", liveLegacy.meetings[0].status === "Scheduled", "stays Scheduled until you record it", "imported as " + liveLegacy.meetings[0].status);

    // 13. Integrity & deletion
    check("No orphans or duplicate IDs", checkIntegrity(db).ok, "integrity check clean", JSON.stringify(checkIntegrity(db)).slice(0, 200));
    const del = A.deleteCompany(db, cid);
    check("Deleting a prospect removes all its records", del.ok && checkIntegrity(del.db).ok && ["contacts", "outreach", "tasks", "activities", "research", "scans"].every((k) => !(del.db as any)[k].some((r: { companyId: string }) => r.companyId === cid)), "cascade delete left no orphans", "records were left behind");
    const demo = demoDb(today);
    check("Demo data is flagged demo everywhere", [...demo.companies, ...demo.research, ...demo.contacts, ...demo.scans, ...demo.outreach].every((r: any) => r.isDemo === true) && demo.research.every((r) => r.mode === "demo"), "every demo record isDemo = true", "a demo record is not flagged");
    check("Demo data has no integrity problems", checkIntegrity(demo).ok, "demo workspace clean", JSON.stringify(checkIntegrity(demo)).slice(0, 200));
  } catch (e) {
    results.push({ name: "Self-test crashed", ok: false, note: String((e as Error).stack || e).slice(0, 300) });
  }
  return results;
}
