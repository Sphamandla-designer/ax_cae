// CAE controller. Owns the workspace envelope and UI state; every data change goes through run(),
// which applies a validated domain action, persists (debounced) and re-renders all derived views.
import { Component } from "react";
import { demoDb, emptyDb, SERVICE_GROUPS, STAGES } from "./data/seed";
import { COMPANY_COLLECTIONS, type Db, type Stage } from "./data/types";
import * as A from "./domain/actions";
import type { Variant } from "./domain/generate";
import { checkIntegrity, removeOrphans } from "./domain/integrity";
import { bestOpp, companyOf, contactsOf, dmOf, grade, isTouchFollowUp, lastTouch, liveOutcomes, oppScore, oppValueOf, outcomeOf, scansOf, score, sevRank } from "./domain/queries";
import { runSelfTest, type TestResult } from "./domain/selftest";
import { acq, completeness, daysSince, dxDims, dxScore, furthestStage, nextBest, quadrant, readiness, REPLY_OUTCOMES, stall, stepStatuses } from "./domain/workflow";
import { addDays, daysBetween, localISODate } from "./lib/dates";
import { fdate, fdatetime, money } from "./lib/format";
import { discardStored, downloadJson, load, parseEnvelope, save, SCHEMA_VERSION, storageAvailable, type Envelope, type ResearchSettings, type WorkspaceKind } from "./lib/storage";
import { providerInfo, researchCompany } from "./research/provider";
import { FirstRun, Recovery } from "./views/Boot";
import ComposerModal from "./views/ComposerModal";
import Layout from "./views/Layout";
import { AddProspectModal, BriefModal, ResponseModal, ScoreModal } from "./views/Modals";
import type { DetailModel } from "./views/workspace/model";

export interface AppProps {
  defaultView?: string;
}

type Boot = "ok" | "corrupt" | "firstrun";
interface Corrupt {
  raw: string;
  error: string;
  backup: Envelope | null;
}

const GRADE: Record<string, [string, string]> = { A: ["#0a0a0a", "#ffffff"], B: ["#e0176b", "#ffffff"], C: ["#e4e4e7", "#2a2c31"], "—": ["#efeff1", "#73767a"] };
const VIEW_TITLES: Record<string, string> = {
  dashboard: "Daily Acquisition Command Center",
  queue: "Acquisition Priority Queue",
  prospects: "Prospects",
  opportunities: "Opportunity Intelligence",
  outreach: "Outreach Intelligence",
  pipeline: "Pipeline",
  campaigns: "Acquisition Campaigns",
  clients: "Clients",
  tasks: "Tasks",
  analytics: "Analytics",
  templates: "Template Library",
  settings: "Settings",
};

/** The demo dataset with the stage and next-action rules applied, so it reads like data the app produced. */
function freshDemo(today: string): Db {
  let n = 0;
  return A.normalizeDb(demoDb(today), { today, now: new Date().toISOString(), uid: (p) => p + "-dn" + n++, demo: true });
}

function freshEnvelope(today: string, active: WorkspaceKind): Envelope {
  return { schemaVersion: SCHEMA_VERSION, updatedAt: new Date().toISOString(), active, workspaces: { live: emptyDb(), demo: freshDemo(today) }, settings: { research: null, firstRunDone: false } };
}

function initialState(props: AppProps) {
  const today = localISODate();
  const loaded = load(today);
  const boot: Boot = loaded.kind === "corrupt" ? "corrupt" : loaded.kind === "empty" || !loaded.env.settings.firstRunDone ? "firstrun" : "ok";
  const env = loaded.kind === "ok" ? loaded.env : freshEnvelope(today, "demo");
  return {
    boot,
    corrupt: (loaded.kind === "corrupt" ? { raw: loaded.raw, error: loaded.error, backup: loaded.backup } : null) as Corrupt | null,
    env,
    today,
    view: props.defaultView ?? "dashboard",
    selId: null as string | null,
    focus: "company",
    outcomeKind: null as "Won" | "Lost" | null,
    search: "",
    showBell: false,
    navOpen: false,
    showAdd: false,
    scoreFor: null as string | null,
    responseFor: null as string | null,
    briefFor: null as string | null,
    composer: null as { cid: string; outreachId?: string; variant?: Variant } | null,
    pipeTab: "board",
    savedView: "All",
    fIndustry: "All industries",
    fStage: "All stages",
    fGrade: "All grades",
    fSource: "All sources",
    tplCat: "All",
    copiedTpl: null as string | null,
    planTab: "contact",
    queueSort: "Smart (default)",
    oppTab: "opportunities",
    audit: false,
    researching: null as string | null,
    notice: null as { kind: "error" | "success" | "info" | "warn"; title: string; lines: string[] } | null,
    storage: { savedAt: null as string | null, error: (storageAvailable() ? null : "Browser storage is unavailable (private mode or blocked). Changes will be lost when this page closes.") as string | null, migratedFrom: loaded.kind === "ok" ? loaded.migratedFrom || null : null },
    selfTest: null as { at: string; results: TestResult[]; workspaceUnchanged: boolean } | null,
    researchDraft: null as ResearchSettings | null,
  };
}
type State = ReturnType<typeof initialState>;

let seq = 0;
const uid = (prefix: string) => prefix + Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 6);

export default class App extends Component<AppProps, State> {
  state = initialState(this.props);
  /** Workspace as of the last action — kept synchronously so consecutive actions in one handler chain. */
  live: Db = this.state.env.workspaces[this.state.env.active]!;
  _persistTimer: ReturnType<typeof setTimeout> | null = null;
  /** True while the envelope has changes that are not in storage yet. */
  _unsaved = false;
  _dayTimer: ReturnType<typeof setInterval> | undefined;
  _noticeTimer: ReturnType<typeof setTimeout> | null = null;
  _drag: string | null = null;

