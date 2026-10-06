import { useMemo, useState } from "react";
import type { Confidence, Fact, FactStatus, Research } from "../../data/types";
import * as A from "../../domain/actions";
import { currentResearch, researchHistory } from "../../domain/queries";
import { researchCheck } from "../../domain/workflow";
import { fdatetime } from "../../lib/format";
import { normalizeWebsite } from "../../lib/url";
import { ERROR_HELP, type ResearchErrorCode } from "../../research/provider";
import { Actions, Badge, Button, C, Card, Check, Errors, ExtLink, Grid, KV, Notice, SelectInput, TextArea, TextInput, labelStyle } from "../ui";
import type { DetailModel } from "./model";

const STATUSES: FactStatus[] = ["Verified", "Unverified", "Unknown"];
const CONFIDENCES: Confidence[] = ["Observed", "Indicated", "Assumption"];

type Row = { field: string; value: string; status: FactStatus; confidence: Confidence; source: string; evidence: string };

function rowsFrom(r: Research | null, website: string, name: string): Row[] {
  return A.RESEARCH_FIELDS.map((f) => {
    const x = r?.facts.find((y) => y.field === f.field);
    if (x) return { field: f.field, value: x.value, status: x.status, confidence: x.confidence, source: x.source, evidence: x.evidence };
    const seed = f.field === "website" ? website : f.field === "name" ? name : "";
    return { field: f.field, value: seed, status: seed ? "Unverified" : "Unknown", confidence: "Assumption", source: "", evidence: "" };
  });
}

function modeBadge(r: Research) {
  if (r.mode === "demo") return <Badge value="DEMO" />;
  return <Badge value={r.mode === "automated" ? "Automated" : "Manual"} title={r.mode === "automated" ? "Retrieved by " + r.provider : "Entered by you"} />;
}

