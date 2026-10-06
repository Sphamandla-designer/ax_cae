import { useState } from "react";
import type { Proposal, ProposalStatus } from "../../data/types";
import * as A from "../../domain/actions";
import { bestOpp, oppsOf, proposalsOf } from "../../domain/queries";
import { fdate, money } from "../../lib/format";
import { Actions, Badge, Button, C, Card, Empty, Errors, Grid, KV, SelectInput, TextArea, TextInput } from "../ui";
import type { DetailModel } from "./model";

const STATUS_FG: Record<string, string> = { Draft: C.grey, Sent: C.greyDark, Viewed: C.goldText, Negotiation: C.goldText, Accepted: C.green, Rejected: C.red, Expired: C.red };
const VERB: Record<string, string> = { Sent: "Mark sent", Viewed: "Mark viewed", Negotiation: "Move to negotiation", Accepted: "Mark accepted", Rejected: "Mark rejected" };

export default function ProposalSection({ d }: { d: DetailModel }) {
  const { c, db, today } = d;
  const props = proposalsOf(db, c.id);
  const opps = oppsOf(db, c.id);
  // With no proposal yet (and an opportunity to link), the section opens straight on the create form.
  const prefill = (): A.ProposalInput => {
    const bo = bestOpp(db, c.id);
    return { project: bo ? (bo.type || bo.service) + " — " + c.name : "", opportunityId: bo ? bo.id : "", service: bo ? bo.type || bo.service : "", scope: "", value: bo ? String(bo.estValue) : "", expiry: "", notes: "" };
  };
  const [editId, setEditId] = useState<string | null>(props.length === 0 && opps.length ? "new" : null);
  const [f, setF] = useState<A.ProposalInput>(prefill);
  const [errors, setErrors] = useState<string[]>([]);
  const set = (k: keyof A.ProposalInput) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const open = (p: Proposal | null) => {
    setF(p ? { project: p.project, opportunityId: p.opportunityId, service: p.service, scope: p.scope, value: String(p.value || ""), expiry: p.expiry, notes: p.notes } : prefill());
    setErrors([]);
    setEditId(p ? p.id : "new");
  };
  const save = () => {
    const r = d.run((db0, ctx) => A.saveProposal(db0, c.id, f, ctx, editId !== "new" ? editId! : undefined));
    if (!r.ok) return setErrors(r.errors);
    setErrors([]);
    setEditId(null);
  };
  const move = (p: Proposal, s: ProposalStatus) => {
    if ((s === "Accepted" || s === "Rejected") && !d.confirm(`Mark “${p.project}” ${s.toLowerCase()}? This records the client's decision.`)) return;
    const r = d.run((db0, ctx) => A.setProposalStatus(db0, p.id, s, ctx));
    setErrors(r.ok ? [] : r.errors);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <Card title="Proposals" aside={!editId ? <Button small onClick={() => open(null)} disabled={!opps.length} title={opps.length ? undefined : "Record an opportunity first"}>Create proposal</Button> : null}>
        {!opps.length ? <Empty action={<Button small kind="secondary" onClick={() => d.setFocus("opportunity")}>Add opportunity</Button>}>A proposal must be linked to an opportunity.</Empty> : null}
        {props.length === 0 && opps.length && !editId ? <Empty>No proposal yet.</Empty> : null}
        {props.map((p) => {
          const st = A.effectiveProposalStatus(p, today);
          const opp = opps.find((o) => o.id === p.opportunityId);
          return (
            <div key={p.id} style={{ borderBottom: "1px solid " + C.lineSoft, padding: "10px 0" }}>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <strong style={{ fontSize: "13.5px" }}>{p.project}</strong>
                <span style={{ fontSize: "10px", letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 700, color: STATUS_FG[st] }}>{st}</span>
                {p.isDemo ? <Badge value="DEMO" /> : null}
                <span style={{ flex: 1 }} />
                <span style={{ fontFamily: C.serif, fontSize: "15px", fontWeight: 600 }}>{money(p.value)}</span>
              </div>
              <Grid cols={3}>
                <KV k="Service" v={p.service || "—"} />
                <KV k="Opportunity" v={opp ? opp.type || opp.service : <span style={{ color: C.red }}>Unlinked</span>} />
                <KV k="Created" v={fdate(p.date)} />
                <KV k="Sent" v={p.sentDate ? fdate(p.sentDate) : "Not sent"} />
                <KV k="Expiry" v={p.expiry ? fdate(p.expiry) : "—"} />
                <KV k="Probability" v={Math.round(p.probability * 100) + "%"} />
              </Grid>
              {p.scope ? <KV k="Scope" v={p.scope} /> : null}
              {p.notes ? <div style={{ fontSize: "12px", color: C.grey, marginTop: "4px" }}>{p.notes}</div> : null}
              <Actions style={{ marginTop: "6px" }}>
                {(A.PROPOSAL_TRANSITIONS[st] || []).map((s) => (
                  <Button key={s} small kind={s === "Rejected" ? "danger" : s === "Sent" || s === "Accepted" ? "primary" : "secondary"} onClick={() => move(p, s)}>
                    {VERB[s] || s}
                  </Button>
                ))}
                {p.status === "Draft" ? (
                  <Button small kind="secondary" onClick={() => open(p)}>
                    Edit draft
                  </Button>
                ) : null}
                {st === "Accepted" && c.stage !== "Won" ? (
                  <Button small onClick={() => d.setFocus("outcome")}>
                    Record won outcome →
                  </Button>
                ) : null}
              </Actions>
            </div>
          );
        })}
        {!editId ? <Errors errors={errors} /> : null}
      </Card>

      {editId ? (
        <Card title={editId === "new" ? "Create proposal" : "Edit draft proposal"}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <TextInput label="Proposal title" required value={f.project} onChange={set("project")} />
            <Grid cols={2}>
              <SelectInput label="Opportunity" required value={f.opportunityId} options={opps.map((o) => ({ value: o.id, label: `${o.type || o.service} — ${money(o.estValue)}` }))} placeholder="Choose…" onChange={set("opportunityId")} />
              <TextInput label="Service" value={f.service} onChange={set("service")} />
            </Grid>
            <TextArea label="Scope" required value={f.scope} onChange={set("scope")} rows={3} placeholder="What is included, phases, deliverables" />
            <Grid cols={2}>
              <TextInput label="Value (ZAR)" required value={f.value} onChange={set("value")} inputMode="numeric" placeholder="180000" />
              <TextInput label="Expiry" type="date" min={today} value={f.expiry} onChange={set("expiry")} hint="Defaults to 21 days after sending." />
            </Grid>
            <TextArea label="Notes" value={f.notes} onChange={set("notes")} rows={2} />
            <Errors errors={errors} />
            <Actions style={{ marginTop: 0 }}>
              <Button onClick={save}>{editId === "new" ? "Create proposal" : "Save proposal"}</Button>
              <Button kind="secondary" onClick={() => (setEditId(null), setErrors([]))}>
                Cancel
              </Button>
            </Actions>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
