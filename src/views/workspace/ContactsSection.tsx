import { useState } from "react";
import { CONTACT_ROLES } from "../../data/seed";
import type { Confidence, Contact } from "../../data/types";
import * as A from "../../domain/actions";
import { contactsOf, dmOf } from "../../domain/queries";
import { fdate } from "../../lib/format";
import { Actions, Badge, Button, C, Card, Empty, Errors, ExtLink, Grid, Notice, SelectInput, TextArea, TextInput } from "../ui";
import type { DetailModel } from "./model";

const blank = (): A.ContactInput => ({ name: "", title: "", department: "", email: "", phone: "", linkedin: "", role: "Unknown", influence: "Medium", relationship: "", preferredChannel: "", notes: "", source: "", confidence: "Assumption" });
const fromContact = (p: Contact): A.ContactInput => ({
  name: p.name,
  title: p.title,
  department: p.department,
  email: p.email,
  phone: p.phone,
  linkedin: p.linkedin,
  role: p.role || "Unknown",
  influence: p.influence || "Medium",
  relationship: p.relationship,
  preferredChannel: p.preferredChannel,
  notes: p.notes,
  source: p.source && /^https?:/.test(p.source) ? p.source : "",
  confidence: p.confidence,
});
const ROLE_FG: Record<string, string> = { "Decision Maker": C.green, Champion: C.green, Influencer: C.gold, Gatekeeper: C.red, Unknown: C.grey };