  // ---------- lifecycle & persistence ----------
  componentDidMount() {
    this._dayTimer = setInterval(() => {
      const t = localISODate();
      if (t !== this.state.today) this.setState({ today: t });
    }, 60000);
    window.addEventListener("pagehide", this.flush);
    window.addEventListener("beforeunload", this.flush);
    document.addEventListener("visibilitychange", this.onVisibility);
    document.addEventListener("keydown", this.onKey);
    if (this.state.storage.migratedFrom) this.schedulePersist();
    if (this.state.storage.migratedFrom) this.notify("info", "Workspace upgraded", ["Your CAE V2.5.1 data was moved to the V3 format. Earlier free-text research is kept as unverified drafts — verify it to complete research."]);
  }
  componentWillUnmount() {
    clearInterval(this._dayTimer);
    window.removeEventListener("pagehide", this.flush);
    window.removeEventListener("beforeunload", this.flush);
    document.removeEventListener("visibilitychange", this.onVisibility);
    document.removeEventListener("keydown", this.onKey);
    this.flush();
  }
  componentDidUpdate(_: AppProps, prev: State) {
    if (prev.env !== this.state.env && this.state.boot !== "corrupt") this.schedulePersist();
  }
  onKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    if (this.state.navOpen) this.setState({ navOpen: false });
    else if (this.state.showBell) this.setState({ showBell: false });
  };
  onVisibility = () => {
    if (document.visibilityState === "hidden") this.flush();
  };
  schedulePersist() {
    this._unsaved = true;
    if (this._persistTimer) clearTimeout(this._persistTimer);
    this._persistTimer = setTimeout(this.flush, 400);
  }
  flush = () => {
    if (this._persistTimer) {
      clearTimeout(this._persistTimer);
      this._persistTimer = null;
    }
    if (!this._unsaved || this.state.boot === "corrupt") return;
    const r = save(this.state.env);
    if (r.ok) {
      this._unsaved = false;
      if (this.state.storage.error || this.state.storage.savedAt !== r.at) this.setState((s) => ({ storage: { ...s.storage, savedAt: r.at, error: null } }));
    } else this.setState((s) => ({ storage: { ...s.storage, error: r.error + " Your latest changes are NOT saved — export your data from Settings." } }));
  };

  // ---------- core ----------
  get db(): Db {
    return this.live;
  }
  ctx(): A.Ctx {
    return { today: this.state.today, now: new Date().toISOString(), uid, demo: this.state.env.active === "demo" };
  }
  setDb(db: Db) {
    this.live = db;
    this.setState((s) => ({ env: { ...s.env, workspaces: { ...s.env.workspaces, [s.env.active]: db } } }));
  }
  /** Apply a domain action. Errors are returned to the caller (forms show them inline). */
  run = (f: (db: Db, ctx: A.Ctx) => A.Result): A.Result => {
    let r: A.Result;
    try {
      r = f(this.db, this.ctx());
    } catch (e) {
      r = { ok: false, errors: ["Unexpected error — nothing was changed.", String((e as Error).message || e)] };
      console.error(e);
    }
    if (r.ok && r.db !== this.db) this.setDb(r.db);
    return r;
  };
  /** Run from a list/button without an inline form: errors go to the notice bar. */
  act = (f: (db: Db, ctx: A.Ctx) => A.Result, success?: string) => {
    const r = this.run(f);
    if (!r.ok) this.notify("error", r.errors[0], r.errors.slice(1));
    else if (success) this.notify("success", success, []);
    // A stale error from an earlier attempt must not linger after something succeeded.
    else if (this.state.notice && (this.state.notice.kind === "error" || this.state.notice.kind === "warn")) this.setState({ notice: null });
    return r;
  };
  notify(kind: "error" | "success" | "info" | "warn", title: string, lines: string[]) {
    if (this._noticeTimer) clearTimeout(this._noticeTimer);
    this.setState({ notice: { kind, title, lines } });
    if (kind === "success" || kind === "info") this._noticeTimer = setTimeout(() => this.setState({ notice: null }), 6000);
  }
  confirm = (m: string) => window.confirm(m);

  setWorkspace(env: Envelope, extra: Partial<State> = {}) {
    this.live = env.workspaces[env.active]!;
    // Filters belong to a workspace's data: start clean so a stale filter can never hide everything.
    this.setState({ env, selId: null, composer: null, responseFor: null, scoreFor: null, briefFor: null, savedView: "All", fIndustry: "All industries", fStage: "All stages", fGrade: "All grades", fSource: "All sources", ...extra } as State);
  }

  // ---------- navigation ----------
  open = (cid: string, focus = "company") => this.setState({ selId: cid, focus, outcomeKind: null, showBell: false, search: "", navOpen: false });
  openNext = (cid: string) => {
    const c = companyOf(this.db, cid);
    if (!c) return;
    this.open(cid, nextBest(this.db, c, this.state.today).focus);
  };
  backTo = () => this.setState({ selId: null });

  // ---------- research ----------
  runResearch = async (cid: string, website: string) => {
    const c = companyOf(this.db, cid);
    if (!c || this.state.researching) return;
    this.setState({ researching: cid });
    const info = providerInfo(this.state.env.settings.research);
    const res = await researchCompany({ companyName: c.name, website, location: c.location }, info);
    this.setState({ researching: null });
    const r = this.run((db, ctx) => A.applyResearchResult(db, cid, res, ctx));
    if (!r.ok) this.notify("error", r.errors[0], r.errors.slice(1));
    else if (res.success) this.notify("success", "Research retrieved — review it before completing", [r.message || ""]);
  };

  // ---------- workspace operations ----------
  switchWorkspace = (kind: WorkspaceKind) => {
    const env = this.state.env;
    const ws = { ...env.workspaces };
    if (!ws[kind]) ws[kind] = kind === "demo" ? freshDemo(this.state.today) : emptyDb(env.workspaces.live?.targets);
    this.setWorkspace({ ...env, active: kind, workspaces: ws, settings: { ...env.settings, firstRunDone: true } }, { boot: "ok", view: "dashboard" });
    this.notify("info", kind === "live" ? "Live workspace" : "Demo workspace", [kind === "live" ? "Real prospects only. Demo data is kept separately and never mixes in." : "Fictional sample data. Nothing you add here appears in your live workspace."]);
  };
  resetDemo = () => {
    if (!this.confirm("Reset the DEMO workspace to its original state? Changes made in the demo are discarded. Your live workspace is not touched.")) return;
    const env = this.state.env;
    this.setWorkspace({ ...env, workspaces: { ...env.workspaces, demo: freshDemo(this.state.today) } });
    this.notify("success", "Demo workspace reset", []);
  };
  clearDemo = () => {
    if (!this.confirm("Delete the DEMO workspace entirely? Your live workspace is not touched. You can restore the demo later with Reset demo.")) return;
    const env = this.state.env;
    this.setWorkspace({ ...env, active: "live", workspaces: { live: env.workspaces.live || emptyDb(), demo: null } });
    this.notify("success", "Demo data deleted", ["You are in your live workspace."]);
  };
  exportData = () => {
    this.flush();
    downloadJson(`cae-workspace-${this.state.today}.json`, JSON.stringify({ ...this.state.env, schemaVersion: SCHEMA_VERSION, updatedAt: new Date().toISOString() }, null, 2));
  };
  importData = (file: File) => {
    file.text().then(
      (text) => {
        let env: Envelope;
        try {
          env = parseEnvelope(text);
        } catch (e) {
          return this.notify("error", "Import failed — nothing was changed", ["The file is not a CAE V3 export: " + (e as Error).message]);
        }
        if (!this.confirm("Replace BOTH workspaces with the imported file? Export your current data first if you may need it.")) return;
        this.setWorkspace(env, { boot: "ok" });
        this.notify("success", "Workspace imported", []);
      },
      () => this.notify("error", "Import failed", ["The file could not be read."]),
    );
  };
  saveResearchSettings = (s: ResearchSettings | null) => {
    const env = this.state.env;
    this.setWorkspace({ ...env, settings: { ...env.settings, research: s } }, { selId: this.state.selId, view: this.state.view } as Partial<State>);
    const info = providerInfo(s);
    this.notify(info.problem ? "error" : "success", info.problem ? "Research provider not usable" : "Research provider saved", [info.problem || info.label]);
  };
  // Recovery from unreadable storage
  restoreBackup = () => {
    const b = this.state.corrupt?.backup;
    if (!b) return;
    this.setWorkspace(b, { boot: "ok", corrupt: null });
  };
  resetAfterCorrupt = (kind: WorkspaceKind) => {
    if (!this.confirm("Start a fresh workspace? The unreadable data will be discarded — export it first if you want to keep a copy.")) return;
    discardStored();
    this.setWorkspace(freshEnvelope(this.state.today, kind), { boot: "ok", corrupt: null });
  };

  runSelfTest = () => {
    const before = JSON.stringify(this.state.env);
    const results = runSelfTest(this.state.today);
    const workspaceUnchanged = JSON.stringify(this.state.env) === before;
    results.push({ name: "Your workspace was not touched", ok: workspaceUnchanged, note: workspaceUnchanged ? "the test ran on an isolated copy; no QA data was added" : "the workspace changed during the test" });
    this.setState({ selfTest: { at: new Date().toISOString(), results, workspaceUnchanged } });
  };

  // ---------- view model ----------
  renderVals() {
    const S = this.state;
    const D = this.db;
    const T = S.today;
    const go = (view: string, extra: Partial<State> = {}) => () => this.setState({ view, selId: null, navOpen: false, ...extra } as State);
    const active = D.companies.filter((c) => c.stage !== "Won" && c.stage !== "Lost");
    const activeIds = new Set(active.map((c) => c.id));
    // Open proposals = sent to an active prospect and not yet decided or expired. Drafts are not pipeline.
    const openProps = D.proposals.filter((p) => activeIds.has(p.companyId) && ["Sent", "Viewed", "Negotiation"].includes(A.effectiveProposalStatus(p, T)));
    const expiredProps = D.proposals.filter((p) => activeIds.has(p.companyId) && A.effectiveProposalStatus(p, T) === "Expired");
    const dueText = (d: string | null) => (!d ? "" : d < T ? "overdue since " + fdate(d) : d === T ? "due today" : "due " + fdate(d));
    const naOverdue = (c: (typeof D.companies)[number]) => !!c.nextAction.due && c.nextAction.due < T;
    const wonRevenue = D.clients.reduce((a, c) => a + c.revenue, 0);
    const followDue = D.outreach.filter((o) => o.followUpDate && o.followUpDate <= T);
    const openTasks = D.tasks.filter((t) => t.status !== "Done");
    const tasksToday = openTasks.filter((t) => t.due <= T);
    const meetingsToday = D.meetings.filter((m) => m.status === "Scheduled" && m.date === T);
    const qualified = active.filter((c) => score(c) >= 15);
    const won = D.companies.filter((c) => c.stage === "Won").length;
    const lost = D.companies.filter((c) => c.stage === "Lost").length;
    const pipeValue = active.reduce((a, c) => a + oppValueOf(D, c.id), 0);
    const weighted = openProps.reduce((a, p) => a + p.value * p.probability, 0);
    const acqAll = D.companies.map((c) => ({ c, a: acq(D, c, T) }));
    const acqOf = (cid: string) => (acqAll.find((x) => x.c.id === cid) || { a: { total: 0 } }).a;
    const activeRanked = acqAll.filter((x) => x.c.stage !== "Won" && x.c.stage !== "Lost").sort((a, b) => b.a.total - a.a.total);
    const nb = (c: (typeof D.companies)[number]) => nextBest(D, c, T);
    const readyFg = (pct: number) => (pct === 100 ? "#2e7d5b" : pct >= 60 ? "#9a6200" : "#b0453c");
    const dueLabel = (d: string | null) => (!d ? "—" : d === T ? "Today" : d < T ? "Overdue" : fdate(d));
    const dueColor = (d: string | null) => (!d ? "#73767a" : d < T ? "#b0453c" : d === T ? "#9a6200" : "#73767a");

    // nav
    const counts: Record<string, number> = { outreach: followDue.length, tasks: tasksToday.length, queue: activeRanked.filter((x) => x.a.total >= 80).length };
    const nav = Object.keys(VIEW_TITLES).map((id) => {
      const on = (S.view === id && !S.selId) || (id === "prospects" && !!S.selId);
      return {
        label: id === "opportunities" ? "Opportunity Intelligence" : id === "queue" ? "Priority Queue" : VIEW_TITLES[id].replace("Daily Acquisition Command Center", "Dashboard").replace("Outreach Intelligence", "Outreach").replace("Acquisition Campaigns", "Campaigns").replace("Template Library", "Templates"),
        count: counts[id] || null,
        current: on,
        color: on ? "#ffffff" : "rgba(255,255,255,.62)",
        bg: on ? "rgba(255,255,255,.07)" : "transparent",
        edge: on ? "#ff3d8a" : "transparent",
        on: go(id, { showBell: false } as Partial<State>),
      };
    });

    // dashboard
    const kpis = [
      { label: "Total prospects", value: D.companies.length, sub: active.length + " active", on: go("prospects", { savedView: "All" }) },
      { label: "Qualified (B+)", value: qualified.length, sub: "active, lead score ≥ 15", on: go("prospects", { savedView: "Qualified" }) },
      { label: "Outreach due", value: followDue.length, sub: "follow-ups due", on: go("outreach") },
      { label: "Meetings", value: D.meetings.filter((m) => m.status === "Scheduled" && m.date >= T).length, sub: meetingsToday.length + " today", on: go("tasks") },
      { label: "Open proposals", value: openProps.length, sub: money(openProps.reduce((a, p) => a + p.value, 0)) + (expiredProps.length ? " · " + expiredProps.length + " expired" : ""), on: go("pipeline", { pipeTab: "props" }) },
      { label: "Pipeline value", value: money(pipeValue), sub: "active opportunities", on: go("pipeline", { pipeTab: "board" }) },
      { label: "Won revenue", value: money(wonRevenue), sub: D.clients.length + " clients", on: go("clients") },
      { label: "Conversion rate", value: won + lost > 0 ? Math.round((won / (won + lost)) * 100) + "%" : "—", sub: won + " won · " + lost + " lost", on: go("analytics") },
    ];
    const funnelStages = (STAGES as string[])
      .filter((s) => s !== "Lost")
      .map((name) => {
        const count = D.companies.filter((c) => c.stage === name).length;
        const on = go("pipeline", { pipeTab: "board" });
        return count > 0 ? { name, count, on, bg: "#0a0a0a", border: "#0a0a0a", fg: "#ffffff", sub: "rgba(255,255,255,.55)" } : { name, count, on, bg: "#fafafa", border: "#e4e4e7", fg: "#c4c5ca", sub: "#b4b6bc" };
      });
    const actions: { tag: string; tagFg: string; tagBg: string; text: string; company: string; on: () => void }[] = [];
    followDue.forEach((o) => {
      const c = companyOf(D, o.companyId);
      if (c) actions.push({ tag: "Follow up", tagFg: "#7a4d00", tagBg: "#fdf3dc", text: "Touch " + (o.touch + 1) + " " + dueText(o.followUpDate), company: c.name, on: () => this.open(c.id, "followup") });
    });
    meetingsToday.forEach((m) => {
      const c = companyOf(D, m.companyId);
      if (c) actions.push({ tag: "Meeting", tagFg: "#2e5b7d", tagBg: "#e6eef4", text: m.type + " at " + m.time, company: c.name, on: () => this.open(c.id, "discovery") });
    });
    active.filter((c) => c.stage === "New").forEach((c) => actions.push({ tag: "Research", tagFg: "#2a2c31", tagBg: "#efeff1", text: "New prospect needs research", company: c.name, on: () => this.open(c.id, "research") }));
    [...expiredProps, ...openProps.filter((p) => p.expiry && p.expiry <= addDays(T, 7))].forEach((p) => {
      const c = companyOf(D, p.companyId);
      if (c) actions.push({ tag: "Proposal", tagFg: "#8a3b34", tagBg: "#f6e6e4", text: (p.expiry < T ? "Proposal expired " : "Proposal expires ") + fdate(p.expiry), company: c.name, on: () => this.open(c.id, "proposal") });
    });
    tasksToday
      .filter((t) => t.priority === "High" && !isTouchFollowUp(t) && !(t.meetingId && t.due === T))
      .slice(0, 3)
      .forEach((t) => {
        const c = companyOf(D, t.companyId);
        if (c) actions.push({ tag: "Task", tagFg: "#2a2c31", tagBg: "#efeff1", text: t.title, company: c.name, on: () => this.open(c.id, this.taskFocus(t)) });
      });
    const priority = active
      .map((c) => {
        const o = bestOpp(D, c.id);
        return { c, s: score(c), os: o ? oppScore(o) : 0, v: oppValueOf(D, c.id) };
      })
      .sort((a, b) => b.s + b.os - (a.s + a.os))
      .slice(0, 5)
      .map(({ c, s, os, v }) => {
        const g = grade(s);
        return { name: c.name, grade: g, gradeBg: GRADE[g][0], gradeFg: GRADE[g][1], meta: (c.industry || "Industry unknown") + " · lead " + s + "/25 · opp " + os + "/25", next: nb(c).label, value: money(v), on: () => this.open(c.id) };
      });
    const activity = D.activities.slice(0, 7).map((a) => ({ kind: a.kind, when: fdatetime(a.ts), text: a.text }));
    const forecast = [
      { label: "Potential pipeline", value: money(pipeValue) },
      { label: "Weighted pipeline", value: money(weighted) },
      { label: "Open proposal value", value: money(openProps.reduce((a, p) => a + p.value, 0)) },
      { label: "Won revenue", value: money(wonRevenue) },
    ];

    // prospects list
    const industries = [...new Set(D.companies.map((c) => c.industry).filter(Boolean))];
    let rows = D.companies.slice();
    const sv = S.savedView;
    if (sv === "Hot prospects") rows = rows.filter((c) => score(c) >= 20);
    if (sv === "Qualified") rows = rows.filter((c) => activeIds.has(c.id) && score(c) >= 15);
    if (sv === "Follow up today") rows = rows.filter((c) => D.outreach.some((o) => o.companyId === c.id && o.followUpDate && o.followUpDate <= T));
    if (sv === "High value") rows = rows.filter((c) => oppValueOf(D, c.id) >= 250000);
    if (sv === "No response") rows = rows.filter((c) => D.outreach.some((o) => o.companyId === c.id && o.outcome === "No response"));
    if (sv === "Proposal stage") rows = rows.filter((c) => c.stage === "Proposal" || c.stage === "Negotiation");
    if (sv === "Won clients") rows = rows.filter((c) => c.stage === "Won");
    // A filter value that no longer exists in this workspace is ignored rather than hiding everything.
    if (S.fIndustry !== "All industries" && industries.includes(S.fIndustry)) rows = rows.filter((c) => c.industry === S.fIndustry);
    if (S.fStage !== "All stages") rows = rows.filter((c) => c.stage === S.fStage);
    if (S.fGrade !== "All grades") rows = rows.filter((c) => grade(score(c)) === S.fGrade);
    if (S.fSource !== "All sources" && D.companies.some((c) => c.leadSource === S.fSource)) rows = rows.filter((c) => c.leadSource === S.fSource);
    const prospects = rows
      .map((c) => ({ c, a: acqOf(c.id) as ReturnType<typeof acq> }))
      .sort((x, y) => y.a.total - x.a.total)
      .map(({ c, a }) => {
        const s = score(c), g = grade(s);
        const r = readiness(D, c), n = nb(c), st = stall(c, T, D), dm = dmOf(D, c.id), o = bestOpp(D, c.id);
        return {
          name: c.name,
          industry: c.industry || "Unknown",
          dm: dm ? dm.name : "Not identified",
          dmFg: dm ? "#697080" : "#b0453c",
          score: s + "/25",
          grade: g,
          gradeBg: GRADE[g][0],
          gradeFg: GRADE[g][1],
          acq: a.total,
          bandFg: a.bandColor,
          bandBg: a.bandBg,
          band: a.band,
          readiness: r.pct + "%",
          readyFg: readyFg(r.pct),
          opp: o ? o.type || o.service : "—",
          stage: c.stage,
          stallLabel: st ? "⚠ " + st.days + "d" : "",
          hasStall: !!st,
          action: n.label,
          due: dueLabel(c.nextAction.due),
          nextColor: dueColor(c.nextAction.due) === "#73767a" ? "#697080" : dueColor(c.nextAction.due),
          value: o ? money(oppValueOf(D, c.id)) : "—",
          actionCta: n.label + " →",
          on: () => this.open(c.id),
          onAction: (e: { stopPropagation: () => void }) => (e.stopPropagation(), this.openNext(c.id)),
          onMore: (e: { stopPropagation: () => void }) => (e.stopPropagation(), this.setState({ scoreFor: c.id })),
        };
      });
    const savedViews = ["All", "Qualified", "Hot prospects", "Follow up today", "High value", "No response", "Proposal stage", "Won clients"].map((x) => ({ label: x, on: () => this.setState({ savedView: x }), bg: sv === x ? "#0a0a0a" : "#fff", fg: sv === x ? "#fff" : "#2a2c31", border: sv === x ? "#0a0a0a" : "#e4e4e7" }));

    // opportunities
    const oppRows = D.opportunities
      .map((o) => {
        const c = companyOf(D, o.companyId);
        return {
          company: c ? c.name : "",
          text: o.opportunity,
          problems: o.problems,
          service: o.type || o.service,
          band: o.valueBand + " value · " + o.basis,
          bandFg: o.basis === "Observed" ? "#2e7d5b" : o.basis === "Indicated" ? "#9a6200" : "#b0453c",
          value: money(o.estValue),
          score: oppScore(o),
          on: () => this.open(o.companyId, "opportunity"),
          onCompany: (e: { stopPropagation: () => void }) => (e.stopPropagation(), this.open(o.companyId)),
          onStrategy: (e: { stopPropagation: () => void }) => (e.stopPropagation(), this.open(o.companyId, "strategy")),
          onOutreach: (e: { stopPropagation: () => void }) => (e.stopPropagation(), this.open(o.companyId, "outreach")),
        };
      })
      .sort((a, b) => b.score - a.score);
    const scanCompanies = D.companies
      .filter((c) => scansOf(D, c.id).length > 0)
      .map((c) => {
        const dx = dxScore(D, c.id);
        return {
          name: c.name,
          dx: dx === null ? "Not scored" : dx + "/100",
          dxW: (dx || 0) + "%",
          dxFg: dx === null ? "#73767a" : dx < 40 ? "#8a3b34" : dx < 60 ? "#9a6200" : "#2e7d5b",
          industry: c.industry || "Unknown",
          on: () => this.open(c.id, "assessment"),
          dims: dxDims(D, c.id).map((d) => ({ dim: d.dim, val: d.assessed ? d.val : "—", w: (d.val || 0) + "%", fg: d.assessed ? ((d.val as number) < 40 ? "#b0453c" : (d.val as number) < 70 ? "#9a6200" : "#2e7d5b") : "#c4c5ca", bar: d.assessed ? ((d.val as number) < 40 ? "#b0453c" : (d.val as number) < 70 ? "#9a6200" : "#2e7d5b") : "#e4e4e7" })),
          scans: scansOf(D, c.id)
            .slice()
            .sort((a, b) => sevRank(b.severity) - sevRank(a.severity))
            .map((s) => ({ category: s.category, status: s.status, statusFg: ({ Excellent: "#2e7d5b", Good: "#2e7d5b", Average: "#9a6200", Weak: "#b0453c", Missing: "#8a3b34" } as Record<string, string>)[s.status] || "#697080", severity: s.severity, sevFg: ({ Critical: "#8a3b34", High: "#b0453c", Medium: "#9a6200", Low: "#73767a" } as Record<string, string>)[s.severity] || "#73767a", problem: s.problem, evidence: s.evidence + " (" + (s.isDemo ? "demo" : s.confidence) + ")", opportunity: s.opportunity, impact: s.impact })),
        };
      });
    const allScanned = active.filter((c) => scansOf(D, c.id).length === 0).map((c) => ({ name: c.name, on: () => this.open(c.id, "assessment") }));
    const quadDefs = [
      { key: "Quick Win", note: "High impact · low complexity — pitch first", fg: "#2e7d5b" },
      { key: "Strategic", note: "High impact · high complexity — phase it", fg: "#9a6200" },
      { key: "Low Priority", note: "Low impact · low complexity — bundle only", fg: "#697080" },
      { key: "Avoid", note: "Low impact · high complexity — decline", fg: "#b0453c" },
    ];
    const matrix = quadDefs.map((q) => {
      const items = D.opportunities.filter((o) => quadrant(o) === q.key).map((o) => ({ company: companyOf(D, o.companyId)?.name || "", type: o.type || o.service, value: money(o.estValue), score: oppScore(o) + "/25", on: () => this.open(o.companyId, "opportunity") }));
      return { ...q, items, empty: items.length === 0 };
    });
    const serviceTaxonomy = Object.entries(SERVICE_GROUPS as Record<string, string[]>).map(([group, items]) => ({ group, items: items.map((label) => ({ label, count: D.opportunities.filter((o) => o.type === label).length })) }));

    // outreach view
    const cadence = [
      { touch: "Touch 1", label: "Initial observation", timing: "Day 0" },
      { touch: "Touch 2", label: "New value / insight", timing: "3 days later" },
      { touch: "Touch 3", label: "Relevant proof or concept", timing: "4 days later" },
      { touch: "Touch 4", label: "Close the loop", timing: "6 days later" },
    ];
    const followUpsDue = followDue.map((o) => {
      const c = companyOf(D, o.companyId);
      return {
        company: c ? c.name : "",
        detail: "Touch " + (o.touch + 1) + " " + dueText(o.followUpDate) + " · last: " + (o.message || "").slice(0, 90),
        doneLabel: D.outreach.some((x) => x.companyId === o.companyId && !x.dateSent) ? "Open draft" : "Prepare touch " + (o.touch + 1),
        onOpen: () => this.open(o.companyId, "followup"),
        // An unsent draft for this prospect is the follow-up: open it instead of starting a second one.
        onDone: () => {
          const pend = D.outreach.find((x) => x.companyId === o.companyId && !x.dateSent);
          this.setState({ composer: pend ? { cid: o.companyId, outreachId: pend.id } : { cid: o.companyId, variant: o.touch + 1 >= 4 ? "Final follow-up" : "Follow-up" } });
        },
        onResched: () => this.act((db, ctx) => A.rescheduleFollowUp(db, o.id, 3, ctx)),
        onSkip: () => this.confirm("Skip touch " + (o.touch + 1) + " for " + (c?.name || "") + "?") && this.act((db, ctx) => A.skipFollowUp(db, o.id, ctx)),
      };
    });
    const allOutreach = D.outreach
      .slice()
      .sort((a, b) => (b.dateSent || b.createdAt || "").localeCompare(a.dateSent || a.createdAt || ""))
      .map((o) => {
        const c = companyOf(D, o.companyId);
        return { company: c ? c.name : "", channel: o.channel, touchLabel: "T" + o.touch, message: o.message, date: o.dateSent ? fdate(o.dateSent) : o.status === "Scheduled" ? "Sched " + fdate(o.dateScheduled) : "Not sent", status: o.status + (o.outcome && o.outcome !== "Sent" && o.outcome !== o.status ? " · " + o.outcome : ""), statusFg: o.status === "Replied" ? "#2e7d5b" : o.status === "Sent" ? "#697080" : "#9a6200", onOpen: () => this.open(o.companyId, o.dateSent ? "followup" : "outreach") };
      });

    // pipeline
    const cols = (STAGES as string[]).map((stage) => {
      const cards = D.companies.filter((c) => c.stage === stage);
      return {
        name: stage,
        fg: stage === "Won" ? "#2e7d5b" : stage === "Lost" ? "#b0453c" : "#2a2c31",
        count: cards.length,
        // Won = what was actually won; Lost carries no pipeline value; open stages = best opportunity value.
        total: stage === "Won" ? money(cards.reduce((a, c) => a + (outcomeOf(D, c.id)?.value || 0), 0)) : stage === "Lost" ? "—" : money(cards.reduce((a, c) => a + oppValueOf(D, c.id), 0)),
        onDrop: (e: { preventDefault: () => void }) => {
          e.preventDefault();
          const id = this._drag;
          this._drag = null;
          if (!id) return;
          const dragged = companyOf(D, id);
          if (dragged && (dragged.stage === "Won" || dragged.stage === "Lost"))
            return this.notify("warn", dragged.name + " is closed as " + dragged.stage, [dragged.stage === "Lost" ? "Open it and use “Reopen prospect” in Won / Lost to bring it back." : "A won client stays won."]);
          if (stage === "Won" || stage === "Lost") return this.openOutcome(id, stage);
          this.act((db, ctx) => A.setStage(db, id, stage as Stage, ctx));
        },
        cards: cards.map((c) => {
          const s = score(c), g = grade(s), o = bestOpp(D, c.id);
          const isClient = D.clients.some((cl) => cl.companyId === c.id);
          return {
            name: c.name,
            grade: g,
            gradeBg: GRADE[g][0],
            gradeFg: GRADE[g][1],
            service: o ? o.type || o.service : c.industry || "—",
            value: c.stage === "Won" ? money(outcomeOf(D, c.id)?.value || 0) : o ? money(oppValueOf(D, c.id)) : "—",
            due: dueLabel(c.nextAction.due),
            dueFg: dueColor(c.nextAction.due),
            next: nb(c).label,
            canConvert: stage === "Won" && !isClient,
            onConvert: (e: { stopPropagation: () => void }) => (e.stopPropagation(), this.act((db, ctx) => A.convertToClient(db, c.id, ctx), c.name + " converted to client")),
            onDrag: () => {
              this._drag = c.id;
            },
            on: () => this.open(c.id),
          };
        }),
      };
    });
    const proposals = D.proposals.map((q) => {
      const c = companyOf(D, q.companyId);
      const st = A.effectiveProposalStatus(q, T);
      return { company: c ? c.name : "", project: q.project, value: money(q.value), prob: Math.round(q.probability * 100) + "%", weighted: money(q.value * q.probability), expiry: q.expiry ? fdate(q.expiry) : "—", expiryFg: q.expiry && q.expiry <= addDays(T, 7) && ["Sent", "Viewed", "Negotiation"].includes(q.status) ? "#b0453c" : "#697080", status: st, statusFg: ({ Accepted: "#2e7d5b", Rejected: "#b0453c", Expired: "#b0453c", Viewed: "#9a6200", Negotiation: "#9a6200" } as Record<string, string>)[st] || "#697080", on: () => this.open(q.companyId, "proposal") };
    });

    // clients
    const clients = D.clients.map((cl) => {
      const c = companyOf(D, cl.companyId);
      const ct = dmOf(D, cl.companyId) || contactsOf(D, cl.companyId)[0];
      return { name: c ? c.name : "", revenue: money(cl.revenue), meta: (ct ? ct.name + " · " + ct.title + " · " : "") + "client since " + fdate(cl.startDate) + " · " + cl.status, services: cl.services, growth: cl.growthOps, referral: cl.referral ? cl.referral : "No referrals recorded.", on: () => this.open(cl.companyId, "outcome") };
    });
    const clientStats = [
      { label: "Active clients", value: D.clients.length },
      { label: "Won revenue", value: money(wonRevenue) },
      { label: "Upsell opportunities", value: D.clients.reduce((a, c) => a + c.growthOps.length, 0) },
    ];

    // tasks
    const mkTask = (t: (typeof D.tasks)[number]) => {
      const c = companyOf(D, t.companyId);
      const done = t.status === "Done";
      return {
        title: t.title,
        company: c ? c.name : "",
        type: t.type,
        priority: t.priority,
        prioFg: t.priority === "High" ? "#b0453c" : t.priority === "Medium" ? "#9a6200" : "#73767a",
        due: done ? (t.completedAt ? "Done " + fdate(t.completedAt) : "Done") : dueLabel(t.due),
        dueFg: done ? "#2e7d5b" : dueColor(t.due),
        // Done tasks and meeting tasks (rescheduled via the meeting) have nothing to push back.
        canReschedule: !done && !t.meetingId,
        check: done ? "✓" : "",
        circleBg: done ? "#2e7d5b" : "#fff",
        circleBorder: done ? "#2e7d5b" : "#b4b6bc",
        titleFg: done ? "#9a9ca3" : "#0a0a0a",
        deco: done ? "line-through" : "none",
        doneAria: done ? "Reopen task" : isTouchFollowUp(t) ? "Done when the next touch is sent — opens the follow-up step" : t.meetingId ? "Done when the meeting is recorded — opens Discovery" : "Mark done",
        onDone: () => this.toggleTask(t.id),
        onOpen: () => this.open(t.companyId, this.taskFocus(t)),
        onReschedule: () => this.act((db, ctx) => A.rescheduleTask(db, t.id, 3, ctx)),
      };
    };
    const taskGroups = [
      { label: "Overdue", fg: "#b0453c", items: openTasks.filter((t) => t.due < T).map(mkTask) },
      { label: "Due today", fg: "#9a6200", items: openTasks.filter((t) => t.due === T).map(mkTask) },
      { label: "Upcoming", fg: "#2a2c31", items: openTasks.filter((t) => t.due > T).sort((a, b) => a.due.localeCompare(b.due)).map(mkTask) },
      { label: "Done", fg: "#2e7d5b", items: D.tasks.filter((t) => t.status === "Done").map((t, i) => ({ t, i })).sort((a, b) => (b.t.completedAt || "").localeCompare(a.t.completedAt || "") || b.i - a.i).slice(0, 30).map((x) => mkTask(x.t)) },
    ].map((g) => ({ ...g, count: g.items.length + (g.items.length === 1 ? " task" : " tasks"), empty: g.items.length === 0 }));

    // analytics
    const outSent = D.outreach.filter((o) => o.dateSent);
    // Rates are per prospect contacted (not per message): one prospect replying once is one reply.
    const contactedIds = new Set(outSent.map((o) => o.companyId));
    const repliedIds = new Set(outSent.filter((o) => REPLY_OUTCOMES.includes(o.outcome)).map((o) => o.companyId));
    const positiveIds = new Set(outSent.filter((o) => ["Positive", "Meeting booked"].includes(o.outcome)).map((o) => o.companyId));
    const decided = D.proposals.filter((p) => p.status === "Accepted" || p.status === "Rejected");
    const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) + "%" : "—");
    const anGroups = [
      { label: "Acquisition", rows: [{ k: "Prospects added", v: D.companies.length }, { k: "Lead score B+ (≥15)", v: D.companies.filter((c) => score(c) >= 15).length }, { k: "Prospects contacted", v: contactedIds.size }, { k: "Messages sent", v: outSent.length }, { k: "Reply rate (per prospect)", v: pct(repliedIds.size, contactedIds.size) }, { k: "Positive reply rate", v: pct(positiveIds.size, contactedIds.size) }] },
      { label: "Sales", rows: [{ k: "Meetings held", v: D.meetings.filter((m) => m.status === "Held").length }, { k: "Proposals", v: D.proposals.length }, { k: "Acceptance rate", v: pct(D.proposals.filter((p) => p.status === "Accepted").length, decided.length) }, { k: "Won", v: won }, { k: "Lost", v: lost }] },
      { label: "Revenue", rows: [{ k: "Pipeline value", v: money(pipeValue) }, { k: "Weighted pipeline", v: money(weighted) }, { k: "Won revenue", v: money(wonRevenue) }, { k: "Avg project value", v: D.clients.length ? money(wonRevenue / D.clients.length) : "—" }] },
    ];
    const stageIdx = (s: string) => (STAGES as string[]).indexOf(s);
    // How far each prospect actually got, from its records — Lost prospects count for the stages they reached.
    const furthest = new Map(D.companies.map((c) => [c.id, Math.max(c.stage === "Lost" ? 0 : stageIdx(c.stage), furthestStage(D, c))]));
    const reached = (min: number) => D.companies.filter((c) => (furthest.get(c.id) || 0) >= min).length;
    const convSteps: [string, number][] = [["Prospects", D.companies.length], ["Qualified", reached(2)], ["Contacted", reached(3)], ["Responded", reached(4)], ["Meeting", reached(5)], ["Proposal", reached(6)], ["Won", won]];
    const base = convSteps[0][1] || 1;
    const convFunnel = convSteps.map(([stage, count]) => ({ stage, count, w: Math.max(2, Math.round((count / base) * 100)) + "%", pct: Math.round((count / base) * 100) + "% of total" }));
    const mkBreak = (label: string, keyFn: (c: (typeof D.companies)[number]) => string | null) => {
      const m: Record<string, { n: number; v: number }> = {};
      D.companies.forEach((c) => {
        const k = keyFn(c);
        if (!k) return;
        m[k] = m[k] || { n: 0, v: 0 };
        m[k].n++;
        m[k].v += oppValueOf(D, c.id);
      });
      const max = Math.max(...Object.values(m).map((x) => x.v), 1);
      return { label, rows: Object.entries(m).sort((a, b) => b[1].v - a[1].v).map(([k, x]) => ({ k, meta: x.n + " · " + money(x.v), w: Math.max(3, Math.round((x.v / max) * 100)) + "%" })) };
    };
    const breakdowns = [mkBreak("By industry", (c) => c.industry || "Unknown"), mkBreak("By lead source", (c) => c.leadSource || "Unknown"), mkBreak("By service", (c) => { const o = bestOpp(D, c.id); return o ? o.type || o.service : null; })];
    const wonCos = D.companies.filter((c) => c.stage === "Won"), lostCos = D.companies.filter((c) => c.stage === "Lost");
    const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);
    const ocAcq = (cs: typeof wonCos) => cs.map((c) => outcomeOf(D, c.id)?.acqAtClose ?? acqOf(c.id).total);
    const avgWon = avg(ocAcq(wonCos)), avgLost = avg(ocAcq(lostCos));
    const insuff = "Insufficient data";
    const bestBy = (keyFn: (c: (typeof D.companies)[number]) => string | null) => {
      const m: Record<string, { w: number; t: number }> = {};
      wonCos.concat(lostCos).forEach((c) => {
        const k = keyFn(c);
        if (!k) return;
        m[k] = m[k] || { w: 0, t: 0 };
        m[k].t++;
        if (c.stage === "Won") m[k].w++;
      });
      // Only groups with at least 3 closed deals qualify; ties go to the larger sample.
      const e = Object.entries(m).filter(([, x]) => x.t >= 3).sort((a, b) => b[1].w / b[1].t - a[1].w / a[1].t || b[1].t - a[1].t);
      return e.length ? e[0][0] + " (" + e[0][1].w + "/" + e[0][1].t + " won)" : insuff + " — needs 3+ closed deals in one group";
    };
    const chan = (() => {
      const m: Record<string, { r: number; t: number }> = {};
      outSent.forEach((o) => {
        m[o.channel] = m[o.channel] || { r: 0, t: 0 };
        m[o.channel].t++;
        if (REPLY_OUTCOMES.includes(o.outcome)) m[o.channel].r++;
      });
      const e = Object.entries(m).filter(([, x]) => x.t >= 3).sort((a, b) => b[1].r / b[1].t - a[1].r / a[1].t || b[1].t - a[1].t);
      return e.length ? e[0][0] + " (" + Math.round((e[0][1].r / e[0][1].t) * 100) + "% of messages replied, n=" + e[0][1].t + ")" : insuff + " — needs 3+ messages on one channel";
    })();
    const closeDays = liveOutcomes(D).filter((o) => o.result === "Won").map((o) => o.daysToClose);
    const acqPerf = [
      { k: "Avg acquisition score — won", v: avgWon !== null ? avgWon + "/100" : insuff },
      { k: "Avg acquisition score — lost", v: avgLost !== null ? avgLost + "/100" : insuff },
      { k: "Best-performing industry", v: bestBy((c) => c.industry || null) },
      { k: "Best-performing campaign", v: bestBy((c) => c.campaign || null) },
      { k: "Best outreach channel", v: chan },
      { k: "Prospect → won (avg days)", v: closeDays.length >= 2 ? avg(closeDays) + " days" : insuff },
      { k: "Avg project value", v: D.clients.length ? money(wonRevenue / D.clients.length) : insuff },
      { k: "Revenue by campaign", v: (() => { const m: Record<string, number> = {}; D.clients.forEach((cl) => { const c = companyOf(D, cl.companyId); const k = c && c.campaign ? c.campaign : "Unassigned"; m[k] = (m[k] || 0) + cl.revenue; }); const e = Object.entries(m).sort((a, b) => b[1] - a[1]); return e.length ? e.map(([k, x]) => k + " " + money(x)).join(" · ") : insuff; })() },
    ];
    const predictors = [
      ...(wonCos.length < 3 || lostCos.length < 3 ? [{ k: "Win predictors", v: insuff + " — need ≥3 won and ≥3 lost outcomes (have " + wonCos.length + " won, " + lostCos.length + " lost)" }] : []),
      ...(avgWon !== null && avgLost !== null ? [{ k: "Observed (not conclusive)", v: "Won average " + avgWon + "/100 vs " + avgLost + "/100 for lost — directional only at n=" + (wonCos.length + lostCos.length) }] : []),
    ];

    // templates
    const tplCats = ["All", "LinkedIn", "Email", "Discovery", "Proposal"].map((x) => ({ label: x, on: () => this.setState({ tplCat: x }), bg: S.tplCat === x ? "#0a0a0a" : "#fff", fg: S.tplCat === x ? "#fff" : "#2a2c31", border: S.tplCat === x ? "#0a0a0a" : "#e4e4e7" }));
    const tpls = D.templates
      .filter((t) => S.tplCat === "All" || t.category === S.tplCat)
      .map((t) => ({
        name: t.name,
        category: t.category,
        body: t.body,
        copyLabel: S.copiedTpl === t.id ? "Copied ✓" : S.copiedTpl === t.id + ":fail" ? "Copy failed" : "Copy",
        onCopy: () => {
          const done = (ok: boolean) => {
            this.setState({ copiedTpl: ok ? t.id : t.id + ":fail" });
            setTimeout(() => this.setState({ copiedTpl: null }), 1800);
          };
          if (!navigator.clipboard) return done(false);
          navigator.clipboard.writeText(t.body).then(() => done(true), () => done(false));
        },
      }));
    const tplVars = ["{{company}}", "{{contact}}", "{{industry}}", "{{problem}}", "{{opportunity}}", "{{service}}"];

    // day plan
    type W = { c: (typeof D.companies)[number]; a: ReturnType<typeof acq>; r: ReturnType<typeof readiness>; nb: ReturnType<typeof nextBest>; stall: ReturnType<typeof stall> };
    const activeW: W[] = active.map((c) => ({ c, a: acqOf(c.id) as ReturnType<typeof acq>, r: readiness(D, c), nb: nb(c), stall: stall(c, T, D) }));
    const rowFor = (x: W) => ({
      name: x.c.name,
      acq: x.a.total,
      band: x.a.band,
      bandFg: x.a.bandColor,
      bandBg: x.a.bandBg,
      readiness: x.r.pct + "%",
      readyFg: readyFg(x.r.pct),
      action: x.nb.label,
      actionCta: x.nb.label + " →",
      why: x.nb.why,
      value: oppValueOf(D, x.c.id) ? money(oppValueOf(D, x.c.id)) : "—",
      stage: x.c.stage,
      stallLabel: x.stall ? "⚠ Stalled " + x.stall.days + "d" : "",
      hasStall: !!x.stall,
      on: () => this.open(x.c.id),
      onAction: (e: { stopPropagation: () => void }) => (e.stopPropagation(), this.openNext(x.c.id)),
      waitingOn: "",
      risk: "",
    });
    const contactNow = activeW.filter((x) => x.r.ready && /outreach/i.test(x.nb.label)).map(rowFor);
    const followNow = activeW.filter((x) => D.outreach.some((o) => o.companyId === x.c.id && o.followUpDate && o.followUpDate <= T)).map(rowFor);
    const researchNow = activeW.filter((x) => !x.r.ready && /research|assess|identify|reassess/i.test(x.nb.label)).sort((p, q) => q.a.total - p.a.total).map(rowFor);
    const prepareNow = activeW.filter((x) => /strategy|prepare|send proposal|record discovery/i.test(x.nb.label) && !/initial outreach/i.test(x.nb.label)).map(rowFor);
    const waiting = activeW
      .filter((x) => x.nb.label === "Await reply" || x.nb.label === "Follow up on proposal" || x.nb.label === "Prepare for discovery")
      .map((x) => ({ ...rowFor(x), waitingOn: x.nb.label === "Follow up on proposal" ? "Proposal decision" : x.nb.label === "Prepare for discovery" ? "Meeting · " + x.nb.why : "Reply to outreach" }));
    const atRisk = activeW
      .filter((x) => x.stall || naOverdue(x.c) || daysSince(lastTouch(D, x.c.id), T) > 21)
      .map((x) => ({ ...rowFor(x), risk: x.stall ? "Stalled " + x.stall.days + " days in " + x.c.stage : naOverdue(x.c) ? "Next action overdue since " + fdate(x.c.nextAction.due) : "No activity for " + daysSince(lastTouch(D, x.c.id), T) + " days" }));
    const planSets: Record<string, ReturnType<typeof rowFor>[]> = { contact: contactNow, follow: followNow, research: researchNow, prepare: prepareNow, waiting, risk: atRisk };
    const planTabs = ([["contact", "Contact now"], ["follow", "Follow up now"], ["research", "Research now"], ["prepare", "Prepare now"], ["waiting", "Waiting"], ["risk", "At risk"]] as [string, string][]).map(([k, label]) => ({ label, n: planSets[k].length, current: S.planTab === k, on: () => this.setState({ planTab: k }), bg: S.planTab === k ? "#ffffff" : "transparent", fg: S.planTab === k ? "#0a0a0a" : "#e7e7ea", border: S.planTab === k ? "#ffffff" : "rgba(255,255,255,.18)" }));
    const planRows = planSets[S.planTab] || [];
    const planEmptyMsg = ({ contact: "Nothing is outreach-ready today — clear the Research now list first.", follow: "No follow-ups due today.", research: "No prospects are missing research or evidence.", prepare: "Nothing waiting on a strategy, proposal or meeting record.", waiting: "Nothing outstanding with prospects right now.", risk: "Nothing at risk — every prospect is moving." } as Record<string, string>)[S.planTab];
    const doneToday = {
      newProspects: D.companies.filter((c) => c.dateDiscovered === T).length,
      // Qualified today = moved to the Qualified stage today (that happens when it becomes outreach-ready).
      qualified: new Set(D.activities.filter((a) => a.kind === "Stage change" && /moved to Qualified/.test(a.text) && localISODate(new Date(a.ts)) === T).map((a) => a.companyId)).size,
      outreach: D.outreach.filter((o) => o.dateSent === T && o.touch === 1).length,
      followUps: D.outreach.filter((o) => o.dateSent === T && o.touch > 1).length,
      meetings: D.meetings.filter((m) => m.status === "Held" && m.date === T).length,
      proposals: D.proposals.filter((p) => p.sentDate === T).length,
    } as Record<string, number>;
    const targetLabels: [keyof typeof D.targets, string][] = [["newProspects", "New prospects"], ["qualified", "Qualified"], ["outreach", "Outreach"], ["followUps", "Follow-ups"], ["meetings", "Discovery meetings"], ["proposals", "Proposals sent"]];
    const targets = targetLabels.map(([k, label]) => {
      const goal = D.targets[k] || 0, done = doneToday[k] || 0;
      const p = goal ? Math.min(100, Math.round((done / goal) * 100)) : 0;
      return { label, text: done + " / " + goal, w: p + "%", bar: p >= 100 ? "#2e7d5b" : p > 0 ? "#e0176b" : "#e4e4e7" };
    });
    const topProspects = activeRanked.slice(0, 5).map(({ c, a }) => {
      const o = bestOpp(D, c.id), dm = dmOf(D, c.id), cts = contactsOf(D, c.id);
      return {
        name: c.name,
        acq: a.total + "/100",
        band: a.band,
        bandFg: a.bandColor,
        bandBg: a.bandBg,
        opp: o ? o.type || o.service : "No opportunity recorded",
        value: o ? money(oppValueOf(D, c.id)) : "—",
        dm: dm ? dm.name + " · " + dm.title : cts.length ? "Not identified (" + cts[0].name + " is " + (cts[0].role || "unknown") + ")" : "Not identified",
        dmFg: dm ? "#2a2c31" : "#b0453c",
        next: nb(c).label,
        nextFg: dueColor(c.nextAction.due),
        on: () => this.open(c.id),
        onScore: (e: { stopPropagation: () => void }) => (e.stopPropagation(), this.setState({ scoreFor: c.id })),
      };
    });
    const outreachToday = [
      ...D.outreach
        .filter((o) => !o.dateSent && (o.status === "Draft" || o.status === "Approved" || (o.status === "Scheduled" && (o.dateScheduled || "") <= T)))
        .map((o) => {
          const c = companyOf(D, o.companyId);
          return { company: c ? c.name : "", detail: o.channel + " · " + (o.status === "Draft" ? "draft — needs approval" : o.status === "Approved" ? "approved — send it, then mark as sent" : o.dateScheduled && o.dateScheduled < T ? "was scheduled for " + fdate(o.dateScheduled) + " — send it, then mark as sent" : "scheduled for today — send it, then mark as sent") + " · " + o.message.slice(0, 70), on: () => this.open(o.companyId, "outreach"), onGen: (e: { stopPropagation: () => void }) => (e.stopPropagation(), this.setState({ composer: { cid: o.companyId, outreachId: o.id } })) };
        }),
      ...contactNow.filter((r) => !D.outreach.some((o) => o.companyId === activeW.find((x) => x.c.name === r.name)?.c.id)).map((r) => {
        const c = activeW.find((x) => x.c.name === r.name)!.c;
        return { company: c.name, detail: "Outreach-ready with no message yet — prepare touch 1", on: () => this.open(c.id, "outreach"), onGen: (e: { stopPropagation: () => void }) => (e.stopPropagation(), this.setState({ composer: { cid: c.id } })) };
      }),
    ];
    const focusFor: Record<string, string> = { "Research complete": "research", "Decision-maker identified": "contacts", "Opportunity with evidence": "opportunity", "Acquisition strategy": "strategy" };
    const researchNeeded = active
      .map((c) => ({ c, comp: completeness(D, c) }))
      .map((x) => ({ ...x, req: x.comp.checks.filter((k) => k.required && !k.ok).map((k) => k.k) }))
      .filter((x) => x.req.length > 0)
      .sort((a, b) => a.comp.pct - b.comp.pct)
      .map(({ c, comp, req }) => ({ company: c.name, pct: comp.pct + "%", missing: req.slice(0, 3).join(" · "), on: () => this.open(c.id, focusFor[req[0]] || (/scan/i.test(req[0]) ? "assessment" : "company")), w: comp.pct + "%" }));
    const revStages = ["Qualified", "Outreach", "Responded", "Discovery", "Proposal", "Negotiation"];
    const revenueOps = acqAll
      .filter(({ c }) => revStages.includes(c.stage))
      .map(({ c, a }) => ({ c, a, v: oppValueOf(D, c.id) }))
      .sort((x, y) => y.v - x.v)
      .slice(0, 6)
      .map(({ c, a, v }) => {
        const o = bestOpp(D, c.id);
        return { company: c.name, stage: c.stage, opp: o ? o.type || o.service : "—", value: money(v), acq: a.total, on: () => this.open(c.id) };
      });
    const recommended = activeW
      .slice()
      .sort((x, y) => (y.stall ? 1 : 0) - (x.stall ? 1 : 0) || y.a.total - x.a.total)
      .slice(0, 7)
      .map((x, i) => ({ n: i + 1 + ".", text: x.nb.label + " — " + x.c.name, why: x.nb.why, on: () => this.openNext(x.c.id) }));
    const planCounts = [
      { label: "Priority prospects", value: activeRanked.filter((x) => x.a.total >= 80).length, sub: "acq score ≥ 80" },
      { label: "Outreach today", value: outreachToday.length, sub: "drafts, approved, ready" },
      { label: "Follow-ups due", value: followDue.length, sub: "cadence due" },
      { label: "Profiles incomplete", value: researchNeeded.length, sub: "required items missing" },
    ];

    // queue
    const queueRows = activeRanked.map(({ c, a }) => ({ c, a, r: readiness(D, c), nb: nb(c), stall: stall(c, T, D) }));
    queueRows.sort((x, y) => {
      const boost = (z: (typeof queueRows)[number]) => {
        let b = 0;
        if (z.r.ready) b += 14;
        if (D.outreach.some((o) => o.companyId === z.c.id && o.followUpDate && o.followUpDate <= T)) b += 12;
        if (naOverdue(z.c)) b += 8;
        if (z.stall) b += 6;
        if (z.r.blocked) b -= 25;
        b += Math.min(8, Math.round(oppValueOf(D, z.c.id) / 60000));
        b += stageIdx(z.c.stage);
        return z.a.total + b;
      };
      return boost(y) - boost(x);
    });
    const qs = S.queueSort;
    if (qs === "Acquisition score") queueRows.sort((a, b) => b.a.total - a.a.total);
    if (qs === "Action readiness") queueRows.sort((a, b) => b.r.pct - a.r.pct);
    if (qs === "Opportunity value") queueRows.sort((a, b) => oppValueOf(D, b.c.id) - oppValueOf(D, a.c.id));
    if (qs === "Urgency") queueRows.sort((a, b) => (a.c.nextAction.due || "9").localeCompare(b.c.nextAction.due || "9"));
    if (qs === "Follow-up date") {
      const fu = (cid: string) => D.outreach.filter((o) => o.companyId === cid && o.followUpDate).map((o) => o.followUpDate!).sort()[0] || "9999";
      queueRows.sort((a, b) => fu(a.c.id).localeCompare(fu(b.c.id)));
    }
    if (qs === "Stage") queueRows.sort((a, b) => stageIdx(b.c.stage) - stageIdx(a.c.stage));
    const queue = queueRows.map(({ c, a, r, nb: n, stall: st }, i) => {
      const o = bestOpp(D, c.id), dm = dmOf(D, c.id);
      const whyNowTxt = st ? "Stalled " + st.days + "d in " + c.stage : D.outreach.some((x) => x.companyId === c.id && x.followUpDate && x.followUpDate <= T) ? "Follow-up due" : r.blocked ? "Not ready — " + r.reason : r.ready && !D.outreach.some((x) => x.companyId === c.id && x.dateSent) ? "Outreach ready" : naOverdue(c) ? "Action overdue" : n.why;
      return {
        rank: String(i + 1).padStart(2, "0"),
        name: c.name,
        acq: a.total,
        band: a.band,
        bandFg: a.bandColor,
        bandBg: a.bandBg,
        w: a.total + "%",
        readiness: r.pct + "%",
        readyW: r.pct + "%",
        readyFg: readyFg(r.pct),
        opp: o ? o.type || o.service : "—",
        value: o ? money(oppValueOf(D, c.id)) : "—",
        dm: dm ? dm.name : "Not identified",
        dmFg: dm ? "#2a2c31" : "#b0453c",
        stage: c.stage,
        whyNow: whyNowTxt,
        action: n.label,
        actionCta: n.label + " →",
        on: () => this.open(c.id),
        onScore: (e: { stopPropagation: () => void }) => (e.stopPropagation(), this.setState({ scoreFor: c.id })),
        onAction: (e: { stopPropagation: () => void }) => (e.stopPropagation(), this.openNext(c.id)),
      };
    });
    const queueSorts = ["Smart (default)", "Acquisition score", "Action readiness", "Opportunity value", "Urgency", "Follow-up date", "Stage"].map((k) => ({ label: k, current: qs === k, on: () => this.setState({ queueSort: k }), bg: qs === k ? "#0a0a0a" : "#fff", fg: qs === k ? "#fff" : "#2a2c31", border: qs === k ? "#0a0a0a" : "#e4e4e7" }));

    // campaigns
    // Campaigns = the defined ones plus every campaign name typed on a prospect.
    const camNames = [...new Set([...D.campaigns.map((x) => x.name), ...D.companies.map((c) => c.campaign).filter(Boolean)])];
    const campaigns = camNames.map((name) => {
      const cam = D.campaigns.find((x) => x.name === name) || { name, target: "Not defined — set on the prospects tagged with it", offer: "—", goal: "—" };
      const cs = D.companies.filter((c) => c.campaign === cam.name);
      const ids = new Set(cs.map((c) => c.id));
      const outs = D.outreach.filter((o) => ids.has(o.companyId) && o.dateSent);
      const contacted = new Set(outs.map((o) => o.companyId));
      const reps = [...new Set(outs.filter((o) => REPLY_OUTCOMES.includes(o.outcome)).map((o) => o.companyId))];
      const rev = D.clients.filter((cl) => ids.has(cl.companyId)).reduce((a, c) => a + c.revenue, 0);
      return { name: cam.name, target: cam.target, offer: cam.offer, goal: cam.goal, stats: [{ k: "Prospects", v: cs.length }, { k: "Contacted", v: contacted.size }, { k: "Replied", v: reps.length }, { k: "Meetings", v: D.meetings.filter((m) => ids.has(m.companyId) && m.status === "Held").length }, { k: "Proposals", v: D.proposals.filter((p) => ids.has(p.companyId)).length }, { k: "Won", v: cs.filter((c) => c.stage === "Won").length }], revenue: money(rev), conv: contacted.size ? Math.round((reps.length / contacted.size) * 100) + "% of contacted replied" : "No outreach yet", avgAcq: cs.length ? Math.round(cs.reduce((a, c) => a + acqOf(c.id).total, 0) / cs.length) + "/100" : "—" };
    });

    // search & notifications
    const q = S.search.trim().toLowerCase();
    const searchResults = q
      ? D.companies
          .filter((c) => c.name.toLowerCase().includes(q) || c.industry.toLowerCase().includes(q) || contactsOf(D, c.id).some((p) => p.name.toLowerCase().includes(q)))
          .slice(0, 6)
          .map((c) => ({ name: c.name, meta: (c.industry || "Unknown") + " · " + c.stage, on: () => this.open(c.id) }))
      : [];
    const bellItems: { tag: string; color: string; text: string; on: () => void }[] = [];
    followDue.forEach((o) => {
      const c = companyOf(D, o.companyId);
      if (c) bellItems.push({ tag: "Follow-up due", color: "#9a6200", text: c.name + " — touch " + (o.touch + 1) + " " + dueText(o.followUpDate), on: () => this.open(c.id, "followup") });
    });
    // Touch follow-up tasks are already listed above as "Follow-up due".
    openTasks.filter((t) => t.due < T && !isTouchFollowUp(t)).forEach((t) => {
      const c = companyOf(D, t.companyId);
      if (c) bellItems.push({ tag: "Overdue task", color: "#b0453c", text: t.title + " (" + c.name + ")", on: () => this.open(c.id, this.taskFocus(t)) });
    });
    meetingsToday.forEach((m) => {
      const c = companyOf(D, m.companyId);
      if (c) bellItems.push({ tag: "Meeting today", color: "#2e5b7d", text: m.type + " with " + c.name + " at " + m.time, on: () => this.open(c.id, "discovery") });
    });
    [...expiredProps, ...openProps.filter((p) => p.expiry && daysBetween(T, p.expiry) <= 7)].forEach((p) => {
      const c = companyOf(D, p.companyId);
      if (c) bellItems.push({ tag: p.expiry < T ? "Proposal expired" : "Proposal expiring", color: "#b0453c", text: c.name + " proposal " + (p.expiry < T ? "expired " : "expires ") + fdate(p.expiry), on: () => this.open(c.id, "proposal") });
    });
    if (S.storage.error) bellItems.unshift({ tag: "Not saved", color: "#b0453c", text: S.storage.error, on: go("settings") });

    // detail
    let detail: DetailModel | null = null;
    const sel = S.selId ? companyOf(D, S.selId) : null;
    if (sel) {
      detail = {
        db: D,
        c: sel,
        today: T,
        focus: S.focus,
        steps: stepStatuses(D, sel, T),
        nba: nextBest(D, sel, T),
        provider: providerInfo(S.env.settings.research),
        researchRunning: S.researching === sel.id,
        run: this.run,
        act: (f) => this.act(f),
        setFocus: (f: string) => this.setState({ focus: f, outcomeKind: null }),
        runResearch: (w: string) => void this.runResearch(sel.id, w),
        openComposer: (o) => this.setState({ composer: { cid: sel.id, ...o } }),
        openResponse: (oid: string) => this.setState({ responseFor: oid }),
        openScore: () => this.setState({ scoreFor: sel.id }),
        openSettings: go("settings"),
        confirm: this.confirm,
        outcomeKind: S.outcomeKind,
      };
    }

    // settings & diagnostics
    const info = providerInfo(S.env.settings.research);
    const integ = checkIntegrity(D);
    const ws = S.env.workspaces;
    const diagnostics = [
      { k: "Storage", v: S.storage.error ? "⚠ " + S.storage.error : storageAvailable() ? "localStorage · key CAE_DATA_V3 (+ backup)" : "Unavailable" },
      { k: "Schema version", v: String(SCHEMA_VERSION) },
      { k: "Active workspace", v: S.env.active === "live" ? "LIVE workspace" : "DEMO workspace" },
      { k: "Other workspace", v: S.env.active === "live" ? (ws.demo ? "Demo kept separately (" + ws.demo.companies.length + " companies)" : "No demo data") : ws.live ? "Live workspace kept separately (" + ws.live.companies.length + " companies)" : "No live data yet" },
      { k: "Research provider", v: info.automated ? info.label + " (" + info.origin + ")" : "Manual research only" + (info.problem ? " — " + info.problem : " (not configured)") },
      { k: "Last saved", v: S.storage.savedAt ? fdatetime(S.storage.savedAt) : "Not saved yet this session" },
      { k: "Companies", v: String(D.companies.length) },
      { k: "Contacts", v: String(D.contacts.length) },
      { k: "Research records", v: D.research.length + " (" + D.research.filter((r) => r.status === "complete").length + " complete)" },
      { k: "Opportunities", v: String(D.opportunities.length) },
      { k: "Outreach records", v: D.outreach.length + " (" + D.outreach.filter((o) => o.dateSent).length + " sent)" },
      { k: "Tasks", v: D.tasks.length + " (" + openTasks.length + " open)" },
      { k: "Orphan records", v: integ.orphans.length ? integ.orphans.length + " ⚠" : "0" },
      { k: "Duplicate IDs", v: integ.duplicateIds.length ? integ.duplicateIds.length + " ⚠" : "0" },
      { k: "Invalid values", v: integ.invalid.length ? integ.invalid.length + " ⚠ (" + integ.invalid.slice(0, 3).map((x) => x.collection + " " + x.id + ": " + x.problem).join("; ") + ")" : "0" },
      { k: "Workflow self-test", v: S.selfTest ? S.selfTest.results.filter((r) => r.ok).length + " of " + S.selfTest.results.length + " passed · " + fdatetime(S.selfTest.at) : "Not run this session" },
    ];

    return {
      nav,
      viewTitle: S.selId ? "Prospect" : VIEW_TITLES[S.view],
      isDemo: S.env.active === "demo",
      demoLabel: S.env.active === "demo" ? "Demo workspace" : "Live workspace",
      // Does what it says: switches to the live workspace (Settings → Workspace has the other options).
      onDemoLabel: () => this.switchWorkspace("live"),
      today: T,
      navOpen: S.navOpen,
      toggleNav: () => this.setState((s) => ({ navOpen: !s.navOpen })),
      notice: S.notice,
      closeNotice: () => this.setState({ notice: null }),
      storageError: S.storage.error,
      search: S.search,
      setSearch: (e: { target: { value: string } }) => this.setState({ search: e.target.value }),
      hasSearch: searchResults.length > 0,
      noSearchResults: !!q && searchResults.length === 0,
      searchResults,
      toggleBell: () => this.setState((s) => ({ showBell: !s.showBell })),
      showBell: S.showBell,
      bellCount: bellItems.length || null,
      bellItems,
      noBell: bellItems.length === 0,
      openAdd: () => this.setState({ showAdd: true, navOpen: false }),
      isDash: S.view === "dashboard" && !S.selId,
      isProspects: S.view === "prospects" && !S.selId,
      isDetail: !!sel,
      isOpps: S.view === "opportunities" && !S.selId,
      isOutreach: S.view === "outreach" && !S.selId,
      isPipeline: S.view === "pipeline" && !S.selId,
      isClients: S.view === "clients" && !S.selId,
      isTasks: S.view === "tasks" && !S.selId,
      isAnalytics: S.view === "analytics" && !S.selId,
      isTemplates: S.view === "templates" && !S.selId,
      isSettings: S.view === "settings" && !S.selId,
      isQueue: S.view === "queue" && !S.selId,
      isCampaigns: S.view === "campaigns" && !S.selId,
      kpis,
      funnelStages,
      actions,
      actionCount: actions.length,
      priority,
      activity,
      forecast,
      savedViews,
      prospects,
      prospectCount: prospects.length,
      noProspects: prospects.length === 0,
      industryFilterOpts: ["All industries", ...industries],
      stageFilterOpts: ["All stages", ...(STAGES as string[])],
      gradeFilterOpts: ["All grades", "A", "B", "C"],
      sourceFilterOpts: ["All sources", ...new Set(D.companies.map((c) => c.leadSource).filter(Boolean))],
      fIndustry: S.fIndustry,
      setFIndustry: (e: { target: { value: string } }) => this.setState({ fIndustry: e.target.value }),
      fStage: S.fStage,
      setFStage: (e: { target: { value: string } }) => this.setState({ fStage: e.target.value }),
      fGrade: S.fGrade,
      setFGrade: (e: { target: { value: string } }) => this.setState({ fGrade: e.target.value }),
      fSource: S.fSource,
      setFSource: (e: { target: { value: string } }) => this.setState({ fSource: e.target.value }),
      clearFilters: () => this.setState({ fIndustry: "All industries", fStage: "All stages", fGrade: "All grades", fSource: "All sources", savedView: "All" }),
      detail,
      back: this.backTo,
      backLabel: VIEW_TITLES[S.view] ? (S.view === "dashboard" ? "dashboard" : VIEW_TITLES[S.view].toLowerCase()) : "prospects",
      openNext: () => sel && this.openNext(sel.id),
      openOutcome: (k: "Won" | "Lost") => sel && this.openOutcome(sel.id, k),
      setStage: (cid: string, stage: string) => (stage === "Won" || stage === "Lost" ? this.openOutcome(cid, stage) : this.act((db, ctx) => A.setStage(db, cid, stage as Stage, ctx))),
      toggleTask: (id: string) => this.toggleTask(id),
      deleteCompany: (cid: string) => {
        const c = companyOf(D, cid);
        if (!c) return;
        const n = (COMPANY_COLLECTIONS as readonly string[]).reduce((a, k) => a + (D as any)[k].filter((r: { companyId: string }) => r.companyId === cid).length, 0);
        const isClient = D.clients.some((x) => x.companyId === cid), hasOutcome = D.outcomes.some((x) => x.companyId === cid);
        if ((isClient || hasOutcome) && !this.confirm(`${c.name} has ${isClient ? "a CLIENT record (with its revenue)" : "a recorded " + (outcomeOf(D, cid)?.result || "") + " outcome"}. Deleting removes it from Clients, Analytics and won revenue. Continue?`)) return;
        if (!this.confirm(`Delete ${c.name} and all ${n} related records (research, contacts, assessments, outreach, tasks, meetings, proposals, activity)? This cannot be undone.`)) return;
        const r = this.run((db) => A.deleteCompany(db, cid));
        if (r.ok) {
          this.setState({ selId: null });
          this.notify("success", c.name + " deleted", [n + " related records removed — no orphans left."]);
        } else this.notify("error", r.errors[0], r.errors.slice(1));
      },
      genBrief: () => sel && this.setState({ briefFor: sel.id }),
      opps: oppRows,
      oppTotal: money(D.opportunities.filter((o) => activeIds.has(o.companyId)).reduce((a, o) => a + o.estValue, 0)),
      cadence,
      followUpsDue,
      dueCount: followUpsDue.length,
      noDue: followUpsDue.length === 0,
      allOutreach,
      noOutreach: allOutreach.length === 0,
      isBoard: S.pipeTab === "board",
      isProps: S.pipeTab === "props",
      setTabBoard: () => this.setState({ pipeTab: "board" }),
      setTabProps: () => this.setState({ pipeTab: "props" }),
      tabBoardBg: S.pipeTab === "board" ? "#0a0a0a" : "#fff",
      tabBoardFg: S.pipeTab === "board" ? "#fff" : "#2a2c31",
      tabPropsBg: S.pipeTab === "props" ? "#0a0a0a" : "#fff",
      tabPropsFg: S.pipeTab === "props" ? "#fff" : "#2a2c31",
      cols,
      allowDrop: (e: { preventDefault: () => void }) => e.preventDefault(),
      proposals,
      pTotal: money(openProps.reduce((a, p) => a + p.value, 0)),
      wTotal: money(weighted),
      wonTotal: money(D.proposals.filter((p) => p.status === "Accepted").reduce((a, p) => a + p.value, 0)),
      clientStats,
      clients,
      noClients: clients.length === 0,
      taskGroups,
      anGroups,
      convFunnel,
      breakdowns,
      tplCats,
      tpls,
      tplVars,
      planCounts,
      topProspects,
      outreachToday,
      noOutreachToday: outreachToday.length === 0,
      researchNeeded,
      noResearch: researchNeeded.length === 0,
      revenueOps,
      recommended,
      queue,
      queueSorts,
      queueCount: queue.length,
      oppTabOpps: S.oppTab === "opportunities",
      oppTabScanner: S.oppTab === "scanner",
      oppTabMatrix: S.oppTab === "matrix",
      oppTabs: ([["opportunities", "Opportunities"], ["scanner", "Digital Opportunity Scanner"], ["matrix", "Opportunity Matrix"]] as [string, string][]).map(([k, label]) => ({ label, current: S.oppTab === k, on: () => this.setState({ oppTab: k }), bg: S.oppTab === k ? "#0a0a0a" : "#fff", fg: S.oppTab === k ? "#fff" : "#2a2c31" })),
      scanCompanies,
      allScanned,
      noUnscanned: allScanned.length === 0,
      matrix,
      serviceTaxonomy,
      campaigns,
      unassignedCount: D.companies.filter((c) => !c.campaign).length,
      acqPerf,
      predictors,
      todayLabelReal: new Date(T + "T12:00:00").toLocaleDateString("en-ZA", { weekday: "long", day: "2-digit", month: "short", year: "numeric" }),
      planTabs,
      planRows,
      planEmpty: planRows.length === 0,
      planEmptyMsg,
      isWaitingTab: S.planTab === "waiting",
      isRiskTab: S.planTab === "risk",
      targets,
      // settings
      settingsRows: [
        { k: "Studio", v: "AX-Channels — digital systems studio" },
        { k: "Currency", v: "ZAR (R)" },
        { k: "Follow-up cadence", v: "Touch 2 +3d · Touch 3 +4d · Touch 4 +6d, then close the loop" },
        { k: "Dates", v: "Stored as ISO, shown as DD MMM YYYY · today is " + fdate(T) },
      ],
      settingsTargets: targetLabels.map(([k, label]) => ({ label, val: String(D.targets[k] ?? 0), on: (e: { target: { value: string } }) => this.act((db) => A.setTarget(db, k, e.target.value)) })),
      workspace: { active: S.env.active, hasDemo: !!ws.demo, hasLive: !!ws.live, liveCount: ws.live?.companies.length || 0, demoCount: ws.demo?.companies.length || 0 },
      switchWorkspace: this.switchWorkspace,
      resetDemo: this.resetDemo,
      clearDemo: this.clearDemo,
      exportData: this.exportData,
      importData: this.importData,
      research: { info, settings: S.env.settings.research, configFromFile: typeof window !== "undefined" && !!window.CAE_CONFIG?.researchProvider },
      saveResearchSettings: this.saveResearchSettings,
      diagnostics,
      integrity: integ,
      repairOrphans: () => this.confirm(`Remove ${integ.orphans.length} orphan record(s) that point at deleted prospects?`) && this.act((db) => ({ ok: true, db: removeOrphans(db) }), "Orphan records removed"),
      audit: S.audit ? "on" : "off",
      toggleAudit: () => this.setState((s) => ({ audit: !s.audit })),
      auditLabel: S.audit ? "On" : "Off",
      auditBg: S.audit ? "#0a0a0a" : "#fff",
      auditFg: S.audit ? "#fff" : "#2a2c31",
      runTest: this.runSelfTest,
      selfTest: S.selfTest,
    };
  }

  /** Tick a task. Tasks that stand for a record (follow-up touch, meeting) open the step that completes them instead. */
  toggleTask = (id: string) => {
    const t = this.db.tasks.find((x) => x.id === id);
    if (!t) return;
    const r = this.run((db, ctx) => A.toggleTask(db, id, ctx));
    if (r.ok) return;
    if (t.status !== "Done" && (isTouchFollowUp(t) || t.meetingId)) {
      this.open(t.companyId, this.taskFocus(t));
      this.notify("info", r.errors[0], []);
    } else this.notify("error", r.errors[0], r.errors.slice(1));
  };

  taskFocus(t: { title: string; type: string; outreachId: string | null; meetingId?: string | null }) {
    if (t.meetingId) return "discovery";
    if (t.outreachId) return t.outreachId.endsWith(":response") ? "response" : "followup";
    return ({ Research: "research", Outreach: "outreach", "Follow-up": "followup", Meeting: "discovery", Proposal: "proposal", Client: "outcome", Nurture: "outcome" } as Record<string, string>)[t.type] || "company";
  }
  openOutcome(cid: string, kind: "Won" | "Lost") {
    this.setState({ selId: cid, focus: "outcome", outcomeKind: kind, navOpen: false });
  }

  render() {
    const S = this.state;
    if (S.boot === "corrupt" && S.corrupt) return <Recovery c={S.corrupt} restore={this.restoreBackup} reset={this.resetAfterCorrupt} />;
    const v = this.renderVals();
    return (
      <>
        <Layout v={v} />
        {S.boot === "firstrun" ? <FirstRun choose={this.switchWorkspace} /> : null}
        {S.showAdd ? <AddProspectModal run={this.run} demo={S.env.active === "demo"} onClose={() => this.setState({ showAdd: false })} onAdded={(id) => this.setState({ showAdd: false, selId: id, focus: "research", outcomeKind: null })} /> : null}
        {S.scoreFor ? <ScoreModal db={this.db} cid={S.scoreFor} today={S.today} onClose={() => this.setState({ scoreFor: null })} /> : null}
        {S.responseFor ? <ResponseModal db={this.db} outreachId={S.responseFor} run={this.run} onClose={() => this.setState({ responseFor: null })} /> : null}
        {S.briefFor ? <BriefModal db={this.db} cid={S.briefFor} onClose={() => this.setState({ briefFor: null })} /> : null}
        {S.composer ? <ComposerModal key={S.composer.cid + (S.composer.outreachId || "") + (S.composer.variant || "")} db={this.db} cid={S.composer.cid} outreachId={S.composer.outreachId} variant={S.composer.variant} run={this.run} confirm={this.confirm} onClose={() => this.setState({ composer: null })} /> : null}
      </>
    );
  }
}

