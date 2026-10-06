import type { Db } from "../data/types";

const KEY = "ax-cae:v2.5.1";

export interface Saved {
  data: Db;
  notes: Record<string, string>;
  demo: boolean;
}

export function load(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

export function save(state: Saved): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked (private mode): the session keeps working in memory.
  }
}
