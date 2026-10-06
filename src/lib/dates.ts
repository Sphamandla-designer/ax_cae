// Calendar dates are ISO "YYYY-MM-DD" strings in the user's local time zone.

const pad = (n: number) => String(n).padStart(2, "0");

export function localISODate(d: Date = new Date()): string {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

export function localTime(d: Date = new Date()): string {
  return pad(d.getHours()) + ":" + pad(d.getMinutes());
}

/** Whole-day arithmetic on an ISO date, immune to time-zone and DST shifts. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.getUTCFullYear() + "-" + pad(t.getUTCMonth() + 1) + "-" + pad(t.getUTCDate());
}

export function daysBetween(from: string, to: string): number {
  const ms = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((ms(to) - ms(from)) / 86400000);
}