function FactsTable({ r }: { r: Research }) {
  const known = r.facts.filter((f) => f.value && f.status !== "Unknown");
  const unknown = A.RESEARCH_FIELDS.filter((f) => !known.some((k) => k.field === f.field)).map((f) => f.label);
  const label = (f: string) => A.RESEARCH_FIELDS.find((x) => x.field === f)?.label || f;
  return (
    <div>
      {known.map((f: Fact) => (
        <div key={f.field} style={{ borderBottom: "1px solid " + C.lineSoft, padding: "9px 0" }}>
          <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
            <span style={labelStyle}>{label(f.field)}</span>
            <Badge value={r.mode === "demo" ? "DEMO" : f.status} />
            {r.mode === "demo" ? null : <Badge value={f.confidence} />}
          </div>
          <div style={{ fontSize: "13.5px", marginTop: "4px", color: C.ink, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{f.value}</div>
          <div style={{ fontSize: "11.5px", color: C.grey, marginTop: "3px" }}>
            {f.source ? (
              <>
                Source: <ExtLink href={f.source} /> {f.retrievedAt ? "· retrieved " + fdatetime(f.retrievedAt) : ""}
              </>
            ) : f.sourceType === "demo" ? (
              "Source: demo dataset (fictional)"
            ) : (
              "Source: entered manually — no source URL"
            )}
            {f.evidence ? <div style={{ fontStyle: "italic", marginTop: "2px" }}>Evidence: “{f.evidence}”</div> : null}
          </div>
        </div>
      ))}
      {unknown.length ? (
        <div style={{ fontSize: "12px", color: C.grey, marginTop: "8px" }}>
          <strong style={{ color: C.greyDark }}>Unknown (not found, not guessed):</strong> {unknown.join(", ")}
        </div>
      ) : null}
    </div>
  );
}

export default function ResearchSection({ d }: { d: DetailModel }) {
  const { c, db } = d;
  const r = currentResearch(db, c.id);
  const history = researchHistory(db, c.id);
  const check = researchCheck(db, c);
  const [website, setWebsite] = useState(c.website.replace(/^https:\/\//, ""));
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<Row[]>(() => rowsFrom(r, c.website, c.name));
  const [notes, setNotes] = useState(r?.notes || "");
  const [verified, setVerified] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [viewVersion, setViewVersion] = useState<string | null>(null);
  const site = normalizeWebsite(website);
  const err = r?.lastError && r.lastError.code !== "PARTIAL" ? r.lastError : null;
  const help = err ? ERROR_HELP[err.code as ResearchErrorCode] : null;
  const viewed = useMemo(() => history.find((h) => h.id === viewVersion) || null, [history, viewVersion]);

  const startEdit = () => {
    setRows(rowsFrom(currentResearch(db, c.id), c.website, c.name));
    setNotes(currentResearch(db, c.id)?.notes || "");
    setErrors([]);
    setEditing(true);
  };
  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const save = () => {
    const res = d.run((db0, ctx) => A.saveResearch(db0, c.id, { facts: rows, notes }, ctx));
    if (!res.ok) return setErrors(res.errors);
    setErrors([]);
    setEditing(false);
  };
  const complete = () => {
    const res = d.run((db0, ctx) => A.completeResearch(db0, c.id, { confirmManual: verified }, ctx));
    setErrors(res.ok ? [] : res.errors);
  };
  const research = () => {
    setErrors([]);
    d.runResearch(website);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {d.provider.automated ? (
        <Notice kind="info" title="Live research connected">
          {d.provider.label}. Results are retrieved from the company's public pages; every fact keeps its source. Review them before completing.
        </Notice>
      ) : (
        <Notice
          kind="warn"
          title="Live company research is not configured."
          actions={
            <Button kind="secondary" small onClick={d.openSettings}>
              Configure research provider
            </Button>
          }
        >
          {d.provider.problem ? d.provider.problem + " " : ""}Enter or verify company information manually. Manual research is recorded as manual — it is never labelled automated.
        </Notice>
      )}

      {c.isDemo ? <Notice kind="info" title="Demo company">This is fictional demo data. Its “research” is sample content, not real research — never use it as a template for real prospects.</Notice> : null}

      <Card title="Website">
        <div className="cae-row" style={{ display: "flex", gap: "10px", alignItems: "flex-end", flexWrap: "wrap" }}>
          <TextInput label="Company website" required value={website} onChange={setWebsite} placeholder="example.co.za" inputMode="url" style={{ flex: "1 1 240px" }} hint={website && !site.ok ? <span style={{ color: C.red }}>{site.error}</span> : site.ok ? "Canonical: " + site.url : undefined} />
          {d.provider.automated ? (
            <Button onClick={research} disabled={d.researchRunning}>
              {d.researchRunning ? "Researching…" : r && r.mode === "automated" ? "Refresh research" : "Research company"}
            </Button>
          ) : null}
          <Button kind="secondary" onClick={startEdit}>
            {r ? "Edit research" : "Research manually"}
          </Button>
          {site.ok ? (
            <a href={site.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12.5px", color: C.gold, padding: "9px 4px" }}>
              Open website ↗
            </a>
          ) : null}
        </div>
        {d.researchRunning ? <div style={{ marginTop: "10px" }}><Notice kind="info">Researching {site.ok ? site.host : website}… nothing is recorded until the provider answers.</Notice></div> : null}
      </Card>

      {err && help ? (
        <Notice
          kind="error"
          title={"Research unavailable — " + help.title}
          actions={
            <>
              {d.provider.automated && help.retryable ? <Button small onClick={research}>Retry</Button> : null}
              <Button small kind="secondary" onClick={startEdit}>
                Research manually
              </Button>
              {site.ok ? (
                <a href={site.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", color: C.gold }}>
                  Open website ↗
                </a>
              ) : null}
            </>
          }
        >
          {err.message} {help.detail} No research was added. ({fdatetime(err.at)})
        </Notice>
      ) : null}
      {r?.lastError?.code === "PARTIAL" ? <Notice kind="warn" title="Partial research">{r.lastError.message} Fill the gaps manually or leave them Unknown.</Notice> : null}

      <Errors errors={errors} />

      {editing ? (
        <Card title={`Edit research${r ? " · v" + (r.status === "complete" ? r.version + 1 : r.version) : ""}`} aside={<span style={{ fontSize: "11.5px", color: C.grey }}>Leave anything you could not confirm as Unknown.</span>}>
          <Notice kind="info">
            <strong>Observed</strong> = you saw it in a source (add the URL). <strong>Indicated</strong> = strongly suggested. <strong>Assumption</strong> = not confirmed. Editing a retrieved fact turns it into a manual fact.
          </Notice>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "12px" }}>
            {rows.map((row, i) => {
              const def = A.RESEARCH_FIELDS[i];
              return (
                <div key={row.field} style={{ borderBottom: "1px solid " + C.lineSoft, paddingBottom: "12px" }}>
                  {def.long ? (
                    <TextArea label={def.label} required={def.required} value={row.value} rows={2} onChange={(v) => setRow(i, { value: v, status: v ? (row.status === "Unknown" ? "Unverified" : row.status) : "Unknown" })} />
                  ) : (
                    <TextInput label={def.label} required={def.required} value={row.value} onChange={(v) => setRow(i, { value: v, status: v ? (row.status === "Unknown" ? "Unverified" : row.status) : "Unknown" })} />
                  )}
                  <Grid cols={3}>
                    <SelectInput label="Status" value={row.status} options={STATUSES} onChange={(v) => setRow(i, { status: v as FactStatus })} />
                    <SelectInput label="Confidence" value={row.confidence} options={CONFIDENCES} onChange={(v) => setRow(i, { confidence: v as Confidence })} />
                    <TextInput label="Source URL" value={row.source} onChange={(v) => setRow(i, { source: v })} placeholder="https://…" inputMode="url" />
                  </Grid>
                </div>
              );
            })}
            <TextArea label="Research notes" value={notes} onChange={setNotes} rows={3} placeholder="Anything else you checked, and where." />
          </div>
          <Actions>
            <Button onClick={save}>Save research</Button>
            <Button kind="secondary" onClick={() => (setEditing(false), setErrors([]))}>
              Cancel
            </Button>
          </Actions>
        </Card>
      ) : null}

      {r && !editing ? (
        <Card
          title={`Research v${r.version}`}
          aside={
            <span style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
              {modeBadge(r)}
              <Badge value={r.status === "complete" ? "Verified" : "Unverified"} title={r.status === "complete" ? "Research complete" : "Draft — not complete"} />
            </span>
          }
        >
          <div style={{ fontSize: "12px", color: C.grey, marginBottom: "8px" }}>
            {r.mode === "automated" ? `Retrieved by ${r.provider} · ${fdatetime(r.retrievedAt)}` : r.mode === "demo" ? "Demo dataset" : "Manual research"} · Last updated {fdatetime(r.updatedAt)}
            {r.status === "complete" ? ` · Completed ${fdatetime(r.completedAt)} (${r.verification?.type === "manual" ? "verified by you" : r.verification?.type === "automated" ? "automated sources" : "demo"})` : " · Draft"}
          </div>
          <FactsTable r={r} />
          {r.sources.length ? (
            <div style={{ marginTop: "12px" }}>
              <div style={labelStyle}>Sources ({r.sources.length})</div>
              {r.sources.map((s) => (
                <div key={s.url} style={{ fontSize: "12px", marginTop: "4px" }}>
                  <ExtLink href={s.url}>{s.title || s.url}</ExtLink> <span style={{ color: C.grey }}>· {s.sourceType} · {fdatetime(s.retrievedAt)}</span>
                </div>
              ))}
            </div>
          ) : null}
          {r.notes ? <KV k="Research notes" v={r.notes} /> : null}
        </Card>
      ) : null}

      {!r && !editing ? (
        <Notice kind="info" title="No research yet">
          {d.provider.automated ? "Run research from the website above, or research manually." : "Research the company manually: visit their website and record what you can confirm, with sources."}
        </Notice>
      ) : null}

      {r && r.status === "draft" && !editing ? (
        <Card title="Complete research">
          {check.missing.length ? (
            <div style={{ fontSize: "12.5px", color: C.redDark, marginBottom: "8px" }}>
              Still missing:
              <ul style={{ margin: "4px 0 0", paddingLeft: "18px" }}>
                {check.missing.filter((m) => m !== "Complete research").map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <Check
            label="I verified these details."
            hint={r.mode === "automated" ? "Optional for automated research with sources. Ticking records it as manually verified." : "Required for manual research: you checked the website and the details are correct."}
            checked={verified}
            onChange={setVerified}
          />
          <Actions>
            <Button onClick={complete}>Complete research</Button>
          </Actions>
        </Card>
      ) : null}
      {r && r.status === "complete" && !editing ? (
        <Notice kind="success" title="Research complete">
          Last researched {fdatetime(r.completedAt)}. To update it, {d.provider.automated ? "refresh research or " : ""}edit research — a new version is created and v{r.version} is kept.
        </Notice>
      ) : null}

      {history.length > 1 ? (
        <Card title="Research history">
          {history.map((h) => (
            <div key={h.id} style={{ display: "flex", gap: "10px", alignItems: "center", padding: "6px 0", borderBottom: "1px solid " + C.lineSoft, flexWrap: "wrap" }}>
              <strong style={{ fontSize: "13px" }}>v{h.version}</strong>
              {modeBadge(h)}
              <span style={{ fontSize: "12px", color: C.grey, flex: 1 }}>
                {fdatetime(h.updatedAt)} · {h.status} · {h.facts.filter((f) => f.status !== "Unknown").length} facts · {h.sources.length} sources
                {h.lastError && h.lastError.code !== "PARTIAL" ? " · failed: " + h.lastError.code : ""}
              </span>
              <Button small kind="secondary" onClick={() => setViewVersion(viewVersion === h.id ? null : h.id)}>
                {viewVersion === h.id ? "Hide" : "View"}
              </Button>
            </div>
          ))}
          {viewed ? (
            <div style={{ marginTop: "10px" }}>
              <FactsTable r={viewed} />
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
