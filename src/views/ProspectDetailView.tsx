// Prospect workspace: workflow rail → header → next best action → why / readiness → focused step.
import { STAGES } from "../data/seed";
import {
  bestOpp,
  completedResearch,
  currentResearch,
  dmOf,
  grade,
  oppScore,
  oppValueOf,
  score,
  signalsOf,
  strategyOf,
  whyOf,
} from "../domain/queries";
import {
  acq,
  completeness,
  readiness,
  researchCheck,
  stall,
  STATUS_COLORS,
  whyConfidence,
  whyNow,
} from "../domain/workflow";
import { fdate, fdatetime, money } from "../lib/format";
import type { VM } from "../vm";
import { Badge, Button, C, Card, Notice, eyebrow, labelStyle } from "./ui";
import AssessmentSection from "./workspace/AssessmentSection";
import CompanySection from "./workspace/CompanySection";
import ContactsSection from "./workspace/ContactsSection";
import DiscoverySection from "./workspace/DiscoverySection";
import { FOCUS_TITLES, STEP_INFO, type DetailModel } from "./workspace/model";
import OpportunitySection from "./workspace/OpportunitySection";
import OutcomeSection from "./workspace/OutcomeSection";
import OutreachSection from "./workspace/OutreachSection";
import PrioritySection from "./workspace/PrioritySection";
import ProposalSection from "./workspace/ProposalSection";
import ResearchSection from "./workspace/ResearchSection";
import StrategySection from "./workspace/StrategySection";

const GRADE_COLORS: Record<string, [string, string]> = {
  A: ["#0a0a0a", "#ffffff"],
  B: ["#e0176b", "#ffffff"],
  C: ["#e4e4e7", "#2a2c31"],
  "—": ["#efeff1", "#73767a"],
};

function Section({ d, onDelete }: { d: DetailModel; onDelete: () => void }) {
  switch (d.focus) {
    case "research":
      return <ResearchSection d={d} />;
    case "assessment":
      return <AssessmentSection d={d} />;
    case "opportunity":
      return <OpportunitySection d={d} />;
    case "contacts":
      return <ContactsSection d={d} />;
    case "prioritize":
      return <PrioritySection d={d} />;
    case "strategy":
      return <StrategySection d={d} />;
    case "outreach":
    case "followup":
    case "response":
      return <OutreachSection d={d} mode={d.focus} />;
    case "discovery":
      return <DiscoverySection d={d} />;
    case "proposal":
      return <ProposalSection d={d} />;
    case "outcome":
      return <OutcomeSection d={d} />;
    default:
      return <CompanySection d={d} onDelete={onDelete} />;
  }
}

