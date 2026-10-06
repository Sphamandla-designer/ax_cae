// AX-Channels CAE — relational demo dataset. All records flagged isDemo.
const TODAY = '2026-08-09';
const STAGES = ['New','Researching','Qualified','Outreach','Responded','Discovery','Proposal','Negotiation','Won','Lost'];
const SERVICES = ['Website','UX/UI Design','Mobile App','Web App','Dashboard','Internal Business System','UX Audit','AI UX','Automation','Digital Transformation','Other'];
const LEAD_SOURCES = ['LinkedIn','Email','Referral','Website','Networking','Cold outreach','Existing client','Other'];

const v1db = {
  companies: [
    {id:'c1', name:'Karoo Ridge Mining', industry:'Mining', subIndustry:'Mineral extraction', website:'karooridge.co.za', location:'Kathu, Northern Cape', size:'250–500', linkedin:'linkedin.com/company/karoo-ridge', description:'Mid-tier iron ore operation expanding into manganese. Paper-driven site processes.', leadSource:'Referral', dateDiscovered:'2026-07-14', owner:'Sipho M.', campaign:'Mining modernisation Q3', stage:'Proposal', priority:'High',
     scores:{problem:5, pay:5, need:4, access:4, growth:4}, nextAction:{label:'Follow up on proposal', due:'2026-08-09'},
     digital:{website:'Outdated brochure site (2019)', mobile:'Not responsive', app:'None', portal:'None', internal:'Excel + paper permits', social:'Dormant LinkedIn'}},
    {id:'c2', name:'Umzansi Freight Solutions', industry:'Logistics', subIndustry:'Road freight', website:'umzansifreight.co.za', location:'Durban, KZN', size:'50–100', linkedin:'linkedin.com/company/umzansi-freight', description:'Cross-border freight operator. Clients phone in for load status — no tracking portal.', leadSource:'LinkedIn', dateDiscovered:'2026-07-28', owner:'Sipho M.', campaign:'Logistics portals', stage:'Discovery', priority:'High',
     scores:{problem:5, pay:4, need:5, access:5, growth:3}, nextAction:{label:'Prepare discovery agenda', due:'2026-08-10'},
     digital:{website:'Functional but dated', mobile:'Poor mobile UX', app:'None', portal:'None — biggest gap', internal:'Legacy TMS, no dashboards', social:'Active Facebook'}},
    {id:'c3', name:'Cape Crest Properties', industry:'Property', subIndustry:'Residential development', website:'capecrest.co.za', location:'Cape Town, WC', size:'20–50', linkedin:'linkedin.com/company/cape-crest', description:'Sectional-title developer with 3 active developments. Leads leak between agents.', leadSource:'Networking', dateDiscovered:'2026-08-01', owner:'Thandi N.', campaign:'—', stage:'Outreach', priority:'Medium',
     scores:{problem:4, pay:4, need:4, access:3, growth:4}, nextAction:{label:'Send follow-up email (Touch 2)', due:'2026-08-09'},
     digital:{website:'Template site, weak IA', mobile:'Acceptable', app:'None', portal:'No buyer portal', internal:'Manual lead sheets', social:'Instagram only'}},
    {id:'c4', name:'Mzansi Build Co', industry:'Construction', subIndustry:'Commercial contracting', website:'mzansibuild.co.za', location:'Johannesburg, GP', size:'100–250', linkedin:'linkedin.com/company/mzansi-build', description:'Tier-2 contractor. Tender documents assembled manually across 4 teams.', leadSource:'Cold outreach', dateDiscovered:'2026-08-05', owner:'Sipho M.', campaign:'Construction ops Q3', stage:'Qualified', priority:'Medium',
     scores:{problem:4, pay:3, need:4, access:2, growth:3}, nextAction:{label:'Research decision-maker', due:'2026-08-09'},
     digital:{website:'Outdated website', mobile:'Not responsive', app:'None', portal:'None', internal:'Manual tender process', social:'None'}},
    {id:'c5', name:'LumoPay', industry:'Technology', subIndustry:'Fintech / payments', website:'lumopay.io', location:'Stellenbosch, WC', size:'20–50', linkedin:'linkedin.com/company/lumopay', description:'Series A payments startup. Merchant dashboard is developer-built and confusing.', leadSource:'Referral', dateDiscovered:'2026-07-20', owner:'Thandi N.', campaign:'—', stage:'Negotiation', priority:'High',
     scores:{problem:4, pay:5, need:5, access:5, growth:5}, nextAction:{label:'Revise scope, resend proposal', due:'2026-08-11'},
     digital:{website:'Good marketing site', mobile:'Good', app:'Merchant app planned', portal:'Confusing merchant dashboard', internal:'Solid stack', social:'Active LinkedIn'}},
    {id:'c6', name:'Bhekani & Partners', industry:'Professional services', subIndustry:'Legal', website:'bhekanilaw.co.za', location:'Pretoria, GP', size:'20–50', linkedin:'linkedin.com/company/bhekani-partners', description:'Commercial law firm. Client intake done over email threads; no matter status visibility.', leadSource:'Email', dateDiscovered:'2026-08-03', owner:'Thandi N.', campaign:'ProServ portals', stage:'Responded', priority:'Medium',
     scores:{problem:4, pay:4, need:3, access:4, growth:2}, nextAction:{label:'Schedule discovery call', due:'2026-08-09'},
     digital:{website:'Dated, no clear CTA', mobile:'Poor', app:'None', portal:'No client portal', internal:'Email-driven intake', social:'Minimal'}},
    {id:'c7', name:'Veldt Logistics Park', industry:'Property', subIndustry:'Industrial property', website:'veldtpark.co.za', location:'Midrand, GP', size:'5–20', linkedin:'linkedin.com/company/veldt-park', description:'Industrial park operator leasing 40+ units. Vacancy marketing is a PDF brochure.', leadSource:'Website', dateDiscovered:'2026-08-07', owner:'Sipho M.', campaign:'—', stage:'Researching', priority:'Low',
     scores:{problem:3, pay:3, need:3, access:2, growth:2}, nextAction:{label:'Complete company research', due:'2026-08-10'},
     digital:{website:'PDF brochure only', mobile:'None', app:'None', portal:'None', internal:'Unknown', social:'None'}},
    {id:'c8', name:'Sasol Peak Analytics', industry:'Technology', subIndustry:'Data / SaaS', website:'peakanalytics.co.za', location:'Sandton, GP', size:'50–100', linkedin:'linkedin.com/company/peak-analytics', description:'BI consultancy productising a SaaS tool. Needs product-grade UX for launch.', leadSource:'LinkedIn', dateDiscovered:'2026-08-08', owner:'Thandi N.', campaign:'SaaS product UX', stage:'New', priority:'High',
     scores:{problem:3, pay:4, need:5, access:3, growth:5}, nextAction:{label:'Research decision-maker', due:'2026-08-09'},
     digital:{website:'Consulting site, no product story', mobile:'OK', app:'SaaS in beta', portal:'—', internal:'—', social:'Active LinkedIn'}},
    {id:'c9', name:'Drakens Coal Logistics', industry:'Mining', subIndustry:'Coal haulage', website:'drakenscoal.co.za', location:'Emalahleni, MP', size:'100–250', linkedin:'linkedin.com/company/drakens-coal', description:'Coal transporter. Weighbridge slips captured manually; disputes cost margin.', leadSource:'Cold outreach', dateDiscovered:'2026-07-10', owner:'Sipho M.', campaign:'Mining modernisation Q3', stage:'Proposal', priority:'High',
     scores:{problem:5, pay:4, need:4, access:3, growth:3}, nextAction:{label:'Proposal expiring — call', due:'2026-08-12'},
     digital:{website:'None', mobile:'None', app:'None', portal:'None', internal:'Manual weighbridge capture', social:'None'}},
    {id:'c10', name:'Fynbos Wealth', industry:'Professional services', subIndustry:'Financial advisory', website:'fynboswealth.co.za', location:'Claremont, WC', size:'5–20', linkedin:'linkedin.com/company/fynbos-wealth', description:'Boutique advisory. Went quiet after two touches.', leadSource:'Networking', dateDiscovered:'2026-06-30', owner:'Thandi N.', campaign:'—', stage:'Outreach', priority:'Low',
     scores:{problem:2, pay:3, need:2, access:2, growth:1}, nextAction:{label:'Final follow-up (Touch 4)', due:'2026-08-13'},
     digital:{website:'Acceptable', mobile:'OK', app:'None', portal:'None', internal:'—', social:'Minimal'}},
    {id:'c11', name:'Atlas Ridge Retail Group', industry:'Logistics', subIndustry:'Retail distribution', website:'atlasridge.co.za', location:'Gqeberha, EC', size:'250–500', linkedin:'linkedin.com/company/atlas-ridge', description:'Won — regional distributor. Ops dashboard delivered, portal phase live.', leadSource:'Referral', dateDiscovered:'2026-04-02', owner:'Sipho M.', campaign:'Logistics portals', stage:'Won', priority:'Medium',
     scores:{problem:5, pay:5, need:5, access:5, growth:4}, nextAction:{label:'Quarterly growth review', due:'2026-09-01'},
     digital:{website:'Rebuilt by AX', mobile:'Good', app:'None', portal:'Customer portal live', internal:'Ops dashboard live', social:'—'}},
    {id:'c12', name:'Khanya Med Clinics', industry:'Professional services', subIndustry:'Healthcare', website:'khanyamed.co.za', location:'Soweto, GP', size:'50–100', linkedin:'linkedin.com/company/khanya-med', description:'Won — clinic group. Booking system project completed May 2026.', leadSource:'Existing client', dateDiscovered:'2026-02-11', owner:'Thandi N.', campaign:'—', stage:'Won', priority:'Medium',
     scores:{problem:4, pay:4, need:5, access:5, growth:3}, nextAction:{label:'Pitch patient app (upsell)', due:'2026-08-20'},
     digital:{website:'Rebuilt by AX', mobile:'Good', app:'Patient app opportunity', portal:'Booking portal live', internal:'—', social:'Active'}},
    {id:'c13', name:'Bergwind Estates', industry:'Property', subIndustry:'Estate management', website:'bergwind.co.za', location:'Paarl, WC', size:'20–50', linkedin:'linkedin.com/company/bergwind', description:'Lost to cheaper template agency. Revisit in 12 months.', leadSource:'Website', dateDiscovered:'2026-05-15', owner:'Sipho M.', campaign:'—', stage:'Lost', priority:'Low',
     scores:{problem:3, pay:2, need:3, access:3, growth:2}, nextAction:{label:'Re-engage Q2 2027', due:'2027-05-01'},
     digital:{website:'Template rebuild (competitor)', mobile:'—', app:'None', portal:'None', internal:'—', social:'—'}}
  ],
  contacts: [
    {id:'p1', companyId:'c1', name:'Johan Kruger', title:'Operations Director', email:'j.kruger@karooridge.co.za', phone:'+27 82 447 1123', linkedin:'linkedin.com/in/johankruger', decisionMaker:true},
    {id:'p2', companyId:'c2', name:'Nomvula Dlamini', title:'Managing Director', email:'nomvula@umzansifreight.co.za', phone:'+27 83 220 8841', linkedin:'linkedin.com/in/nomvuladlamini', decisionMaker:true},
    {id:'p3', companyId:'c3', name:'Pieter van Wyk', title:'Sales Director', email:'pieter@capecrest.co.za', phone:'+27 82 990 3321', linkedin:'linkedin.com/in/pietervanwyk', decisionMaker:false},
    {id:'p4', companyId:'c4', name:'Lerato Mokoena', title:'Commercial Manager', email:'lerato@mzansibuild.co.za', phone:'+27 71 456 2210', linkedin:'linkedin.com/in/leratomokoena', decisionMaker:false},
    {id:'p5', companyId:'c5', name:'Daniel Botha', title:'Co-founder & CPO', email:'daniel@lumopay.io', phone:'+27 82 118 7754', linkedin:'linkedin.com/in/danielbotha', decisionMaker:true},
    {id:'p6', companyId:'c6', name:'Adv. Sibusiso Bhekani', title:'Managing Partner', email:'s.bhekani@bhekanilaw.co.za', phone:'+27 82 774 9908', linkedin:'linkedin.com/in/sbhekani', decisionMaker:true},
    {id:'p7', companyId:'c7', name:'Marius Steyn', title:'Park Manager', email:'marius@veldtpark.co.za', phone:'+27 83 665 1147', linkedin:'—', decisionMaker:false},
    {id:'p8', companyId:'c8', name:'Zanele Khumalo', title:'Head of Product', email:'zanele@peakanalytics.co.za', phone:'+27 72 334 6690', linkedin:'linkedin.com/in/zanelekhumalo', decisionMaker:true},
    {id:'p9', companyId:'c9', name:'Frans Oosthuizen', title:'General Manager', email:'frans@drakenscoal.co.za', phone:'+27 82 552 3376', linkedin:'—', decisionMaker:true},
    {id:'p10', companyId:'c10', name:'Michelle Adams', title:'Practice Manager', email:'michelle@fynboswealth.co.za', phone:'+27 84 209 5583', linkedin:'—', decisionMaker:false},
    {id:'p11', companyId:'c11', name:'Craig Naidoo', title:'COO', email:'craig@atlasridge.co.za', phone:'+27 83 441 0092', linkedin:'linkedin.com/in/craignaidoo', decisionMaker:true},
    {id:'p12', companyId:'c12', name:'Dr. Ayanda Zulu', title:'CEO', email:'ayanda@khanyamed.co.za', phone:'+27 82 667 2214', linkedin:'linkedin.com/in/ayandazulu', decisionMaker:true},
    {id:'p13', companyId:'c13', name:'Susan Terblanche', title:'GM', email:'susan@bergwind.co.za', phone:'+27 83 210 4456', linkedin:'—', decisionMaker:false}
  ],
  opportunities: [
    {id:'o1', companyId:'c1', problems:['Manual business process','No customer portal','Outdated website'], opportunity:'Digitise permit-to-work and shift handover; ops dashboard for site managers.', service:'Internal Business System', valueBand:'High', estValue:420000, scores:{severity:5,impact:5,fit:4,budget:4,likelihood:4}},
    {id:'o2', companyId:'c2', problems:['No customer portal','Manual business process','Poor dashboard experience'], opportunity:'Client load-tracking portal + internal ops dashboard on existing TMS data.', service:'Web App', valueBand:'High', estValue:350000, scores:{severity:5,impact:5,fit:5,budget:4,likelihood:4}},
    {id:'o3', companyId:'c3', problems:['Weak information architecture','Poor conversion','Manual business process'], opportunity:'Development marketing site with unit availability + agent lead pipeline.', service:'Website', valueBand:'Medium', estValue:120000, scores:{severity:4,impact:4,fit:4,budget:3,likelihood:3}},
    {id:'o4', companyId:'c4', problems:['Manual business process','Outdated website'], opportunity:'Tender assembly workflow tool; refreshed credentials site.', service:'Internal Business System', valueBand:'Medium', estValue:180000, scores:{severity:4,impact:4,fit:3,budget:3,likelihood:2}},
    {id:'o5', companyId:'c5', problems:['Poor dashboard experience','Difficult navigation','Fragmented digital experience'], opportunity:'Merchant dashboard redesign + design system ahead of Series B.', service:'UX/UI Design', valueBand:'High', estValue:280000, scores:{severity:4,impact:5,fit:5,budget:5,likelihood:5}},
    {id:'o6', companyId:'c6', problems:['No customer portal','Manual business process','No clear CTA'], opportunity:'Client matter-status portal; intake form automation.', service:'Web App', valueBand:'Medium', estValue:160000, scores:{severity:4,impact:4,fit:4,budget:3,likelihood:3}},
    {id:'o8', companyId:'c8', problems:['Fragmented digital experience','Poor conversion'], opportunity:'Product UX for SaaS launch: onboarding, empty states, dashboard IA.', service:'UX/UI Design', valueBand:'High', estValue:300000, scores:{severity:3,impact:5,fit:5,budget:4,likelihood:3}},
    {id:'o9', companyId:'c9', problems:['Manual business process','Poor dashboard experience'], opportunity:'Digital weighbridge capture + dispute dashboard.', service:'Dashboard', valueBand:'High', estValue:390000, scores:{severity:5,impact:5,fit:4,budget:3,likelihood:3}},
    {id:'o12', companyId:'c12', problems:['Fragmented digital experience'], opportunity:'Patient companion app (upsell on booking system).', service:'Mobile App', valueBand:'Medium', estValue:220000, scores:{severity:3,impact:4,fit:5,budget:4,likelihood:4}}
  ],
  outreach: [
    {id:'r1', companyId:'c1', channel:'Email', touch:1, message:'Intro: site-process digitisation angle after referral from Atlas Ridge.', dateSent:'2026-07-16', status:'Replied', response:'Positive — asked for credentials', followUpDate:null},
    {id:'r2', companyId:'c1', channel:'Email', touch:2, message:'Sent proposal for permit-to-work system, R420k scope.', dateSent:'2026-08-04', status:'Viewed', response:'', followUpDate:'2026-08-09'},
    {id:'r3', companyId:'c2', channel:'LinkedIn', touch:1, message:'Connected + note on load-status phone-call volume.', dateSent:'2026-07-29', status:'Replied', response:'Positive — discovery booked', followUpDate:null},
    {id:'r4', companyId:'c3', channel:'Email', touch:1, message:'Intro referencing Sandpiper Bay launch; offered IA teardown.', dateSent:'2026-08-05', status:'No response', response:'', followUpDate:'2026-08-09'},
    {id:'r5', companyId:'c4', channel:'Email', touch:1, message:'Cold intro: tender assembly time-cost angle.', dateSent:'2026-08-06', status:'Sent', response:'', followUpDate:'2026-08-11'},
    {id:'r6', companyId:'c5', channel:'Referral intro', touch:1, message:'Warm intro via Atlas Ridge CTO.', dateSent:'2026-07-21', status:'Positive', response:'Meeting held 28 Jul', followUpDate:null},
    {id:'r7', companyId:'c6', channel:'Email', touch:1, message:'Intro: matter-status portal for commercial clients.', dateSent:'2026-08-04', status:'Replied', response:'Interested — wants a call', followUpDate:'2026-08-09'},
    {id:'r8', companyId:'c9', channel:'Phone', touch:2, message:'Walked GM through weighbridge dispute numbers.', dateSent:'2026-07-22', status:'Positive', response:'Requested proposal', followUpDate:null},
    {id:'r9', companyId:'c10', channel:'Email', touch:3, message:'Third touch — shared advisory-firm case study.', dateSent:'2026-07-30', status:'No response', response:'', followUpDate:'2026-08-13'},
    {id:'r10', companyId:'c8', channel:'LinkedIn', touch:0, message:'Draft: product-UX-for-launch angle, references beta screenshots.', dateSent:null, dateScheduled:'2026-08-10', status:'Draft', response:'', followUpDate:null}
  ],
  tasks: [
    {id:'t1', companyId:'c1', title:'Call Johan re proposal questions', type:'Follow-up', priority:'High', due:'2026-08-09', status:'Open', notes:'He viewed the proposal twice on Friday.'},
    {id:'t2', companyId:'c8', title:'Research Peak Analytics beta + decision-maker map', type:'Research', priority:'High', due:'2026-08-09', status:'Open', notes:''},
    {id:'t3', companyId:'c3', title:'Send Touch 2 email to Pieter', type:'Outreach', priority:'Medium', due:'2026-08-09', status:'Open', notes:'Use website-opportunity template.'},
    {id:'t4', companyId:'c6', title:'Propose discovery slots to Adv. Bhekani', type:'Meeting', priority:'High', due:'2026-08-09', status:'Open', notes:''},
    {id:'t5', companyId:'c2', title:'Prepare discovery agenda + portal references', type:'Meeting', priority:'High', due:'2026-08-10', status:'Open', notes:'Meeting 11 Aug 10:00.'},
    {id:'t6', companyId:'c9', title:'Call Frans — proposal expires 15 Aug', type:'Proposal', priority:'High', due:'2026-08-12', status:'Open', notes:''},
    {id:'t7', companyId:'c12', title:'Draft patient-app upsell one-pager', type:'Client', priority:'Medium', due:'2026-08-20', status:'Open', notes:''},
    {id:'t8', companyId:'c4', title:'Identify Mzansi Build decision-maker', type:'Research', priority:'Medium', due:'2026-08-08', status:'Open', notes:'Overdue — Lerato is not the DM.'},
    {id:'t9', companyId:'c10', title:'Final follow-up email (Touch 4)', type:'Follow-up', priority:'Low', due:'2026-08-13', status:'Open', notes:''},
    {id:'t10', companyId:'c5', title:'Rework LumoPay scope per negotiation notes', type:'Proposal', priority:'High', due:'2026-08-11', status:'Open', notes:'Drop usability round 2, keep design system.'},
    {id:'t11', companyId:'c11', title:'Send Q3 growth review invite', type:'Client', priority:'Medium', due:'2026-08-07', status:'Done', notes:''}
  ],
  meetings: [
    {id:'m1', companyId:'c2', date:'2026-08-11', time:'10:00', type:'Discovery', notes:'Portal scope, TMS integration questions.'},
    {id:'m2', companyId:'c5', date:'2026-08-09', time:'14:30', type:'Negotiation', notes:'Scope revision walkthrough with Daniel.'},
    {id:'m3', companyId:'c6', date:null, time:null, type:'Discovery', notes:'To be scheduled.'}
  ],
  proposals: [
    {id:'q1', companyId:'c1', project:'Permit-to-work & shift handover system', service:'Internal Business System', date:'2026-08-04', value:420000, status:'Viewed', expiry:'2026-08-25', probability:0.6, notes:'Ops director championing internally.'},
    {id:'q2', companyId:'c9', project:'Weighbridge capture & dispute dashboard', service:'Dashboard', date:'2026-07-25', value:390000, status:'Sent', expiry:'2026-08-15', probability:0.4, notes:'Expiring soon — needs a call.'},
    {id:'q3', companyId:'c5', project:'Merchant dashboard redesign + design system', service:'UX/UI Design', date:'2026-07-30', value:280000, status:'Negotiation', expiry:'2026-08-30', probability:0.75, notes:'Negotiating scope, not price.'},
    {id:'q4', companyId:'c11', project:'Ops dashboard + customer portal', service:'Web App', date:'2026-05-06', value:510000, status:'Accepted', expiry:'—', probability:1, notes:'Phase 2 live.'},
    {id:'q5', companyId:'c12', project:'Clinic booking system', service:'Web App', date:'2026-03-02', value:340000, status:'Accepted', expiry:'—', probability:1, notes:'Delivered May 2026.'},
    {id:'q6', companyId:'c13', project:'Estate marketing site', service:'Website', date:'2026-06-01', value:95000, status:'Rejected', expiry:'—', probability:0, notes:'Lost on price to template agency.'}
  ],
  clients: [
    {id:'cl1', companyId:'c11', startDate:'2026-05-20', revenue:510000, services:['Dashboard','Web App'], status:'Active — phase 2', growthOps:['Dashboard client → Automation','Portal client → Mobile App'], referral:'Referred Karoo Ridge & LumoPay'},
    {id:'cl2', companyId:'c12', startDate:'2026-03-15', revenue:340000, services:['Web App','Website'], status:'Active — support retainer', growthOps:['Booking system → Patient app','Existing client → AI UX triage'], referral:'—'}
  ],
  activities: [
    {id:'a1', ts:'2026-08-08 16:40', companyId:'c8', kind:'Prospect added', text:'Peak Analytics added from LinkedIn campaign.'},
    {id:'a2', ts:'2026-08-08 11:05', companyId:'c1', kind:'Proposal viewed', text:'Johan Kruger viewed the proposal (2nd time).'},
    {id:'a3', ts:'2026-08-07 15:22', companyId:'c6', kind:'Reply', text:'Adv. Bhekani replied — interested, wants a call.'},
    {id:'a4', ts:'2026-08-07 09:10', companyId:'c7', kind:'Prospect added', text:'Veldt Logistics Park added from website enquiry.'},
    {id:'a5', ts:'2026-08-06 14:00', companyId:'c4', kind:'Outreach sent', text:'Cold intro email sent to Lerato Mokoena.'},
    {id:'a6', ts:'2026-08-05 10:30', companyId:'c3', kind:'Outreach sent', text:'Touch 1 email sent to Pieter van Wyk.'},
    {id:'a7', ts:'2026-08-04 17:15', companyId:'c1', kind:'Proposal sent', text:'R420 000 proposal sent to Karoo Ridge Mining.'},
    {id:'a8', ts:'2026-08-04 09:45', companyId:'c6', kind:'Outreach sent', text:'Matter-portal intro sent to Bhekani & Partners.'},
    {id:'a9', ts:'2026-07-30 13:20', companyId:'c5', kind:'Proposal sent', text:'Merchant dashboard proposal sent to LumoPay.'},
    {id:'a10', ts:'2026-07-29 08:55', companyId:'c2', kind:'Meeting booked', text:'Discovery with Umzansi Freight set for 11 Aug.'}
  ],
  templates: [
    {id:'tp1', category:'LinkedIn', name:'Initial outreach', body:'Hi {{contact}} — I noticed {{company}} is growing fast in {{industry}}. We recently helped a similar business fix {{problem}}, and I saw a comparable opportunity on your side: {{opportunity}}. Open to a short call?'},
    {id:'tp2', category:'LinkedIn', name:'Follow-up', body:'Hi {{contact}} — following up on my note about {{opportunity}}. Happy to share the 2-page teardown we did on {{company}}\u2019s current experience. Worth 15 minutes?'},
    {id:'tp3', category:'LinkedIn', name:'Final follow-up', body:'{{contact}}, last note from me — if improving {{problem}} isn\u2019t a priority this quarter, no problem at all. I\u2019ll leave the teardown with you either way.'},
    {id:'tp4', category:'Email', name:'Initial outreach', body:'Subject: {{company}} \u00d7 AX-Channels\n\nHi {{contact}},\n\nWe work with {{industry}} businesses whose digital tools haven\u2019t kept up with their growth. Looking at {{company}}, the clearest gap we see is {{problem}}.\n\nWe\u2019d approach it as: {{opportunity}}.\n\nWould a 20-minute call this week be useful?'},
    {id:'tp5', category:'Email', name:'Website opportunity', body:'Hi {{contact}} — your current site is costing {{company}} enquiries: {{problem}}. We build sites as infrastructure, not brochures. A {{service}} engagement would fix this in weeks, not months.'},
    {id:'tp6', category:'Email', name:'UX opportunity', body:'Hi {{contact}} — we did a quick expert review of {{company}}\u2019s experience and found: {{problem}}. The upside is real: {{opportunity}}. Can I send the annotated review?'},
    {id:'tp7', category:'Email', name:'Proposal follow-up', body:'Hi {{contact}} — checking in on the {{service}} proposal. Happy to walk through scope or phasing on a short call. Anything blocking a decision I can help with?'},
    {id:'tp8', category:'Email', name:'Re-engagement', body:'Hi {{contact}} — it\u2019s been a while since we spoke about {{opportunity}}. We\u2019ve since shipped two similar projects in {{industry}}. If the timing is better now, I\u2019d love to reconnect.'},
    {id:'tp9', category:'Discovery', name:'Discovery questions', body:'1. Walk me through how a new customer experiences {{company}} today.\n2. Where does your team lose the most time each week?\n3. What breaks first when volume doubles?\n4. Who feels {{problem}} most — customers or staff?\n5. What would \u201cfixed\u201d look like in 6 months?\n6. Who signs off, and what do they care about?'},
    {id:'tp10', category:'Proposal', name:'Proposal introduction', body:'{{company}} has outgrown its current digital tools. This proposal sets out how AX-Channels will deliver {{service}} to resolve {{problem}} — built as infrastructure that scales with the team, not a launch-day artefact.'},
    {id:'tp11', category:'Proposal', name:'Proposal follow-up', body:'Hi {{contact}} — the {{service}} proposal expires soon. If scope or phasing is the sticking point, we can restructure — the 50% deposit can also be split. Shall we talk this week?'}
  ]
};


