import { useState } from "react";
import type { Strategy } from "../../data/types";
import * as A from "../../domain/actions";
import { bestOpp, contactsOf, currentResearch, dmOf, factOf, isValidScan, oppValueOf, scansOf, sevRank, strategyOf } from "../../domain/queries";
import { researchCheck } from "../../domain/workflow";
import { money } from "../../lib/format";
import { Actions, Badge, Button, C, Card, Errors, Grid, KV, Notice, SelectInput, TextArea, TextInput, labelStyle } from "../ui";
import type { DetailModel } from "./model";

function initial(d: DetailModel, st: Strategy | null): A.StrategyInput {
  const opp = bestOpp(d.db, d.c.id);
  const dm = dmOf(d.db, d.c.id);
  const worst = scansOf(d.db, d.c.id).filter(isValidScan).sort((a, b) => sevRank(b.severity) - sevRank(a.severity))[0];
  if (st)
    return {
      problem: st.problem,
      opportunity: st.opportunity,
      targetContactId: st.targetContactId,
      service: st.service,
      valueProposition: st.valueProposition,
      entryOffer: st.entryOffer,
      angle: st.angle,
      channel: st.channel,
      cta: st.cta,
      proof: st.proof,
      nextStep: st.nextStep,
      dealValue: st.dealValue,
      difficulty: st.difficulty,
    };
  // Prefill only from recorded data; everything strategic stays for you to write.
  return {
    problem: worst ? worst.problem : "",
    opportunity: opp ? opp.opportunity : "",
    targetContactId: dm ? dm.id : "",
    service: opp ? opp.type || opp.service : "",
    valueProposition: "",
    entryOffer: "",
    angle: "",
    channel: dm?.preferredChannel || "",
    cta: "",
    proof: "",
    nextStep: "",
    dealValue: oppValueOf(d.db, d.c.id) ? money(oppValueOf(d.db, d.c.id)) : "",
    difficulty: "Moderate",
  };
}

