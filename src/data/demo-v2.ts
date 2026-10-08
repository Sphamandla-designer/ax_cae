// AX-Channels CAE V2 — intelligence layer over the V1 dataset. Extends cae-data.js without modifying it.
import { db as v1, TODAY, STAGES, SERVICES, LEAD_SOURCES } from './demo-v1';
export { TODAY, STAGES, SERVICES, LEAD_SOURCES };

export const SERVICE_GROUPS = {
  'Websites': ['Website redesign','New website','Landing pages','SEO-focused experience'],
  'Product Design': ['Mobile app','Web app','SaaS product','UX/UI redesign'],
  'Business Systems': ['Dashboard','Internal system','Customer portal','Operational platform'],
  'Digital Transformation': ['Process redesign','Digital workflow','Customer journey','Digital infrastructure'],
  'AI & Automation': ['AI UX','AI assistant','Workflow automation','Intelligent dashboard','AI-powered product'],
  'UX Strategy': ['UX audit','UX research','Product strategy','Design system']
};
export const SCAN_CATEGORIES = ['Website','Mobile experience','Mobile app','Customer portal','Internal systems','Dashboard / Reporting','E-commerce','Booking / Lead generation','Automation','AI opportunities','Digital brand / Trust'];
export const SCAN_STATUSES = ['Excellent','Good','Average','Weak','Missing'];
export const SEVERITIES = ['Low','Medium','High','Critical'];
export const CONTACT_ROLES = ['Decision Maker','Influencer','Champion','Gatekeeper','Unknown'];
export const NEXT_ACTIONS_BY_STAGE = {
  'New':['Research company','Identify decision-maker','Complete digital audit'],
  'Researching':['Identify decision-maker','Complete digital audit','Create opportunity brief'],
  'Qualified':['Identify decision-maker','Send initial outreach','Create opportunity brief'],
  'Outreach':['Follow up','Send follow-up with new value','Try alternate channel'],
  'Responded':['Schedule discovery','Send discovery questions','Confirm decision-maker'],
  'Discovery':['Prepare proposal','Send discovery recap','Map stakeholders'],
  'Proposal':['Follow up on proposal','Offer proposal walkthrough','Address objections'],
  'Negotiation':['Revise scope','Close','Confirm start date'],
  'Won':['Kick off project','Plan growth review','Ask for referral'],
  'Lost':['Nurture','Schedule re-engagement','Log loss reason']
};

const db = JSON.parse(JSON.stringify(v1));

