// Screens shown before the workspace: storage recovery and first-run choice.
import type { Envelope, WorkspaceKind } from "../lib/storage";
import { downloadJson } from "../lib/storage";
import { fdatetime } from "../lib/format";
import { Button, C, Modal, Notice } from "./ui";

export function Recovery({
  c,
  restore,
  reset,
}: {
  c: { raw: string; error: string; backup: Envelope | null };
  restore: () => void;
  reset: (k: WorkspaceKind) => void;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f6f4ef",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
      }}
    >
      <main
        style={{
          background: "#fff",
          border: "1px solid " + C.line,
          borderRadius: "8px",
          maxWidth: "620px",
          width: "100%",
          padding: "28px",
        }}
      >
        <div style={{ fontFamily: C.serif, fontSize: "22px", fontWeight: 600 }}>
          Your saved workspace could not be read
        </div>
        <p style={{ fontSize: "13.5px", color: C.greyDark, lineHeight: 1.6 }}>
          The CAE found saved data in this browser but it is unreadable: <strong>{c.error}</strong>. Nothing has been
          overwritten. Choose what to do — export the raw data first if you might need it.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {c.backup ? (
            <Notice
              kind="info"
              title="A backup of the previous save is available"
              actions={<Button onClick={restore}>Restore backup</Button>}
            >
              Saved {fdatetime(c.backup.updatedAt)} · {c.backup.workspaces.live?.companies.length || 0} live and{" "}
              {c.backup.workspaces.demo?.companies.length || 0} demo companies.
            </Notice>
          ) : (
            <Notice kind="warn" title="No readable backup">
              There is no earlier save to restore.
            </Notice>
          )}
          <Notice
            kind="info"
            title="Keep a copy"
            actions={
              <Button kind="secondary" onClick={() => downloadJson("cae-unreadable-data.json", c.raw)}>
                Export raw data
              </Button>
            }
          >
            Downloads the unreadable data exactly as stored, so nothing is lost.
          </Notice>
          <Notice
            kind="error"
            title="Reset workspace"
            actions={
              <>
                <Button kind="danger" onClick={() => reset("live")}>
                  Start an empty live workspace
                </Button>
                <Button kind="secondary" onClick={() => reset("demo")}>
                  Start with demo data
                </Button>
              </>
            }
          >
            Discards the unreadable data.
          </Notice>
        </div>
      </main>
    </div>
  );
}

export function FirstRun({ choose }: { choose: (k: WorkspaceKind) => void }) {
  return (
    <Modal title="Welcome to the AX-Channels CAE" onClose={() => choose("demo")} width={560}>
      <p style={{ fontSize: "13.5px", color: C.greyDark, lineHeight: 1.6, marginTop: 0 }}>
        Two separate workspaces live in this file. They never mix.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <Notice
          kind="success"
          title="Live workspace — real prospects"
          actions={<Button onClick={() => choose("live")}>Start live workspace</Button>}
        >
          Empty. Every company you add is real; research must come from real sources or your own verification.
        </Notice>
        <Notice
          kind="info"
          title="Demo workspace — fictional data"
          actions={
            <Button kind="secondary" onClick={() => choose("demo")}>
              Explore the demo
            </Button>
          }
        >
          Sample companies (LumoPay, Karoo Ridge Mining…) to learn the workflow. Clearly labelled DEMO; switch any time
          in Settings.
        </Notice>
      </div>
    </Modal>
  );
}
