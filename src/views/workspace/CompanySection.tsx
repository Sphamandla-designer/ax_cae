import { useEffect, useRef, useState } from "react";
import { LEAD_SOURCES } from "../../data/seed";
import type { Confidence } from "../../data/types";
import * as A from "../../domain/actions";
import { signalsOf } from "../../domain/queries";
import { fdate } from "../../lib/format";
import { Actions, Badge, Button, C, Card, Errors, ExtLink, Grid, KV, Notice, SelectInput, TextArea, TextInput } from "../ui";
import type { DetailModel } from "./model";

const INDUSTRIES = ["Mining", "Logistics", "Property", "Construction", "Technology", "Financial services", "Professional services", "Healthcare", "Retail", "Manufacturing", "Agriculture", "Education", "Hospitality", "Other"];

export default function CompanySection({ d, onDelete }: { d: DetailModel; onDelete: () => void }) {
  const { c, db } = d;
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState<A.CompanyInput>({ name: c.name });
  const [errors, setErrors] = useState<string[]>([]);
  const [sig, setSig] = useState({ label: "", confidence: "Assumption" as Confidence, source: "" });
  const [sigErrors, setSigErrors] = useState<string[]>([]);
  const [note, setNote] = useState(db.notes[c.id] || "");
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const set = (k: keyof A.CompanyInput) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const signals = signalsOf(db, c.id);

  const pendingNote = useRef<string | null>(null);
  // Leaving the section (or the prospect) saves a note that is still waiting for the typing pause.
  useEffect(() => () => {
    if (noteTimer.current) clearTimeout(noteTimer.current);
    if (pendingNote.current !== null) d.act((db0) => A.setNote(db0, c.id, pendingNote.current!));
  }, []);
  const changeNote = (v: string) => {
    setNote(v);
    pendingNote.current = v;
    if (noteTimer.current) clearTimeout(noteTimer.current);
    // Notes are saved after typing pauses, not on every keystroke.
    noteTimer.current = setTimeout(() => {
      pendingNote.current = null;
      d.act((db0) => A.setNote(db0, c.id, v));
    }, 500);
  };
  const edit = () => {
    setF({ name: c.name, website: c.website, industry: c.industry, subIndustry: c.subIndustry, location: c.location, size: c.size, leadSource: c.leadSource, campaign: c.campaign, linkedin: c.linkedin, priority: c.priority });
    setErrors([]);
    setEditing(true);
  };
  const save = () => {
    const r = d.run((db0, ctx) => A.updateCompany(db0, c.id, f, ctx));
    if (!r.ok) return setErrors(r.errors);
    setErrors([]);
    setEditing(false);
  };
  const addSignal = () => {
    const r = d.run((db0, ctx) => A.addSignal(db0, c.id, sig, ctx));
    if (!r.ok) return setSigErrors(r.errors);
    setSigErrors([]);
    setSig({ label: "", confidence: "Assumption", source: "" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {!editing ? (
        <Card title="Company profile" aside={<span style={{ display: "flex", gap: "8px" }}>{c.isDemo ? <Badge value="DEMO" /> : null}<Button small kind="secondary" onClick={edit}>Edit company</Button></span>}>
          <Grid cols={2}>
            <KV k="Name" v={c.name} />
            <KV k="Website" v={c.website ? <ExtLink href={c.website} /> : "Unknown"} />
            <KV k="Industry" v={c.industry || "Unknown"} />
            <KV k="Sub-industry" v={c.subIndustry || "Unknown"} />
            <KV k="Location" v={c.location || "Unknown"} />
            <KV k="Company size" v={c.size || "Unknown"} />
            <KV k="Lead source" v={c.leadSource || "Unknown"} />
            <KV k="Campaign" v={c.campaign || "—"} />
            <KV k="Discovered" v={fdate(c.dateDiscovered)} />
            <KV k="Priority" v={c.priority} />
          </Grid>
          <KV k="Description" v={c.description || "Unknown — complete research to confirm it."} />
          <Actions>
            <Button small kind="danger" onClick={onDelete}>
              Delete prospect
            </Button>
          </Actions>
        </Card>
      ) : (
        <Card title="Edit company">
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <Grid cols={2}>
              <TextInput label="Company name" required value={f.name} onChange={set("name")} />
              <TextInput label="Website" value={f.website || ""} onChange={set("website")} inputMode="url" hint="Changing it means research must confirm the new site." />
              <SelectInput label="Industry" value={f.industry || ""} options={INDUSTRIES} placeholder="Unknown" onChange={set("industry")} />
              <TextInput label="Sub-industry" value={f.subIndustry || ""} onChange={set("subIndustry")} />
              <TextInput label="Location" value={f.location || ""} onChange={set("location")} />
              <TextInput label="Company size" value={f.size || ""} onChange={set("size")} placeholder="Leave empty if unknown" />
              <SelectInput label="Lead source" value={f.leadSource || ""} options={LEAD_SOURCES as string[]} placeholder="Unknown" onChange={set("leadSource")} />
              <TextInput label="Campaign" value={f.campaign || ""} onChange={set("campaign")} />
              <TextInput label="LinkedIn page" value={f.linkedin || ""} onChange={set("linkedin")} inputMode="url" />
              <SelectInput label="Priority" value={f.priority || "Medium"} options={["High", "Medium", "Low"]} onChange={set("priority")} />
            </Grid>
            <Errors errors={errors} />
            <Actions style={{ marginTop: 0 }}>
              <Button onClick={save}>Save company</Button>
              <Button kind="secondary" onClick={() => (setEditing(false), setErrors([]))}>
                Cancel
              </Button>
            </Actions>
          </div>
        </Card>
      )}

      <Card title="Why-now signals">
        {signals.length === 0 ? <div style={{ fontSize: "12.5px", color: C.grey }}>No signals recorded. Add one when you spot growth, hiring, launches or new leadership — with the source.</div> : null}
        {signals.map((s) => (
          <div key={s.id} style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "13px", padding: "5px 0", borderBottom: "1px solid " + C.lineSoft, flexWrap: "wrap" }}>
            <span style={{ flex: 1 }}>{s.label}</span>
            <Badge value={s.isDemo ? "DEMO" : s.confidence} />
            {s.source ? <ExtLink href={s.source}>source</ExtLink> : <span style={{ fontSize: "11.5px", color: C.grey }}>no source</span>}
          </div>
        ))}
        <div className="cae-row" style={{ display: "flex", gap: "8px", alignItems: "flex-end", flexWrap: "wrap", marginTop: "10px" }}>
          <TextInput label="New signal" value={sig.label} onChange={(v) => setSig((x) => ({ ...x, label: v }))} placeholder="e.g. Hiring a Head of Digital" style={{ flex: "2 1 200px" }} />
          <SelectInput label="Confidence" value={sig.confidence} options={["Observed", "Indicated", "Assumption"]} onChange={(v) => setSig((x) => ({ ...x, confidence: v as Confidence }))} style={{ flex: "1 1 120px" }} />
          <TextInput label="Source URL" value={sig.source} onChange={(v) => setSig((x) => ({ ...x, source: v }))} inputMode="url" style={{ flex: "2 1 180px" }} />
          <Button onClick={addSignal}>Add signal</Button>
        </div>
        <Errors errors={sigErrors} />
      </Card>

      <Card title="Outreach readiness state">
        {c.notReadyReason ? (
          <Notice kind={c.overrideNotReady ? "warn" : "error"} title={c.overrideNotReady ? "Overridden — outreach allowed" : "NOT READY — do not contact yet"}>
            Reason: {c.notReadyReason}.
          </Notice>
        ) : (
          <div style={{ fontSize: "12.5px", color: C.grey }}>No not-ready flag. Mark the prospect not ready if it should stay out of “Contact now”.</div>
        )}
        <div className="cae-row" style={{ display: "flex", gap: "8px", alignItems: "flex-end", flexWrap: "wrap", marginTop: "10px" }}>
          <SelectInput label="Not-ready reason" value={c.notReadyReason || ""} options={A.NOT_READY_REASONS} placeholder="None — ready when the checklist is" onChange={(v) => d.act((db0, ctx) => A.setNotReady(db0, c.id, v || null, ctx))} style={{ flex: "1 1 240px" }} />
          {c.notReadyReason && !c.overrideNotReady ? (
            <Button kind="secondary" onClick={() => d.confirm(`Override the NOT READY state for ${c.name}? It will appear in Contact now despite: ${c.notReadyReason}.`) && d.act((db0, ctx) => A.overrideNotReady(db0, c.id, ctx))}>
              Override and allow outreach
            </Button>
          ) : null}
        </div>
      </Card>

      <Card title="Notes">
        <TextArea label="Internal notes" value={note} onChange={changeNote} rows={4} placeholder="Internal notes on this prospect… (saved automatically)" />
      </Card>
    </div>
  );
}
