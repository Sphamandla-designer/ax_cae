// CAE data model, schema version 3.
// Every record carries its companyId (except workspace-level records) and isDemo. Dates are ISO
// "YYYY-MM-DD"; timestamps are full ISO strings.

export type Stage =
  | "New"
  | "Researching"
  | "Qualified"
  | "Outreach"
  | "Responded"
  | "Discovery"
  | "Proposal"
  | "Negotiation"
  | "Won"
  | "Lost";

/** How well a statement is supported. Observed requires a retrieved/inspected source. */
export type Confidence = "Observed" | "Indicated" | "Assumption";
/** Whether a research field has been checked. Unknown means nothing was found — never guessed. */
export type FactStatus = "Verified" | "Unverified" | "Unknown";
export type SourceType = "website" | "structured-data" | "provider" | "manual" | "demo";

export interface LeadScores {
  problem: number;
  pay: number;
  need: number;
  access: number;
  growth: number;
}

export interface Company {
  id: string;
  isDemo: boolean;
  name: string;
  /** Canonical URL ("https://example.co.za") or "" when unknown. */
  website: string;
  industry: string;
  subIndustry: string;
  location: string;
  size: string;
  linkedin: string;
  /** Short description shown in lists; mirrors the completed research description. */
  description: string;
  leadSource: string;
  dateDiscovered: string;
  owner: string;
  campaign: string;
  stage: Stage;
  stageSince: string;
  priority: string;
  scores: LeadScores;
  nextAction: { label: string; due: string };
  notReadyReason: string | null;
  overrideNotReady: boolean;
  createdAt: string;
  updatedAt: string;
}

/** One researched statement with provenance. */
export interface Fact {
  field: string;
  value: string;
  status: FactStatus;
  confidence: Confidence;
  /** URL the statement came from, "" for manual entries without a source. */
  source: string;
  sourceType: SourceType;
  retrievedAt: string;
  /** Quote or extracted context supporting the value. */
  evidence: string;
}

export interface ResearchSource {
  url: string;
  title: string;
  retrievedAt: string;
  sourceType: SourceType;
}

export type ResearchMode = "automated" | "manual" | "demo";

/** One research version. A company keeps every version; the newest is current. */
export interface Research {
  id: string;
  companyId: string;
  isDemo: boolean;
  version: number;
  mode: ResearchMode;
  provider: string;
  status: "draft" | "complete";
  createdAt: string;
  updatedAt: string;
  /** When the provider retrieved the sources (automated) — "" for manual research. */
  retrievedAt: string;
  facts: Fact[];
  sources: ResearchSource[];
  /** Last provider failure on this version, kept so the failure stays visible. */
  lastError: { code: string; message: string; at: string } | null;
  verification: { type: "manual" | "automated" | "demo"; confirmedAt: string } | null;
  completedAt: string;
  notes: string;
}

export interface Contact {
  id: string;
  companyId: string;
  isDemo: boolean;
  name: string;
  title: string;
  department: string;
  email: string;
  phone: string;
  linkedin: string;
  /** Explicit decision-maker flag. Only set by "Mark decision-maker" or the form's explicit checkbox. */
  decisionMaker: boolean;
  role: string;
  influence: string;
  relationship: string;
  lastContacted: string | null;
  preferredChannel: string;
  notes: string;
  source: string;
  confidence: Confidence;
}

export interface Opportunity {
  id: string;
  companyId: string;
  isDemo: boolean;
  problems: string[];
  consequence: string;
  opportunity: string;
  service: string;
  type: string;
  group: string;
  valueBand: string;
  estValue: number;
  complexity: string;
  scores: { severity: number; impact: number; fit: number; budget: number; likelihood: number };
  /** Supporting assessment records. */
  evidenceScanIds: string[];
  evidenceNote: string;
  /** Observed when backed by observed scans; Assumption must be validated in discovery. */
  basis: Confidence;
}

export interface Scan {
  id: string;
  companyId: string;
  isDemo: boolean;
  category: string;
  status: string;
  severity: string;
  problem: string;
  evidence: string;
  opportunity: string;
  impact: string;
  confidence: Confidence;
  source: string;
  sourceType: SourceType;
  assessedAt: string;
}

export interface Signal {
  id: string;
  companyId: string;
  isDemo: boolean;
  label: string;
  confidence: Confidence;
  source: string;
  recordedAt: string;
}

