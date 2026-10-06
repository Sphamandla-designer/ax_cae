// Response, score breakdown, add-prospect and brief dialogs.
import { useState } from "react";
import { LEAD_SOURCES, OUTCOME_NEXT, OUTREACH_OUTCOMES } from "../data/seed";
import type { Db } from "../data/types";
import * as A from "../domain/actions";
import {
  bestOpp,
  companyOf,
  contactsOf,
  currentResearch,
  dmOf,
  factOf,
  isValidScan,
  scansOf,
  sevRank,
  strategyOf,
} from "../domain/queries";
import { acq, researchCheck, REPLY_OUTCOMES } from "../domain/workflow";
import { fdate, money } from "../lib/format";
import { normalizeWebsite } from "../lib/url";
import { Badge, Button, C, Errors, Grid, KV, Modal, Notice, SelectInput, TextArea, TextInput } from "./ui";

type Run = (f: (db: Db, ctx: A.Ctx) => A.Result) => A.Result;

export function ResponseModal({
  db,
  outreachId,
  run,
  onClose,
}: {
  db: Db;
  outreachId: string;
  run: Run;
  onClose: () => void;
}) {
  const o = db.outreach.find((x) => x.id === outreachId);
  const [choice, setChoice] = useState(o && o.outcome && o.outcome !== "Sent" ? o.outcome : "");
  const [notes, setNotes] = useState(o?.responseNotes || "");
  const [errors, setErrors] = useState<string[]>([]);
  if (!o) return null;
  const c = companyOf(db, o.companyId);
  const options = (OUTREACH_OUTCOMES as string[]).filter((x) => x !== "Sent");
  const save = () => {
    const r = run((d0, ctx) => A.recordResponse(d0, o.id, choice, notes, ctx));
    if (!r.ok) return setErrors(r.errors);
    onClose();
  };
  return (
    <Modal
      title={`Record response · ${c?.name || ""}`}
      onClose={onClose}
      footer={
        <>
          <Button kind="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!choice}>
            Save response
          </Button>
        </>
      }
    >
      <div style={{ fontSize: "12.5px", color: C.greyDark, marginBottom: "10px" }}>
        Touch {o.touch} · {o.channel} · sent {fdate(o.dateSent)}
      </div>
      <div role="radiogroup" aria-label="What happened" style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {options.map((x) => (
          <button
            key={x}
            type="button"
            role="radio"
            aria-checked={choice === x}
            onClick={() => setChoice(x)}
            style={{
              border: "1px solid " + (choice === x ? C.navy : C.line),
              background: choice === x ? C.navy : "#fff",
              color: choice === x ? "#fff" : C.greyDark,
              borderRadius: "4px",
              padding: "6px 11px",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            {x}
          </button>
        ))}
      </div>
      <div style={{ marginTop: "12px" }}>
        <TextArea
          label="Response notes"
          required={REPLY_OUTCOMES.includes(choice)}
          value={notes}
          onChange={setNotes}
          rows={3}
          placeholder="What did they actually say?"
        />
      </div>
      {choice ? (
        <div style={{ marginTop: "10px" }}>
          <Notice
            kind="info"
            title={"Recommended next action: " + ((OUTCOME_NEXT as Record<string, string>)[choice] || "Follow up")}
          >
            {REPLY_OUTCOMES.includes(choice)
              ? "Saving closes the open follow-up for this touch and creates a task for the next action."
              : "This is not a reply — the follow-up cadence continues."}
          </Notice>
        </div>
      ) : null}
      <div style={{ marginTop: "10px" }}>
        <Errors errors={errors} />
      </div>
    </Modal>
  );
}

export function ScoreModal({ db, cid, today, onClose }: { db: Db; cid: string; today: string; onClose: () => void }) {
  const c = companyOf(db, cid);
  if (!c) return null;
  const a = acq(db, c, today);
  return (
    <Modal
      title={`Acquisition score · ${c.name}`}
      onClose={onClose}
      width={520}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {a.parts.map((p) => (
        <div key={p.label} style={{ padding: "7px 0", borderBottom: "1px solid " + C.lineSoft }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
            <span>{p.label}</span>
            <strong>
              {p.val}/{p.max}
            </strong>
          </div>
          <div
            style={{
              background: C.lineSoft,
              height: "5px",
              borderRadius: "2px",
              marginTop: "5px",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                width: Math.round((p.val / p.max) * 100) + "%",
                background: p.val / p.max >= 0.7 ? C.green : p.val / p.max >= 0.4 ? C.gold : C.red,
                borderRadius: "2px",
              }}
            />
          </div>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "12px" }}>
        <span style={{ fontFamily: C.serif, fontSize: "26px", fontWeight: 600 }}>{a.total}/100</span>
        <strong style={{ color: a.bandColor, textTransform: "uppercase", letterSpacing: ".08em", fontSize: "12px" }}>
          {a.band}
        </strong>
      </div>
      <div style={{ fontSize: "13px", color: C.greyDark, marginTop: "6px" }}>{a.reason}</div>
      <div style={{ fontSize: "11.5px", color: C.grey, marginTop: "8px" }}>
        Calculated from recorded data only: lead scores, the best opportunity, contacts, evidenced assessments, signals
        and recent activity.
      </div>
    </Modal>
  );
}

const INDUSTRIES = [
  "Mining",
  "Logistics",
  "Property",
  "Construction",
  "Technology",
  "Financial services",
  "Professional services",
  "Healthcare",
  "Retail",
  "Manufacturing",
  "Agriculture",
  "Education",
  "Hospitality",
  "Other",
];

export function AddProspectModal({
  run,
  demo,
  onClose,
  onAdded,
}: {
  run: Run;
  demo: boolean;
  onClose: () => void;
  onAdded: (id: string) => void;
}) {
  const [f, setF] = useState<A.CompanyInput>({
    name: "",
    website: "",
    industry: "",
    location: "",
    leadSource: "",
    contactName: "",
    contactTitle: "",
    email: "",
    description: "",
  });
  const [errors, setErrors] = useState<string[]>([]);
  const set = (k: keyof A.CompanyInput) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const site = f.website ? normalizeWebsite(f.website) : null;
  const save = () => {
    const r = run((d0, ctx) => A.addCompany(d0, f, ctx));
    if (!r.ok) return setErrors(r.errors);
    onAdded(r.id!);
  };
  return (
    <Modal
      title="Add prospect"
      onClose={onClose}
      footer={
        <>
          <Button kind="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save prospect</Button>
        </>
      }
    >
      {demo ? (
        <div style={{ marginBottom: "12px" }}>
          <Notice kind="warn" title="You are in the DEMO workspace">
            This prospect will be saved as demo data. Real companies belong in your live workspace (Settings →
            Workspace).
          </Notice>
        </div>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <TextInput
          label="Company name"
          required
          value={f.name}
          onChange={set("name")}
          placeholder="Registered or trading name"
        />
        <Grid cols={2}>
          <TextInput
            label="Website"
            value={f.website || ""}
            onChange={set("website")}
            placeholder="company.co.za"
            inputMode="url"
            hint={
              site ? (
                site.ok ? (
                  "Will be saved as " + site.url
                ) : (
                  <span style={{ color: C.red }}>{site.error}</span>
                )
              ) : (
                "Needed for research."
              )
            }
          />
          <TextInput
            label="Location"
            value={f.location || ""}
            onChange={set("location")}
            placeholder="Leave empty if unknown"
          />
          <SelectInput
            label="Industry"
            value={f.industry || ""}
            options={INDUSTRIES}
            placeholder="Unknown"
            onChange={set("industry")}
          />
          <SelectInput
            label="Lead source"
            value={f.leadSource || ""}
            options={LEAD_SOURCES as string[]}
            placeholder="Unknown"
            onChange={set("leadSource")}
          />
          <TextInput label="Contact name" value={f.contactName || ""} onChange={set("contactName")} />
          <TextInput label="Contact job title" value={f.contactTitle || ""} onChange={set("contactTitle")} />
          <TextInput
            label="Contact email"
            type="email"
            value={f.email || ""}
            onChange={set("email")}
            inputMode="email"
          />
        </Grid>
        <TextArea
          label="What you know so far"
          value={f.description || ""}
          onChange={set("description")}
          rows={2}
          placeholder="Saved as an unverified research note until you verify it"
        />
        <div style={{ fontSize: "11.5px", color: C.grey }}>
          Nothing is filled in for you. Unknown fields stay unknown until research confirms them. A contact added here
          is not a decision-maker until you mark them.
        </div>
        <Errors errors={errors} />
      </div>
    </Modal>
  );
}

/** Opportunity brief assembled from records only; missing items say so. */
export function BriefModal({ db, cid, onClose }: { db: Db; cid: string; onClose: () => void }) {
  const c = companyOf(db, cid);
  if (!c) return null;
  const r = currentResearch(db, cid);
  const ok = researchCheck(db, c).ok;
  const o = bestOpp(db, cid);
  const dm = dmOf(db, cid) || contactsOf(db, cid)[0] || null;
  const st = strategyOf(db, cid);
  const scans = scansOf(db, cid)
    .filter(isValidScan)
    .sort((a, b) => sevRank(b.severity) - sevRank(a.severity));
  const missing = (s: string) => <span style={{ color: C.red }}>{s}</span>;
  return (
    <Modal
      title={`Opportunity brief · ${c.name}`}
      onClose={onClose}
      width={720}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {c.isDemo ? (
        <Notice kind="info" title="Demo company — fictional">
          Not real research.
        </Notice>
      ) : null}
      <KV
        k="Company"
        v={
          ok ? (
            <>
              {factOf(r, "description")?.value}{" "}
              <Badge
                value={r?.mode === "demo" ? "DEMO" : r?.verification?.type === "manual" ? "Verified" : "Observed"}
              />
            </>
          ) : (
            missing("Research not complete — company context unverified")
          )
        }
      />
      <KV
        k="Profile"
        v={[c.industry || "Industry unknown", c.location || "Location unknown", c.size || "Size unknown"].join(" · ")}
      />
      <KV
        k="Observed problems"
        v={
          scans.length
            ? scans.map((s) => (
                <div key={s.id}>
                  {s.category}: {s.problem} — <em>{s.evidence}</em> <Badge value={s.isDemo ? "DEMO" : s.confidence} />
                </div>
              ))
            : missing("No evidenced assessments")
        }
      />
      <KV
        k="Business impact"
        v={o?.consequence ? o.consequence + " (your opportunity record)" : missing("Not recorded")}
      />
      <KV
        k="Opportunity"
        v={
          o
            ? `${o.type || o.service} — ${o.opportunity} · ${money(o.estValue)} · basis ${o.basis}`
            : missing("None recorded")
        }
      />
      <KV
        k="Decision-maker"
        v={
          dm
            ? `${dm.name} · ${dm.title}${dm.decisionMaker ? "" : " (not confirmed as decision-maker)"}`
            : missing("Not identified")
        }
      />
      <KV
        k="Strategy (hypothesis)"
        v={st ? [st.valueProposition, st.angle].filter(Boolean).join(" — ") : missing("No strategy yet")}
      />
      <KV
        k="About AX-Channels"
        v="We build digital infrastructure — systems that scale with the team and adapt to real users. (Our positioning, not a fact about the prospect.)"
      />
    </Modal>
  );
}
