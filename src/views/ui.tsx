// Shared building blocks in the AX-Channels design system (axchannels.co.za — assets/css/home.css):
// ink #0a0a0a on white, magenta accent #e0176b, cool neutrals, Archivo + JetBrains Mono, pill buttons.
// "gold*" names are kept for compatibility: C.gold is the brand accent; goldText/goldBg are the amber "needs attention" state.
import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from "react";

export const C = {
  navy: "#0a0a0a",
  ink: "#0a0a0a",
  gold: "#e0176b",
  goldText: "#7a4d00",
  grey: "#73767a",
  greyDark: "#2a2c31",
  greyMid: "#697080",
  line: "#e4e4e7",
  lineSoft: "#efeff1",
  paper: "#fafafa",
  green: "#2e7d5b",
  greenBg: "#e8f2ec",
  red: "#b0453c",
  redDark: "#8a3b34",
  redBg: "#f6e6e4",
  goldBg: "#fdf3dc",
  serif: "'Archivo',system-ui,sans-serif",
  mono: "'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace",
  accentDark: "#ff3d8a",
  accentBg: "#fde8f1",
  cyan: "#5cd1f0",
};

// Labels and eyebrows use the brand's mono caption style (JetBrains Mono, uppercase, tracked).
export const labelStyle: CSSProperties = {
  fontFamily: C.mono,
  fontSize: "10.5px",
  letterSpacing: ".08em",
  textTransform: "uppercase",
  color: C.grey,
  fontWeight: 500,
};
export const eyebrow: CSSProperties = {
  fontFamily: C.mono,
  fontSize: "10.5px",
  letterSpacing: ".1em",
  textTransform: "uppercase",
  color: C.gold,
  fontWeight: 500,
};
export const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  marginTop: "5px",
  border: "1px solid " + C.line,
  borderRadius: "8px",
  padding: "9px 12px",
  fontSize: "13px",
  background: "#fff",
  color: C.ink,
};

export function Card({
  children,
  style,
  title,
  aside,
  id,
}: {
  children: ReactNode;
  style?: CSSProperties;
  title?: ReactNode;
  aside?: ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      style={{ background: "#fff", border: "1px solid " + C.line, borderRadius: "12px", padding: "18px 20px", ...style }}
    >
      {title || aside ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: "10px",
            flexWrap: "wrap",
            marginBottom: "10px",
          }}
        >
          {title ? <h3 style={{ ...eyebrow, margin: 0 }}>{title}</h3> : <span />}
          {aside}
        </div>
      ) : null}
      {children}
    </section>
  );
}

type FieldProps = {
  label: string;
  required?: boolean;
  hint?: ReactNode;
  children: (id: string) => ReactNode;
  style?: CSSProperties;
};
export function Field({ label, required, hint, children, style }: FieldProps) {
  const id = useId();
  return (
    <div style={style}>
      <label htmlFor={id} style={labelStyle}>
        {label}
        {required ? <span style={{ color: C.red, marginLeft: "5px" }}>Required</span> : null}
      </label>
      {children(id)}
      {hint ? <div style={{ fontSize: "11.5px", color: C.grey, marginTop: "4px" }}>{hint}</div> : null}
    </div>
  );
}

export function TextInput(p: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
  hint?: ReactNode;
  style?: CSSProperties;
  min?: string;
  inputMode?: "numeric" | "url" | "email" | "tel";
}) {
  return (
    <Field label={p.label} required={p.required} hint={p.hint} style={p.style}>
      {(id) => (
        <input
          id={id}
          type={p.type || "text"}
          value={p.value}
          min={p.min}
          inputMode={p.inputMode}
          placeholder={p.placeholder}
          aria-required={p.required || undefined}
          onChange={(e) => p.onChange(e.target.value)}
          style={inputStyle}
        />
      )}
    </Field>
  );
}

export function TextArea(p: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  rows?: number;
  hint?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <Field label={p.label} required={p.required} hint={p.hint} style={p.style}>
      {(id) => (
        <textarea
          id={id}
          value={p.value}
          rows={p.rows || 3}
          placeholder={p.placeholder}
          aria-required={p.required || undefined}
          onChange={(e) => p.onChange(e.target.value)}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
        />
      )}
    </Field>
  );
}

