import type { VM } from "../vm";
import { C } from "./ui";

export default function Topbar({ v }: { v: VM }) {
  return (
    <header
      className="cae-topbar"
      style={{
        minHeight: "58px",
        flex: "none",
        background: "#fff",
        borderBottom: "1px solid " + C.line,
        display: "flex",
        alignItems: "center",
        gap: "14px",
        padding: "0 24px",
        position: "relative",
        zIndex: 30,
      }}
    >
      <button
        type="button"
        className="cae-menu-btn"
        aria-label="Open navigation"
        aria-expanded={v.navOpen}
        onClick={v.toggleNav}
        style={{
          display: "none",
          background: "none",
          border: "1px solid " + C.line,
          borderRadius: "4px",
          padding: "6px 9px",
          fontSize: "16px",
          cursor: "pointer",
        }}
      >
        ☰
      </button>
      <h1
        style={{
          fontFamily: C.serif,
          fontSize: "17px",
          fontWeight: 600,
          margin: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {v.viewTitle}
      </h1>
      <div style={{ flex: "1" }} />
      <div className="cae-search" style={{ position: "relative", width: "300px" }}>
        <input
          type="search"
          aria-label="Search companies and contacts"
          value={v.search}
          onChange={v.setSearch}
          onKeyDown={(e) => {
            if (e.key === "Enter" && v.searchResults[0]) v.searchResults[0].on();
            if (e.key === "Escape") v.setSearch({ target: { value: "" } });
          }}
          placeholder="Search companies, contacts…"
          style={{
            width: "100%",
            boxSizing: "border-box",
            border: "1px solid " + C.line,
            borderRadius: "4px",
            padding: "7px 12px",
            fontSize: "13px",
            background: "#f6f4ef",
            color: C.ink,
          }}
        />
        {v.hasSearch || v.noSearchResults ? (
          <div
            role="listbox"
            aria-label="Search results"
            style={{
              position: "absolute",
              top: "38px",
              left: 0,
              right: 0,
              background: "#fff",
              border: "1px solid " + C.line,
              borderRadius: "5px",
              boxShadow: "0 8px 24px rgba(16,21,30,.08)",
              overflow: "hidden",
            }}
          >
            {v.searchResults.map((r) => (
              <button
                key={r.name}
                type="button"
                role="option"
                aria-selected={false}
                onClick={r.on}
                className="hover-bg-f6f4ef"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "8px",
                  border: "none",
                  borderBottom: "1px solid " + C.lineSoft,
                  background: "#fff",
                  textAlign: "left",
                  fontFamily: "inherit",
                }}
              >
                <span style={{ fontWeight: 500 }}>{r.name}</span>
                <span style={{ color: C.grey, fontSize: "12px" }}>{r.meta}</span>
              </button>
            ))}
            {v.noSearchResults ? (
              <div style={{ padding: "9px 12px", fontSize: "12.5px", color: C.grey }}>
                No matching companies or contacts.
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={v.toggleBell}
          aria-label={`Notifications (${v.bellCount || 0})`}
          aria-expanded={v.showBell}
          className="hover-bg-f6f4ef"
          style={{
            width: "34px",
            height: "34px",
            border: "1px solid " + C.line,
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            background: "#fff",
            position: "relative",
          }}
        >
          <span aria-hidden="true" style={{ fontSize: "15px" }}>
            ◦
          </span>
          {v.bellCount ? (
            <span
              style={{
                position: "absolute",
                top: "-6px",
                right: "-6px",
                background: C.red,
                color: "#fff",
                fontSize: "10px",
                fontWeight: 700,
                borderRadius: "9px",
                padding: "1px 5px",
              }}
            >
              {v.bellCount}
            </span>
          ) : null}
        </button>
        {v.showBell ? (
          <div
            className="cae-bell"
            style={{
              position: "absolute",
              top: "42px",
              right: 0,
              width: "330px",
              maxWidth: "calc(100vw - 32px)",
              background: "#fff",
              border: "1px solid " + C.line,
              borderRadius: "6px",
              boxShadow: "0 10px 28px rgba(16,21,30,.1)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "10px 14px",
                fontSize: "10.5px",
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: C.grey,
                borderBottom: "1px solid " + C.lineSoft,
              }}
            >
              Notifications
            </div>
            {v.bellItems.map((b, i) => (
              <button
                key={i}
                type="button"
                onClick={b.on}
                className="hover-bg-f6f4ef"
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 14px",
                  border: "none",
                  borderBottom: "1px solid " + C.lineSoft,
                  cursor: "pointer",
                  background: "#fff",
                  fontFamily: "inherit",
                }}
              >
                <span
                  style={{
                    display: "block",
                    fontSize: "10px",
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                    color: b.color,
                    fontWeight: 600,
                  }}
                >
                  {b.tag}
                </span>
                <span style={{ display: "block", fontSize: "13px", marginTop: "3px", color: C.ink }}>{b.text}</span>
              </button>
            ))}
            {v.noBell ? (
              <div style={{ padding: "12px 14px", fontSize: "12.5px", color: C.grey }}>Nothing needs attention.</div>
            ) : null}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={v.openAdd}
        className="hover-bg-a8863d cae-add-btn"
        style={{
          background: C.navy,
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          padding: "9px 16px",
          fontSize: "13px",
          fontWeight: 500,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        + Add prospect
      </button>
    </header>
  );
}
