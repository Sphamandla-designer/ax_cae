// Record shapes for the CAE dataset (V1 CRM + V2 intelligence layer + V2.5 workflow layer).

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

export interface LeadScores {
  problem: number;
  pay: number;
  need: number;
  access: number;
  growth: number;
}

export interface Research {
  summary: string;
  findings: string;
  completed: boolean;
}

export interface Company {
  id: string;
  name: string;
  industry: string;
  subIndustry: string;
  website: string;
  location: string;
  size: string;
  linkedin: string;
  description: string;
  leadSource: string;
  dateDiscovered: string;
  owner: string;
  campaign: string;
  stage: Stage;
  priority: string;
  scores: LeadScores;
  nextAction: { label: string; due: string };
  digital: Record<string, string>;
  stageSince: string;
  notReadyReason: string | null;
  overrideNotReady: boolean;
  research?: Research;
  isDemo?: boolean;
  isTest?: boolean;
}

export interface Contact {
  id: string;
  companyId: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  linkedin: string;
  decisionMaker: boolean;
  department?: string;
  role?: string;
  influence?: string;
  relationship?: string;
  lastContacted?: string | null;
  preferredChannel?: string;
  notes?: string;
}

export interface Opportunity {
  id: string;
  companyId: string;
  problems: string[];
  opportunity: string;
  service: string;
  type?: string;
  group?: string;
  valueBand: string;
  estValue: number;
  complexity?: string;
  scores: { severity: number; impact: number; fit: number; budget: number; likelihood: number };
}

export interface Scan {
  id: string;
  companyId: string;
  category: string;
  status: string;
  severity: string;
  problem: string;
  evidence: string;
  opportunity: string;
  impact: string;
  confidence: string;
}

export interface Signal {
  id: string;
  companyId: string;
  label: string;
  confidence: string;
}

export interface Strategy {
  id: string;
  companyId: string;
  problem: string;
  opportunity: string;
  target: string;
  service: string;
  entryOffer: string;
  angle: string;
  proof: string;
  nextStep: string;
  dealValue: string;
  difficulty: string;
}

export interface Why {
  companyId: string;
  why: string;
  primary: string;
  secondary: string;
  valueRange: string;
  approach: string;
}

export interface Outreach {
  id: string;
  companyId: string;
  channel: string;
  touch: number;
  message: string;
  dateSent: string | null;
  dateScheduled?: string | null;
  status: string;
  response: string;
  followUpDate: string | null;
  purpose: string;
  outcome: string;
  responseNotes: string;
}

export interface Task {
  id: string;
  companyId: string;
  title: string;
  type: string;
  priority: string;
  due: string;
  status: string;
  notes: string;
}

export interface Meeting {
  id: string;
  companyId: string;
  date: string;
  time: string;
  type: string;
  notes: string;
}

export interface Proposal {
  id: string;
  companyId: string;
  project: string;
  service: string;
  date: string;
  value: number;
  status: string;
  expiry: string;
  probability: number;
  notes: string;
}

export interface Client {
  id: string;
  companyId: string;
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
  name: string;
  target: string;
  offer: string;
  goal: string;
}

export interface Outcome {
  companyId: string;
  result: "Won" | "Lost";
  acqAtClose: number;
  oppAtClose: number;
  readinessAtClose: number;
  industry: string;
  service: string;
  value: number;
  source: string;
  campaign: string;
  daysToClose: number;
  reason?: string;
  notes: string;
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
}
