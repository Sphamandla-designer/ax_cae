import * as A from "../../domain/actions";
import { acq } from "../../domain/workflow";
import { Button, C, Card, Errors } from "../ui";
import { useState } from "react";
import type { DetailModel } from "./model";

const DIMS: [keyof DetailModel["c"]["scores"], string][] = [
  ["problem", "Digital problem"],
  ["pay", "Ability to pay"],
  ["need", "Potential need"],
  ["access", "Decision-maker access"],
  ["growth", "Company growth / activity"],
];

export default function PrioritySection({ d }: { d: DetailModel }) {
  const { c } = d;
  const a = acq(d.db, c, d.today);
  const [errors, setErrors] = useState<string[]>([]);
  const setScore = (k: (typeof DIMS)[number][0], n: number) => {
    const next = c.scores[k] === n && n === 1 ? 0 : n;
    const r = d.run((db, ctx) => A.setScore(db, c.id, k, next, ctx));
    setErrors(r.ok ? [] : r.errors);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <Card title="Lead qualification" aside={<span style={{ fontSize: "12px", color: C.grey }}>Your judgement, 1–5 per dimension</span>}>
        {DIMS.map(([k, label]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 0", borderBottom: "1px solid " + C.lineSoft }}>
            <span style={{ flex: 1, fontSize: "13px" }}>{label}</span>
            <span role="radiogroup" aria-label={label} style={{ display: "flex", gap: "5px" }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={c.scores[k] === n}
                  aria-label={`${label}: ${n}`}
                  onClick={() => setScore(k, n)}
                  style={{ width: "22px", height: "22px", borderRadius: "11px", border: "1px solid " + (n <= c.scores[k] ? C.navy : "#d8d2c2"), background: n <= c.scores[k] ? C.navy : "#fff", cursor: "pointer", padding: 0 }}
                />
              ))}
            </span>
            <span style={{ width: "28px", textAlign: "right", fontSize: "12px", fontWeight: 700 }}>{c.scores[k] || "—"}</span>
          </div>
        ))}
        <Errors errors={errors} />
      </Card>
      <Card title="Acquisition score breakdown" aside={<span style={{ fontWeight: 700, color: a.bandColor, fontSize: "12px" }}>{a.band} · {a.total}/100</span>}>
        {a.parts.map((p) => (
          <div key={p.label} style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", padding: "5px 0", borderBottom: "1px solid " + C.lineSoft }}>
            <span>{p.label}</span>
            <strong>
              {p.val}/{p.max}
            </strong>
          </div>
        ))}
        <div style={{ fontSize: "12.5px", color: C.greyDark, marginTop: "8px" }}>{a.reason}</div>
        <div style={{ marginTop: "10px" }}>
          <Button small kind="secondary" onClick={d.openScore}>
            Open full breakdown
          </Button>
        </div>
      </Card>
    </div>
  );
}
