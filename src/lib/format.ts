// Display formatting. Dates are stored as ISO; shown South-African style: "06 Oct 2026".
const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fdate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return "—";
  return m[3] + " " + M[Number(m[2]) - 1] + " " + m[1];
}

/** Timestamp in local time: "06 Oct 2026, 21:40". */
export function fdatetime(ts: string | null | undefined): string {
  if (!ts) return "—";
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(ts)) return fdate(ts) + ", " + ts.slice(11);
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return fdate(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return pad(d.getDate()) + " " + M[d.getMonth()] + " " + d.getFullYear() + ", " + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

export function money(v: number | null | undefined): string {
  return v ? "R" + String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") : "—";
}

export const orUnknown = (s: string | null | undefined, unknown = "Unknown") => (s && s.trim() ? s : unknown);