// AX-Channels CAE V2 — intelligence layer over the V1 dataset. Extends cae-data.js without modifying it.
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

const db = JSON.parse(JSON.stringify(v1db));

// --- Decision-maker intelligence: enrich existing contacts, add secondary contacts ---
const contactExtras = {
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
db.contacts = db.contacts.map(c => ({...c, ...contactExtras[c.id]}));
db.contacts.push(
  {id:'p14', companyId:'c1', name:'Annelie Fourie', title:'PA to Operations Director', email:'a.fourie@karooridge.co.za', phone:'+27 53 723 1180', linkedin:'—', decisionMaker:false, department:'Operations', role:'Gatekeeper', influence:'Medium', relationship:'Neutral — books Johan\u2019s calls', lastContacted:'2026-08-04', preferredChannel:'Phone', notes:'Best route to Johan\u2019s diary.'},
  {id:'p15', companyId:'c2', name:'Sizwe Mthembu', title:'Operations Manager', email:'sizwe@umzansifreight.co.za', phone:'+27 71 884 2209', linkedin:'linkedin.com/in/sizwemthembu', decisionMaker:false, department:'Operations', role:'Champion', influence:'Medium', relationship:'Positive — feels the pain daily', lastContacted:'2026-07-29', preferredChannel:'WhatsApp', notes:'Fields the status calls. Will champion the portal.'},
  {id:'p16', companyId:'c5', name:'Kabelo Modise', title:'Co-founder & CTO', email:'kabelo@lumopay.io', phone:'+27 83 456 7712', linkedin:'linkedin.com/in/kabelomodise', decisionMaker:false, department:'Engineering', role:'Influencer', influence:'High', relationship:'Positive — met at discovery', lastContacted:'2026-07-28', preferredChannel:'Email', notes:'Wants component library his team can build from.'}
);

// --- Opportunities: type taxonomy + matrix placement (impact from scores; complexity recorded) ---
const oppExtras = {
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
db.opportunities = db.opportunities.map(o => ({...o, ...oppExtras[o.id]}));
db.opportunities.push(
  {id:'o1b', companyId:'c1', problems:['Poor dashboard experience'], opportunity:'Shift-ops reporting dashboard on existing production data — fast standalone win.', service:'Dashboard', type:'Dashboard', group:'Business Systems', valueBand:'Medium', estValue:150000, complexity:'Low', scores:{severity:4,impact:5,fit:5,budget:4,likelihood:4}},
  {id:'o7', companyId:'c7', problems:['Outdated website'], opportunity:'Vacancy listing page with unit specs and enquiry capture.', service:'Website', type:'Landing pages', group:'Websites', valueBand:'Low', estValue:45000, complexity:'Low', scores:{severity:2,impact:2,fit:3,budget:2,likelihood:2}},
  {id:'o7b', companyId:'c7', problems:['Manual business process'], opportunity:'Custom leasing ERP — heavy build, thin returns at 40 units.', service:'Internal Business System', type:'Operational platform', group:'Business Systems', valueBand:'Low', estValue:60000, complexity:'High', scores:{severity:2,impact:2,fit:2,budget:2,likelihood:1}}
);

// --- Digital Opportunity Scanner records ---
db.scans = [
  {id:'sc1', companyId:'c1', category:'Website', status:'Weak', severity:'High', problem:'2019 brochure site, broken layouts on new content', evidence:'Careers page renders raw HTML; news last updated 2023', opportunity:'Credibility rebuild for investor & supplier audiences', impact:'Weak second impression during proposal diligence'},
  {id:'sc2', companyId:'c1', category:'Mobile experience', status:'Missing', severity:'High', problem:'Site unusable on mobile', evidence:'No viewport meta; pinch-zoom required', opportunity:'Responsive rebuild', impact:'Site staff access everything on phones'},
  {id:'sc3', companyId:'c1', category:'Internal systems', status:'Weak', severity:'Critical', problem:'Permit-to-work on paper, shift handover in Excel', evidence:'Ops walkthrough 16 Jul; 40+ min handover meetings', opportunity:'Permit & handover system (proposed)', impact:'Safety compliance risk + lost production time'},
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
  {id:'st2', companyId:'c2', problem:'No client visibility on loads — 60 status calls a day', opportunity:'Load-tracking portal on existing TMS data', target:'Nomvula Dlamini (MD); Sizwe as internal champion', service:'Web App', entryOffer:'Operations UX audit of the status-call workflow', angle:'Quantify the cost of status calls; portal pays for itself in ops hours', proof:'Atlas Ridge customer portal — live reference', nextStep:'Discovery meeting 11 Aug — scope portal MVP', dealValue:'R350 000', difficulty:'Easy'},
  {id:'st3', companyId:'c5', problem:'Confusing merchant dashboard driving churn and support load', opportunity:'Dashboard redesign + design system before Series B', target:'Daniel Botha (CPO); keep Kabelo close on build feasibility', service:'UX/UI Design', entryOffer:'Annotated teardown of top-5 merchant journeys', angle:'Design system as infrastructure for the Series B story — not a reskin', proof:'SaaS dashboard work + component library samples', nextStep:'Close negotiation — revised scope by 11 Aug', dealValue:'R280 000', difficulty:'Moderate'},
  {id:'st4', companyId:'c9', problem:'Manual weighbridge capture losing 7% of loads to disputes', opportunity:'Digital capture + dispute dashboard', target:'Frans Oosthuizen (GM) — phone-first', service:'Dashboard', entryOffer:'Dispute-cost calculation from their own numbers', angle:'Pure margin-recovery pitch: the system pays for itself per dispute avoided', proof:'Mining ops references; dispute-rate math', nextStep:'Call before proposal expires 15 Aug', dealValue:'R390 000', difficulty:'Moderate'},
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
  {companyId:'c9', why:'Pure margin-recovery story: 7% dispute rate is measurable money. GM is the DM and already requested the proposal.', primary:'Digital weighbridge capture + dispute dashboard', secondary:'Basic credibility website', valueRange:'R390 000', approach:'Phone-first. Keep the pitch to dispute-cost math; proposal expires 15 Aug.'}
];

// --- Acquisition campaigns ---
db.campaigns = [
  {id:'cam1', name:'Mining modernisation Q3', target:'South African mining & resources companies', offer:'Digital Opportunity Preview (free 10-min annotated walkthrough)', goal:'10 discovery meetings by end Q3'},
  {id:'cam2', name:'Logistics portals', target:'SA logistics and distribution operators', offer:'Operations UX audit', goal:'3 portal projects in 2026'},
  {id:'cam3', name:'SaaS product UX', target:'Product-driven companies approaching launch', offer:'Free beta first-run teardown', goal:'2 product engagements'},
  {id:'cam4', name:'ProServ portals', target:'Professional-services firms (legal, advisory, health)', offer:'Client-portal opportunity brief', goal:'4 discovery meetings'}
];

export { db };
