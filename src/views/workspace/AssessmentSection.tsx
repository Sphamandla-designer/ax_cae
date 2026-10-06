import { useState } from "react";
import { SCAN_CATEGORIES, SCAN_STATUSES, SEVERITIES } from "../../data/seed";
import type { Confidence } from "../../data/types";
import * as A from "../../domain/actions";
import { isValidScan, scansOf, sevRank } from "../../domain/queries";
import { dxConfidence, dxDims, dxScore, MIN_SCANS } from "../../domain/workflow";
import { fdate } from "../../lib/format";
import { Actions, Badge, Button, C, Card, Empty, Errors, ExtLink, Grid, Notice, SelectInput, TextArea, TextInput, labelStyle } from "../ui";
import type { DetailModel } from "./model";

const blank = (): A.ScanInput => ({ category: "", status: "", severity: "Medium", problem: "", evidence: "", confidence: "Assumption", source: "", opportunity: "", impact: "" });

export default function AssessmentSection({ d }: { d: DetailModel }) {
  const { c, db } = d;
  const scans = scansOf(db, c.id).slice().sort((a, b) => sevRank(b.severity) - sevRank(a.severity));
  const valid = scans.filter(isValidScan);
  const [adding, setAdding] = useState(scans.length === 0);
  const [f, setF] = useState<A.ScanInput>(blank);
  const [errors, setErrors] = useState<string[]>([]);
  const set = (k: keyof A.ScanInput) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const dx = dxScore(db, c.id);
  const conf = dxConfidence(db, c.id);
  const save = () => {
    const r = d.run((db0, ctx) => A.addScan(db0, c.id, f, ctx));
    if (!r.ok) return setErrors(r.errors);
    setErrors([]);
    setF(blank());
    setAdding(false);
  };
  const remove = (id: string) => {
    if (!d.confirm("Remove this assessment? Opportunities that cite it will lose it as evidence.")) return;
    const r = d.run((db0, ctx) => A.deleteScan(db0, id, ctx));
    if (!r.ok) setErrors(r.errors);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <Card title="Digital experience score" aside={<span style={{ fontSize: "12px", color: conf.fg, fontWeight: 700 }}>Assessment confidence: {conf.label}</span>}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
          <span style={{ fontFamily: C.serif, fontSize: "28px", fontWeight: 600 }}>{dx === null ? "—" : dx}</span>
          <span style={{ fontSize: "13px", color: C.grey }}>{dx === null ? "Not scored — nothing assessed yet" : `/100 · based on ${conf.n} of ${conf.total} assessed dimensions`}</span>
        </div>
        <Grid cols={4}>
          {dxDims(db, c.id).map((x) => (
            <div key={x.dim} style={{ fontSize: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: C.greyDark }}>
                <span>{x.dim}</span>
                <strong>{x.assessed ? x.val : "Not assessed"}</strong>
              </div>
              <div style={{ background: C.lineSoft, height: "4px", borderRadius: "2px", marginTop: "4px", position: "relative" }}>
                {x.assessed ? <div style={{ position: "absolute", inset: 0, width: x.val + "%", background: (x.val as number) < 40 ? C.red : (x.val as number) < 70 ? C.gold : C.green, borderRadius: "2px" }} /> : null}
              </div>
            </div>
          ))}
        </Grid>
        <div style={{ fontSize: "12px", color: C.grey, marginTop: "10px" }}>
          {valid.length} of {MIN_SCANS} evidenced assessments recorded{valid.length >= MIN_SCANS ? " — step complete." : "."}
          {scans.length > valid.length ? ` ${scans.length - valid.length} assessment(s) lack evidence or a source and do not count.` : ""}
        </div>
      </Card>

      <Card title="Assessments" aside={!adding ? <Button small onClick={() => setAdding(true)}>Add assessment</Button> : null}>
        {scans.length === 0 && !adding ? <Empty>No assessments yet. Inspect their website and record what you see, with evidence.</Empty> : null}
        {scans.map((s) => (
          <div key={s.id} style={{ borderBottom: "1px solid " + C.lineSoft, padding: "10px 0" }}>
            <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
              <strong style={{ fontSize: "13.5px" }}>{s.category}</strong>
              <span style={{ fontSize: "12px", color: C.greyMid }}>{s.status}</span>
              <Badge value={s.severity} title="Severity" />
              <Badge value={s.isDemo ? "DEMO" : s.confidence} />
              {!isValidScan(s) ? <Badge value="Not counted" title="Missing evidence or source" /> : null}
              <span style={{ flex: 1 }} />
              <Button small kind="danger" onClick={() => remove(s.id)}>
                Remove
              </Button>
            </div>
            <div style={{ fontSize: "13px", marginTop: "5px" }}>
              <strong>Problem:</strong> {s.problem}
            </div>
            <div style={{ fontSize: "12.5px", color: C.greyDark, marginTop: "3px" }}>
              <strong>Evidence:</strong> {s.evidence || <em style={{ color: C.red }}>none recorded</em>}
            </div>
            {s.impact ? <div style={{ fontSize: "12.5px", color: C.greyDark, marginTop: "3px" }}><strong>Impact:</strong> {s.impact}</div> : null}
            {s.opportunity ? <div style={{ fontSize: "12.5px", color: C.greyDark, marginTop: "3px" }}><strong>Opportunity:</strong> {s.opportunity}</div> : null}
            <div style={{ fontSize: "11.5px", color: C.grey, marginTop: "3px" }}>
              {s.source ? <>Source: <ExtLink href={s.source} /></> : s.sourceType === "demo" ? "Source: demo dataset" : "No source URL"} · assessed {fdate(s.assessedAt)}
            </div>
          </div>
        ))}
        {adding ? (
          <div style={{ borderTop: scans.length ? "1px solid " + C.lineSoft : undefined, marginTop: scans.length ? "10px" : 0, paddingTop: scans.length ? "12px" : 0, display: "flex", flexDirection: "column", gap: "12px" }}>
            <Grid cols={3}>
              <SelectInput label="Category" required value={f.category} options={SCAN_CATEGORIES as string[]} placeholder="Choose…" onChange={set("category")} />
              <SelectInput label="Status" required value={f.status} options={SCAN_STATUSES as string[]} placeholder="Choose…" onChange={set("status")} />
              <SelectInput label="Severity" required value={f.severity} options={SEVERITIES as string[]} onChange={set("severity")} />
            </Grid>
            <TextInput label="Problem" required value={f.problem} onChange={set("problem")} placeholder="e.g. Mobile navigation hides the quote form behind three taps" />
            <TextArea label="Evidence" required value={f.evidence} onChange={set("evidence")} rows={2} placeholder="What you actually saw, where (page, device, steps)." />
            <Grid cols={2}>
              <SelectInput
                label="Confidence"
                required
                value={f.confidence}
                options={["Observed", "Indicated", "Assumption"]}
                onChange={(v) => setF((x) => ({ ...x, confidence: v as Confidence }))}
                hint="Observed needs the URL of the page you inspected."
              />
              <TextInput label="Source URL" required={f.confidence === "Observed"} value={f.source} onChange={set("source")} placeholder={c.website || "https://…"} inputMode="url" />
            </Grid>
            <Grid cols={2}>
              <TextInput label="Business impact" value={f.impact} onChange={set("impact")} placeholder="What it costs them" />
              <TextInput label="Opportunity" value={f.opportunity} onChange={set("opportunity")} placeholder="What AX-Channels could do" />
            </Grid>
            <Errors errors={errors} />
            <Actions style={{ marginTop: 0 }}>
              <Button onClick={save}>Save assessment</Button>
              <Button kind="secondary" onClick={() => (setAdding(false), setErrors([]), setF(blank()))}>
                Cancel
              </Button>
            </Actions>
          </div>
        ) : null}
        {!adding && errors.length ? <Errors errors={errors} /> : null}
      </Card>
      {!c.website ? <Notice kind="warn">No website on record — Observed findings from the company site are not possible until research confirms it.</Notice> : null}
    </div>
  );
}