// --- Decision-maker intelligence: enrich existing contacts, add secondary contacts ---
const contactExtras: Record<string, any> = {
  p1:{department:'Operations', role:'Decision Maker', influence:'High', relationship:'Warm — proposal in hand', lastContacted:'2026-08-04', preferredChannel:'Email', notes:'Championing the permit system internally. Wants board-ready numbers.'},
  p2:{department:'Executive', role:'Decision Maker', influence:'High', relationship:'Warm — discovery booked', lastContacted:'2026-07-29', preferredChannel:'LinkedIn', notes:'Direct, numbers-driven. Hates agency fluff.'},
  p3:{department:'Sales', role:'Influencer', influence:'Medium', relationship:'Cold — one touch, no reply', lastContacted:'2026-08-05', preferredChannel:'Email', notes:'Owner (MD) signs off — Pieter can open the door.'},
  p4:{department:'Commercial', role:'Gatekeeper', influence:'Medium', relationship:'Cold', lastContacted:'2026-08-06', preferredChannel:'Email', notes:'Not the DM. Ops Director unknown — research needed.'},
  p5:{department:'Product', role:'Decision Maker', influence:'High', relationship:'Strong — in negotiation', lastContacted:'2026-08-06', preferredChannel:'WhatsApp', notes:'Design-literate. Cares about design-system longevity.'},
  p6:{department:'Executive', role:'Decision Maker', influence:'High', relationship:'Warm — replied positively', lastContacted:'2026-08-07', preferredChannel:'Email', notes:'Formal tone. Prefers scheduled calls.'},
  p7:{department:'Operations', role:'Unknown', influence:'Low', relationship:'None yet', lastContacted:null, preferredChannel:'Phone', notes:'Owner structure unclear — likely family holding.'},
  p8:{department:'Product', role:'Decision Maker', influence:'High', relationship:'New — draft outreach pending', lastContacted:null, preferredChannel:'LinkedIn', notes:'Ex-agency. Will judge our craft hard.'},
  p9:{department:'Executive', role:'Decision Maker', influence:'High', relationship:'Warm — requested proposal', lastContacted:'2026-07-22', preferredChannel:'Phone', notes:'Phone-first. Avoid long emails.'},
  p10:{department:'Operations', role:'Gatekeeper', influence:'Low', relationship:'Gone quiet after 3 touches', lastContacted:'2026-07-30', preferredChannel:'Email', notes:'Partners make decisions; Michelle screens vendors.'},
  p11:{department:'Executive', role:'Decision Maker', influence:'High', relationship:'Client — strong', lastContacted:'2026-08-01', preferredChannel:'Email', notes:'Happy reference. Ask for intros.'},
  p12:{department:'Executive', role:'Decision Maker', influence:'High', relationship:'Client — strong', lastContacted:'2026-07-28', preferredChannel:'WhatsApp', notes:'Open to patient-app pitch after Q3 results.'},
  p13:{department:'Management', role:'Influencer', influence:'Medium', relationship:'Lost — revisit 2027', lastContacted:'2026-06-20', preferredChannel:'Email', notes:''}
};
db.contacts = db.contacts.map((c: any) => ({...c, ...contactExtras[c.id]}));
db.contacts.push(
  {id:'p14', companyId:'c1', name:'Annelie Fourie', title:'PA to Operations Director', email:'a.fourie@karooridge.co.za', phone:'+27 53 723 1180', linkedin:'—', decisionMaker:false, department:'Operations', role:'Gatekeeper', influence:'Medium', relationship:'Neutral — books Johan\u2019s calls', lastContacted:'2026-08-04', preferredChannel:'Phone', notes:'Best route to Johan\u2019s diary.'},
  {id:'p15', companyId:'c2', name:'Sizwe Mthembu', title:'Operations Manager', email:'sizwe@umzansifreight.co.za', phone:'+27 71 884 2209', linkedin:'linkedin.com/in/sizwemthembu', decisionMaker:false, department:'Operations', role:'Champion', influence:'Medium', relationship:'Positive — feels the pain daily', lastContacted:'2026-07-29', preferredChannel:'WhatsApp', notes:'Fields the status calls. Will champion the portal.'},
  {id:'p16', companyId:'c5', name:'Kabelo Modise', title:'Co-founder & CTO', email:'kabelo@lumopay.io', phone:'+27 83 456 7712', linkedin:'linkedin.com/in/kabelomodise', decisionMaker:false, department:'Engineering', role:'Influencer', influence:'High', relationship:'Positive — met at discovery', lastContacted:'2026-07-28', preferredChannel:'Email', notes:'Wants component library his team can build from.'}
);

// --- Opportunities: type taxonomy + matrix placement (impact from scores; complexity recorded) ---
const oppExtras: Record<string, any> = {
  o1:{type:'Internal system', group:'Business Systems', complexity:'High'},
  o2:{type:'Customer portal', group:'Business Systems', complexity:'High'},
  o3:{type:'Website redesign', group:'Websites', complexity:'Low'},
  o4:{type:'Digital workflow', group:'Digital Transformation', complexity:'High'},
  o5:{type:'UX/UI redesign', group:'Product Design', complexity:'Low'},
  o6:{type:'Customer portal', group:'Business Systems', complexity:'High'},
  o8:{type:'SaaS product', group:'Product Design', complexity:'Low'},
  o9:{type:'Intelligent dashboard', group:'AI & Automation', complexity:'High'},
  o12:{type:'Mobile app', group:'Product Design', complexity:'High'}
};
db.opportunities = db.opportunities.map((o: any) => ({...o, ...oppExtras[o.id]}));
db.opportunities.push(
  {id:'o1b', companyId:'c1', problems:['Poor dashboard experience'], opportunity:'Shift-ops reporting dashboard on existing production data — fast standalone win.', service:'Dashboard', type:'Dashboard', group:'Business Systems', valueBand:'Medium', estValue:150000, complexity:'Low', scores:{severity:4,impact:5,fit:5,budget:4,likelihood:4}},
  {id:'o7', companyId:'c7', problems:['Outdated website'], opportunity:'Vacancy listing page with unit specs and enquiry capture.', service:'Website', type:'Landing pages', group:'Websites', valueBand:'Low', estValue:45000, complexity:'Low', scores:{severity:2,impact:2,fit:3,budget:2,likelihood:2}},
  {id:'o7b', companyId:'c7', problems:['Manual business process'], opportunity:'Custom leasing ERP — heavy build, thin returns at 40 units.', service:'Internal Business System', type:'Operational platform', group:'Business Systems', valueBand:'Low', estValue:60000, complexity:'High', scores:{severity:2,impact:2,fit:2,budget:2,likelihood:1}}
);

