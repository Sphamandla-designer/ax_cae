import { addDays, daysBetween } from "../lib/dates";
import { migrateLegacy } from "./migrate";
import * as demo from "./demo-v25";
import type { Db } from "./types";

export {
  STAGES,
  WORKFLOW,
  LEAD_SOURCES,
  SERVICE_GROUPS,
  SCAN_CATEGORIES,
  SCAN_STATUSES,
  SEVERITIES,
  CONTACT_ROLES,
  NEXT_ACTIONS_BY_STAGE,
  CONFIDENCE_LEVELS,
  OUTREACH_OUTCOMES,
  OUTCOME_NEXT,
  LOST_REASONS,
  STALL_THRESHOLDS,
  TOUCH_PURPOSES,
  DEFAULT_TARGETS,
} from "./demo-v25";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

// The demo dataset was authored around a fixed "today". Every date in it is moved by the same
// offset so the demo keeps its intended shape (what is due, overdue, stalled) on the real date.
function shiftDates<T>(value: T, days: number): T {
  if (typeof value === "string") {
    return (ISO_DATE.test(value) ? addDays(value, days) + value.slice(10) : value) as T;
  }
  if (Array.isArray(value)) return value.map((v) => shiftDates(v, days)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shiftDates(v, days)])) as T;
  }
  return value;
}

/** The demo workspace: fictional companies, every record flagged isDemo. */
export function demoDb(today: string): Db {
  return migrateLegacy(shiftDates(demo.db, daysBetween(demo.TODAY, today)), true, today);
}

/** An empty live workspace. Templates are product content and carry over; nothing else does. */
export function emptyDb(targets = { ...demo.DEFAULT_TARGETS }): Db {
  return {
    companies: [],
    research: [],
    contacts: [],
    opportunities: [],
    outreach: [],
    tasks: [],
    meetings: [],
    proposals: [],
    clients: [],
    activities: [],
    templates: JSON.parse(JSON.stringify(demo.db.templates)),
    scans: [],
    signals: [],
    strategies: [],
    whys: [],
    campaigns: [],
    outcomes: [],
    targets,
    notes: {},
  };
}
