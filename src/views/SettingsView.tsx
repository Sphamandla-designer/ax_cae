// Settings: workspace (demo vs live), research provider, targets, diagnostics and QA tools.
import { useRef, useState } from "react";
import type { ResearchSettings } from "../lib/storage";
import { fdatetime } from "../lib/format";
import type { VM } from "../vm";
import { Actions, Badge, Button, C, Card, Grid, KV, Notice, SelectInput, TextInput, labelStyle } from "./ui";

function ResearchProviderCard({ v }: { v: VM }) {
  const { info, settings, configFromFile } = v.research;
  const [mode, setMode] = useState<ResearchSettings["mode"]>(settings?.mode || info.mode);
  const [endpoint, setEndpoint] = useState(settings?.endpoint || info.endpoint || "");
  const [timeout, setTimeoutS] = useState(String(Math.round((settings?.timeoutMs || info.timeoutMs) / 1000)));
  return (
    <Card
      title="Research provider"
      aside={
        <Badge
          value={info.automated ? "Observed" : "Unknown"}
          title={info.automated ? "Automated research available" : "Manual research only"}
        />
      }
    >
      <div style={{ fontSize: "13px", color: C.greyDark, lineHeight: 1.55 }}>
        Currently:{" "}
        <strong>{info.automated ? info.label : "Manual research only — live research is not connected."}</strong>
        {info.problem ? <div style={{ color: C.red, marginTop: "4px" }}>{info.problem}</div> : null}
        <div style={{ fontSize: "12px", color: C.grey, marginTop: "6px" }}>
          A standalone HTML file cannot browse other websites by itself. Automated research needs a research{" "}
          <strong>proxy</strong> — a small server you run (server/research-proxy.mjs in the source) — or an{" "}
          <strong>API</strong> endpoint that implements the same contract and is safe to call from a browser. Never put
          API keys here; secrets belong on the proxy.
          {configFromFile
            ? " A window.CAE_CONFIG block in this file also configures a provider; settings saved here take precedence."
            : ""}
        </div>
      </div>
      <Grid cols={3}>
        <SelectInput
          label="Mode"
          value={mode}
          options={[
            { value: "manual", label: "Manual (no live research)" },
            { value: "proxy", label: "Proxy (your research server)" },
            { value: "api", label: "API (browser-safe endpoint)" },
          ]}
          onChange={(x) => setMode(x as ResearchSettings["mode"])}
        />
        <TextInput
          label="Endpoint URL"
          required={mode !== "manual"}
          value={endpoint}
          onChange={setEndpoint}
          placeholder="http://localhost:8787/research"
          inputMode="url"
        />
        <TextInput label="Timeout (seconds)" value={timeout} onChange={setTimeoutS} inputMode="numeric" />
      </Grid>
      <Actions>
        <Button
          onClick={() =>
            v.saveResearchSettings(
              mode === "manual" && !endpoint
                ? { mode, endpoint: "", timeoutMs: 25000 }
                : {
                    mode,
                    endpoint: endpoint.trim(),
                    timeoutMs: Math.max(5, Math.min(120, Number(timeout) || 25)) * 1000,
                  },
            )
          }
        >
          Save research provider
        </Button>
        {settings ? (
          <Button kind="secondary" onClick={() => v.saveResearchSettings(null)}>
            Use file default
          </Button>
        ) : null}
      </Actions>
    </Card>
  );
}