// --- Digital Opportunity Scanner records ---
db.scans = [
  {id:'sc1', companyId:'c1', category:'Website', status:'Weak', severity:'High', problem:'2019 brochure site, broken layouts on new content', evidence:'Careers page renders raw HTML; news last updated 2023', opportunity:'Credibility rebuild for investor & supplier audiences', impact:'Weak second impression during proposal diligence'},
  {id:'sc2', companyId:'c1', category:'Mobile experience', status:'Missing', severity:'High', problem:'Site unusable on mobile', evidence:'No viewport meta; pinch-zoom required', opportunity:'Responsive rebuild', impact:'Site staff access everything on phones'},
  {id:'sc3', companyId:'c1', category:'Internal systems', status:'Weak', severity:'Critical', problem:'Permit-to-work on paper, shift handover in Excel', evidence:'Ops walkthrough; 40+ min handover meetings', opportunity:'Permit & handover system (proposed)', impact:'Safety compliance risk + lost production time'},
  {id:'sc4', companyId:'c1', category:'Dashboard / Reporting', status:'Missing', severity:'High', problem:'No live view of production vs plan', evidence:'Weekly PDF report assembled manually', opportunity:'Shift-ops dashboard (quick win)', impact:'Decisions lag operations by a week'},
  {id:'sc5', companyId:'c1', category:'Automation', status:'Missing', severity:'Medium', problem:'Manual capture between weighbridge, Excel and SAP', evidence:'Triple data entry observed', opportunity:'Capture-once workflow automation', impact:'Errors + admin headcount'},
  {id:'sc6', companyId:'c2', category:'Customer portal', status:'Missing', severity:'Critical', problem:'Clients phone in for load status', evidence:'Ops fields ~60 status calls/day (Sizwe)', opportunity:'Load-tracking portal (proposed)', impact:'Churn risk on top-10 accounts; ops time drain'},
  {id:'sc7', companyId:'c2', category:'Mobile experience', status:'Weak', severity:'High', problem:'Booking form fails on mobile', evidence:'Form validation broken on Android Chrome', opportunity:'Mobile-first booking flow', impact:'Lost inbound loads'},
  {id:'sc8', companyId:'c2', category:'Dashboard / Reporting', status:'Weak', severity:'High', problem:'TMS data exists but no management view', evidence:'MD exports CSVs weekly', opportunity:'Ops dashboard on TMS data', impact:'Margin leaks invisible until month-end'},
  {id:'sc9', companyId:'c2', category:'Website', status:'Average', severity:'Medium', problem:'Dated but functional', evidence:'Lighthouse 61; content stale', opportunity:'Refresh alongside portal launch', impact:'Moderate'},
  {id:'sc10', companyId:'c3', category:'Website', status:'Weak', severity:'High', problem:'Template site, weak IA, developments buried', evidence:'3 clicks to find unit pricing', opportunity:'Development-first site with availability', impact:'Leads leak to competitor portals'},
  {id:'sc11', companyId:'c3', category:'Booking / Lead generation', status:'Weak', severity:'Critical', problem:'Enquiries go to shared inbox; agents chase manually', evidence:'Pieter: “we lose track of who followed up”', opportunity:'Lead pipeline with agent assignment', impact:'Direct sales leakage on live developments'},
  {id:'sc12', companyId:'c3', category:'Digital brand / Trust', status:'Average', severity:'Medium', problem:'Inconsistent branding across developments', evidence:'3 different logo treatments live', opportunity:'Unified development brand system', impact:'Buyer trust at R2m+ price points'},
  {id:'sc13', companyId:'c5', category:'Dashboard / Reporting', status:'Weak', severity:'Critical', problem:'Merchant dashboard is developer-built and confusing', evidence:'Support tickets: 38% are “where do I find…”', opportunity:'Dashboard redesign + design system (proposed)', impact:'Merchant churn; support cost'},
  {id:'sc14', companyId:'c5', category:'AI opportunities', status:'Missing', severity:'Medium', problem:'No intelligent surfacing of merchant anomalies', evidence:'Merchants find failed-settlement issues late', opportunity:'AI-assisted alerts in redesigned dashboard', impact:'Differentiator ahead of Series B'},
  {id:'sc15', companyId:'c5', category:'Website', status:'Good', severity:'Low', problem:'—', evidence:'Recent marketing site, solid', opportunity:'None needed', impact:'—'},
  {id:'sc16', companyId:'c6', category:'Website', status:'Weak', severity:'High', problem:'Dated, no clear CTA, no practice-area journeys', evidence:'No enquiry path beyond a phone number', opportunity:'Credibility + intake-led rebuild', impact:'Referred clients can\u2019t validate the firm'},
  {id:'sc17', companyId:'c6', category:'Customer portal', status:'Missing', severity:'High', problem:'No matter-status visibility for clients', evidence:'Partners field “any update?” emails daily', opportunity:'Matter-status portal (proposed)', impact:'Partner hours lost; client frustration'},
  {id:'sc18', companyId:'c6', category:'Automation', status:'Missing', severity:'Medium', problem:'Intake via email threads', evidence:'No structured intake form', opportunity:'Intake form + conflict-check workflow', impact:'Slow onboarding of new matters'},
  {id:'sc19', companyId:'c9', category:'Website', status:'Missing', severity:'Critical', problem:'No web presence at all', evidence:'Domain parks to registrar page', opportunity:'Basic credibility site', impact:'Fails supplier due-diligence checks'},
  {id:'sc20', companyId:'c9', category:'Internal systems', status:'Weak', severity:'Critical', problem:'Weighbridge slips captured manually', evidence:'Dispute rate 7% of loads (Frans)', opportunity:'Digital capture + dispute dashboard (proposed)', impact:'Direct margin loss on disputes'},
  {id:'sc21', companyId:'c9', category:'Dashboard / Reporting', status:'Missing', severity:'High', problem:'No visibility of load/dispute trends', evidence:'Monthly reconciliation in Excel', opportunity:'Dispute dashboard', impact:'Disputes settled from weak data'}
];

