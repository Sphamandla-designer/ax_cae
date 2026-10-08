import { useState } from "react";
import type { Meeting } from "../../data/types";
import * as A from "../../domain/actions";
import { dmOf, meetingsOf } from "../../domain/queries";
import { fdate } from "../../lib/format";
import { Actions, Badge, Button, C, Card, Check, Empty, Errors, Grid, KV, SelectInput, TextArea, TextInput } from "../ui";
import type { DetailModel } from "./model";

const TYPES = ["Discovery", "Follow-up discovery", "Proposal walkthrough", "Negotiation"];
const blank = (today: string): A.MeetingInput => ({ date: today, time: "10:00", type: "Discovery", attendees: "", decisionMakerAttended: false, notes: "", painPoints: "", requirements: "", budget: "", timeline: "", nextStep: "" });
const fromMeeting = (m: Meeting): A.MeetingInput => ({ date: m.date, time: m.time || "10:00", type: m.type, attendees: m.attendees, decisionMakerAttended: m.decisionMakerAttended, notes: m.notes, painPoints: m.painPoints, requirements: m.requirements, budget: m.budget, timeline: m.timeline, nextStep: m.nextStep });

export default function DiscoverySection({ d }: { d: DetailModel }) {
  const { c, db, today } = d;
  const meetings = meetingsOf(db, c.id).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const dm = dmOf(db, c.id);
  // Open on the form the next action needs: record a meeting whose date has come, or schedule the first one.
  const due = meetings.find((m) => m.status === "Scheduled" && m.date && m.date <= today);
  const [form, setForm] = useState<{ kind: "schedule" | "held"; id?: string } | null>(() =>
    due ? { kind: "held", id: due.id } : meetings.length === 0 && d.nba.focus === "discovery" ? { kind: "schedule" } : null,
  );
  const [f, setF] = useState<A.MeetingInput>(() => (due ? { ...fromMeeting(due), attendees: due.attendees || dm?.name || "" } : blank(today)));
  const [errors, setErrors] = useState<string[]>([]);
  const set = (k: keyof A.MeetingInput) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const open = (kind: "schedule" | "held", m?: Meeting) => {
    const base = m ? fromMeeting(m) : blank(today);
    if (kind === "held" && base.date > today) base.date = today;
    if (kind === "held" && !base.attendees && dm) base.attendees = dm.name;
    setF(base);
    setErrors([]);
    setForm({ kind, id: m?.id });
  };
  const save = () => {
    const r = d.run((db0, ctx) => (form!.kind === "schedule" ? A.scheduleMeeting(db0, c.id, f, ctx, form!.id) : A.recordMeetingHeld(db0, c.id, f, ctx, form!.id)));
    if (!r.ok) return setErrors(r.errors);
    setErrors([]);
    setForm(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <Card
        title="Meetings"
        aside={
          !form ? (
            <span style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <Button small onClick={() => open("schedule")}>Schedule discovery</Button>
              {/* Recording discovery records the scheduled meeting (if any) rather than creating a second one. */}
              <Button small kind="secondary" onClick={() => open("held", meetings.find((m) => m.status === "Scheduled"))}>Record discovery</Button>
            </span>
          ) : null
        }
      >
        {meetings.length === 0 && !form ? <Empty>No meetings yet. Schedule discovery once the prospect agrees to talk.</Empty> : null}
        {meetings.map((m) => (
          <div key={m.id} style={{ borderBottom: "1px solid " + C.lineSoft, padding: "10px 0" }}>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <strong style={{ fontSize: "13.5px" }}>{m.type}</strong>
              <span style={{ fontSize: "12.5px", color: C.greyMid }}>{m.date ? fdate(m.date) + (m.time ? " · " + m.time : "") : "Date not set"}</span>
              <span style={{ fontSize: "10px", letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 700, color: m.status === "Held" ? C.green : m.status === "Cancelled" ? C.red : C.goldText }}>{m.status}</span>
              {m.isDemo ? <Badge value="DEMO" /> : null}
            </div>
            {m.status === "Held" ? (
              <Grid cols={2}>
                <KV k="Attendees" v={m.attendees || "—"} />
                <KV k="Decision-maker attended" v={m.decisionMakerAttended ? "Yes" : "No / not recorded"} />
                <KV k="Notes" v={m.notes || "—"} />
                <KV k="Pain points" v={m.painPoints || "—"} />
                <KV k="Requirements" v={m.requirements || "—"} />
                <KV k="Next step" v={m.nextStep || "—"} />
                <KV k="Budget" v={m.budget || "Unknown"} />
                <KV k="Timeline" v={m.timeline || "Unknown"} />
              </Grid>
            ) : (
              <div style={{ fontSize: "12.5px", color: C.greyDark, marginTop: "4px" }}>{m.notes || "No agenda recorded."}</div>
            )}
            {m.status === "Scheduled" ? (
              <Actions style={{ marginTop: "6px" }}>
                {!m.date || m.date <= today ? <Button small onClick={() => open("held", m)}>Record discovery</Button> : <span style={{ fontSize: "12px", color: C.grey }}>Can be recorded on or after {fdate(m.date)}.</span>}
                <Button small kind="secondary" onClick={() => open("schedule", m)}>Reschedule</Button>
                <Button small kind="danger" onClick={() => d.confirm("Cancel this meeting? It stays in the history as cancelled.") && d.act((db0, ctx) => A.cancelMeeting(db0, m.id, ctx))}>
                  Cancel meeting
                </Button>
              </Actions>
            ) : null}
          </div>
        ))}
        {!form ? <Errors errors={errors} /> : null}
      </Card>

      {form ? (
        <Card title={form.kind === "schedule" ? (form.id ? "Reschedule meeting" : "Schedule discovery") : "Record discovery (meeting held)"}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <Grid cols={3}>
              <TextInput label="Date" required type="date" value={f.date} min={form.kind === "schedule" ? today : undefined} onChange={set("date")} />
              <TextInput label="Time" required type="time" value={f.time} onChange={set("time")} />
              <SelectInput label="Meeting type" required value={f.type} options={TYPES} onChange={set("type")} />
            </Grid>
            <TextInput label="Attendees" required={form.kind === "held"} value={f.attendees} onChange={set("attendees")} placeholder="Names and roles" />
            {form.kind === "held" ? (
              <>
                <Check label={`Decision-maker attended${dm ? " (" + dm.name + ")" : ""}`} checked={f.decisionMakerAttended} onChange={(v) => setF((x) => ({ ...x, decisionMakerAttended: v }))} />
                <TextArea label="Notes" required value={f.notes} onChange={set("notes")} rows={3} placeholder="What was discussed" />
                <Grid cols={2}>
                  <TextArea label="Pain points" required value={f.painPoints} onChange={set("painPoints")} rows={2} />
                  <TextArea label="Requirements" required value={f.requirements} onChange={set("requirements")} rows={2} placeholder="Or “None identified yet”" />
                  <TextInput label="Budget (if known)" value={f.budget} onChange={set("budget")} placeholder="Leave empty if unknown" />
                  <TextInput label="Timeline (if known)" value={f.timeline} onChange={set("timeline")} placeholder="Leave empty if unknown" />
                </Grid>
                <TextInput label="Agreed next step" required value={f.nextStep} onChange={set("nextStep")} />
              </>
            ) : (
              <TextArea label="Agenda" value={f.notes} onChange={set("notes")} rows={2} placeholder="What must this meeting establish?" />
            )}
            <Errors errors={errors} />
            <Actions style={{ marginTop: 0 }}>
              <Button onClick={save}>{form.kind === "schedule" ? "Save meeting" : "Record discovery"}</Button>
              <Button kind="secondary" onClick={() => (setForm(null), setErrors([]))}>
                Cancel
              </Button>
            </Actions>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