export function SelectInput(p: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: (string | { value: string; label: string })[];
  required?: boolean;
  placeholder?: string;
  hint?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <Field label={p.label} required={p.required} hint={p.hint} style={p.style}>
      {(id) => (
        <select
          id={id}
          value={p.value}
          aria-required={p.required || undefined}
          onChange={(e) => p.onChange(e.target.value)}
          style={{ ...inputStyle, padding: "9px 10px" }}
        >
          {p.placeholder !== undefined ? <option value="">{p.placeholder}</option> : null}
          {p.options.map((o) => {
            const v = typeof o === "string" ? o : o.value;
            return (
              <option key={v} value={v}>
                {typeof o === "string" ? o : o.label}
              </option>
            );
          })}
        </select>
      )}
    </Field>
  );
}

export function Check({
  label,
  checked,
  onChange,
  hint,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: ReactNode;
}) {
  return (
    <label
      style={{
        display: "flex",
        gap: "9px",
        alignItems: "flex-start",
        fontSize: "13px",
        color: C.greyDark,
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: "2px", width: "15px", height: "15px", accentColor: C.navy }}
      />
      <span>
        {label}
        {hint ? (
          <span style={{ display: "block", fontSize: "11.5px", color: C.grey, marginTop: "2px" }}>{hint}</span>
        ) : null}
      </span>
    </label>
  );
}

type BtnKind = "primary" | "secondary" | "danger" | "gold" | "quiet";
const BTN: Record<BtnKind, CSSProperties> = {
  // Brand pills: black on light surfaces, magenta for the one action that matters most.
  primary: { background: C.navy, color: "#fff", border: "1px solid " + C.navy },
  gold: { background: C.gold, color: "#fff", border: "1px solid " + C.gold },
  secondary: { background: "#fff", color: C.greyDark, border: "1px solid " + C.line },
  danger: { background: "#fff", color: C.redDark, border: "1px solid #e3c3bf" },
  quiet: { background: "transparent", color: C.gold, border: "1px solid transparent", textDecoration: "underline" },
};
const HOVER: Record<BtnKind, string> = {
  primary: "ax-btn ax-btn--dark",
  gold: "ax-btn ax-btn--accent",
  secondary: "ax-btn hover-bg-f6f4ef",
  danger: "ax-btn hover-bg-f6e6e4",
  quiet: "",
};