export default function ProspectDetailView({ v }: { v: VM }) {
  const d = v.detail as DetailModel;
  const { c, db, today } = d;
  const s = score(c),
    g = grade(s),
    [gBg, gFg] = GRADE_COLORS[g];
  const a = acq(db, c, today);
  const r = readiness(db, c);
  const st = stall(c, today, db);
  const bo = bestOpp(db, c.id);
  const comp = completeness(db, c);
  const why = whyOf(db, c.id);
  const wc = whyConfidence(db, c);
  const wn = whyNow(db, c.id);
  // The research the rest of the workflow stands on: the latest completed version (a refresh draft is still being reviewed).
  const research = completedResearch(db, c.id) || currentResearch(db, c.id);
  const strategy = strategyOf(db, c.id);
  const cur = d.steps.find((x) => x.key === d.focus) || d.steps[0];
  const [cfg, cbg] = STATUS_COLORS[cur.status];
  const closed = c.stage === "Won" || c.stage === "Lost";
  const meta = [
    c.industry || "Industry unknown",
    c.subIndustry,
    c.location || "Location unknown",
    c.size ? c.size + " staff" : "",
    c.website.replace(/^https:\/\//, ""),
  ]
    .filter(Boolean)
    .join(" · ");
  const dm = dmOf(db, c.id);
  const tasks = db.tasks
    .filter((t) => t.companyId === c.id && t.status !== "Done")
    .sort((x, y) => x.due.localeCompare(y.due));
  const acts = db.activities.filter((x) => x.companyId === c.id).slice(0, 25);
  const verified = researchCheck(db, c).ok;
  const whyRows: [string, string, string | null][] = [
    [
      "Primary opportunity",
      bo ? `${bo.type || bo.service} — ${bo.opportunity}` : "Unknown — no opportunity recorded",
      bo ? bo.basis : null,
    ],
    ["Potential value", bo ? money(bo.estValue) : "Unknown", null],
    ["Why now?", wn.text, wn.conf],
    ["Decision-maker", dm ? `${dm.name} · ${dm.title}` : "Not identified", null],
    [
      "Company",
      verified ? c.description || "—" : "Unverified — research incomplete",
      verified
        ? research?.mode === "demo"
          ? "DEMO"
          : research?.verification?.type === "manual"
            ? "Verified"
            : research?.facts.find((f) => f.field === "description")?.confidence || "Indicated"
        : null,
    ],
    ["Recommended approach", strategy?.angle || "No strategy yet", strategy ? "Hypothesis" : null],
  ];

  return (
    <div className="cae-detail">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "14px",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={v.back}
          style={{
            fontSize: "12.5px",
            color: C.gold,
            cursor: "pointer",
            background: "none",
            border: "none",
            padding: 0,
            fontFamily: "inherit",
          }}
        >
          ← Back to {v.backLabel}
        </button>
        {!closed ? (
          <div style={{ display: "flex", gap: "8px" }}>
            <Button
              small
              kind="secondary"
              style={{ color: C.green, borderColor: C.green }}
              onClick={() => v.openOutcome("Won")}
            >
              Mark won
            </Button>
            <Button small kind="secondary" onClick={() => v.openOutcome("Lost")}>
              Mark lost
            </Button>
          </div>
        ) : null}
      </div>

      {c.isDemo ? (
        <div style={{ marginBottom: "14px" }}>
          <Notice kind="info" title="DEMO PROSPECT — fictional data">
            Nothing here is real research. Switch to your live workspace in Settings for real prospects.
          </Notice>
        </div>
      ) : null}

      <Card
        title="Acquisition workflow"
        aside={
          <span style={{ fontSize: "11.5px", color: C.grey }}>
            Complete · In progress · Ready · Locked · Blocked — any stage can be opened
          </span>
        }
        style={{ marginBottom: "14px" }}
      >
        <nav aria-label="Acquisition workflow" style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {d.steps.map((x) => {
            const [fg, bg, border] = STATUS_COLORS[x.status];
            const active = x.key === d.focus;
            return (
              <button
                key={x.key}
                type="button"
                aria-current={active ? "step" : undefined}
                onClick={() => d.setFocus(x.key)}
                className="hover-border-a8863d"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "7px 11px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  border: "1px solid " + (active ? C.gold : border),
                  background: bg,
                  boxShadow: active ? "0 0 0 1px " + C.gold : "none",
                  fontFamily: "inherit",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: "17px",
                    height: "17px",
                    borderRadius: "9px",
                    background: fg,
                    color: "#fff",
                    fontSize: "9.5px",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: "none",
                  }}
                >
                  {x.status === "COMPLETE" ? "✓" : x.status === "BLOCKED" ? "!" : x.n}
                </span>
                <span style={{ fontSize: "12px", fontWeight: 600, color: fg }}>
                  {x.n}. {x.name}
                </span>
                <span
                  style={{
                    fontSize: "8.5px",
                    letterSpacing: ".08em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    color: fg,
                    opacity: 0.8,
                  }}
                >
                  {x.status}
                </span>
              </button>
            );
          })}
        </nav>
      </Card>

      {st ? (
        <div style={{ marginBottom: "14px" }}>
          <Notice
            kind="error"
            title={`⚠ Stalled for ${st.days} days in ${c.stage} (threshold ${st.threshold} days)`}
            actions={
              <Button small onClick={v.openNext}>
                Take action: {d.nba.label}
              </Button>
            }
          />
        </div>
      ) : null}

      <div
        className="cae-head"
        style={{
          background: "#fff",
          border: "1px solid " + C.line,
          borderRadius: "12px",
          padding: "20px 22px",
          display: "flex",
          alignItems: "center",
          gap: "18px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1", minWidth: "220px" }}>
          <h2 style={{ fontFamily: C.serif, fontSize: "26px", fontWeight: 600, margin: 0 }}>{c.name}</h2>
          <div style={{ fontSize: "12.5px", color: C.grey, marginTop: "4px", overflowWrap: "anywhere" }}>{meta}</div>
        </div>
        <button
          type="button"
          onClick={d.openScore}
          title="How was this calculated?"
          style={{
            textAlign: "center",
            cursor: "pointer",
            background: a.bandBg,
            borderRadius: "10px",
            padding: "10px 16px",
            border: "none",
            fontFamily: "inherit",
          }}
        >
          <div
            style={{
              fontSize: "10px",
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: a.bandColor,
              fontWeight: 700,
            }}
          >
            Acquisition score
          </div>
          <div style={{ fontFamily: C.serif, fontSize: "28px", fontWeight: 600, marginTop: "2px", color: a.bandColor }}>
            {a.total}
            <span style={{ fontSize: "14px" }}>/100</span>
          </div>
          <div
            style={{
              fontSize: "10px",
              letterSpacing: ".08em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: a.bandColor,
            }}
          >
            {a.band} · why?
          </div>
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ ...labelStyle, fontWeight: 600 }}>Opportunity value</div>
          <div style={{ fontFamily: C.serif, fontSize: "20px", fontWeight: 600, marginTop: "6px" }}>
            {oppValueOf(db, c.id) ? money(oppValueOf(db, c.id)) : "Not estimated"}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ ...labelStyle, fontWeight: 600 }}>Lead score</div>
          <div
            style={{ display: "flex", alignItems: "center", gap: "7px", marginTop: "5px", justifyContent: "center" }}
          >
            <span
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "999px",
                background: gBg,
                color: gFg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              {g}
            </span>
            <span style={{ fontFamily: C.serif, fontSize: "20px", fontWeight: 600 }}>
              {s}
              <span style={{ fontSize: "13px", color: C.grey }}>/25</span>
            </span>
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ ...labelStyle, fontWeight: 600 }}>Opportunity score</div>
          <div style={{ fontFamily: C.serif, fontSize: "20px", fontWeight: 600, marginTop: "6px" }}>
            {bo ? oppScore(bo) : 0}
            <span style={{ fontSize: "13px", color: C.grey }}>/25</span>
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <label htmlFor="cae-stage" style={{ ...labelStyle, fontWeight: 600 }}>
            Stage
          </label>
          {closed ? (
            <div
              style={{
                marginTop: "8px",
                fontSize: "13px",
                fontWeight: 700,
                color: c.stage === "Won" ? C.green : C.red,
              }}
            >
              {c.stage}
            </div>
          ) : (
            <select
              id="cae-stage"
              value={c.stage}
              onChange={(e) => v.setStage(c.id, e.target.value)}
              style={{
                display: "block",
                marginTop: "6px",
                border: "1px solid " + C.line,
                borderRadius: "8px",
                padding: "6px 10px",
                fontSize: "12.5px",
                background: C.paper,
                color: C.ink,
              }}
            >
              {(STAGES as string[]).map((o) => (
                <option key={o} value={o}>
                  {o === "Won" || o === "Lost" ? o + " (record outcome)" : o}
                </option>
              ))}
            </select>
          )}
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ ...labelStyle, fontWeight: 600 }}>Priority</div>
          <div
            style={{
              marginTop: "8px",
              fontSize: "12px",
              fontWeight: 600,
              color: c.priority === "High" ? C.red : c.priority === "Medium" ? C.gold : C.grey,
            }}
          >
            {c.priority}
          </div>
        </div>
      </div>

      <div
        className="cae-nba"
        style={{
          background: C.navy,
          borderRadius: "12px",
          marginTop: "14px",
          padding: "16px 22px",
          display: "flex",
          alignItems: "center",
          gap: "18px",
          color: "#fff",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1", minWidth: "220px" }}>
          <div
            style={{
              fontSize: "10px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: C.gold,
              fontWeight: 700,
            }}
          >
            Next best action
          </div>
          <div style={{ fontFamily: C.serif, fontSize: "21px", fontWeight: 600, marginTop: "4px" }}>{d.nba.label}</div>
          <div style={{ fontSize: "12px", color: "rgba(255,255,255,.6)", marginTop: "3px" }}>{d.nba.why}</div>
        </div>
        <div
          style={{
            fontSize: "12.5px",
            color:
              c.nextAction.due && c.nextAction.due < today ? "#e08e85" : c.nextAction.due === today ? "#f2b84b" : "rgba(255,255,255,.6)",
          }}
        >
          {!c.nextAction.due
            ? "No date — waiting"
            : c.nextAction.due === today
              ? "Due today"
              : c.nextAction.due < today
                ? "Overdue since " + fdate(c.nextAction.due)
                : "Due " + fdate(c.nextAction.due)}
        </div>
        <Button kind="gold" onClick={v.openNext}>
          {d.nba.label} →
        </Button>
      </div>

      <div
        className="cae-split"
        style={{
          display: "grid",
          gridTemplateColumns: "1.7fr 1fr",
          gap: "16px",
          marginTop: "16px",
          alignItems: "start",
        }}
      >
        <section
          style={{
            background: "#fff",
            border: "2px solid " + C.navy,
            borderRadius: "12px",
            padding: "18px 22px",
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <h3 style={{ fontFamily: C.serif, fontSize: "19px", fontWeight: 600, margin: 0 }}>Why this prospect?</h3>
            <span style={{ display: "flex", gap: "10px", alignItems: "baseline" }}>
              <span
                style={{
                  fontSize: "10.5px",
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  color: wc.fg,
                }}
              >
                Confidence: {wc.label}
              </span>
              <span
                style={{
                  fontSize: "10.5px",
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: a.bandColor,
                  fontWeight: 700,
                }}
              >
                {a.band} · {a.total}/100
              </span>
            </span>
          </div>
          {wc.insufficient || !verified ? (
            <div style={{ marginTop: "10px" }}>
              <Notice kind="error" title="Insufficient evidence — research required.">
                Only recorded evidence is shown below; nothing is inferred.
              </Notice>
            </div>
          ) : null}
          {why && c.isDemo ? (
            <div style={{ fontSize: "14px", lineHeight: 1.6, marginTop: "10px" }}>
              {why.why} <Badge value="DEMO" />
            </div>
          ) : null}
          <div
            className="cae-grid cae-grid-2"
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginTop: "14px" }}
          >
            {whyRows.map(([k, val, badge]) => (
              <div key={k}>
                <div
                  style={{
                    fontSize: "10px",
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                    color: C.gold,
                    fontWeight: 700,
                  }}
                >
                  {k}
                </div>
                <div style={{ fontSize: "13.5px", marginTop: "4px", overflowWrap: "anywhere" }}>
                  {val} {badge ? <Badge value={c.isDemo && badge !== "Hypothesis" ? "DEMO" : badge} /> : null}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
              marginTop: "16px",
              borderTop: "1px solid " + C.lineSoft,
              paddingTop: "12px",
            }}
          >
            <span style={{ ...labelStyle, width: "100%" }}>Why now · signals</span>
            {signalsOf(db, c.id).map((x) => (
              <span
                key={x.id}
                style={{
                  display: "inline-flex",
                  gap: "7px",
                  alignItems: "center",
                  fontSize: "11.5px",
                  background: C.navy,
                  color: "#fff",
                  borderRadius: "999px",
                  padding: "4px 9px",
                }}
              >
                {x.label}{" "}
                <span
                  style={{
                    fontSize: "9.5px",
                    letterSpacing: ".06em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    color:
                      x.confidence === "Observed" ? "#8fd1b3" : x.confidence === "Indicated" ? "#f2b84b" : "#e08e85",
                  }}
                >
                  {c.isDemo ? "demo" : x.confidence}
                </span>
              </span>
            ))}
            {signalsOf(db, c.id).length === 0 ? (
              <span style={{ fontSize: "12.5px", color: "#9a9ca3" }}>
                No signals recorded — add them under Company.
              </span>
            ) : null}
          </div>
        </section>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 }}>
          <section
            style={{
              background: "#fff",
              border: "2px solid " + (r.ready ? C.green : C.red),
              borderRadius: "12px",
              padding: "16px 20px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h3 style={{ ...eyebrow, margin: 0 }}>Action readiness</h3>
              <span
                style={{
                  fontFamily: C.serif,
                  fontSize: "22px",
                  fontWeight: 600,
                  color: r.pct === 100 ? C.green : r.pct >= 60 ? C.gold : C.red,
                }}
              >
                {r.pct}%
              </span>
            </div>
            <div
              style={{
                fontSize: "11.5px",
                letterSpacing: ".1em",
                textTransform: "uppercase",
                fontWeight: 700,
                color: r.ready ? C.green : C.red,
                background: r.ready ? C.greenBg : C.redBg,
                borderRadius: "999px",
                padding: "6px 10px",
                marginTop: "10px",
                textAlign: "center",
              }}
            >
              {r.ready ? "Ready for outreach" : r.blocked ? "Not ready — " + r.reason : "Not ready"}
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }}>
              {r.items.map((x) => (
                <li key={x.k} style={{ borderBottom: "1px solid " + C.lineSoft }}>
                  <button
                    type="button"
                    onClick={() => d.setFocus(x.target)}
                    className="hover-color-a8863d"
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "center",
                      width: "100%",
                      fontSize: "12.5px",
                      padding: "5px 0",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                      color: C.greyDark,
                      fontFamily: "inherit",
                    }}
                  >
                    <span style={{ color: x.ok ? C.green : C.red, fontWeight: 700 }}>{x.ok ? "☑" : "☐"}</span>
                    <span>{x.k}</span>
                    <span className="sr-only">{x.ok ? "(done)" : "(missing)"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section
            style={{ background: "#fff", border: "1px solid " + C.line, borderRadius: "12px", padding: "16px 20px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h3 style={{ ...eyebrow, margin: 0 }}>Profile completeness</h3>
              <span
                style={{
                  fontFamily: C.serif,
                  fontSize: "22px",
                  fontWeight: 600,
                  color: comp.pct >= 80 ? C.green : comp.pct >= 50 ? C.gold : C.red,
                }}
              >
                {comp.pct}%
              </span>
            </div>
            {comp.checks.map((x) => (
              <div
                key={x.k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "8px",
                  fontSize: "12.5px",
                  padding: "5px 0",
                  borderBottom: "1px solid " + C.lineSoft,
                }}
              >
                <span style={{ color: C.greyDark }}>
                  {x.k}{" "}
                  <span style={{ fontSize: "10px", color: C.grey }}>{x.required ? "required" : "recommended"}</span>
                </span>
                <span style={{ fontWeight: 700, color: x.ok ? C.green : C.red }}>{x.ok ? "✓" : "missing"}</span>
              </div>
            ))}
          </section>
        </div>
      </div>

      <div
        className="cae-split"
        style={{
          display: "grid",
          gridTemplateColumns: "1.7fr 1fr",
          gap: "16px",
          marginTop: "16px",
          alignItems: "start",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 }}>
          <div
            id="cae-workspace"
            tabIndex={-1}
            style={{ background: C.navy, borderRadius: "12px", padding: "12px 18px", color: "#fff", outline: "none" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: "10px",
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: C.gold,
                  fontWeight: 700,
                }}
              >
                Workspace
              </span>
              <h3 style={{ fontFamily: C.serif, fontSize: "17px", fontWeight: 600, flex: 1, margin: 0 }}>
                {FOCUS_TITLES[d.focus] || "Workspace"}
              </h3>
              <span
                style={{
                  fontSize: "9.5px",
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  color: cfg,
                  background: cbg,
                  borderRadius: "999px",
                  padding: "4px 9px",
                }}
              >
                {cur.status}
              </span>
            </div>
            {STEP_INFO[d.focus] ? (
              <div style={{ fontSize: "12px", color: "rgba(255,255,255,.75)", marginTop: "6px", lineHeight: 1.5 }}>
                {STEP_INFO[d.focus].what}{" "}
                <span style={{ color: "rgba(255,255,255,.55)" }}>{STEP_INFO[d.focus].why}</span>
              </div>
            ) : null}
            {cur.missing.length && cur.status !== "COMPLETE" ? (
              <div style={{ fontSize: "12px", color: "#f2b84b", marginTop: "6px" }}>
                Required to complete: {cur.missing.join(" · ")}
              </div>
            ) : null}
            {cur.status === "LOCKED" ? (
              <div style={{ fontSize: "12px", color: "#e8a49c", marginTop: "4px" }}>
                ⚠ Earlier steps are unfinished — you can still work here, but they come first.
              </div>
            ) : null}
          </div>
          <Section
            key={c.id + ":" + d.focus + ":" + (d.outcomeKind || "")}
            d={d}
            onDelete={() => v.deleteCompany(c.id)}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 }}>
          <section style={{ background: "#fff", border: "1px solid " + C.line, borderRadius: "12px" }}>
            <h3 style={{ ...eyebrow, margin: 0, padding: "14px 20px", borderBottom: "1px solid " + C.lineSoft }}>
              Open tasks
            </h3>
            {tasks.map((t) => (
              <label
                key={t.id}
                style={{
                  display: "flex",
                  gap: "10px",
                  alignItems: "center",
                  padding: "10px 20px",
                  borderBottom: "1px solid " + C.lineSoft,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  onChange={() => v.toggleTask(t.id)}
                  checked={false}
                  style={{ width: "16px", height: "16px", accentColor: C.navy, flex: "none" }}
                />
                <span style={{ flex: 1, fontSize: "13px" }}>{t.title}</span>
                <span
                  style={{
                    fontSize: "11px",
                    color: t.due < today ? C.red : t.due === today ? C.gold : C.grey,
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.due === today ? "Today" : t.due < today ? "Overdue" : fdate(t.due)}
                </span>
              </label>
            ))}
            {tasks.length === 0 ? (
              <div style={{ padding: "12px 20px", fontSize: "12.5px", color: C.grey }}>No open tasks.</div>
            ) : null}
          </section>
          <section style={{ background: "#fff", border: "1px solid " + C.line, borderRadius: "12px" }}>
            <h3 style={{ ...eyebrow, margin: 0, padding: "14px 20px", borderBottom: "1px solid " + C.lineSoft }}>
              Activity timeline
            </h3>
            {acts.map((x) => (
              <div key={x.id} style={{ padding: "10px 20px", borderBottom: "1px solid " + C.lineSoft }}>
                <div
                  style={{
                    fontSize: "10px",
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                    color: C.grey,
                    fontWeight: 600,
                  }}
                >
                  {x.kind} · {fdatetime(x.ts)}
                </div>
                <div style={{ fontSize: "12.5px", marginTop: "3px", color: C.greyDark }}>{x.text}</div>
              </div>
            ))}
            {acts.length === 0 ? (
              <div style={{ padding: "12px 20px", fontSize: "12.5px", color: C.grey }}>No activity yet.</div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
