import type { VM } from "../vm";
import axMark from "../assets/ax-mark-reversed.png";
import { C } from "./ui";

export default function Sidebar({ v }: { v: VM }) {
  return (
    <aside
      className={"cae-sidebar" + (v.navOpen ? " cae-sidebar-open" : "")}
      aria-label="Main navigation"
      style={{
        width: "230px",
        flex: "none",
        background: C.navy,
        color: "#e7e7ea",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "22px 20px 18px 20px", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
        <img src={axMark} alt="AX-Channels" width={58} height={28} style={{ display: "block" }} />
        <div
          style={{
            fontFamily: C.mono,
            fontSize: "10px",
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,.62)",
            marginTop: "12px",
          }}
        >
          Client Acquisition Engine
        </div>
      </div>
      <nav
        style={{
          padding: "14px 10px",
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          flex: "1",
          overflowY: "auto",
        }}
      >
        {v.nav.map((n) => (
          <button
            key={n.label}
            type="button"
            onClick={n.on}
            aria-current={n.current ? "page" : undefined}
            className="hover-color-ffffff"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "13.5px",
              color: n.color,
              background: n.bg,
              border: "none",
              borderLeft: "2px solid " + n.edge,
              textAlign: "left",
              fontFamily: "inherit",
            }}
          >
            <span>{n.label}</span>
            {n.count ? (
              <span
                style={{
                  fontSize: "10.5px",
                  background: C.gold,
                  color: C.navy,
                  fontWeight: 700,
                  borderRadius: "9px",
                  padding: "1px 7px",
                }}
                aria-label={n.count + " due"}
              >
                {n.count}
              </span>
            ) : null}
          </button>
        ))}
      </nav>
      <div style={{ padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,.08)" }}>
        <button
          type="button"
          onClick={v.onDemoLabel}
          title="Workspace settings"
          style={{
            display: "inline-block",
            fontSize: "10px",
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: v.isDemo ? C.gold : "#8fd1b3",
            border: "1px solid " + (v.isDemo ? "rgba(224,23,107,.55)" : "rgba(143,209,179,.55)"),
            background: "transparent",
            borderRadius: "999px",
            padding: "4px 9px",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {v.demoLabel}
        </button>
      </div>
    </aside>
  );
}