export function Button({
  kind = "primary",
  children,
  onClick,
  disabled,
  small,
  type = "button",
  title,
  style,
}: {
  kind?: BtnKind;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  small?: boolean;
  type?: "button" | "submit";
  title?: string;
  style?: CSSProperties;
}) {
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      className={disabled ? undefined : HOVER[kind]}
      style={{
        ...BTN[kind],
        borderRadius: "999px",
        padding: small ? "6px 13px" : "10px 20px",
        fontSize: small ? "11.5px" : "13px",
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Actions({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginTop: "12px", ...style }}>
      {children}
    </div>
  );
}

export function Grid({ children, cols = 2, gap = "12px" }: { children: ReactNode; cols?: number; gap?: string }) {
  return (
    <div
      className={"cae-grid cae-grid-" + cols}
      style={{ display: "grid", gridTemplateColumns: `repeat(${cols},minmax(0,1fr))`, gap }}
    >
      {children}
    </div>
  );
}

const CONF: Record<string, [string, string, string]> = {
  Observed: [C.green, C.greenBg, "Observed — directly supported by a source"],
  Indicated: [C.goldText, C.goldBg, "Indicated — strongly suggested, not directly verified"],
  Assumption: [C.redDark, C.redBg, "Assumption — must be validated"],
  Verified: [C.green, C.greenBg, "Verified"],
  Unverified: [C.goldText, C.goldBg, "Not verified yet"],
  Unknown: [C.grey, C.lineSoft, "Not found — unknown"],
  DEMO: ["#5b4a8a", "#ece8f6", "Demo dataset — fictional"],
  // Record and system states (not provenance).
  Complete: [C.green, C.greenBg, "Complete"],
  Draft: [C.goldText, C.goldBg, "Draft — not complete"],
  Partial: [C.goldText, C.goldBg, "Partial — some information could not be retrieved"],
  Failed: [C.redDark, C.redBg, "Failed — nothing was retrieved"],
  Live: [C.green, C.greenBg, "Live workspace — real prospects"],
  Configured: [C.green, C.greenBg, "Configured"],
  "Not configured": [C.grey, C.lineSoft, "Not configured"],
  Clean: [C.green, C.greenBg, "No problems found"],
  "Problems found": [C.redDark, C.redBg, "Problems found"],
};
/** Text + colour badge (colour is never the only signal). */
export function Badge({ value, title }: { value: string; title?: string }) {
  const [fg, bg, t] = CONF[value] || [C.greyDark, C.lineSoft, value];
  return (
    <span
      title={title || t}
      style={{
        display: "inline-block",
        fontSize: "9.5px",
        fontFamily: C.mono,
        letterSpacing: ".04em",
        textTransform: "uppercase",
        fontWeight: 500,
        color: fg,
        background: bg,
        borderRadius: "999px",
        padding: "2px 8px",
        whiteSpace: "nowrap",
      }}
    >
      {value}
    </span>
  );
}

type NoticeKind = "error" | "warn" | "info" | "success";
const NOTICE: Record<NoticeKind, [string, string, string]> = {
  error: [C.redDark, C.redBg, "#e3c3bf"],
  warn: [C.goldText, C.goldBg, "#efd59a"],
  info: [C.greyDark, C.paper, C.line],
  success: [C.green, C.greenBg, "#bcdccb"],
};
export function Notice({
  kind = "info",
  title,
  children,
  actions,
}: {
  kind?: NoticeKind;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const [fg, bg, border] = NOTICE[kind];
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      style={{
        background: bg,
        border: "1px solid " + border,
        borderRadius: "10px",
        padding: "10px 14px",
        color: fg,
        fontSize: "12.5px",
        lineHeight: 1.5,
      }}
    >
      {title ? <div style={{ fontWeight: 700, marginBottom: children ? "3px" : 0 }}>{title}</div> : null}
      {children}
      {actions ? <Actions style={{ marginTop: "8px" }}>{actions}</Actions> : null}
    </div>
  );
}

/** Validation errors returned by an action ("Cannot … Missing:" + bullet lines). */
export function Errors({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return (
    <Notice kind="error" title={errors[0]}>
      {errors.length > 1 ? (
        <ul style={{ margin: "4px 0 0", paddingLeft: "18px" }}>
          {errors.slice(1).map((e, i) => (
            <li key={i}>{e.replace(/^•\s*/, "")}</li>
          ))}
        </ul>
      ) : null}
    </Notice>
  );
}

export function KV({ k, v, mono }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div style={{ borderBottom: "1px solid " + C.lineSoft, padding: "6px 0", minWidth: 0 }}>
      <div style={labelStyle}>{k}</div>
      <div
        style={{
          fontSize: "13px",
          marginTop: "3px",
          color: C.ink,
          overflowWrap: "anywhere",
          fontFamily: mono ? "monospace" : undefined,
        }}
      >
        {v}
      </div>
    </div>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div style={{ fontSize: "13px", color: C.grey, padding: "6px 0" }}>
      {children}
      {action ? <Actions>{action}</Actions> : null}
    </div>
  );
}

export function ExtLink({ href, children }: { href: string; children?: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: C.gold, overflowWrap: "anywhere" }}>
      {children || href}
    </a>
  );
}

/** Accessible dialog: Escape closes, focus moves in on open, Tab stays inside, focus returns on close. */
export function Modal({
  title,
  onClose,
  children,
  width = 640,
  footer,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  footer?: ReactNode;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const panel = ref.current!;
    const focusables = () =>
      [
        ...panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((e) => !e.hasAttribute("disabled"));
    (focusables()[1] || focusables()[0] || panel).focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close.current();
      } else if (e.key === "Tab") {
        const f = focusables();
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) (e.preventDefault(), f[f.length - 1].focus());
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) (e.preventDefault(), f[0].focus());
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      if (prev && document.contains(prev)) prev.focus();
    };
  }, []);
  return (
    <div
      className="cae-modal"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10,10,10,.55)",
        zIndex: 100,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "40px 16px",
        overflowY: "auto",
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{
          background: "#fff",
          borderRadius: "16px",
          width: "100%",
          maxWidth: width + "px",
          boxShadow: "0 20px 60px rgba(10,10,10,.35)",
          outline: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "16px 20px",
            borderBottom: "1px solid " + C.lineSoft,
          }}
        >
          <h2 id={titleId} style={{ fontFamily: C.serif, fontSize: "19px", fontWeight: 600, margin: 0, flex: 1 }}>
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "22px",
              lineHeight: 1,
              cursor: "pointer",
              color: C.grey,
              padding: "2px 6px",
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: "16px 20px" }}>{children}</div>
        {footer ? (
          <div
            style={{
              padding: "12px 20px",
              borderTop: "1px solid " + C.lineSoft,
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Keyboard activation for clickable non-button elements (Enter / Space behave like a click). */
export function activate(e: {
  key: string;
  preventDefault: () => void;
  currentTarget: EventTarget;
  target: EventTarget;
}) {
  if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).click();
  }
}
