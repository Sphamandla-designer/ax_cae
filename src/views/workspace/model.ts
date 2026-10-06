import type { Company, Db } from "../../data/types";
import type { Ctx, Result } from "../../domain/actions";
import type { Variant } from "../../domain/generate";
import type { NextAction, StepDef, StepStatus } from "../../domain/workflow";
import type { ProviderInfo } from "../../research/provider";

/** Everything a prospect-workspace section needs: the records, derived state and the action runner. */
export interface DetailModel {
  db: Db;
  c: Company;
  today: string;
  focus: string;
  steps: (StepDef & { status: StepStatus })[];
  nba: NextAction;
  provider: ProviderInfo;
  researchRunning: boolean;
  /** Apply a domain action to the workspace. Returns the action's result so forms can show errors. */
  run: (f: (db: Db, ctx: Ctx) => Result) => Result;
  setFocus: (focus: string) => void;
  runResearch: (website: string) => void;
  openComposer: (opts: { variant?: Variant; outreachId?: string }) => void;
  openResponse: (outreachId: string) => void;
  openScore: () => void;
  openSettings: () => void;
  confirm: (message: string) => boolean;
  /** Pre-selected outcome kind when "Mark won/lost" was used. */
  outcomeKind: "Won" | "Lost" | null;
}

export const STEP_INFO: Record<string, { what: string; why: string }> = {
  company: { what: "The prospect's identity and profile.", why: "Everything else hangs off a correct company record." },
  research: {
    what: "Establish who they are from real sources: website, description, offering, location.",
    why: "Outreach built on unverified facts loses trust. Research is complete only with a confirmed website, a real description and sources (or your explicit verification).",
  },
  assessment: {
    what: "Record what is wrong with their digital experience — category, problem, evidence and source.",
    why: "Evidence turns an opinion (“bad website”) into a reason to talk. Three evidenced assessments complete the step.",
  },
  opportunity: {
    what: "Turn the evidence into a commercial opportunity with a value estimate.",
    why: "It decides what AX-Channels offers first and whether the prospect is worth pursuing.",
  },
  contacts: {
    what: "Find the person who can approve the work, and mark them as decision-maker.",
    why: "Outreach to the wrong person stalls. Decision-maker status is never inferred — you set it.",
  },
  prioritize: { what: "Score lead quality on five dimensions; the acquisition score combines it with the evidence.", why: "Ranks where your time goes. A judgement call — it does not block later steps." },
  strategy: {
    what: "Decide the problem to lead with, who to target, the value proposition, angle and channel.",
    why: "The strategy is your hypothesis. It must be grounded in the observed evidence shown alongside it.",
  },
  outreach: {
    what: "Draft the first message from verified information, approve it, then mark it as sent once you have actually sent it.",
    why: "Generating or copying a message is not sending it. Only “Mark as sent” records a sent touch and schedules the follow-up.",
  },
  followup: { what: "Work the four-touch cadence: each follow-up is a new message you send and log.", why: "Most replies come after the first touch — but only if each touch adds something new." },
  response: { what: "Record what the prospect actually replied.", why: "The response decides the next action: discovery, a different contact, or nurture." },
  discovery: { what: "Book the discovery meeting, then record what was learned once it has happened.", why: "Pain points, requirements, budget and timeline make the proposal specific." },
  proposal: { what: "A proposal linked to the opportunity, with scope, value and status.", why: "Tracks the commercial offer through sent, negotiation and decision." },
  outcome: { what: "Record Won or Lost deliberately, with value or reason.", why: "Closing preserves the full history and feeds analytics on what wins." },
};

export const FOCUS_TITLES: Record<string, string> = {
  company: "Company profile",
  research: "Research",
  assessment: "Digital assessment",
  opportunity: "Opportunity intelligence",
  contacts: "Decision-maker intelligence",
  prioritize: "Prioritise — acquisition score",
  strategy: "Acquisition strategy",
  outreach: "Outreach",
  followup: "Follow-up",
  response: "Response",
  discovery: "Discovery",
  proposal: "Proposal",
  outcome: "Won / lost outcome",
};