export interface Strategy {
  id: string;
  companyId: string;
  isDemo: boolean;
  problem: string;
  opportunity: string;
  targetContactId: string;
  target: string;
  service: string;
  valueProposition: string;
  entryOffer: string;
  angle: string;
  channel: string;
  cta: string;
  proof: string;
  nextStep: string;
  dealValue: string;
  difficulty: string;
  updatedAt: string;
}

export interface Why {
  companyId: string;
  isDemo: boolean;
  why: string;
  primary: string;
  secondary: string;
  valueRange: string;
  approach: string;
}

export type OutreachStatus = "Draft" | "Approved" | "Scheduled" | "Sent" | "Replied";

export interface Outreach {
  id: string;
  companyId: string;
  isDemo: boolean;
  contactId: string;
  channel: string;
  touch: number;
  purpose: string;
  message: string;
  status: OutreachStatus;
  createdAt: string;
  approvedAt: string | null;
  dateScheduled: string | null;
  dateSent: string | null;
  /** Response outcome (Positive, No response, Meeting booked, …) — separate from delivery status. */
  outcome: string;
  responseNotes: string;
  response: string;
  respondedAt: string | null;
  followUpDate: string | null;
  followUpSkipped: boolean;
}

export interface Task {
  id: string;
  companyId: string;
  isDemo: boolean;
  title: string;
  type: string;
  priority: string;
  due: string;
  status: string;
  notes: string;
  /** Outreach touch this follow-up task belongs to (one open task per touch). */
  outreachId: string | null;
}

export interface Meeting {
  id: string;
  companyId: string;
  isDemo: boolean;
  status: "Scheduled" | "Held" | "Cancelled";
  date: string;
  time: string;
  type: string;
  attendees: string;
  decisionMakerAttended: boolean;
  notes: string;
  painPoints: string;
  requirements: string;
  budget: string;
  timeline: string;
  nextStep: string;
  heldAt: string | null;
}

export type ProposalStatus = "Draft" | "Sent" | "Viewed" | "Negotiation" | "Accepted" | "Rejected" | "Expired";

export interface Proposal {
  id: string;
  companyId: string;
  isDemo: boolean;
  opportunityId: string;
  project: string;
  service: string;
  scope: string;
  value: number;
  status: ProposalStatus;
  date: string;
  sentDate: string | null;
  expiry: string;
  probability: number;
  notes: string;
  decidedAt: string | null;
}

export interface Client {
  id: string;
  companyId: string;
  isDemo: boolean;
  startDate: string;
  revenue: number;
  services: string[];
  status: string;
  growthOps: string[];
  referral: string;
}

export interface Activity {
  id: string;
  ts: string;
  companyId: string;
  isDemo: boolean;
  kind: string;
  text: string;
}

export interface Template {
  id: string;
  category: string;
  name: string;
  body: string;
}

export interface Campaign {
  id: string;
  isDemo: boolean;
  name: string;
  target: string;
  offer: string;
  goal: string;
}

export interface Outcome {
  companyId: string;
  isDemo: boolean;
  result: "Won" | "Lost";
  recordedAt: string;
  acqAtClose: number;
  oppAtClose: number;
  readinessAtClose: number;
  industry: string;
  service: string;
  value: number;
  source: string;
  campaign: string;
  daysToClose: number;
  reason: string;
  notes: string;
  competitor: string;
  reEntryDate: string | null;
}

export interface Targets {
  newProspects: number;
  qualified: number;
  outreach: number;
  followUps: number;
  meetings: number;
  proposals: number;
}

export interface Db {
  companies: Company[];
  research: Research[];
  contacts: Contact[];
  opportunities: Opportunity[];
  outreach: Outreach[];
  tasks: Task[];
  meetings: Meeting[];
  proposals: Proposal[];
  clients: Client[];
  activities: Activity[];
  templates: Template[];
  scans: Scan[];
  signals: Signal[];
  strategies: Strategy[];
  whys: Why[];
  campaigns: Campaign[];
  outcomes: Outcome[];
  targets: Targets;
  notes: Record<string, string>;
}

/** Collections that hold company-owned records (used by integrity checks and cascade delete). */
export const COMPANY_COLLECTIONS = [
  "research",
  "contacts",
  "opportunities",
  "outreach",
  "tasks",
  "meetings",
  "proposals",
  "clients",
  "activities",
  "scans",
  "signals",
  "strategies",
  "whys",
  "outcomes",
] as const;
