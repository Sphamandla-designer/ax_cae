import { useState } from "react";
import { LEAD_SOURCES, LOST_REASONS } from "../../data/seed";
import * as A from "../../domain/actions";
import { bestOpp, clientOf, outcomeOf, proposalsOf } from "../../domain/queries";
import { daysBetween } from "../../lib/dates";
import { fdate, money } from "../../lib/format";
import { Actions, Badge, Button, C, Card, Errors, Grid, KV, Notice, SelectInput, TextArea, TextInput } from "../ui";
import type { DetailModel } from "./model";

export default function OutcomeSection({ d }: { d: DetailModel }) {
  const { c, db, today } = d;
  const oc = outcomeOf(db, c.id);
  const client = clientOf(db, c.id);
  const accepted = proposalsOf(db, c.id).find((p) => p.status === "Accepted");
  const bo = bestOpp(db, c.id);
  const [kind, setKind] = useState<"Won" | "Lost">(d.outcomeKind || (accepted ? "Won" : "Lost"));
  const [f, setF] = useState<A.OutcomeInput>(() => ({
    kind,
    value: String(accepted?.value || bo?.estValue || ""),
    service: accepted?.service || (bo ? bo.type || bo.service : ""),
    source: c.leadSource,
    campaign: c.campaign,
    reason: "",
    notes: "",
    competitor: "",
    reEntryDate: "",
  }));
  const [errors, setErrors] = useState<string[]>([]);
  const set = (k: keyof A.OutcomeInput) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const save = () => {
    if (!d.confirm(`Record ${c.name} as ${kind.toUpperCase()}? The full history is kept.`)) return;
    const r = d.run((db0, ctx) => A.recordOutcome(db0, c.id, { ...f, kind }, ctx));
    setErrors(r.ok ? [] : r.errors);
  };

  if (oc)
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <Card title="Acquisition outcome" aside={<span style={{ display: "flex", gap: "6px" }}>{oc.isDemo ? <Badge value="DEMO" /> : null}<strong style={{ color: oc.result === "Won" ? C.green : C.red, fontSize: "12px", letterSpacing: ".08em", textTransform: "uppercase" }}>{oc.result}</strong></span>}>
          <Grid cols={3}>
            <KV k="Recorded" v={fdate(oc.recordedAt)} />
            <KV k={oc.result === "Won" ? "Why we won" : "Lost reason"} v={oc.reason || "—"} />
            <KV k="Deal value" v={money(oc.value)} />
            <KV k="Service" v={oc.service || "—"} />
            <KV k="Acquisition source" v={oc.source || "—"} />
            <KV k="Campaign" v={oc.campaign || "—"} />
            <KV k="Days to close" v={oc.daysToClose + " days"} />
            <KV k="Acquisition score at close" v={oc.acqAtClose + "/100"} />
            <KV k="Readiness at close" v={oc.readinessAtClose + "%"} />
            {oc.result === "Lost" ? <KV k="Competitor" v={oc.competitor || "Not known"} /> : null}
            {oc.result === "Lost" ? <KV k="Re-entry date" v={oc.reEntryDate ? fdate(oc.reEntryDate) : "None set"} /> : null}
          </Grid>
          {oc.notes ? <KV k="Notes" v={oc.notes} /> : null}
          <div style={{ fontSize: "11.5px", color: C.grey, marginTop: "8px" }}>Structured outcome data, kept with the full research, outreach and proposal history. The CAE does not learn from it automatically.</div>
        </Card>
        {oc.result === "Won" && !client ? (
          <Notice kind="warn" title="No client record yet" actions={<Button small onClick={() => d.run((db0, ctx) => A.convertToClient(db0, c.id, ctx))}>Convert to client</Button>}>This prospect was won but has no client record.</Notice>
        ) : null}
        {client ? <Notice kind="success" title="Client">Client since {fdate(client.startDate)} · {money(client.revenue)} · {client.status}</Notice> : null}
      </div>
    );

  return (
    <Card title="Record outcome">
      <div role="radiogroup" aria-label="Outcome" style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
        {(["Won", "Lost"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            style={{ border: "1px solid " + (kind === k ? C.navy : C.line), background: kind === k ? C.navy : "#fff", color: kind === k ? "#fff" : C.greyDark, borderRadius: "4px", padding: "8px 18px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
          >
            {k}
          </button>
        ))}
      </div>
      {kind === "Won" && !accepted ? <div style={{ marginBottom: "10px" }}><Notice kind="warn">No accepted proposal is recorded. You can still record the win, but check the proposal status first.</Notice></div> : null}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {kind === "Won" ? (
          <>
            <Grid cols={2}>
              <TextInput label="Final project value (ZAR)" required value={f.value} onChange={set("value")} inputMode="numeric" />
              <TextInput label="Service purchased" required value={f.service} onChange={set("service")} />
              <SelectInput label="Acquisition source" value={f.source} options={LEAD_SOURCES as string[]} placeholder="Unknown" onChange={set("source")} />
              <TextInput label="Campaign" value={f.campaign} onChange={set("campaign")} />
            </Grid>
            <TextInput label="Why AX-Channels won" required value={f.reason} onChange={set("reason")} />
          </>
        ) : (
          <>
            <SelectInput label="Lost reason" required value={f.reason} options={LOST_REASONS as string[]} placeholder="Choose…" onChange={set("reason")} />
            <Grid cols={2}>
              <TextInput label="Competitor (if known)" value={f.competitor} onChange={set("competitor")} />
              <TextInput label="Re-entry date (optional)" type="date" min={today} value={f.reEntryDate} onChange={set("reEntryDate")} hint="Creates a nurture task for that date." />
            </Grid>
          </>
        )}
        <TextArea label="Notes" value={f.notes} onChange={set("notes")} rows={2} placeholder="What happened" />
        <div style={{ fontSize: "12px", color: C.grey }}>Days to close: {daysBetween(c.dateDiscovered, today)} (since {fdate(c.dateDiscovered)})</div>
        <Errors errors={errors} />
        <Actions style={{ marginTop: 0 }}>
          <Button onClick={save}>Record outcome</Button>
        </Actions>
      </div>
    </Card>
  );
}
