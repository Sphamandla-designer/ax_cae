// Converts V2.5-shaped data (the bundled demo dataset, or a workspace saved by CAE V2.5.1) into the
// V3 model. Nothing is upgraded to "verified": legacy free-text research becomes a draft that the user
// must verify, and demo content is labelled demo everywhere.
import { normalizeWebsite } from "../lib/url";
import type {
  Company,
  Contact,
  Db,
  Fact,
  Meeting,
  Opportunity,
  Outreach,
  OutreachStatus,
  Proposal,
  Research,
  Scan,
  Strategy,
} from "./types";

type Legacy = Record<string, any>;

const dash = (v: unknown) => (typeof v === "string" && v.trim() && v.trim() !== "—" ? v.trim() : "");
const sevRank = (s: string) => ({ Critical: 4, High: 3, Medium: 2, Low: 1 })[s] || 0;

// Value propositions for the demo strategies (demo content, authored with the dataset).
const DEMO_VALUE_PROPS: Record<string, string> = {
  st1: "Replace paper permits and Excel handovers with one system that makes every shift auditable.",
  st2: "Give clients self-service load visibility and take the status calls off the ops team.",
  st3: "A merchant dashboard and design system that cut churn and scale with the Series B roadmap.",
  st4: "Digital weighbridge capture that recovers the margin lost to load disputes.",
  st5: "Launch-ready product UX: onboarding and empty states that get trial users to value.",
};

function outreachStatus(legacy: string): { status: OutreachStatus; outcome: string } {
  switch (legacy) {
    case "Draft":
      return { status: "Draft", outcome: "" };
    case "Scheduled":
      return { status: "Scheduled", outcome: "" };
    case "Replied":
    case "Positive":
    case "Negative":
    case "Neutral":
    case "Not interested":
    case "Wrong person":
    case "Meeting booked":
      return { status: "Replied", outcome: legacy };
    case "No response":
    case "Viewed":
      return { status: "Sent", outcome: legacy };
    default:
      return { status: "Sent", outcome: "Sent" };
  }
}

