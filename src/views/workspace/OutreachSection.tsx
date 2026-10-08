import { useState } from "react";
import type { Outreach } from "../../data/types";
import * as A from "../../domain/actions";
import { contactsOf, outreachOf } from "../../domain/queries";
import { readiness } from "../../domain/workflow";
import { fdate } from "../../lib/format";
import { Actions, Badge, Button, C, Card, Empty, Errors, Notice } from "../ui";
import type { DetailModel } from "./model";

const STATUS_FG: Record<string, string> = { Draft: C.grey, Approved: C.goldText, Scheduled: C.goldText, Sent: C.greyDark, Replied: C.green };

export default function OutreachSection({ d, mode }: { d: DetailModel; mode: "outreach" | "followup" | "response" }) {
  const { c, db, today } = d;
  const outs = outreachOf(db, c.id).slice().sort((a, b) => a.touch - b.touch || a.createdAt.localeCompare(b.createdAt));
  const sent = outs.filter((o) => o.dateSent);
  const pending = outs.filter((o) => !o.dateSent);
  const contacts = contactsOf(db, c.id);
  const ready = readiness(db, c);
  const [errors, setErrors] = useState<string[]>([]);
  const [scheduleFor, setScheduleFor] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState(today);
  const run = (fn: Parameters<DetailModel["run"]>[0]) => {
    const r = d.run(fn);
    setErrors(r.ok ? [] : r.errors);
    return r;
  };
  const markSent = (o: Outreach) => {
    const r = d.run((db0, ctx) => A.markOutreachSent(db0, o.id, ctx));
    if (r.ok) return setErrors([]);
    if (r.errors[0].startsWith("Not ready") && d.confirm(r.errors.join("\n") + "\n\nYou have actually sent this message and want to override the readiness check?")) {
      run((db0, ctx) => A.markOutreachSent(db0, o.id, ctx, { overrideReadiness: true }));
    } else setErrors(r.errors);
  };
  const nextTouch = sent.length + 1;
  const variant = nextTouch >= 4 ? "Final follow-up" : nextTouch >= 2 ? "Follow-up" : contactsOf(db, c.id).length && /linkedin/i.test(db.strategies.find((s) => s.companyId === c.id)?.channel || "") ? "LinkedIn" : "Email";
  const due = sent.find((o) => o.followUpDate);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {mode === "outreach" && !sent.length ? (
        ready.ready ? (
          <Notice kind="success" title="Ready for outreach">Every readiness item is in place. Prepare the message, approve it, send it from your own email or LinkedIn, then mark it as sent here.</Notice>
        ) : (
          <Notice kind="warn" title="Outreach not ready">
            Missing:
            <ul style={{ margin: "4px 0 0", paddingLeft: "18px" }}>
              {ready.blocked ? <li>Do not contact yet: {ready.reason}</li> : null}
              {ready.missing.map((m) => (
                <li key={m.k}>
                  {m.k} —{" "}
                  <button type="button" onClick={() => d.setFocus(m.target)} style={{ background: "none", border: "none", color: C.gold, textDecoration: "underline", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
                    fix
                  </button>
                </li>
              ))}
            </ul>
          </Notice>
        )
      ) : null}

      {mode === "followup" ? (
        <Notice kind="info" title="Follow-up cadence">
          Touch 1 initial observation · Touch 2 new value · Touch 3 proof or concept · Touch 4 close the loop. Each follow-up is a new message: prepare it, approve it, send it, then mark it as sent.
          {due ? ` Next follow-up (touch ${due.touch + 1}) is due ${fdate(due.followUpDate)}${due.followUpDate! < today ? " — overdue" : due.followUpDate === today ? " — today" : ""}.` : sent.length ? " No follow-up is scheduled." : ""}
        </Notice>
      ) : null}

      <Card
        title={mode === "response" ? "Sent messages — record what happened" : "Touches"}
        aside={
          mode !== "response" && !pending.length && contacts.length && (mode === "outreach" ? !sent.length : sent.length > 0 && nextTouch <= 4) ? (
            <Button small onClick={() => d.openComposer({ variant: variant as never })}>
              {mode === "outreach" ? "Prepare outreach" : `Prepare follow-up (touch ${nextTouch})`}
            </Button>
          ) : null
        }
      >
        {!contacts.length ? <Empty action={<Button small onClick={() => d.setFocus("contacts")}>Add decision-maker</Button>}>Outreach needs a contact to address.</Empty> : null}
        {outs.length === 0 && contacts.length ? <Empty>Nothing drafted or sent yet.</Empty> : null}
        {mode === "response" && !sent.length && outs.length ? <Empty>No message has been sent yet — responses can only be recorded for sent messages.</Empty> : null}
        {(mode === "response" ? sent : outs).map((o) => {
          const who = contacts.find((p) => p.id === o.contactId);
          return (
            <div key={o.id} style={{ borderBottom: "1px solid " + C.lineSoft, padding: "10px 0" }}>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <strong style={{ fontSize: "13px" }}>Touch {o.touch}</strong>
                <span style={{ fontSize: "12px", color: C.greyMid }}>
                  {o.purpose} · {o.channel}
                  {who ? " · to " + who.name : ""}
                </span>
                <span style={{ fontSize: "10px", letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 700, color: STATUS_FG[o.status] }}>{o.status}</span>
                {o.isDemo ? <Badge value="DEMO" /> : null}
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: "12px", color: C.grey }}>
                  {o.dateSent ? "Sent " + fdate(o.dateSent) : o.status === "Scheduled" ? "Scheduled " + fdate(o.dateScheduled) : o.approvedAt ? "Approved, not sent" : "Not sent"}
                </span>
              </div>
              <div style={{ fontSize: "12.5px", color: C.greyDark, marginTop: "5px", whiteSpace: "pre-wrap", maxHeight: "7.5em", overflow: "hidden" }}>{o.message || <em>No message text recorded.</em>}</div>
              {o.dateSent ? (
                <div style={{ fontSize: "12px", color: C.grey, marginTop: "4px" }}>
                  Outcome: <strong style={{ color: C.greyDark }}>{o.outcome || "Sent"}</strong>
                  {o.responseNotes ? " — " + o.responseNotes : ""}
                  {o.followUpDate ? ` · next follow-up ${fdate(o.followUpDate)}` : o.followUpSkipped ? " · follow-up skipped" : ""}
                </div>
              ) : null}
              <Actions style={{ marginTop: "6px" }}>
                {o.status === "Draft" ? (
                  <>
                    <Button small onClick={() => run((db0, ctx) => A.approveOutreach(db0, o.id, ctx))}>
                      Approve
                    </Button>
                    <Button small kind="secondary" onClick={() => d.openComposer({ outreachId: o.id })}>
                      Edit draft
                    </Button>
                    <Button small kind="danger" onClick={() => d.confirm("Discard this draft?") && run((db0, ctx) => A.deleteOutreachDraft(db0, o.id, ctx))}>
                      Discard
                    </Button>
                  </>
                ) : null}
                {o.status === "Approved" || o.status === "Scheduled" ? (
                  <>
                    <Button small onClick={() => markSent(o)}>
                      Mark as sent
                    </Button>
                    {o.status === "Approved" ? (
                      <Button small kind="secondary" onClick={() => (setScheduleFor(o.id), setScheduleDate(today))}>
                        Schedule
                      </Button>
                    ) : null}
                    <Button small kind="secondary" onClick={() => d.openComposer({ outreachId: o.id })}>
                      Edit (returns to draft)
                    </Button>
                  </>
                ) : null}
                {o.dateSent ? (
                  <Button small kind={mode === "response" ? "primary" : "secondary"} onClick={() => d.openResponse(o.id)}>
                    {o.status === "Replied" ? "Update response" : "Record response"}
                  </Button>
                ) : null}
                {o.dateSent && o.followUpDate ? (
                  <>
                    <Button small kind="secondary" onClick={() => run((db0, ctx) => A.rescheduleFollowUp(db0, o.id, 3, ctx))}>
                      Reschedule +3 days
                    </Button>
                    <Button small kind="secondary" onClick={() => d.confirm(`Skip touch ${o.touch + 1}? The skip is recorded in the activity log.`) && run((db0, ctx) => A.skipFollowUp(db0, o.id, ctx))}>
                      Skip follow-up
                    </Button>
                  </>
                ) : null}
              </Actions>
              {scheduleFor === o.id ? (
                <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "8px", flexWrap: "wrap" }}>
                  <label style={{ fontSize: "12px" }}>
                    Send on{" "}
                    <input type="date" min={today} value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} style={{ border: "1px solid " + C.line, borderRadius: "8px", padding: "5px 8px", fontSize: "12.5px" }} />
                  </label>
                  <Button small onClick={() => run((db0, ctx) => A.scheduleOutreach(db0, o.id, scheduleDate, ctx)).ok && setScheduleFor(null)}>
                    Save schedule
                  </Button>
                  <Button small kind="secondary" onClick={() => setScheduleFor(null)}>
                    Cancel
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
        <Errors errors={errors} />
      </Card>
    </div>
  );
}