export default function StrategySection({ d }: { d: DetailModel }) {
  const { c, db } = d;
  const st = strategyOf(db, c.id);
  const [editing, setEditing] = useState(!st);
  const [f, setF] = useState<A.StrategyInput>(() => initial(d, st));
  const [errors, setErrors] = useState<string[]>([]);
  const set = (k: keyof A.StrategyInput) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const contacts = contactsOf(db, c.id);
  const r = currentResearch(db, c.id);
  const desc = factOf(r, "description");
  const evid = scansOf(db, c.id).filter(isValidScan);
  const opp = bestOpp(db, c.id);
  const dm = dmOf(db, c.id);
  const save = () => {
    const res = d.run((db0, ctx) => A.saveStrategy(db0, c.id, f, ctx));
    if (!res.ok) return setErrors(res.errors);
    setErrors([]);
    setEditing(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <Card title="Evidence on record" aside={<span style={{ fontSize: "11.5px", color: C.grey }}>What the strategy must stand on</span>}>
        <KV k="Company (research)" v={desc && researchCheck(db, c).ok ? <>{desc.value} <Badge value={r?.mode === "demo" ? "DEMO" : desc.confidence} /></> : <span style={{ color: C.red }}>Research not complete — company context unverified</span>} />
        <div style={{ padding: "6px 0", borderBottom: "1px solid " + C.lineSoft }}>
          <div style={labelStyle}>Observed problems</div>
          {evid.length ? (
            evid.map((s) => (
              <div key={s.id} style={{ fontSize: "12.5px", marginTop: "3px" }}>
                {s.category}: {s.problem} <Badge value={s.isDemo ? "DEMO" : s.confidence} />
              </div>
            ))
          ) : (
            <div style={{ fontSize: "12.5px", color: C.red, marginTop: "3px" }}>No evidenced assessments yet.</div>
          )}
        </div>
        <KV k="Opportunity" v={opp ? `${opp.type || opp.service} — ${opp.opportunity} (${money(opp.estValue)}, basis ${opp.basis})` : <span style={{ color: C.red }}>None recorded</span>} />
        <KV k="Decision-maker" v={dm ? `${dm.name} · ${dm.title}` : <span style={{ color: C.red }}>Not identified</span>} />
      </Card>

      {st && !editing ? (
        <Card title="Acquisition strategy" aside={<span style={{ display: "flex", gap: "6px", alignItems: "center" }}><Badge value="Hypothesis" title="Strategy is your hypothesis, not evidence" /><Button small kind="secondary" onClick={() => (setF(initial(d, st)), setEditing(true))}>Edit strategy</Button></span>}>
          <Grid cols={2}>
            <KV k="Primary problem" v={st.problem} />
            <KV k="Primary opportunity" v={st.opportunity || "—"} />
            <KV k="Target person" v={st.target || "—"} />
            <KV k="Recommended service" v={st.service || "—"} />
            <KV k="Value proposition" v={st.valueProposition || <span style={{ color: C.red }}>Missing</span>} />
            <KV k="Entry offer" v={st.entryOffer || "—"} />
            <KV k="Outreach angle" v={st.angle || <span style={{ color: C.red }}>Missing</span>} />
            <KV k="Channel" v={st.channel || <span style={{ color: C.red }}>Missing</span>} />
            <KV k="Call to action" v={st.cta || "—"} />
            <KV k="Proof to use" v={st.proof || "—"} />
            <KV k="Desired next step" v={st.nextStep || "—"} />
            <KV k="Estimated deal value" v={st.dealValue || "—"} />
          </Grid>
          <div style={{ fontSize: "12px", color: C.grey, marginTop: "8px" }}>Expected sales difficulty: {st.difficulty}</div>
        </Card>
      ) : null}

      {editing ? (
        <Card title={st ? "Edit strategy" : "Create acquisition strategy"}>
          {!contacts.length ? (
            <Notice kind="warn" title="Add a contact first">
              The strategy targets a real person.{" "}
              <button type="button" onClick={() => d.setFocus("contacts")} style={{ background: "none", border: "none", color: C.gold, textDecoration: "underline", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
                Add the decision-maker
              </button>
            </Notice>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "10px" }}>
            <TextInput label="Primary problem" required value={f.problem} onChange={set("problem")} hint="Prefilled from your highest-severity evidenced assessment — edit as needed." />
            <TextInput label="Primary opportunity" value={f.opportunity} onChange={set("opportunity")} />
            <Grid cols={2}>
              <SelectInput label="Target person" required value={f.targetContactId} options={contacts.map((p) => ({ value: p.id, label: `${p.name} — ${p.title}${p.decisionMaker ? " (decision-maker)" : ""}` }))} placeholder="Choose…" onChange={set("targetContactId")} />
              <TextInput label="Recommended service" value={f.service} onChange={set("service")} />
            </Grid>
            <TextArea label="Value proposition" required value={f.valueProposition} onChange={set("valueProposition")} rows={2} placeholder="The outcome AX-Channels delivers for them, in one sentence" />
            <TextArea label="Outreach angle" required value={f.angle} onChange={set("angle")} rows={2} placeholder="How you'll open — tied to the observed problem" />
            <Grid cols={3}>
              <SelectInput label="Channel" required value={f.channel} options={A.CHANNELS} placeholder="Choose…" onChange={set("channel")} />
              <TextInput label="Entry offer" value={f.entryOffer} onChange={set("entryOffer")} placeholder="e.g. a short annotated walkthrough" />
              <TextInput label="Call to action" value={f.cta} onChange={set("cta")} placeholder="e.g. a 15-minute call" />
            </Grid>
            <Grid cols={3}>
              <TextInput label="Proof to use" value={f.proof} onChange={set("proof")} />
              <TextInput label="Desired next step" value={f.nextStep} onChange={set("nextStep")} />
              <TextInput label="Estimated deal value" value={f.dealValue} onChange={set("dealValue")} />
            </Grid>
            <SelectInput label="Expected sales difficulty" required value={f.difficulty} options={["Easy", "Moderate", "Difficult"]} onChange={set("difficulty")} />
            <Errors errors={errors} />
            <Actions style={{ marginTop: 0 }}>
              <Button onClick={save}>{st ? "Save strategy" : "Create strategy"}</Button>
              {st ? (
                <Button kind="secondary" onClick={() => (setEditing(false), setErrors([]))}>
                  Cancel
                </Button>
              ) : null}
            </Actions>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