export function migrateLegacy(src: Legacy, isDemo: boolean, today: string): Db {
  const L = JSON.parse(JSON.stringify(src)) as Legacy;
  const arr = (k: string) => (Array.isArray(L[k]) ? L[k] : []);
  const ts = (d: string | null | undefined) => (d ? String(d).slice(0, 10) + "T09:00:00.000Z" : new Date().toISOString());

  const companies: Company[] = arr("companies").map((c: Legacy) => {
    const site = dash(c.website) ? normalizeWebsite(c.website) : null;
    return {
      id: c.id,
      isDemo,
      name: String(c.name || "").trim(),
      website: site && site.ok ? site.url : "",
      industry: dash(c.industry),
      subIndustry: dash(c.subIndustry),
      location: dash(c.location),
      size: dash(c.size),
      linkedin: dash(c.linkedin),
      description: dash(c.description) || dash(c.research?.summary),
      leadSource: dash(c.leadSource),
      dateDiscovered: c.dateDiscovered || today,
      owner: dash(c.owner),
      campaign: dash(c.campaign),
      stage: c.stage || "New",
      stageSince: c.stageSince || c.dateDiscovered || today,
      priority: c.priority || "Medium",
      scores: c.scores || { problem: 0, pay: 0, need: 0, access: 0, growth: 0 },
      nextAction: c.nextAction || { label: "Research company", due: today },
      notReadyReason: c.notReadyReason ?? null,
      overrideNotReady: !!c.overrideNotReady,
      createdAt: ts(c.dateDiscovered),
      updatedAt: ts(c.stageSince || c.dateDiscovered),
    };
  });

  // Research: demo companies get a clearly labelled demo record; legacy live research becomes an
  // unverified draft (it never had sources or verification).
  const research: Research[] = [];
  for (const c of arr("companies")) {
    const co = companies.find((x) => x.id === c.id)!;
    const at = ts(c.dateDiscovered);
    const fact = (field: string, value: string): Fact => ({
      field,
      value,
      status: value ? "Unverified" : "Unknown",
      confidence: "Assumption",
      source: "",
      sourceType: isDemo ? "demo" : "manual",
      retrievedAt: isDemo ? at : "",
      evidence: isDemo ? "Demo dataset — fictional company" : "Entered in CAE V2.5 (not verified)",
    });
    if (isDemo) {
      const facts = [
        fact("name", co.name),
        fact("website", co.website),
        fact("industry", co.industry),
        fact("subIndustry", co.subIndustry),
        fact("location", co.location),
        fact("size", co.size),
        fact("description", co.description),
      ].filter((f) => f.value);
      research.push({
        id: "rs-" + c.id,
        companyId: c.id,
        isDemo: true,
        version: 1,
        mode: "demo",
        provider: "Demo dataset",
        status: co.description && co.website ? "complete" : "draft",
        createdAt: at,
        updatedAt: at,
        retrievedAt: "",
        facts,
        sources: [],
        lastError: null,
        verification: co.description && co.website ? { type: "demo", confirmedAt: at } : null,
        completedAt: co.description && co.website ? at : "",
        notes: "",
      });
    } else if (c.research || co.description) {
      research.push({
        id: "rs-" + c.id,
        companyId: c.id,
        isDemo: false,
        version: 1,
        mode: "manual",
        provider: "Manual",
        status: "draft",
        createdAt: at,
        updatedAt: at,
        retrievedAt: "",
        facts: [fact("name", co.name), fact("website", co.website), fact("description", dash(c.research?.summary) || co.description)].filter(
          (f) => f.value,
        ),
        sources: [],
        lastError: null,
        verification: null,
        completedAt: "",
        notes: dash(c.research?.findings),
      });
    }
  }

  const contacts: Contact[] = arr("contacts").map((p: Legacy) => {
    const dm = !!p.decisionMaker || p.role === "Decision Maker";
    return {
      id: p.id,
      companyId: p.companyId,
      isDemo,
      name: dash(p.name),
      title: dash(p.title),
      department: dash(p.department),
      email: dash(p.email),
      phone: dash(p.phone),
      linkedin: dash(p.linkedin),
      decisionMaker: dm,
      role: dm ? "Decision Maker" : p.role || "Unknown",
      influence: p.influence || "Medium",
      relationship: dash(p.relationship),
      lastContacted: p.lastContacted || null,
      preferredChannel: dash(p.preferredChannel),
      notes: p.notes || "",
      source: isDemo ? "Demo dataset" : "",
      confidence: isDemo ? "Indicated" : "Assumption",
    };
  });

  const scans: Scan[] = arr("scans").map((s: Legacy) => ({
    id: s.id,
    companyId: s.companyId,
    isDemo,
    category: s.category,
    status: s.status,
    severity: s.severity || "Medium",
    problem: dash(s.problem),
    evidence: dash(s.evidence) === "Not recorded" ? "" : dash(s.evidence),
    opportunity: dash(s.opportunity),
    impact: dash(s.impact),
    // Legacy Observed scans had no source: only demo data may keep the label (it is labelled demo).
    confidence: isDemo ? s.confidence || "Assumption" : s.confidence === "Observed" ? "Indicated" : s.confidence || "Assumption",
    source: "",
    sourceType: isDemo ? "demo" : "manual",
    assessedAt: ts(companies.find((c) => c.id === s.companyId)?.dateDiscovered),
  }));

  const opportunities: Opportunity[] = arr("opportunities").map((o: Legacy) => {
    const own = scans.filter((s) => s.companyId === o.companyId);
    const linked = own.filter((s) => sevRank(s.severity) >= 3);
    const ev = (linked.length ? linked : own).map((s) => s.id);
    const evScans = scans.filter((s) => ev.includes(s.id));
    return {
      id: o.id,
      companyId: o.companyId,
      isDemo,
      problems: Array.isArray(o.problems) ? o.problems : [],
      consequence: dash(o.consequence) || dash(evScans.find((s) => s.impact)?.impact),
      opportunity: dash(o.opportunity),
      service: dash(o.service),
      type: dash(o.type) || dash(o.service),
      group: dash(o.group) || "Other",
      valueBand: o.valueBand || "Low",
      estValue: Number(o.estValue) || 0,
      complexity: o.complexity || "Low",
      scores: o.scores || { severity: 3, impact: 3, fit: 3, budget: 3, likelihood: 3 },
      evidenceScanIds: ev,
      evidenceNote: ev.length ? "" : isDemo ? "Demo dataset — discovery notes" : "",
      basis: evScans.some((s) => s.confidence === "Observed") ? "Observed" : evScans.length ? "Indicated" : "Assumption",
    };
  });

  const dmOf = (cid: string) => contacts.find((p) => p.companyId === cid && p.decisionMaker) || null;
  const strategies: Strategy[] = arr("strategies").map((s: Legacy) => {
    const dm = dmOf(s.companyId);
    return {
      id: s.id,
      companyId: s.companyId,
      isDemo,
      problem: dash(s.problem),
      opportunity: dash(s.opportunity),
      targetContactId: dm ? dm.id : "",
      target: dash(s.target),
      service: dash(s.service),
      valueProposition: dash(s.valueProposition) || (isDemo ? DEMO_VALUE_PROPS[s.id] || "" : ""),
      entryOffer: dash(s.entryOffer),
      angle: dash(s.angle),
      channel: dash(s.channel) || (dm && dm.preferredChannel) || "",
      cta: dash(s.cta) || dash(s.nextStep),
      proof: dash(s.proof),
      nextStep: dash(s.nextStep),
      dealValue: dash(s.dealValue),
      difficulty: s.difficulty || "Moderate",
      updatedAt: ts(today),
    };
  });

  const outreach: Outreach[] = arr("outreach").map((o: Legacy) => {
    const legacy = o.outcome && o.outcome !== o.status ? o.outcome : o.status;
    const { status, outcome } = outreachStatus(legacy);
    const dm = dmOf(o.companyId) || contacts.find((p) => p.companyId === o.companyId) || null;
    const sent = status === "Sent" || status === "Replied" ? o.dateSent || null : null;
    return {
      id: o.id,
      companyId: o.companyId,
      isDemo,
      contactId: dm ? dm.id : "",
      channel: o.channel || "Email",
      touch: Number(o.touch) || 1,
      purpose: o.purpose || "Initial observation",
      message: dash(o.message),
      status,
      createdAt: ts(o.dateSent || o.dateScheduled || today),
      approvedAt: sent || status === "Scheduled" ? ts(o.dateSent || o.dateScheduled) : null,
      dateScheduled: o.dateScheduled || null,
      dateSent: sent,
      outcome,
      responseNotes: o.responseNotes || o.response || "",
      response: o.response || "",
      respondedAt: status === "Replied" ? ts(o.dateSent) : null,
      followUpDate: o.followUpDate || null,
      followUpSkipped: false,
    };
  });

  const meetings: Meeting[] = arr("meetings").map((m: Legacy) => ({
    id: m.id,
    companyId: m.companyId,
    isDemo,
    // Only the demo story treats past meetings as held; real ones stay Scheduled until you record them.
    status: m.status === "Held" || (isDemo && m.date && m.date < today) ? "Held" : m.status === "Cancelled" ? "Cancelled" : "Scheduled",
    date: m.date || "",
    time: m.time || "",
    type: m.type || "Discovery",
    attendees: m.attendees || "",
    decisionMakerAttended: !!m.decisionMakerAttended,
    notes: dash(m.notes),
    painPoints: m.painPoints || "",
    requirements: m.requirements || "",
    budget: m.budget || "",
    timeline: m.timeline || "",
    nextStep: m.nextStep || "",
    heldAt: m.status === "Held" || (isDemo && m.date && m.date < today) ? ts(m.date) : null,
  }));

  const proposals: Proposal[] = arr("proposals").map((q: Legacy) => {
    const best = opportunities
      .filter((o) => o.companyId === q.companyId)
      .sort((a, b) => b.estValue - a.estValue)[0];
    return {
      id: q.id,
      companyId: q.companyId,
      isDemo,
      opportunityId: q.opportunityId || (best ? best.id : ""),
      project: dash(q.project),
      service: dash(q.service),
      scope: q.scope || "",
      value: Number(q.value) || 0,
      status: q.status || "Draft",
      date: q.date || today,
      sentDate: q.sentDate ?? (q.status && q.status !== "Draft" ? q.date : null),
      expiry: dash(q.expiry),
      probability: Number(q.probability) || 0.4,
      notes: q.notes || "",
      decidedAt: q.status === "Accepted" || q.status === "Rejected" ? ts(q.date) : null,
    };
  });

  const tag = <T extends object>(xs: T[]) => xs.map((x) => ({ ...x, isDemo }));
  // Follow-up rules: a replied message has nothing due; only each prospect's latest sent touch carries a
  // follow-up date; every follow-up that is due has exactly one linked task (an existing matching task is reused).
  const REPLIES = ["Replied", "Positive", "Neutral", "Negative", "Wrong person", "Not interested", "Meeting booked"];
  const latestSent = new Map<string, Outreach>();
  outreach.filter((o) => o.dateSent).forEach((o) => {
    const cur = latestSent.get(o.companyId);
    if (!cur || o.touch > cur.touch) latestSent.set(o.companyId, o);
  });
  const repliedCos = new Set(outreach.filter((o) => REPLIES.includes(o.outcome)).map((o) => o.companyId));
  outreach.forEach((o) => {
    if (o.followUpDate && (REPLIES.includes(o.outcome) || repliedCos.has(o.companyId) || latestSent.get(o.companyId) !== o)) o.followUpDate = null;
  });
  const legacyTasks: Db["tasks"] = arr("tasks").map((t: Legacy) => ({ ...t, isDemo, outreachId: t.outreachId ?? null, meetingId: null, completedAt: null, notes: t.notes || "" }) as Db["tasks"][number]);
  const fuTasks: Db["tasks"] = [];
  outreach.filter((o) => o.followUpDate).forEach((o) => {
    const match = legacyTasks.find((t) => t.companyId === o.companyId && t.status !== "Done" && !t.outreachId && (t.type === "Follow-up" || t.type === "Outreach") && /touch|follow/i.test(t.title));
    if (match) Object.assign(match, { type: "Follow-up", outreachId: o.id, due: o.followUpDate });
    else {
      const co = companies.find((c) => c.id === o.companyId);
      fuTasks.push({ id: "t-fu-" + o.id, companyId: o.companyId, isDemo, title: `Follow up ${co ? co.name : "prospect"} — touch ${o.touch + 1}`, type: "Follow-up", priority: "High", due: o.followUpDate!, status: "Open", notes: "", outreachId: o.id, meetingId: null, completedAt: null });
    }
  });

  return {
    companies,
    research,
    contacts,
    opportunities,
    outreach,
    tasks: [
      ...legacyTasks,
      ...fuTasks,
      // Every scheduled meeting gets its task, as new meetings do.
      ...meetings
        .filter((m) => m.status === "Scheduled" && /^\d{4}-\d{2}-\d{2}$/.test(m.date))
        .map((m) => {
          const co = companies.find((c) => c.id === m.companyId);
          return { id: "t-" + m.id, companyId: m.companyId, isDemo, title: `${m.type} with ${co ? co.name : "prospect"} — ${m.date} ${m.time}`.trim(), type: "Meeting", priority: "High", due: m.date, status: "Open", notes: "", outreachId: null, meetingId: m.id, completedAt: null } as Db["tasks"][number];
        }),
    ],
    meetings,
    proposals,
    clients: tag(arr("clients")),
    activities: tag(arr("activities")),
    templates: arr("templates"),
    scans,
    signals: arr("signals").map((s: Legacy) => ({
      ...s,
      isDemo,
      confidence: s.confidence || "Assumption",
      source: s.source || "",
      recordedAt: s.recordedAt || ts(today),
    }) as Db["signals"][number]),
    strategies,
    whys: tag(arr("whys")),
    // A live workspace only keeps campaigns its own prospects use (V2.5.1 carried the demo campaigns over).
    campaigns: tag(arr("campaigns").filter((cam: Legacy) => isDemo || companies.some((c) => c.campaign === cam.name))),
    outcomes: arr("outcomes").map((o: Legacy) => ({
      ...o,
      isDemo,
      recordedAt: o.recordedAt || ts(today),
      reason: o.reason || (o.result === "Won" ? "Accepted" : "Other"),
      notes: o.notes || "",
      competitor: o.competitor || (o.reason === "Chose competitor" ? "Not recorded" : ""),
      reEntryDate: o.reEntryDate || null,
    }) as Db["outcomes"][number]),
    targets: L.targets || { newProspects: 5, qualified: 3, outreach: 5, followUps: 3, meetings: 1, proposals: 1 },
    notes: L.notes || {},
  };
}
