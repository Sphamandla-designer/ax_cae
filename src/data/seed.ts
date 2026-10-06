import { addDays, daysBetween } from "../lib/dates";
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

export function demoDb(today: string): Db {
  return shiftDates(JSON.parse(JSON.stringify(demo.db)) as Db, daysBetween(demo.TODAY, today));
}

export function emptyDb(): Db {
  const base = demoDb(demo.TODAY);
  return {
    ...base,
    companies: [],
    contacts: [],
    opportunities: [],
    outreach: [],
    tasks: [],
    meetings: [],
    proposals: [],
    clients: [],
    activities: [],
    scans: [],
    signals: [],
    strategies: [],
    whys: [],
    outcomes: [],
  };
}
