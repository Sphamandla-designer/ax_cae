// AX-Channels CAE — relational demo dataset. All records flagged isDemo.
export const TODAY = '2026-08-09';
export const STAGES = ['New','Researching','Qualified','Outreach','Responded','Discovery','Proposal','Negotiation','Won','Lost'];
export const SERVICES = ['Website','UX/UI Design','Mobile App','Web App','Dashboard','Internal Business System','UX Audit','AI UX','Automation','Digital Transformation','Other'];
export const LEAD_SOURCES = ['LinkedIn','Email','Referral','Website','Networking','Cold outreach','Existing client','Other'];

export const db = {
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
    {id:'r6', companyId:'c5', channel:'Referral intro', touch:1, message:'Warm intro via Atlas Ridge CTO.', dateSent:'2026-07-21', status:'Positive', response:'Meeting held', followUpDate:null},
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
    {id:'t5', companyId:'c2', title:'Prepare discovery agenda + portal references', type:'Meeting', priority:'High', due:'2026-08-10', status:'Open', notes:'Ahead of the scheduled discovery meeting.'},
    {id:'t6', companyId:'c9', title:'Call Frans before the proposal expires', type:'Proposal', priority:'High', due:'2026-08-12', status:'Open', notes:''},
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
    {id:'a10', ts:'2026-07-29 08:55', companyId:'c2', kind:'Meeting booked', text:'Discovery with Umzansi Freight booked.'}
  ],
  templates: [
    // Placeholders only. A template never claims results, clients, growth or work you have not recorded:
    // fill {{problem}} / {{opportunity}} from your own assessment and opportunity records.
    {id:'tp1', category:'LinkedIn', name:'Initial outreach', body:'Hi {{contact}} — I was looking at {{company}} and noticed {{problem}}. There may be a contained fix: {{opportunity}}. I can send a short write-up of what I saw if that is useful.'},
    {id:'tp2', category:'LinkedIn', name:'Follow-up', body:'Hi {{contact}} — following up on my note about {{problem}}. I have put the observations into a short write-up for {{company}}. Want me to send it over?'},
    {id:'tp3', category:'LinkedIn', name:'Final follow-up', body:'{{contact}}, last note from me — if {{problem}} is not a priority right now, that is completely fair. If it comes up later, I am one message away.'},
    {id:'tp4', category:'Email', name:'Initial outreach', body:'Subject: {{company}} — {{problem}}\n\nHi {{contact}},\n\nWhile looking at {{company}} I noticed {{problem}}.\n\nThe way I would approach it: {{opportunity}}.\n\nWould a 20-minute call be useful to see whether it matters on your side?\n\n— AX-Channels'},
    {id:'tp5', category:'Email', name:'Website opportunity', body:'Hi {{contact}} — I reviewed {{company}}\u2019s website and noticed {{problem}}. If that is affecting enquiries, a {{service}} engagement is one way to address it. Happy to share what I found.'},
    {id:'tp6', category:'Email', name:'UX opportunity', body:'Hi {{contact}} — I did a quick review of {{company}}\u2019s customer experience and noted: {{problem}}. A possible next step: {{opportunity}}. Can I send the annotated notes?'},
    {id:'tp7', category:'Email', name:'Proposal follow-up', body:'Hi {{contact}} — checking in on the {{service}} proposal. Happy to walk through scope or phasing on a short call. Is there anything blocking a decision that I can help with?'},
    {id:'tp8', category:'Email', name:'Re-engagement', body:'Hi {{contact}} — we last spoke about {{opportunity}}. If the timing is better now, I would be glad to pick it up again. If not, no problem.'},
    {id:'tp9', category:'Discovery', name:'Discovery questions', body:'1. Walk me through how a new customer experiences {{company}} today.\n2. Where does your team lose the most time each week?\n3. What breaks first when volume doubles?\n4. Who feels {{problem}} most — customers or staff?\n5. What would \u201cfixed\u201d look like in 6 months?\n6. Who signs off, and what do they care about?'},
    {id:'tp10', category:'Proposal', name:'Proposal introduction', body:'This proposal sets out how AX-Channels would deliver {{service}} for {{company}} to address {{problem}}, based on what we discussed in discovery.'},
    {id:'tp11', category:'Proposal', name:'Proposal follow-up', body:'Hi {{contact}} — the {{service}} proposal expires soon. If scope or phasing is the sticking point, we can look at restructuring it. Shall we talk this week?'}
  ]
};
