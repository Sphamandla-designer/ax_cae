import { useState } from "react";
import type { Opportunity } from "../../data/types";
import * as A from "../../domain/actions";
import { isValidOpportunity, oppScore, oppsOf, scansOf } from "../../domain/queries";
import { quadrant } from "../../domain/workflow";
import { money } from "../../lib/format";
import { Actions, Badge, Button, C, Card, Check, Empty, Errors, Grid, Notice, SelectInput, TextArea, TextInput, labelStyle } from "../ui";
import type { DetailModel } from "./model";

const blank = (): A.OpportunityInput => ({
  problems: "",
  consequence: "",
  opportunity: "",
  type: "",
  estValue: "",
  complexity: "Low",
  severity: 3,
  impact: 3,
  likelihood: 3,
  fit: 3,
  evidenceScanIds: [],
  evidenceNote: "",
  confirmAssumption: false,
});
const fromOpp = (o: Opportunity): A.OpportunityInput => ({
  problems: o.problems.join(", "),
  consequence: o.consequence,
  opportunity: o.opportunity,
  type: o.type || o.service,
  estValue: String(o.estValue || ""),
  complexity: o.complexity || "Low",
  severity: o.scores.severity,
  impact: o.scores.impact,
  likelihood: o.scores.likelihood,
  fit: o.scores.fit,
  evidenceScanIds: o.evidenceScanIds,
  evidenceNote: o.evidenceNote,
  confirmAssumption: o.basis === "Assumption",
});
const SCALE = ["1", "2", "3", "4", "5"];