export default function ContactsSection({ d }: { d: DetailModel }) {
  const { c, db } = d;
  const contacts = contactsOf(db, c.id);
  const dm = dmOf(db, c.id);
  const [editId, setEditId] = useState<string | null>(contacts.length ? null : "new");
  const [f, setF] = useState<A.ContactInput>(blank);
  const [errors, setErrors] = useState<string[]>([]);
  const set = (k: keyof A.ContactInput) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const save = () => {
    const r = d.run((db0, ctx) => A.saveContact(db0, c.id, f, ctx, editId && editId !== "new" ? editId : undefined));
    if (!r.ok) return setErrors(r.errors);
    setErrors([]);
    setEditId(null);
  };
  const act = (fn: Parameters<DetailModel["run"]>[0]) => {
    const r = d.run(fn);
    setErrors(r.ok ? [] : r.errors);
  };
  const edit = (p: Contact | null) => {
    setF(p ? fromContact(p) : blank());
    setErrors([]);
    setEditId(p ? p.id : "new");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <Card
        title="Contacts"
        aside={
          <span style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ fontSize: "10.5px", letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 700, color: dm ? C.green : C.red, background: dm ? C.greenBg : C.redBg, borderRadius: "999px", padding: "3px 8px" }}>
              Decision-maker identified: {dm ? "YES" : "NO"}
            </span>
            {!editId ? (
              <Button small onClick={() => edit(null)}>
                Add contact
              </Button>
            ) : null}
          </span>
        }
      >
        {!dm ? (
          <div style={{ marginBottom: "10px" }}>
            <Notice kind="warn" title="Identify the decision-maker before outreach.">
              {contacts.length ? "Mark the contact who can approve the project, or add them." : "No contacts yet. Add the person who can approve the project."}
            </Notice>
          </div>
        ) : null}
        {contacts.length === 0 && editId !== "new" ? <Empty>No contacts recorded.</Empty> : null}
        {contacts.map((p) => (
          <div key={p.id} style={{ borderBottom: "1px solid " + C.lineSoft, padding: "10px 0" }}>
            <div style={{ display: "flex", gap: "8px", alignItems: "baseline", flexWrap: "wrap" }}>
              <strong style={{ fontSize: "14px" }}>{p.name}</strong>
              <span style={{ fontSize: "12.5px", color: C.greyMid }}>
                {p.title}
                {p.department ? " · " + p.department : ""}
              </span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: "10.5px", letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 700, color: ROLE_FG[p.role] || C.grey }}>{p.decisionMaker ? "Decision-maker ✓" : p.role}</span>
              <Badge value={p.isDemo ? "DEMO" : p.confidence} />
            </div>
            <div className="cae-grid cae-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 16px", fontSize: "12px", color: C.greyDark, marginTop: "5px" }}>
              <span>Influence · {p.influence || "—"}</span>
              <span>Channel · {p.preferredChannel || "Not set"}</span>
              <span>Last contacted · {p.lastContacted ? fdate(p.lastContacted) : "Never"}</span>
              <span>Relationship · {p.relationship || "—"}</span>
              {p.email ? <a href={"mailto:" + p.email} style={{ color: C.gold }}>{p.email}</a> : <span>No email</span>}
              <span>{p.phone || "No phone"}</span>
              {p.linkedin ? <ExtLink href={/^https?:/.test(p.linkedin) ? p.linkedin : "https://" + p.linkedin}>{p.linkedin}</ExtLink> : null}
              <span>Source · {p.source ? (/^https?:/.test(p.source) ? <ExtLink href={p.source} /> : p.source) : "entered manually"}</span>
            </div>
            {p.notes ? <div style={{ fontSize: "12px", color: C.grey, marginTop: "4px" }}>{p.notes}</div> : null}
            <Actions style={{ marginTop: "6px" }}>
              {!p.decisionMaker ? (
                <Button small kind="secondary" onClick={() => act((db0, ctx) => A.markDecisionMaker(db0, c.id, p.id, ctx))}>
                  Mark decision-maker
                </Button>
              ) : null}
              <Button small kind="secondary" onClick={() => edit(p)}>
                Edit
              </Button>
              <Button small kind="secondary" onClick={() => act((db0, ctx) => A.logContactTouch(db0, c.id, p.id, ctx))}>
                Log contact today
              </Button>
            </Actions>
          </div>
        ))}
        {!editId ? <Errors errors={errors} /> : null}
      </Card>

      {editId ? (
        <Card title={editId === "new" ? "Add contact" : "Edit contact"}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <Grid cols={2}>
              <TextInput label="Name" required value={f.name} onChange={set("name")} />
              <TextInput label="Job title" required value={f.title} onChange={set("title")} />
              <TextInput label="Department" value={f.department} onChange={set("department")} />
              <TextInput label="Email" type="email" value={f.email} onChange={set("email")} inputMode="email" />
              <TextInput label="Phone" type="tel" value={f.phone} onChange={set("phone")} inputMode="tel" />
              <TextInput label="LinkedIn" value={f.linkedin} onChange={set("linkedin")} placeholder="linkedin.com/in/…" inputMode="url" />
            </Grid>
            <Grid cols={3}>
              <SelectInput
                label="Decision-making role"
                required
                value={f.role}
                options={CONTACT_ROLES as string[]}
                onChange={set("role")}
                hint={f.role === "Decision Maker" ? "This person will be recorded as the decision-maker." : "Choose Decision Maker only if they can approve the project."}
              />
              <SelectInput label="Influence" value={f.influence} options={["Low", "Medium", "High"]} onChange={set("influence")} />
              <SelectInput label="Preferred channel" value={f.preferredChannel} options={A.CHANNELS} placeholder="Not set" onChange={set("preferredChannel")} />
            </Grid>
            <Grid cols={3}>
              <TextInput label="Relationship" value={f.relationship} onChange={set("relationship")} placeholder="e.g. Cold, Warm — replied" />
              <TextInput label="Source URL" value={f.source} onChange={set("source")} placeholder="Team page or LinkedIn URL" inputMode="url" />
              <SelectInput label="Confidence" value={f.confidence} options={["Observed", "Indicated", "Assumption"]} onChange={(v) => setF((x) => ({ ...x, confidence: v as Confidence }))} hint="Observed needs a source." />
            </Grid>
            <TextArea label="Notes" value={f.notes} onChange={set("notes")} rows={2} />
            <Errors errors={errors} />
            <Actions style={{ marginTop: 0 }}>
              <Button onClick={save}>{editId === "new" ? "Add contact" : "Save contact"}</Button>
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