// --- Why-now signals (manual for V2; architecture ready for detection) ---
db.signals = [
  {id:'sg1', companyId:'c1', label:'Expanding into manganese'}, {id:'sg2', companyId:'c1', label:'Hiring ops-systems coordinator'},
  {id:'sg3', companyId:'c2', label:'Client complaints about load visibility'}, {id:'sg4', companyId:'c2', label:'New cross-border routes added'},
  {id:'sg5', companyId:'c3', label:'3 developments launching this quarter'},
  {id:'sg6', companyId:'c5', label:'Series B raise expected'}, {id:'sg7', companyId:'c5', label:'Merchant churn rising'},
  {id:'sg8', companyId:'c8', label:'SaaS beta launching Q4'}, {id:'sg9', companyId:'c8', label:'Hiring Head of Design'},
  {id:'sg10', companyId:'c9', label:'Margin pressure from disputes'},
  {id:'sg11', companyId:'c6', label:'New commercial practice lead appointed'}
];

// --- Acquisition strategies (high-priority prospects) ---
db.strategies = [
  {id:'st1', companyId:'c1', problem:'Paper permit-to-work and Excel handovers create safety and production risk', opportunity:'Permit & handover system; ops dashboard as fast first phase', target:'Johan Kruger (Operations Director) — via Annelie for diary', service:'Internal Business System', entryOffer:'Free 10-minute digital operations preview (annotated walkthrough)', angle:'Lead with the dashboard quick win and safety-compliance risk, not a big-bang system pitch', proof:'Atlas Ridge ops dashboard case study (same referral network)', nextStep:'Proposal walkthrough call this week', dealValue:'R420 000 (+R150 000 dashboard phase)', difficulty:'Moderate'},
  {id:'st2', companyId:'c2', problem:'No client visibility on loads — 60 status calls a day', opportunity:'Load-tracking portal on existing TMS data', target:'Nomvula Dlamini (MD); Sizwe as internal champion', service:'Web App', entryOffer:'Operations UX audit of the status-call workflow', angle:'Quantify the cost of status calls; portal pays for itself in ops hours', proof:'Atlas Ridge customer portal — live reference', nextStep:'Discovery meeting — scope portal MVP', dealValue:'R350 000', difficulty:'Easy'},
  {id:'st3', companyId:'c5', problem:'Confusing merchant dashboard driving churn and support load', opportunity:'Dashboard redesign + design system before Series B', target:'Daniel Botha (CPO); keep Kabelo close on build feasibility', service:'UX/UI Design', entryOffer:'Annotated teardown of top-5 merchant journeys', angle:'Design system as infrastructure for the Series B story — not a reskin', proof:'SaaS dashboard work + component library samples', nextStep:'Close negotiation — send the revised scope', dealValue:'R280 000', difficulty:'Moderate'},
  {id:'st4', companyId:'c9', problem:'Manual weighbridge capture losing 7% of loads to disputes', opportunity:'Digital capture + dispute dashboard', target:'Frans Oosthuizen (GM) — phone-first', service:'Dashboard', entryOffer:'Dispute-cost calculation from their own numbers', angle:'Pure margin-recovery pitch: the system pays for itself per dispute avoided', proof:'Mining ops references; dispute-rate math', nextStep:'Call before the proposal expires', dealValue:'R390 000', difficulty:'Moderate'},
  {id:'st5', companyId:'c8', problem:'Consulting-grade UX won\u2019t survive a SaaS launch', opportunity:'Product UX for launch: onboarding, empty states, dashboard IA', target:'Zanele Khumalo (Head of Product) — ex-agency, judges craft', service:'UX/UI Design', entryOffer:'Free teardown of the beta\u2019s first-run experience', angle:'Show 2–3 concrete beta UX issues and one redesigned concept screen', proof:'LumoPay dashboard work (once closed) + product design system samples', nextStep:'15-minute intro call', dealValue:'R300 000', difficulty:'Moderate'}
];

