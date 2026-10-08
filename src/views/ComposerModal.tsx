// Outreach composer: draft from recorded evidence → save draft → approve → mark as sent.
// Generating, editing or copying a message never records it as sent.
import { useState } from "react";
import type { Db } from "../data/types";
import * as A from "../domain/actions";
import { draftMessage, VARIANTS, type Variant } from "../domain/generate";
import { companyOf, contactsOf, dmOf, strategyOf } from "../domain/queries";
import { Badge, Button, C, Errors, Grid, Modal, Notice, SelectInput, TextArea, labelStyle } from "./ui";

interface Props {
  db: Db;
  cid: string;
  outreachId?: string;
  variant?: Variant;
  run: (f: (db: Db, ctx: A.Ctx) => A.Result) => A.Result;
  confirm: (m: string) => boolean;
  onClose: () => void;
}

export default function ComposerModal({ db, cid, outreachId, variant: v0, run, confirm, onClose }: Props) {
  const c = companyOf(db, cid);
  const existing = outreachId ? db.outreach.find((o) => o.id === outreachId) || null : null;
  const st = strategyOf(db, cid);
  const contacts = contactsOf(db, cid);
  const [variant, setVariant] = useState<Variant>(
    v0 ||
      (existing ? (existing.touch >= 4 ? "Final follow-up" : existing.touch >= 2 ? "Follow-up" : "Email") : "Email"),
  );
  const [contactId, setContactId] = useState(
    existing?.contactId || st?.targetContactId || dmOf(db, cid)?.id || contacts[0]?.id || "",
  );
  const [channel, setChannel] = useState(
    existing?.channel || st?.channel || (variant === "LinkedIn" ? "LinkedIn" : "Email"),
  );
  const draft = draftMessage(db, cid, variant, contactId);
  const [text, setText] = useState(existing ? existing.message : draft.insufficient ? "" : draft.text);
  const [recordId, setRecordId] = useState<string | null>(existing ? existing.id : null);
  const [errors, setErrors] = useState<string[]>([]);
  const [copy, setCopy] = useState<"idle" | "ok" | "fail">("idle");
  const record = recordId ? db.outreach.find((o) => o.id === recordId) || null : null;
  const dirty =
    !record || record.message !== text.trim() || record.channel !== channel || record.contactId !== contactId;

  if (!c) return null;
  const regenerate = (nv: Variant = variant, cidc = contactId) => {
    const g = draftMessage(db, cid, nv, cidc);
    if (
      text.trim() &&
      text.trim() !== draft.text.trim() &&
      !confirm("Replace your edited message with a freshly generated draft?")
    )
      return;
    setText(g.insufficient ? "" : g.text);
  };
  const saveDraft = (): string | null => {
    const r = run((d0, ctx) =>
      A.saveOutreachDraft(
        d0,
        cid,
        { contactId, channel, message: text },
        ctx,
        record && !record.dateSent ? record.id : undefined,
      ),
    );
    if (!r.ok) {
      setErrors(r.errors);
      return null;
    }
    setErrors([]);
    setRecordId(r.id || recordId);
    return r.id || recordId;
  };
  const approve = () => {
    const id = dirty || record?.status !== "Draft" ? saveDraft() : record!.id;
    if (!id) return;
    const r = run((d0, ctx) => A.approveOutreach(d0, id, ctx));
    setErrors(r.ok ? [] : r.errors);
  };
  const markSent = () => {
    if (!record) return;
    let r = run((d0, ctx) => A.markOutreachSent(d0, record.id, ctx));
    if (
      !r.ok &&
      r.errors[0].startsWith("Not ready") &&
      confirm(r.errors.join("\n") + "\n\nYou have actually sent this message and want to override the readiness check?")
    )
      r = run((d0, ctx) => A.markOutreachSent(d0, record.id, ctx, { overrideReadiness: true }));
    if (!r.ok) return setErrors(r.errors);
    onClose();
  };
  const doCopy = async () => {
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(text);
      setCopy("ok");
    } catch {
      setCopy("fail");
    }
    setTimeout(() => setCopy("idle"), 2500);
  };
  const status = !record
    ? "Not saved"
    : record.dateSent
      ? "Sent"
      : record.status === "Draft"
        ? dirty
          ? "Draft — unsaved changes"
          : "Draft saved"
        : record.status + " — not sent yet";

  return (
    <Modal
      title={`Outreach · ${c.name}`}
      onClose={onClose}
      width={760}
      footer={
        <>
          <span style={{ flex: 1, fontSize: "12px", color: C.grey, alignSelf: "center" }}>
            Status: <strong style={{ color: C.greyDark }}>{status}</strong>
          </span>
          <Button kind="secondary" onClick={doCopy} disabled={!text.trim()}>
            {copy === "ok" ? "Copied ✓" : copy === "fail" ? "Copy failed — select and copy manually" : "Copy message"}
          </Button>
          {!record || record.status === "Draft" || dirty ? (
            <>
              <Button kind="secondary" onClick={saveDraft}>
                Save draft
              </Button>
              <Button onClick={approve}>Approve</Button>
            </>
          ) : null}
          {record && !dirty && (record.status === "Approved" || record.status === "Scheduled") ? (
            <Button onClick={markSent}>Mark as sent</Button>
          ) : null}
          <Button kind="secondary" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <div role="tablist" aria-label="Message type" style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {VARIANTS.map((x) => (
          <button
            key={x}
            type="button"
            role="tab"
            aria-selected={variant === x}
            onClick={() => {
              setVariant(x);
              regenerate(x);
            }}
            style={{
              border: "1px solid " + (variant === x ? C.navy : C.line),
              background: variant === x ? C.navy : "#fff",
              color: variant === x ? "#fff" : C.greyDark,
              borderRadius: "8px",
              padding: "6px 12px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {x}
          </button>
        ))}
      </div>
      <div style={{ fontSize: "12px", color: C.grey, marginTop: "6px" }}>{draft.note}</div>

      {draft.insufficient ? (
        <div style={{ marginTop: "12px" }}>
          <Notice kind="warn" title={A.INSUFFICIENT}>
            Missing:
            <ul style={{ margin: "4px 0 0", paddingLeft: "18px" }}>
              {draft.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
            You can still write the message yourself — only use facts you have verified.
          </Notice>
        </div>
      ) : null}

      <Grid cols={2}>
        <SelectInput
          label="To"
          required
          value={contactId}
          options={contacts.map((p) => ({
            value: p.id,
            label: `${p.name} — ${p.title}${p.decisionMaker ? " (decision-maker)" : ""}`,
          }))}
          placeholder="Choose…"
          onChange={(x) => {
            setContactId(x);
            // The greeting and the evidence list follow the recipient (asks first if you edited the text).
            regenerate(variant, x);
          }}
        />
        <SelectInput label="Channel" required value={channel} options={A.CHANNELS} onChange={setChannel} />
      </Grid>
      <div style={{ marginTop: "12px" }}>
        <TextArea
          label="Message"
          required
          value={text}
          onChange={setText}
          rows={12}
          placeholder="Write the message using only verified details."
        />
        <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
          <Button small kind="secondary" onClick={() => regenerate()}>
            Regenerate from records
          </Button>
        </div>
      </div>

      <div style={{ marginTop: "14px", borderTop: "1px solid " + C.lineSoft, paddingTop: "10px" }}>
        <div style={labelStyle}>Built only from these records</div>
        {draft.used.length ? (
          draft.used.map((u) => (
            <div key={u.k} style={{ fontSize: "12px", marginTop: "5px", color: C.greyDark }}>
              <strong>{u.k}:</strong> {u.v} <span style={{ color: C.grey }}>· {u.basis}</span>
            </div>
          ))
        ) : (
          <div style={{ fontSize: "12px", color: C.grey, marginTop: "4px" }}>No verified records available.</div>
        )}
        <div style={{ fontSize: "11.5px", color: C.grey, marginTop: "6px" }}>
          The generator never adds launches, funding, headcount, customers or other facts that are not in these records.{" "}
          <Badge value="Hypothesis" title="Strategy content is your hypothesis" /> content comes from your strategy.
        </div>
      </div>
      <div style={{ marginTop: "12px" }}>
        <Errors errors={errors} />
      </div>
    </Modal>
  );
}
