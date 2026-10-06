// Versioned workspace storage (CAE_DATA_V3).
//
// One envelope holds two fully separate workspaces — live (real prospects) and demo (fictional data) —
// so demo records can never mix with live ones. Before each write the previous good save is kept as a
// backup. A save that cannot be read is never overwritten automatically: the app shows a recovery
// screen (restore backup / export raw data / reset).
import { COMPANY_COLLECTIONS, type Db } from "../data/types";
import { migrateLegacy } from "../data/migrate";

export const STORAGE_KEY = "CAE_DATA_V3";
export const BACKUP_KEY = "CAE_DATA_V3_BACKUP";
const LEGACY_KEY = "ax-cae:v2.5.1";
export const SCHEMA_VERSION = 3;

export type WorkspaceKind = "live" | "demo";

export interface ResearchSettings {
  mode: "manual" | "proxy" | "api";
  endpoint: string;
  timeoutMs: number;
}

export interface Settings {
  /** Research provider chosen in Settings; null = use window.CAE_CONFIG / manual. Never holds secrets. */
  research: ResearchSettings | null;
  firstRunDone: boolean;
}

export interface Envelope {
  schemaVersion: number;
  updatedAt: string;
  active: WorkspaceKind;
  workspaces: { live: Db | null; demo: Db | null };
  settings: Settings;
}

export type LoadResult =
  | { kind: "empty" }
  | { kind: "ok"; env: Envelope; migratedFrom?: string }
  | { kind: "corrupt"; raw: string; error: string; backup: Envelope | null };

const ARRAYS = ["companies", "templates", "campaigns", ...COMPANY_COLLECTIONS] as const;

/** Throws with a readable reason when a stored workspace does not have the V3 shape. */
export function assertDb(db: unknown, label: string): asserts db is Db {
  if (!db || typeof db !== "object") throw new Error(`${label}: workspace is missing`);
  const d = db as Record<string, unknown>;
  for (const k of ARRAYS) if (!Array.isArray(d[k])) throw new Error(`${label}: "${k}" is not a list`);
  if (!d.targets || typeof d.targets !== "object") throw new Error(`${label}: targets are missing`);
  if (!d.notes || typeof d.notes !== "object") throw new Error(`${label}: notes are missing`);
}

export function parseEnvelope(raw: string): Envelope {
  let env: Envelope;
  try {
    env = JSON.parse(raw);
  } catch (e) {
    throw new Error("the saved data is not valid JSON (" + (e as Error).message + ")");
  }
  if (!env || typeof env !== "object") throw new Error("the saved data is empty");
  if (env.schemaVersion !== SCHEMA_VERSION) throw new Error(`unsupported schema version ${String(env.schemaVersion)}`);
  if (env.active !== "live" && env.active !== "demo") throw new Error("the active workspace is not recorded");
  if (!env.workspaces) throw new Error("no workspaces were saved");
  if (env.workspaces.live) assertDb(env.workspaces.live, "live workspace");
  if (env.workspaces.demo) assertDb(env.workspaces.demo, "demo workspace");
  if (!env.workspaces[env.active]) throw new Error(`the active ${env.active} workspace is missing`);
  env.settings = { research: null, firstRunDone: true, ...((env.settings || {}) as Partial<Settings>) };
  return env;
}

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function storageAvailable(): boolean {
  try {
    const k = "__cae_probe__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export function load(today: string): LoadResult {
  const raw = readKey(STORAGE_KEY);
  if (raw) {
    try {
      return { kind: "ok", env: parseEnvelope(raw) };
    } catch (e) {
      let backup: Envelope | null = null;
      const b = readKey(BACKUP_KEY);
      if (b) {
        try {
          backup = parseEnvelope(b);
        } catch {
          backup = null;
        }
      }
      return { kind: "corrupt", raw, error: (e as Error).message, backup };
    }
  }
  // One-time upgrade from the V2.5.1 build.
  const legacy = readKey(LEGACY_KEY);
  if (legacy) {
    try {
      const old = JSON.parse(legacy);
      const kind: WorkspaceKind = old.demo === false ? "live" : "demo";
      const db = migrateLegacy(old.data, kind === "demo", today);
      db.notes = old.notes || {};
      return {
        kind: "ok",
        migratedFrom: LEGACY_KEY,
        env: {
          schemaVersion: SCHEMA_VERSION,
          updatedAt: new Date().toISOString(),
          active: kind,
          workspaces: { live: kind === "live" ? db : null, demo: kind === "demo" ? db : null },
          settings: { research: null, firstRunDone: true },
        },
      };
    } catch (e) {
      return { kind: "corrupt", raw: legacy, error: "the V2.5.1 workspace could not be upgraded (" + (e as Error).message + ")", backup: null };
    }
  }
  return { kind: "empty" };
}

export type SaveResult = { ok: true; at: string } | { ok: false; error: string };

export function save(env: Envelope): SaveResult {
  const at = new Date().toISOString();
  const json = JSON.stringify({ ...env, schemaVersion: SCHEMA_VERSION, updatedAt: at });
  try {
    const prev = localStorage.getItem(STORAGE_KEY);
    if (prev && prev !== json) {
      try {
        parseEnvelope(prev);
        localStorage.setItem(BACKUP_KEY, prev);
      } catch {
        // never replace a good backup with an unreadable save
      }
    }
    localStorage.setItem(STORAGE_KEY, json);
    return { ok: true, at };
  } catch (e) {
    const err = e as DOMException;
    const quota = err && (err.name === "QuotaExceededError" || err.code === 22);
    return {
      ok: false,
      error: quota
        ? "The browser's storage for this file is full."
        : "The browser blocked storage (" + (err?.message || String(e)) + ").",
    };
  }
}

/** Clear the corrupt save only after the user has chosen what to do with it. */
export function discardStored(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing else to do
  }
}

export function downloadJson(filename: string, text: string): void {
  const blob = new Blob([text], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