export default function SettingsView({ v }: { v: VM }) {
  const file = useRef<HTMLInputElement>(null);
  const ws = v.workspace;
  const st = v.selfTest;
  const passed = st ? st.results.filter((r) => r.ok).length : 0;
  return (
    <div
      className="cae-grid cae-grid-2"
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", alignItems: "start" }}
    >
      <Card
        title="Workspace"
        aside={
          <Badge
            value={ws.active === "live" ? "Verified" : "DEMO"}
            title={ws.active === "live" ? "Live workspace" : "Demo workspace"}
          />
        }
        style={{ gridColumn: "span 2" }}
      >
        <div style={{ fontSize: "13.5px", color: C.greyDark, lineHeight: 1.6 }}>
          You are in the{" "}
          <strong>
            {ws.active === "live" ? "LIVE workspace (real prospects)" : "DEMO workspace (fictional data)"}
          </strong>
          . The two are stored separately and never mix: demo records are always labelled DEMO and are never used as
          research for real prospects.
        </div>
        <Grid cols={2}>
          <KV k="Live workspace" v={ws.hasLive ? ws.liveCount + " companies" : "Not started"} />
          <KV k="Demo workspace" v={ws.hasDemo ? ws.demoCount + " companies (fictional)" : "Deleted"} />
        </Grid>
        <Actions>
          {ws.active === "demo" ? (
            <Button onClick={() => v.switchWorkspace("live")}>
              {ws.hasLive && ws.liveCount ? "Switch to live workspace" : "Start live workspace"}
            </Button>
          ) : (
            <Button kind="secondary" onClick={() => v.switchWorkspace("demo")}>
              {ws.hasDemo ? "Open demo workspace" : "Load demo workspace"}
            </Button>
          )}
          {ws.hasDemo ? (
            <Button kind="secondary" onClick={v.resetDemo}>
              Reset demo
            </Button>
          ) : null}
          {ws.hasDemo ? (
            <Button kind="danger" onClick={v.clearDemo}>
              Clear demo
            </Button>
          ) : null}
          <span style={{ flex: 1 }} />
          <Button kind="secondary" onClick={v.exportData}>
            Export data (JSON)
          </Button>
          <Button kind="secondary" onClick={() => file.current?.click()}>
            Import data
          </Button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            aria-label="Import CAE data file"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) v.importData(f);
              e.target.value = "";
            }}
          />
        </Actions>
        {v.storageError ? (
          <div style={{ marginTop: "10px" }}>
            <Notice kind="error" title="Changes are not being saved">
              {v.storageError}
            </Notice>
          </div>
        ) : null}
      </Card>

      <div style={{ gridColumn: "span 2" }}>
        <ResearchProviderCard v={v} />
      </div>

      <Card title="Studio">
        {v.settingsRows.map((r) => (
          <KV key={r.k} k={r.k} v={r.v} />
        ))}
      </Card>

      <Card title="Daily acquisition targets">
        <div style={{ fontSize: "12px", color: C.grey }}>
          Operating targets, not quotas. They drive the dashboard progress bars.
        </div>
        {v.settingsTargets.map((t) => (
          <div
            key={t.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "7px 0",
              borderBottom: "1px solid " + C.lineSoft,
            }}
          >
            <label style={{ fontSize: "13px", color: C.greyDark }} htmlFor={"tgt-" + t.label.replace(/\W+/g, "-")}>
              {t.label}
            </label>
            <input
              id={"tgt-" + t.label.replace(/\W+/g, "-")}
              type="number"
              min={0}
              max={100}
              value={t.val}
              onChange={t.on}
              style={{
                width: "70px",
                border: "1px solid " + C.line,
                borderRadius: "4px",
                padding: "6px 9px",
                fontSize: "13px",
                textAlign: "right",
                background: C.paper,
              }}
            />
          </div>
        ))}
      </Card>

      <Card
        title="Diagnostics"
        style={{ gridColumn: "span 2" }}
        aside={
          <Badge
            value={v.integrity.ok ? "Verified" : "Assumption"}
            title={v.integrity.ok ? "No integrity problems" : "Integrity problems found"}
          />
        }
      >
        <Grid cols={2}>
          {v.diagnostics.map((r) => (
            <KV key={r.k} k={r.k} v={r.v} />
          ))}
        </Grid>
        {v.integrity.orphans.length ? (
          <Actions>
            <Button kind="danger" onClick={v.repairOrphans}>
              Remove {v.integrity.orphans.length} orphan record(s)
            </Button>
          </Actions>
        ) : null}
      </Card>

      <Card title="Development · QA" style={{ gridColumn: "span 2" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            padding: "8px 0",
            borderBottom: "1px solid " + C.lineSoft,
            flexWrap: "wrap",
          }}
        >
          <span>
            <span style={{ display: "block", fontSize: "13px", fontWeight: 600 }}>Interaction audit</span>
            <span style={{ display: "block", fontSize: "11.5px", color: C.grey, marginTop: "2px" }}>
              Outlines every interactive element so dead controls are obvious
            </span>
          </span>
          <button
            type="button"
            aria-pressed={v.audit === "on"}
            onClick={v.toggleAudit}
            style={{
              border: "1px solid " + C.line,
              background: v.auditBg,
              color: v.auditFg,
              borderRadius: "4px",
              padding: "8px 16px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {v.auditLabel}
          </button>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            padding: "10px 0",
            flexWrap: "wrap",
          }}
        >
          <span style={{ flex: "1 1 300px" }}>
            <span style={{ display: "block", fontSize: "13px", fontWeight: 600 }}>Workflow self-test</span>
            <span style={{ display: "block", fontSize: "11.5px", color: C.grey, marginTop: "2px" }}>
              Runs the real workflow functions — create → research → assessment → opportunity → decision-maker →
              strategy → draft → sent → follow-up → response → discovery → proposal → outcome → reload → delete — on an
              isolated copy. Your data is never touched and no test records are left behind.
            </span>
          </span>
          <Button onClick={v.runTest}>Run self-test</Button>
        </div>
        {st ? (
          <div style={{ borderTop: "1px solid " + C.lineSoft, paddingTop: "10px" }}>
            <div
              style={{ fontSize: "13px", fontWeight: 700, color: passed === st.results.length ? C.green : C.red }}
              role="status"
            >
              {passed} of {st.results.length} checks passed · {fdatetime(st.at)}
            </div>
            {st.results.map((r, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: "10px",
                  alignItems: "baseline",
                  padding: "5px 0",
                  borderBottom: "1px solid " + C.lineSoft,
                  fontSize: "12.5px",
                }}
              >
                <strong style={{ color: r.ok ? C.green : C.red, width: "44px", flex: "none" }}>
                  {r.ok ? "PASS" : "FAIL"}
                </strong>
                <span style={{ flex: 1 }}>
                  {r.name} <span style={{ color: C.grey }}>— {r.note}</span>
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
