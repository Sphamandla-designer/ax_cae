import type { VM } from "../vm";
import AnalyticsView from "./AnalyticsView";
import CampaignsView from "./CampaignsView";
import ClientsView from "./ClientsView";
import DashboardView from "./DashboardView";
import OpportunitiesView from "./OpportunitiesView";
import OutreachView from "./OutreachView";
import PipelineView from "./PipelineView";
import ProspectDetailView from "./ProspectDetailView";
import ProspectsView from "./ProspectsView";
import QueueView from "./QueueView";
import SettingsView from "./SettingsView";
import Sidebar from "./Sidebar";
import TasksView from "./TasksView";
import TemplatesView from "./TemplatesView";
import Topbar from "./Topbar";
import { Button, C, Notice } from "./ui";

export default function Layout({ v }: { v: VM }) {
  return (
    <div
      data-audit={v.audit}
      className="cae-shell"
      style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#f6f4ef" }}
    >
      <Sidebar v={v} />
      {v.navOpen ? <div className="cae-scrim" onClick={v.toggleNav} aria-hidden="true" /> : null}
      <div style={{ flex: "1", display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar v={v} />
        <main className="cae-content" style={{ flex: "1", overflowY: "auto", padding: "24px" }}>
          {v.storageError ? (
            <div style={{ marginBottom: "14px" }}>
              <Notice kind="error" title="Changes are not being saved">
                {v.storageError}
              </Notice>
            </div>
          ) : null}
          {v.notice ? (
            <div style={{ marginBottom: "14px" }}>
              <Notice
                kind={v.notice.kind}
                title={v.notice.title}
                actions={
                  <Button small kind="secondary" onClick={v.closeNotice}>
                    Dismiss
                  </Button>
                }
              >
                {v.notice.lines.filter(Boolean).length
                  ? v.notice.lines.filter(Boolean).map((l, i) => <div key={i}>{l}</div>)
                  : null}
              </Notice>
            </div>
          ) : null}
          {v.isDemo && !v.isDetail ? (
            <div
              style={{
                marginBottom: "14px",
                fontSize: "12px",
                color: C.goldText,
                background: C.goldBg,
                border: "1px solid #e0cf9e",
                borderRadius: "5px",
                padding: "8px 12px",
              }}
            >
              DEMO WORKSPACE — fictional companies for learning the workflow. Nothing here is real research.{" "}
              <button
                type="button"
                onClick={v.onDemoLabel}
                style={{
                  background: "none",
                  border: "none",
                  color: C.goldText,
                  textDecoration: "underline",
                  cursor: "pointer",
                  padding: 0,
                  fontFamily: "inherit",
                }}
              >
                Switch to your live workspace
              </button>
            </div>
          ) : null}
          {v.isDash ? <DashboardView v={v} /> : null}
          {v.isQueue ? <QueueView v={v} /> : null}
          {v.isCampaigns ? <CampaignsView v={v} /> : null}
          {v.isProspects ? <ProspectsView v={v} /> : null}
          {v.isDetail ? <ProspectDetailView v={v} /> : null}
          {v.isOpps ? <OpportunitiesView v={v} /> : null}
          {v.isOutreach ? <OutreachView v={v} /> : null}
          {v.isPipeline ? <PipelineView v={v} /> : null}
          {v.isClients ? <ClientsView v={v} /> : null}
          {v.isTasks ? <TasksView v={v} /> : null}
          {v.isAnalytics ? <AnalyticsView v={v} /> : null}
          {v.isTemplates ? <TemplatesView v={v} /> : null}
          {v.isSettings ? <SettingsView v={v} /> : null}
        </main>
      </div>
    </div>
  );
}