export default function OpportunitySection({ d }: { d: DetailModel }) {
  const { c, db } = d;
  const opps = oppsOf(db, c.id).slice().sort((a, b) => oppScore(b) - oppScore(a));
  const scans = scansOf(db, c.id);
  const [editId, setEditId] = useState<string | null>(opps.length ? null : "new");
  // A new opportunity starts linked to the observed assessments (untick any that do not apply).
  const [f, setF] = useState<A.OpportunityInput>(() => ({ ...blank(), evidenceScanIds: scans.filter((s) => s.confidence === "Observed").map((s) => s.id) }));
  const [errors, setErrors] = useState<string[]>([]);
  const set = <K extends keyof A.OpportunityInput>(k: K) => (v: A.OpportunityInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const linked = scans.filter((s) => f.evidenceScanIds.includes(s.id));
  const basis = linked.some((s) => s.confidence === "Observed") ? "Observed" : linked.length ? "Indicated" : "Assumption";
  const save = () => {
    const r = d.run((db0, ctx) => A.saveOpportunity(db0, c.id, f, ctx, editId && editId !== "new" ? editId : undefined));
    if (!r.ok) return setErrors(r.errors);
    setErrors([]);
    setEditId(null);
  };
  const edit = (o: Opportunity | null) => {
    setF(o ? fromOpp(o) : { ...blank(), evidenceScanIds: scans.filter((s) => s.confidence === "Observed").map((s) => s.id) });
    setErrors([]);
    setEditId(o ? o.id : "new");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <Card title="Opportunities" aside={editId ? null : <Button small onClick={() => edit(null)}>Add opportunity</Button>}>
        {opps.length === 0 && !editId ? <Empty>No opportunity yet. Base it on the assessment evidence.</Empty> : null}
        {opps.map((o) => {
          const ev = scans.filter((s) => o.evidenceScanIds.includes(s.id));
          return (
            <div key={o.id} style={{ borderBottom: "1px solid " + C.lineSoft, padding: "10px 0" }}>
              <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                <strong style={{ fontSize: "14px" }}>{o.type || o.service}</strong>
                <span style={{ fontSize: "12px", color: C.grey }}>{o.group}</span>
                <Badge value={o.isDemo ? "DEMO" : o.basis} title={"Evidence basis: " + o.basis} />
                <Badge value={quadrant(o)} title="Opportunity matrix quadrant" />
                {!isValidOpportunity(o) ? <Badge value="Incomplete" title="Missing problem, service, value or evidence" /> : null}
                <span style={{ flex: 1 }} />
                <span style={{ fontFamily: C.serif, fontSize: "15px", fontWeight: 600 }}>{money(o.estValue)}</span>
                <Button small kind="secondary" onClick={() => edit(o)}>
                  Edit
                </Button>
              </div>
              <div style={{ fontSize: "13px", marginTop: "5px" }}>{o.opportunity}</div>
              <div style={{ fontSize: "12.5px", color: C.greyDark, marginTop: "3px" }}>
                <strong>Problem:</strong> {o.problems.join(", ") || "—"} · <strong>Consequence:</strong> {o.consequence || <em style={{ color: C.red }}>not recorded</em>}
              </div>
              <div style={{ fontSize: "12px", color: C.grey, marginTop: "3px" }}>
                Score {oppScore(o)}/25 · complexity {o.complexity} · likelihood {o.scores.likelihood}/5 · evidence:{" "}
                {ev.length ? ev.map((s) => s.category + " (" + s.confidence + ")").join(", ") : o.evidenceNote || "none"}
              </div>
              {o.basis === "Assumption" ? <div style={{ fontSize: "12px", color: C.redDark, fontWeight: 600, marginTop: "4px" }}>Assumption — validate during discovery.</div> : null}
              <Actions style={{ marginTop: "6px" }}>
                <Button small kind="secondary" onClick={() => d.setFocus("strategy")}>
                  Create strategy →
                </Button>
                <Button small kind="secondary" onClick={() => d.setFocus("outreach")}>
                  Prepare outreach →
                </Button>
              </Actions>
            </div>
          );
        })}
      </Card>

      {editId ? (
        <Card title={editId === "new" ? "Add opportunity" : "Edit opportunity"}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <TextInput label="Problem(s)" required value={f.problems} onChange={set("problems")} placeholder="Comma-separated, e.g. No customer portal, Manual quoting" />
            <TextInput label="Business consequence" required value={f.consequence} onChange={set("consequence")} placeholder="What the problem costs them" />
            <TextArea label="Opportunity" required value={f.opportunity} onChange={set("opportunity")} rows={2} placeholder="What AX-Channels would build, and what it fixes" />
            <Grid cols={3}>
              <SelectInput label="Recommended service" required value={f.type} options={A.OPP_TYPES} placeholder="Choose…" onChange={set("type")} />
              <TextInput label="Estimated value (ZAR)" required value={f.estValue} onChange={set("estValue")} placeholder="180000" inputMode="numeric" />
              <SelectInput label="Complexity" required value={f.complexity} options={["Low", "High"]} onChange={set("complexity")} />
            </Grid>
            <Grid cols={4}>
              <SelectInput label="Severity" value={String(f.severity)} options={SCALE} onChange={(v) => set("severity")(Number(v))} />
              <SelectInput label="Impact" value={String(f.impact)} options={SCALE} onChange={(v) => set("impact")(Number(v))} />
              <SelectInput label="Likelihood" value={String(f.likelihood)} options={SCALE} onChange={(v) => set("likelihood")(Number(v))} />
              <SelectInput label="Service fit" value={String(f.fit)} options={SCALE} onChange={(v) => set("fit")(Number(v))} />
            </Grid>
            <div>
              <div style={labelStyle}>
                Evidence <span style={{ color: C.red }}>Required</span>
              </div>
              {scans.length ? (
                scans.map((s) => (
                  <label key={s.id} style={{ display: "flex", gap: "8px", alignItems: "flex-start", fontSize: "12.5px", padding: "4px 0", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={f.evidenceScanIds.includes(s.id)}
                      onChange={(e) => set("evidenceScanIds")(e.target.checked ? [...f.evidenceScanIds, s.id] : f.evidenceScanIds.filter((x) => x !== s.id))}
                      style={{ marginTop: "2px", accentColor: C.navy }}
                    />
                    <span>
                      {s.category}: {s.problem} <Badge value={s.confidence} />
                    </span>
                  </label>
                ))
              ) : (
                <div style={{ fontSize: "12.5px", color: C.grey, marginTop: "4px" }}>No assessments to link yet — record them in Digital assessment, or describe the evidence below.</div>
              )}
              <TextInput label="Other evidence" value={f.evidenceNote} onChange={set("evidenceNote")} placeholder="e.g. Raised by the MD on a call (date)" />
            </div>
            <div style={{ fontSize: "12.5px" }}>
              Evidence basis: <Badge value={basis} />
              {basis === "Assumption" ? <span style={{ color: C.redDark, marginLeft: "6px", fontWeight: 600 }}>Assumption — validate during discovery.</span> : null}
            </div>
            {basis === "Assumption" ? (
              <Check label="Based on assumptions — validate during discovery" hint="Required to save an assumption-only opportunity worth R250 000 or more." checked={!!f.confirmAssumption} onChange={(v) => set("confirmAssumption")(v)} />
            ) : null}
            <Errors errors={errors} />
            <Actions style={{ marginTop: 0 }}>
              <Button onClick={save}>{editId === "new" ? "Add opportunity" : "Save opportunity"}</Button>
              <Button kind="secondary" onClick={() => (setEditId(null), setErrors([]))}>
                Cancel
              </Button>
            </Actions>
          </div>
        </Card>
      ) : null}
      {!scans.length && !opps.length ? (
        <Notice kind="warn" title="No assessment evidence yet">
          Opportunities should come from evidence. <button type="button" onClick={() => d.setFocus("assessment")} style={{ background: "none", border: "none", color: C.gold, textDecoration: "underline", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>Add an assessment first</button>.
        </Notice>
      ) : null}
    </div>
  );
}