// --- Why-this-prospect summaries ---
db.whys = [
  {companyId:'c1', why:'Strong AX fit: paper-driven ops, no dashboards, safety-compliance pressure, and a warm referral in. Multiple customer- and staff-facing digital gaps.', primary:'Permit-to-work & shift-handover system', secondary:'Shift-ops reporting dashboard (fast first phase)', valueRange:'R150 000 – R570 000', approach:'Lead with the dashboard quick win and the referral, not a system mega-pitch.'},
  {companyId:'c2', why:'Textbook portal case: real daily pain (60 status calls), data already in the TMS, DM engaged, champion inside ops.', primary:'Client load-tracking portal', secondary:'Management ops dashboard on TMS data', valueRange:'R250 000 – R400 000', approach:'Quantify status-call cost in discovery; scope an MVP portal first.'},
  {companyId:'c3', why:'Live developments mean urgency: every leaked lead is a lost unit sale. Weak IA and manual lead handling are visible from outside.', primary:'Development-first website with live availability', secondary:'Agent lead pipeline', valueRange:'R90 000 – R150 000', approach:'Lead with a personalised experience audit of one development, not a generic redesign pitch.'},
  {companyId:'c5', why:'Funded, design-literate, urgent: churn traces to the dashboard, and Series B raises the stakes. Highest likelihood in pipeline.', primary:'Merchant dashboard redesign', secondary:'Design system + AI-assisted alerts', valueRange:'R280 000', approach:'Frame the design system as Series B infrastructure; close scope this week.'},
  {companyId:'c6', why:'Partners feel the pain personally (“any update?” emails). Clear portal case with modest scope and a responsive DM.', primary:'Matter-status client portal', secondary:'Intake automation + site rebuild', valueRange:'R120 000 – R200 000', approach:'Discovery call framed around partner hours saved per week.'},
  {companyId:'c8', why:'Product-driven company entering launch window — needs a partner who thinks like a product team. Budget likely; craft bar high.', primary:'Launch UX: onboarding, empty states, dashboard IA', secondary:'Design system for the SaaS', valueRange:'R200 000 – R350 000', approach:'Earn credibility with a sharp free teardown of the beta before pitching scope.'},
  {companyId:'c9', why:'Pure margin-recovery story: 7% dispute rate is measurable money. GM is the DM and already requested the proposal.', primary:'Digital weighbridge capture + dispute dashboard', secondary:'Basic credibility website', valueRange:'R390 000', approach:'Phone-first. Keep the pitch to dispute-cost math; the proposal expires soon.'}
];

// --- Acquisition campaigns ---
db.campaigns = [
  {id:'cam1', name:'Mining modernisation Q3', target:'South African mining & resources companies', offer:'Digital Opportunity Preview (free 10-min annotated walkthrough)', goal:'10 discovery meetings by end Q3'},
  {id:'cam2', name:'Logistics portals', target:'SA logistics and distribution operators', offer:'Operations UX audit', goal:'3 portal projects in 2026'},
  {id:'cam3', name:'SaaS product UX', target:'Product-driven companies approaching launch', offer:'Free beta first-run teardown', goal:'2 product engagements'},
  {id:'cam4', name:'ProServ portals', target:'Professional-services firms (legal, advisory, health)', offer:'Client-portal opportunity brief', goal:'4 discovery meetings'}
];

export { db };
