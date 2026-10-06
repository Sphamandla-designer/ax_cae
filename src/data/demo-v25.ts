// AX-Channels CAE V2.5 — workflow layer. Extends the V2 dataset without modifying it.
import { db as v2, TODAY, STAGES, SERVICES, LEAD_SOURCES, SERVICE_GROUPS, SCAN_CATEGORIES, SCAN_STATUSES, SEVERITIES, CONTACT_ROLES, NEXT_ACTIONS_BY_STAGE } from './demo-v2';
export { TODAY, STAGES, SERVICES, LEAD_SOURCES, SERVICE_GROUPS, SCAN_CATEGORIES, SCAN_STATUSES, SEVERITIES, CONTACT_ROLES, NEXT_ACTIONS_BY_STAGE };

export const WORKFLOW = ['Company','Research','Digital assessment','Opportunity','Decision-maker','Strategy','Outreach','Follow-up','Discovery','Proposal','Outcome'];
export const CONFIDENCE_LEVELS = ['Observed','Indicated','Assumption'];
export const OUTREACH_OUTCOMES = ['Sent','Viewed','Replied','Positive','Neutral','Negative','No response','Wrong person','Not interested','Meeting booked'];
export const OUTCOME_NEXT = {
  'Positive':'Schedule discovery',
  'Meeting booked':'Prepare discovery',
  'Replied':'Qualify the reply, then schedule discovery',
  'No response':'Follow up',
  'Wrong person':'Identify correct decision-maker',
  'Not interested':'Move to nurture',
  'Negative':'Close / nurture',
  'Neutral':'Set nurture date',
  'Viewed':'Follow up',
  'Sent':'Await reply — follow up on cadence'
};
export const LOST_REASONS = ['No budget','No current need','Wrong timing','Chose competitor','No response','Wrong decision-maker','Poor fit','Project cancelled','Other'];
export const STALL_THRESHOLDS = {Researching:7, Qualified:7, Outreach:10, Responded:5, Discovery:10, Proposal:14, Negotiation:14};
export const DEFAULT_TARGETS = {newProspects:5, qualified:3, outreach:5, followUps:3, meetings:1, proposals:1};
export const TOUCH_PURPOSES = {1:'Initial observation', 2:'New value / insight', 3:'Relevant proof or concept', 4:'Close the loop'};

// Evidence confidence per scan record (Observed = directly confirmed, Indicated = strong signal, Assumption = unconfirmed)
const scanConfidence: Record<string, string> = {
  sc1:'Observed', sc2:'Observed', sc3:'Observed', sc4:'Observed', sc5:'Observed',
  sc6:'Observed', sc7:'Observed', sc8:'Indicated', sc9:'Observed',
  sc10:'Observed', sc11:'Observed', sc12:'Observed',
  sc13:'Observed', sc14:'Indicated', sc15:'Observed',
  sc16:'Observed', sc17:'Indicated', sc18:'Assumption',
  sc19:'Observed', sc20:'Observed', sc21:'Indicated'
};
const signalConfidence: Record<string, string> = {
  sg1:'Observed', sg2:'Observed', sg3:'Indicated', sg4:'Observed', sg5:'Observed',
  sg6:'Indicated', sg7:'Indicated', sg8:'Observed', sg9:'Observed', sg10:'Indicated', sg11:'Observed'
};
// When each company entered its current stage (drives stall detection)
const stageSince: Record<string, string> = {
  c1:'2026-08-04', c2:'2026-07-29', c3:'2026-08-05', c4:'2026-07-24', c5:'2026-07-30',
  c6:'2026-08-07', c7:'2026-08-07', c8:'2026-08-08', c9:'2026-07-25', c10:'2026-07-02',
  c11:'2026-05-20', c12:'2026-03-15', c13:'2026-06-10'
};
// Prospects not yet ready to contact, with the blocking reason
const notReady: Record<string, string> = {
  c7:'Insufficient research', c10:'No evidence of need'
};

const db = JSON.parse(JSON.stringify(v2));
// Peak Analytics scan — completed during V2.5 research, makes the prospect outreach-ready
db.scans.push(
  {id:'sc22', companyId:'c8', category:'Website', status:'Average', severity:'Medium', problem:'Consulting site with no product story — the SaaS is invisible', evidence:'No product page; beta only reachable via a shared link', opportunity:'Product-led site section for launch', impact:'Launch traffic will have nowhere to land', confidence:'Observed'},
  {id:'sc23', companyId:'c8', category:'Dashboard / Reporting', status:'Weak', severity:'High', problem:'Beta dashboard has no onboarding or empty states', evidence:'First-run walkthrough of the beta: blank tables, no guidance', opportunity:'Onboarding, empty states and dashboard IA', impact:'Trial users churn before first value', confidence:'Observed'},
  {id:'sc24', companyId:'c8', category:'Digital brand / Trust', status:'Average', severity:'Medium', problem:'Consultancy brand does not read as a product company', evidence:'Same brand system used for both offerings', opportunity:'Product brand + design system', impact:'Harder to charge product pricing', confidence:'Indicated'},
  {id:'sc25', companyId:'c8', category:'Mobile experience', status:'Average', severity:'Low', problem:'Marketing site fine on mobile; product not mobile-targeted', evidence:'Responsive site; beta is desktop-first by design', opportunity:'None needed for launch', impact:'—', confidence:'Observed'}
);
db.scans = db.scans.map((s: any) => ({...s, confidence: s.confidence || scanConfidence[s.id] || 'Assumption'}));
db.signals = db.signals.map((s: any) => ({...s, confidence: signalConfidence[s.id] || 'Assumption'}));
db.companies = db.companies.map((c: any) => ({...c, stageSince: stageSince[c.id] || c.dateDiscovered, notReadyReason: notReady[c.id] || null, overrideNotReady:false}));
db.outreach = db.outreach.map((o: any) => ({...o, purpose: (TOUCH_PURPOSES as Record<number, string>)[o.touch] || 'Initial observation', outcome: o.status, responseNotes: o.response || ''}));
db.targets = {...DEFAULT_TARGETS};
// Structured outcome records for closed prospects (collected data — not automated learning)
db.outcomes = [
  {companyId:'c11', result:'Won', acqAtClose:88, oppAtClose:24, readinessAtClose:100, industry:'Logistics', service:'Web App', value:510000, source:'Referral', campaign:'Logistics portals', daysToClose:48, notes:'Referral + live reference closed it. Portal phase upsold after dashboard.'},
  {companyId:'c12', result:'Won', acqAtClose:79, oppAtClose:20, readinessAtClose:100, industry:'Professional services', service:'Web App', value:340000, source:'Existing client', campaign:'—', daysToClose:33, notes:'Existing relationship. Fast close, low negotiation.'},
  {companyId:'c13', result:'Lost', acqAtClose:46, oppAtClose:12, readinessAtClose:71, industry:'Property', service:'Website', value:95000, source:'Website', campaign:'—', daysToClose:16, reason:'Chose competitor', notes:'Lost on price to a template agency. Weak differentiation on a low-value website scope.'}
];
export { db };
