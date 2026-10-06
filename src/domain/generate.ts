// Outreach drafting from recorded evidence only.
//
// The generator may use: the company name, completed research, assessments with evidence, the recorded
// opportunity, the chosen contact and the acquisition strategy. It never adds facts about the company
// (launches, funding, size, customers, technology…). When there is not enough verified material it
// returns the INSUFFICIENT notice instead of a message.
import type { Db } from "../data/types";
import { INSUFFICIENT } from "./actions";
import { bestOpp, companyOf, contactsOf, dmOf, isValidScan, scansOf, sevRank, strategyOf } from "./queries";
import { researchCheck } from "./workflow";

export const VARIANTS = ["LinkedIn", "Email", "Follow-up", "Final follow-up"] as const;
export type Variant = (typeof VARIANTS)[number];

export interface Basis {
  k: string;
  v: string;
  basis: string;
}

export interface Draft {
  variant: Variant;
  text: string;
  insufficient: boolean;
  missing: string[];
  used: Basis[];
  cta: string;
  note: string;
}

const lc = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const stripDot = (s: string) => s.replace(/[.\s]+$/, "");

export function draftMessage(db: Db, cid: string, variant: Variant, contactId?: string): Draft {
  const c = companyOf(db, cid)!;
  const contact = (contactId && contactsOf(db, cid).find((p) => p.id === contactId)) || dmOf(db, cid) || null;
  const scan = scansOf(db, cid)
    .filter((s) => isValidScan(s) && s.confidence !== "Assumption")
    .sort((a, b) => (a.confidence === "Observed" ? -1 : 0) - (b.confidence === "Observed" ? -1 : 0) || sevRank(b.severity) - sevRank(a.severity))[0];
  const opp = bestOpp(db, cid);
  const st = strategyOf(db, cid);
  const researched = researchCheck(db, c).ok;

  const missing: string[] = [];
  if (!contact) missing.push("A contact to address (add the decision-maker)");
  if (!scan) missing.push("An evidenced assessment finding (Observed or Indicated, with evidence)");
  if (!researched) missing.push("Completed company research");
  const used: Basis[] = [];
  if (contact) used.push({ k: "Recipient", v: `${contact.name} · ${contact.title}${contact.decisionMaker ? " (decision-maker)" : ""}`, basis: contact.confidence + (contact.source ? " · " + contact.source : "") });
  if (scan) used.push({ k: "Observed problem", v: `${scan.category}: ${scan.problem}`, basis: scan.confidence + (scan.source ? " · " + scan.source : "") });
  if (scan) used.push({ k: "Evidence", v: scan.evidence, basis: scan.confidence });
  if (opp) used.push({ k: "Recorded opportunity", v: opp.opportunity, basis: "Your opportunity record (" + opp.basis + ")" });
  if (st) used.push({ k: "Strategy", v: [st.valueProposition, st.angle].filter(Boolean).join(" — "), basis: "Your strategy (hypothesis)" });

  const meta = {
    LinkedIn: { cta: "Ask whether they'd like the short write-up", note: "Short and conversational: observation → why it matters → one low-friction ask." },
    Email: { cta: st?.cta || "Offer a short call", note: "A little more context. No pleasantries, no agency claims." },
    "Follow-up": { cta: "Offer the concrete next piece", note: "Adds something new — never “just following up”." },
    "Final follow-up": { cta: "Close the loop politely", note: "Last touch: leave the door open, no pressure." },
  }[variant];

  if (missing.length) return { variant, text: INSUFFICIENT + "\n\nMissing:\n" + missing.map((m) => "• " + m).join("\n"), insufficient: true, missing, used, ...meta };

  const first = contact!.name.split(/\s+/)[0];
  const cat = lc(scan!.category);
  const problem = stripDot(lc(scan!.problem));
  const evidence = stripDot(scan!.evidence);
  const oppLine = opp ? stripDot(opp.opportunity) : "";
  const value = st?.valueProposition ? stripDot(st.valueProposition) : "";
  const offer = st?.entryOffer ? lc(stripDot(st.entryOffer)) : "a short write-up of what I found";
  const ask = st?.cta ? lc(stripDot(st.cta)) : "a 15-minute call";
  const notDm = !contact!.decisionMaker;
  // An Indicated finding is a hypothesis: the message must say so, never present it as something seen.
  const seen = scan!.confidence === "Observed";
  const noticed = seen ? "noticed" : "it looks like there may be";

  let text = "";
  if (variant === "LinkedIn") {
    text =
      `Hi ${first} — I was looking at ${c.name}'s ${cat} and ${noticed} ${problem} (${evidence}).\n\n` +
      (oppLine ? `It looks like there's a contained fix: ${lc(oppLine)}.\n\n` : "") +
      `I've put together ${offer}. Happy to send it over if useful.`;
  } else if (variant === "Email") {
    text =
      `Subject: ${c.name} — ${scan!.category.toLowerCase()}\n\nHi ${first},\n\n` +
      `While reviewing ${c.name}'s ${cat} ${seen ? "I noticed" : "it looked like there may be"} ${problem}. ${seen ? "What I saw" : "What suggests it"}: ${evidence}.\n\n` +
      (opp?.consequence ? `If that holds up, it may be costing ${lc(stripDot(opp.consequence))}.\n\n` : "") +
      (oppLine ? `The opportunity as I see it: ${lc(oppLine)}.` + (value ? ` ${value}.` : "") + "\n\n" : value ? value + ".\n\n" : "") +
      `I'd rather show than tell, so I've prepared ${offer}. Would ${ask} be useful?\n\n— AX-Channels`;
  } else if (variant === "Follow-up") {
    text =
      `Hi ${first} — following up on my note about ${problem} on ${c.name}'s ${cat}.\n\n` +
      (st?.angle ? `One more thought: ${lc(stripDot(st.angle))}.\n\n` : value ? `${value}.\n\n` : "") +
      `I can share ${offer} — want me to send it?` +
      (notDm ? "\n\nIf this sits with someone else on your side, I'm happy to be pointed their way." : "");
  } else {
    text =
      `Hi ${first} — last note from me on this.\n\n` +
      `If ${problem} isn't a priority right now, that's completely fair. If it comes up later, I'm one reply away.\n\n— AX-Channels`;
  }
  return { variant, text, insufficient: false, missing: [], used, ...meta };
}
