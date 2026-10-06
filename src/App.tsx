import { Component } from "react";
import { flushSync } from "react-dom";
import * as M from "./data/seed";
import { demoDb, emptyDb } from "./data/seed";
import type { Db } from "./data/types";
import { addDays, daysBetween, localISODate, localTime } from "./lib/dates";
import { load, save } from "./lib/storage";
import Layout from "./views/Layout";

// Controller for the whole CAE workspace. Ported from the logic class of `project/CAE V2.5.1.dc.html`:
// state + record mutators + engines (acquisition score, readiness, next best action, 13-stage workflow),
// and renderVals(), which builds the view model the generated views in src/views render.

export interface AppProps {
  defaultView?: string;
}

function initialState(props: AppProps) {
  const today = localISODate();
  const saved = load();
  const demo = saved ? saved.demo : true;
  const data: Db = saved ? saved.data : demoDb(today);
  return { view:props.defaultView ?? 'dashboard', selId:null, search:'', showBell:false, showAdd:false, showBrief:false, briefLoading:false, briefFor:null,
    pipeTab:'board', savedView:'All', fIndustry:'All industries', fStage:'All stages', fGrade:'All grades', fSource:'All sources',
    tplCat:'All', copiedTpl:null, notes:(saved ? saved.notes : {}) as Record<string,string>, form:{} as Record<string,string>, data, demo, today,
    stages:M.STAGES, sources:M.LEAD_SOURCES,
    showScore:false, scoreFor:null, showGen:false, genFor:null, genVariant:'LinkedIn', genLoading:false,
    genEdit:null, genStep:'preview', showOutcome:false, outcomeFor:null, outcomeChoice:'', outcomeNotes:'',
    showClose:false, closeFor:null, closeKind:'Lost', closeReason:'', closeNotes:'', closeValue:'',
    planTab:'contact', workflow:M.WORKFLOW, confLevels:M.CONFIDENCE_LEVELS, outcomes:M.OUTREACH_OUTCOMES, outcomeNext:M.OUTCOME_NEXT as Record<string,string>,
    lostReasons:M.LOST_REASONS, stalls:M.STALL_THRESHOLDS as Record<string,number>, touchPurposes:M.TOUCH_PURPOSES as Record<number,string>,
    detailFocus:'company', editForm:{} as Record<string,string>, formError:'', editing:null, audit:false, testLog:[], testRan:false,
    queueSort:'Smart (default)', oppTab:'opportunities', scanCats:M.SCAN_CATEGORIES, scanStatuses:M.SCAN_STATUSES, severities:M.SEVERITIES,
    contactRoles:M.CONTACT_ROLES, nextActionsByStage:M.NEXT_ACTIONS_BY_STAGE as Record<string,string[]>, serviceGroups:M.SERVICE_GROUPS as Record<string,string[]>,
    addIndustry:'Mining', addSource:'LinkedIn' };
}
type State = ReturnType<typeof initialState>;

let seq = 0;
const uid = (prefix: string) => prefix + Date.now().toString(36) + (seq++).toString(36);

export default class App extends Component<AppProps, State> {
  state = initialState(this.props);
  _drag: string | null = null;
  _genTimer: ReturnType<typeof setTimeout> | null = null;
  _briefTimer: ReturnType<typeof setTimeout> | null = null;

  // helpers
  score(c){ const s=c.scores; return s.problem+s.pay+s.need+s.access+s.growth; }
  grade(n){ return n>=20?'A':n>=15?'B':n>=10?'C':'—'; }
  gradeColors(g){ return g==='A'?['#0c1220','#ffffff']:g==='B'?['#a8863d','#ffffff']:g==='C'?['#e6e2d8','#3a3f48']:['#f0ede4','#8a8474']; }
  oppScore(o){ const s=o.scores; return s.severity+s.impact+s.fit+s.budget+s.likelihood; }
  money(v){ return v?'R'+String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g,'\u2009'):'—'; }
  fdate(d){ if(!d) return '—'; const p=d.split(' ')[0].split('-'); const M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return parseInt(p[2],10)+' '+M[parseInt(p[1],10)-1]; }
  isToday(d){ return d===this.state.today; }
  isOverdue(d){ return !!d && d<this.state.today; }
  dueLabel(d){ if(!d) return '—'; if(this.isToday(d)) return 'Today'; if(this.isOverdue(d)) return 'Overdue'; return this.fdate(d); }
  dueColor(d){ if(!d) return '#8a8474'; if(this.isOverdue(d)) return '#b0453c'; if(this.isToday(d)) return '#a8863d'; return '#8a8474'; }
  contactOf(cid){ return this.state.data.contacts.find(x=>x.companyId===cid); }
  oppOf(cid){ return this.state.data.opportunities.find(x=>x.companyId===cid); }
  companyOf(cid){ return this.state.data.companies.find(x=>x.id===cid); }
  statusColor(s){ return {'Replied':'#2e7d5b','Positive':'#2e7d5b','Accepted':'#2e7d5b','Viewed':'#a8863d','Negotiation':'#a8863d','Sent':'#6b6f78','Scheduled':'#6b6f78','Draft':'#8a8474','No response':'#b0453c','Negative':'#b0453c','Not interested':'#b0453c','Rejected':'#b0453c','Expired':'#b0453c'}[s]||'#6b6f78'; }
  mut(key, fn){ this.setState(s=>({ data:{ ...s.data, [key]: fn(s.data[key]) } })); }
  addActivity(cid, kind, text){ this._dirty.add(cid); const ts=this.state.today+' '+localTime(); this.mut('activities', a=>[{id:uid('a'), ts, companyId:cid, kind, text}, ...a]); }
  setStage(cid, stage){
    const co=this.companyOf(cid); if(!co || co.stage===stage) return;
    // Closing a deal always goes through the outcome form (lost reason / won value).
    if(stage==='Won'||stage==='Lost') return this.openClose(cid, stage);
    this.mut('companies', cs=>cs.map(c=>c.id===cid?{...c, stage, stageSince:this.state.today}:c));
    this.addActivity(cid,'Stage change', co.name+' moved to '+stage+'.');
  }

  componentDidMount(){
    // A workspace left open overnight should roll over to the new day.
    this._dayTimer=setInterval(()=>{ const t=localISODate(); if(t!==this.state.today) this.setState({today:t}); }, 60000);
  }
  componentWillUnmount(){
    clearInterval(this._dayTimer);
    if(this._genTimer) clearTimeout(this._genTimer);
    if(this._briefTimer) clearTimeout(this._briefTimer);
  }
  _dayTimer: ReturnType<typeof setInterval> | undefined;
  _dirty = new Set<string>();
  // The preparation steps are completed by saving records, so a logged next action that names one of them
  // is moved on to the recomputed next best action once that record exists. Actions set explicitly
  // (follow-ups, responses, meetings, proposals, manual picks) are left alone.
  syncLoggedNext(){
    const prep=['Research company','Research digital experience','Identify primary opportunity','Identify decision-maker','Create acquisition strategy','Prepare initial outreach','Reassess opportunity','Complete digital audit','Create opportunity brief'];
    const updates={};
    this._dirty.forEach(cid=>{ const c=this.companyOf(cid); if(!c||!prep.includes(c.nextAction.label)) return;
      const nb=this.nextBest(c).label; if(nb!==c.nextAction.label) updates[cid]=nb; });
    this._dirty.clear();
    if(Object.keys(updates).length) this.mut('companies', cs=>cs.map(x=>updates[x.id]?{...x, nextAction:{label:updates[x.id], due:this.state.today}}:x));
  }
  persist(){ save({data:this.state.data, notes:this.state.notes, demo:this.state.demo}); }

  open(cid){ this.openAt(cid,'company'); }

  // ---------- V2.5.1 workflow routing ----------
  // Open the section for the next best action, with its form already open when the step needs data.
  openNext(c){
    const nb=this.nextBest(c), f=this.focusForAction(nb.label), cid=c.id;
    const go=(editing=null, editForm={})=>this.setState({detailFocus:f, editing, editForm, formError:''});
    if(f==='research'){ const rs=this.researchOf(c); return go('research',{summary:rs.summary, findings:rs.findings, website:c.website}); }
    if(f==='assessment') return go('scan');
    if(f==='opportunity'&&!this.oppsOf(cid).length) return go('opp');
    if(f==='contacts'&&!this.contactsOf(cid).length) return go('contact',{ctRole:'Decision Maker'});
    if(f==='strategy') return this.editStrategy(cid);
    if(nb.label==='Schedule discovery') return go('meeting');
    if(nb.label==='Prepare proposal') return go('proposal',{prProject:(this.bestOpp(cid)||{}).type||'', prValue:String(this.oppValueOf(cid)||'')});
    return go();
  }
  doNext(cid){ const c=this.companyOf(cid); if(!c) return; this.setState({selId:cid, showBell:false, search:''}); this.openNext(c); }
  // Opening a prospect always starts clean: no form or error carried over from the previous one.
  openAt(cid, focus){ this.setState({selId:cid, detailFocus:focus||'company', showBell:false, search:'', editing:null, editForm:{}, formError:''}); }
  setFocus(f){ this.setState({detailFocus:f, editing:null, editForm:{}, formError:''}); }
  ef(key, val){ this.setState(s=>({editForm:{...s.editForm, [key]:val}})); }
  efv(key, fallback){ const v=(this.state.editForm||{})[key]; return v===undefined?(fallback??''):v; }
  clearForm(){ this.setState({editForm:{}, formError:''}); }
  researchOf(c){ return c.research || {summary:c.description||'', findings:'', completed: !!(c.description && c.website && c.website!=='—')}; }

  // 13-stage workflow: definition, completion, status, routing target
  stages13(c){
    const cid=c.id, D=this.state.data, si=s=>this.state.stages.indexOf(s);
    const rs=this.researchOf(c), scans=this.scansOf(cid), opps=this.oppsOf(cid), dm=this.dmOf(cid), st=this.strategyOf(cid);
    const cts=this.contactsOf(cid);
    const outs=D.outreach.filter(o=>o.companyId===cid), sent=outs.filter(o=>o.dateSent), drafts=outs.filter(o=>!o.dateSent);
    const responded=outs.filter(o=>o.outcome&&!['Sent','Viewed','Draft','Scheduled'].includes(o.outcome));
    const mtgs=D.meetings.filter(m=>m.companyId===cid), heldMtgs=mtgs.filter(m=>m.date&&m.date<=this.state.today);
    const props=D.proposals.filter(p=>p.companyId===cid);
    const scored=Object.values(c.scores as Record<string,number>).every(v=>v>0);
    const closed=c.stage==='Won'||c.stage==='Lost';
    const followed=sent.filter(o=>o.touch>=2);
    const defs=[
      {key:'company', n:1, name:'Company', done:true, prog:false, cta:'Review company'},
      {key:'research', n:2, name:'Research', done:rs.completed, prog:!rs.completed&&!!rs.summary, cta:rs.completed?'Edit research':'Start research'},
      {key:'assessment', n:3, name:'Digital assessment', done:scans.length>=3, prog:scans.length>0&&scans.length<3, cta:scans.length===0?'Start assessment':scans.length<3?'Continue assessment':'Review assessment'},
      {key:'opportunity', n:4, name:'Opportunity', done:opps.length>0&&this.oppValueOf(cid)>0, prog:opps.length>0&&this.oppValueOf(cid)===0, cta:opps.length?'Review opportunity':'Identify opportunity'},
      {key:'contacts', n:5, name:'Decision-maker', done:!!dm, prog:!dm&&cts.length>0, cta:dm?'Review contacts':cts.length?'Review contacts':'Add decision-maker'},
      {key:'prioritize', n:6, name:'Prioritize', done:scored, prog:!scored&&Object.values(c.scores as Record<string,number>).some(v=>v>0), cta:'Review priority'},
      {key:'strategy', n:7, name:'Strategy', done:!!st, prog:false, cta:st?'Edit strategy':'Create strategy'},
      {key:'outreach', n:8, name:'Outreach', done:sent.length>0, prog:drafts.length>0, cta:sent.length?'Review outreach':'Generate outreach'},
      {key:'followup', n:9, name:'Follow-up', done:followed.length>0||si(c.stage)>=4, prog:sent.length>0&&!followed.length, cta:'Complete follow-up'},
      {key:'response', n:10, name:'Response', done:responded.length>0, prog:sent.length>0&&!responded.length, cta:'Record response'},
      {key:'discovery', n:11, name:'Discovery', done:heldMtgs.length>0, prog:mtgs.length>0&&!heldMtgs.length, cta:mtgs.length?'Record discovery':'Schedule discovery'},
      {key:'proposal', n:12, name:'Proposal', done:props.length>0, prog:false, cta:props.length?'View proposal':'Create proposal'},
      {key:'outcome', n:13, name:'Won / Lost', done:closed, prog:false, cta:closed?'Review outcome':'Record outcome'}
    ];
    // status: COMPLETE / IN PROGRESS / BLOCKED / READY / LOCKED (locked = prerequisite missing, still navigable)
    let prevDone=true;
    return defs.map(d=>{
      const blocked = d.n>=8 && !!c.notReadyReason && !c.overrideNotReady;
      let status = d.done?'COMPLETE' : d.prog?'IN PROGRESS' : blocked?'BLOCKED' : prevDone?'READY':'LOCKED';
      prevDone = prevDone && d.done;
      const colors={COMPLETE:['#2e7d5b','#e8f2ec','#bcdccb'], 'IN PROGRESS':['#a8863d','#f6f0e0','#e0cf9e'], READY:['#0c1220','#ffffff','#0c1220'], LOCKED:['#a39d8f','#faf9f5','#e6e2d8'], BLOCKED:['#8a3b34','#f6e6e4','#e3c3bf']};
      const [fg,bg,border]=colors[status];
      return {...d, status, fg, bg, border, mark:d.done?'✓':status==='BLOCKED'?'!':String(d.n), on:()=>this.setFocus(d.key)};
    });
  }
  focusForAction(label){
    const l=(label||'').toLowerCase();
    if(/research (company|digital)|research digital|reassess/.test(l)) return /digital/.test(l)?'assessment':'research';
    if(/assessment|assess/.test(l)) return 'assessment';
    if(/opportunity/.test(l)) return 'opportunity';
    if(/decision-maker|correct decision/.test(l)) return 'contacts';
    if(/strateg/.test(l)) return 'strategy';
    if(/proposal/.test(l)) return 'proposal';
    if(/discovery/.test(l)) return 'discovery';
    if(/follow up|follow-up|nurture/.test(l)) return 'followup';
    if(/response|reply/.test(l)) return 'response';
    if(/outreach|send|message/.test(l)) return 'outreach';
    if(/convert|won|lost|outcome|kick off|growth review/.test(l)) return 'outcome';
    return 'company';
  }
  // ---------- V2.5 workflow engines ----------
  stepState(c){
    const cid=c.id, D=this.state.data, si=s=>this.state.stages.indexOf(s);
    const scans=this.scansOf(cid), opps=this.oppsOf(cid), dm=this.dmOf(cid), st=this.strategyOf(cid);
    const outs=D.outreach.filter(o=>o.companyId===cid), sent=outs.filter(o=>o.dateSent);
    const followed=sent.filter(o=>o.touch>=2);
    const mtg=D.meetings.filter(m=>m.companyId===cid);
    const props=D.proposals.filter(p=>p.companyId===cid);
    const closed=c.stage==='Won'||c.stage==='Lost';
    return {
      'Company':{done:true, target:'overview'},
      'Research':{done:this.researchOf(c).completed, target:'research'},
      'Digital assessment':{done:scans.length>=3, target:'scanner'},
      'Opportunity':{done:opps.length>0&&this.oppValueOf(cid)>0, target:'opportunity'},
      'Decision-maker':{done:!!dm, target:'contacts'},
      'Strategy':{done:!!st, target:'strategy'},
      'Outreach':{done:sent.length>0, target:'outreach'},
      'Follow-up':{done:followed.length>0||si(c.stage)>=4, target:'outreach'},
      'Discovery':{done:mtg.some(m=>m.date)||si(c.stage)>=5&&c.stage!=='Lost', target:'outreach'},
      'Proposal':{done:props.length>0, target:'outreach'},
      'Outcome':{done:closed, target:'overview'}
    };
  }
  readiness(c){
    const steps=this.stepState(c);
    const req=['Company','Research','Digital assessment','Opportunity','Decision-maker','Strategy'];
    const evidence=this.scansOf(c.id).some(s=>s.confidence==='Observed');
    const angle=!!(this.strategyOf(c.id)&&this.strategyOf(c.id).angle);
    const items=[
      {k:'Company researched', ok:steps['Research'].done, target:'research'},
      {k:'Digital problem identified', ok:this.scansOf(c.id).length>0, target:'scanner'},
      {k:'Evidence recorded (observed)', ok:evidence, target:'scanner'},
      {k:'Primary opportunity identified', ok:steps['Opportunity'].done, target:'opportunity'},
      {k:'Decision-maker identified', ok:steps['Decision-maker'].done, target:'contacts'},
      {k:'Acquisition strategy created', ok:steps['Strategy'].done, target:'strategy'},
      {k:'Outreach angle defined', ok:angle, target:'strategy'},
      {k:'Channel selected', ok:!!(this.dmOf(c.id)&&this.dmOf(c.id).preferredChannel&&this.dmOf(c.id).preferredChannel!=='—'), target:'contacts'}
    ];
    const done=items.filter(x=>x.ok).length;
    const pct=Math.round(done/items.length*100);
    const missing=items.filter(x=>!x.ok);
    const blocked=c.notReadyReason&&!c.overrideNotReady;
    return {pct, items, missing, ready:missing.length===0&&!blocked, blocked, reason:c.notReadyReason};
  }
  nextBest(c){
    const cid=c.id, D=this.state.data, T=this.state.today, steps=this.stepState(c);
    const outs=D.outreach.filter(o=>o.companyId===cid);
    const sent=outs.filter(o=>o.dateSent), drafts=outs.filter(o=>!o.dateSent);
    const due=outs.find(o=>o.followUpDate&&o.followUpDate<=T);
    const positive=outs.some(o=>['Positive','Replied','Meeting booked'].includes(o.outcome||o.status));
    const props=D.proposals.filter(p=>p.companyId===cid);
    const openProp=props.find(p=>['Draft','Sent','Viewed','Negotiation'].includes(p.status));
    const accepted=props.find(p=>p.status==='Accepted');
    const isClient=D.clients.some(cl=>cl.companyId===cid);
    const mk=(label,why,target)=>({label, why, target});
    if(c.stage==='Won') return isClient?mk('Plan growth review','Client active — expand the account','overview'):mk('Convert to client','Proposal accepted','overview');
    if(c.stage==='Lost') return mk('Nurture','Closed lost — keep a light touch for re-entry','overview');
    if(accepted&&!isClient) return mk('Convert to client','Proposal accepted','overview');
    if(!steps['Research'].done) return mk('Research company','No description or website on file','overview');
    if(!steps['Digital assessment'].done) return mk('Research digital experience','Fewer than 3 categories assessed','scanner');
    if(!steps['Opportunity'].done) return mk('Identify primary opportunity','Digital assessment done, no valued opportunity','opportunity');
    if(!steps['Decision-maker'].done) return mk('Identify decision-maker','Opportunity clear but no approver identified','contacts');
    if(!steps['Strategy'].done) return mk('Create acquisition strategy','Decision-maker known, no strategy','strategy');
    if(openProp) return mk('Follow up on proposal','Proposal '+openProp.status.toLowerCase()+(openProp.expiry!=='—'?' · expires '+this.fdate(openProp.expiry):''),'outreach');
    if(c.stage==='Discovery'&&!props.length) return mk('Prepare proposal','Discovery held, no proposal yet','outreach');
    if(positive&&this.state.stages.indexOf(c.stage)<5) return mk('Schedule discovery','Positive response received','outreach');
    if(due) return mk('Follow up with decision-maker','Touch '+(due.touch+1)+' due '+this.dueLabel(due.followUpDate).toLowerCase(),'outreach');
    if(drafts.length) return mk('Send initial outreach','Message drafted, not sent','outreach');
    if(!sent.length) return mk('Prepare initial outreach','Strategy ready, no outreach sent','outreach');
    if(!this.oppsOf(cid).length) return mk('Reassess opportunity','No active opportunity recorded','opportunity');
    return mk('Follow up','Awaiting a reply — keep the cadence going','outreach');
  }
  stall(c){
    const th=this.state.stalls[c.stage];
    if(!th||c.stage==='Won'||c.stage==='Lost') return null;
    const d=this.daysSince(c.stageSince||c.dateDiscovered);
    return d>th?{days:d, threshold:th}:null;
  }
  dxConfidence(cid){
    const dims=this.dxDims(cid), n=dims.filter(d=>d.assessed).length, total=dims.length;
    const pct=Math.round(n/total*100);
    const label=n===0?'None':n<=2?'Low':pct>=100?'High':pct>=63?'Medium':'Low';
    return {n, total, pct, label, fg:label==='High'?'#2e7d5b':label==='Medium'?'#a8863d':'#b0453c'};
  }
  whyConfidence(cid){
    const scans=this.scansOf(cid), obs=scans.filter(s=>s.confidence==='Observed').length;
    const sig=this.signalsOf(cid), sigObs=sig.filter(s=>s.confidence==='Observed').length;
    const hasOpp=this.oppsOf(cid).length>0, hasDM=!!this.dmOf(cid);
    const pts=(obs>=3?2:obs>=1?1:0)+(sigObs>=1?1:0)+(hasOpp?1:0)+(hasDM?1:0);
    const label=pts>=4?'High':pts>=2?'Medium':scans.length===0?'Insufficient':'Low';
    return {label, fg:label==='High'?'#2e7d5b':label==='Medium'?'#a8863d':'#b0453c', insufficient:label==='Insufficient'};
  }
  confFg(c){ return {Observed:'#2e7d5b', Indicated:'#a8863d', Assumption:'#b0453c'}[c]||'#8a8474'; }
  whyNow(cid){
    const sig=this.signalsOf(cid).slice().sort((a,b)=>({Observed:0,Indicated:1,Assumption:2}[a.confidence]-{Observed:0,Indicated:1,Assumption:2}[b.confidence]));
    if(sig.length) return {text:sig[0].label, conf:sig[0].confidence};
    const worst=this.scansOf(cid).slice().sort((a,b)=>this.sevRank(b.severity)-this.sevRank(a.severity))[0];
    if(worst&&this.sevRank(worst.severity)>=3) return {text:worst.severity.toLowerCase()+' problem in '+worst.category.toLowerCase(), conf:worst.confidence};
    return {text:'No urgency signal recorded', conf:'Assumption'};
  }
  // ---------- V2.5.1 stage actions (all mutate real records) ----------
  saveResearch(cid, complete){
    const f=this.state.editForm||{}; const c=this.companyOf(cid);
    if(complete && !(f.summary||c.description)){ this.setState({formError:'Add a research summary before marking research complete.'}); return; }
    const rs={summary:f.summary??(c.research?c.research.summary:c.description)??'', findings:f.findings??(c.research?c.research.findings:'')??'', completed: complete? true : (c.research?c.research.completed:false)};
    this.mut('companies', cs=>cs.map(x=>x.id===cid?{...x, research:rs, description:rs.summary||x.description, website:(f.website||x.website), stageSince: (complete&&x.stage==='New')?this.state.today:x.stageSince, stage:(complete&&x.stage==='New')?'Researching':x.stage, notReadyReason:(complete&&x.notReadyReason==='Insufficient research')?null:x.notReadyReason}:x));
    this.addActivity(cid, complete?'Research complete':'Research updated', complete?'Company research completed.':'Research notes updated.');
    this.setState({editForm:{}, formError:'', editing:null});
  }
  saveScan(cid){
    const f=this.state.editForm||{};
    if(!f.scanCategory||!f.scanStatus||!f.scanProblem){ this.setState({formError:'Category, status and problem are required.'}); return; }
    this.mut('scans', ss=>[...ss, {id:uid('sc'), companyId:cid, category:f.scanCategory, status:f.scanStatus, severity:f.scanSeverity||'Medium', problem:f.scanProblem, evidence:f.scanEvidence||'Not recorded', confidence:f.scanConfidence||'Assumption', opportunity:f.scanOpportunity||'—', impact:f.scanImpact||'—'}]);
    this.addActivity(cid,'Assessment updated', f.scanCategory+' assessed as '+f.scanStatus+' — '+f.scanProblem);
    this.setState({editForm:{}, formError:'', editing:null});
  }
  saveOpportunity(cid){
    const f=this.state.editForm||{};
    if(!f.oppType||!f.oppText){ this.setState({formError:'Opportunity type and description are required.'}); return; }
    const val=parseInt(f.oppValue,10)||0;
    const group=Object.entries(this.state.serviceGroups||{}).find(([,items])=>items.includes(f.oppType));
    this.mut('opportunities', os=>[...os, {id:uid('o'), companyId:cid, problems:(f.oppProblems||'').split(',').map(s=>s.trim()).filter(Boolean), opportunity:f.oppText, service:f.oppType, type:f.oppType, group:group?group[0]:'Other', valueBand: val>=250000?'High':val>=100000?'Medium':'Low', estValue:val, complexity:f.oppComplexity||'Low', scores:{severity:parseInt(f.oppSeverity,10)||3, impact:parseInt(f.oppImpact,10)||3, fit:parseInt(f.oppFit,10)||3, budget:3, likelihood:3}}]);
    this.resolveNotReady(cid,'Opportunity unclear');
    this.addActivity(cid,'Opportunity created', f.oppType+' — '+this.money(val));
    this.setState({editForm:{}, formError:'', editing:null});
  }
  saveContact(cid){
    const f=this.state.editForm||{};
    if(!f.ctName||!f.ctTitle){ this.setState({formError:'Contact name and job title are required.'}); return; }
    const role=f.ctRole||'Unknown';
    const rec={id:f.ctId||uid('p'), companyId:cid, name:f.ctName, title:f.ctTitle, department:f.ctDept||'—', email:f.ctEmail||'—', phone:f.ctPhone||'—', linkedin:f.ctLinkedin||'—', decisionMaker:role==='Decision Maker', role, influence:f.ctInfluence||'Medium', relationship:f.ctRelationship||'New — not contacted', lastContacted:null, preferredChannel:f.ctChannel||'Email', notes:f.ctNotes||''};
    const existing=f.ctId?this.state.data.contacts.find(p=>p.id===f.ctId):null;
    if(existing) this.mut('contacts', ps=>ps.map(p=>p.id===f.ctId?{...p, ...rec, lastContacted:p.lastContacted}:p));
    else this.mut('contacts', ps=>[...ps, rec]);
    if(role==='Decision Maker') this.resolveNotReady(cid,'No decision-maker');
    this.addActivity(cid, existing?'Contact updated':'Contact added', f.ctName+' ('+role+') '+(existing?'updated':'added')+'.');
    this.setState({editForm:{}, formError:'', editing:null});
  }
  // A NOT READY reason clears itself once the gap it names has been filled.
  resolveNotReady(cid, reason){ this.mut('companies', cs=>cs.map(x=>x.id===cid&&x.notReadyReason===reason?{...x, notReadyReason:null}:x)); }
  markDM(cid, pid){
    this.mut('contacts', ps=>ps.map(p=>p.id===pid?{...p, role:'Decision Maker', decisionMaker:true}:p));
    this.resolveNotReady(cid,'No decision-maker');
    const p=this.state.data.contacts.find(x=>x.id===pid);
    this.addActivity(cid,'Decision-maker identified', (p?p.name:'Contact')+' marked as decision-maker.');
  }
  saveStrategy(cid){
    const f=this.state.editForm||{}; const existing=this.strategyOf(cid);
    if(!f.stProblem&&!existing){ this.setState({formError:'Primary problem is required.'}); return; }
    if(!f.stAngle&&!existing){ this.setState({formError:'Outreach angle is required — it drives the generated message.'}); return; }
    const rec={id:existing?existing.id:uid('st'), companyId:cid,
      problem:f.stProblem??(existing&&existing.problem)??'', opportunity:f.stOpportunity??(existing&&existing.opportunity)??'',
      target:f.stTarget??(existing&&existing.target)??'', service:f.stService??(existing&&existing.service)??'',
      entryOffer:f.stOffer??(existing&&existing.entryOffer)??'', angle:f.stAngle??(existing&&existing.angle)??'',
      proof:f.stProof??(existing&&existing.proof)??'', nextStep:f.stNextStep??(existing&&existing.nextStep)??'',
      dealValue:f.stValue??(existing&&existing.dealValue)??'', difficulty:f.stDifficulty??(existing&&existing.difficulty)??'Moderate'};
    this.mut('strategies', ss=> existing?ss.map(s=>s.id===existing.id?rec:s):[...ss, rec]);
    this.addActivity(cid, existing?'Strategy updated':'Strategy created', 'Acquisition strategy '+(existing?'updated':'created')+'.');
    this.setState({editForm:{}, formError:'', editing:null});
  }
  saveMeeting(cid, held){
    const f=this.state.editForm||{};
    if(!held && !/^\d{4}-\d{2}-\d{2}$/.test(f.mtDate||'')){ this.setState({formError:'Pick a meeting date.'}); return; }
    if(held){
      const open=this.state.data.meetings.find(m=>m.companyId===cid&&m.date);
      this.mut('meetings', ms=>ms.map(m=>m.id===(open&&open.id)?{...m, date:this.state.today, notes:(f.mtNotes||m.notes)}:m));
      if(!open) this.mut('meetings', ms=>[...ms, {id:uid('m'), companyId:cid, date:this.state.today, time:f.mtTime||'—', type:'Discovery', notes:f.mtNotes||'Discovery held.'}]);
      this.mut('companies', cs=>cs.map(x=>x.id===cid?{...x, stage:'Discovery', stageSince:this.state.today, nextAction:{label:'Prepare proposal', due:this.state.today}}:x));
      this.addActivity(cid,'Discovery held', f.mtNotes||'Discovery meeting recorded.');
    } else {
      this.mut('meetings', ms=>[...ms, {id:uid('m'), companyId:cid, date:f.mtDate, time:f.mtTime||'10:00', type:'Discovery', notes:f.mtNotes||'—'}]);
      this.mut('companies', cs=>cs.map(x=>x.id===cid?{...x, nextAction:{label:'Prepare discovery', due:f.mtDate}}:x));
      this.addActivity(cid,'Meeting booked','Discovery scheduled for '+this.fdate(f.mtDate)+'.');
    }
    this.setState({editForm:{}, formError:'', editing:null});
  }
  saveProposal(cid){
    const f=this.state.editForm||{}; const bo=this.bestOpp(cid);
    if(!f.prProject){ this.setState({formError:'Project name is required.'}); return; }
    const val=parseInt(f.prValue,10)||this.oppValueOf(cid);
    if(!val){ this.setState({formError:'Proposal value is required.'}); return; }
    const exp=addDays(this.state.today,21);
    this.mut('proposals', ps=>[...ps, {id:uid('q'), companyId:cid, project:f.prProject, service:bo?(bo.type||bo.service):'—', date:this.state.today, value:val, status:'Draft', expiry:exp, probability:0.4, notes:f.prNotes||''}]);
    this.addActivity(cid,'Proposal created', f.prProject+' — '+this.money(val)+' (draft).');
    this.setState({editForm:{}, formError:'', editing:null});
  }
  proposalAction(cid, pid, action){
    const T=this.state.today;
    if(action==='sent'){
      this.mut('proposals', ps=>ps.map(p=>p.id===pid?{...p, status:'Sent', date:T}:p));
      this.mut('companies', cs=>cs.map(x=>x.id===cid?{...x, stage:'Proposal', stageSince:T, nextAction:{label:'Follow up on proposal', due:addDays(T,4)}}:x));
      this.addActivity(cid,'Proposal sent','Proposal marked as sent.');
    }
    if(action==='negotiation'){
      this.mut('proposals', ps=>ps.map(p=>p.id===pid?{...p, status:'Negotiation', probability:0.65}:p));
      this.mut('companies', cs=>cs.map(x=>x.id===cid?{...x, stage:'Negotiation', stageSince:T, nextAction:{label:'Revise scope', due:T}}:x));
      this.addActivity(cid,'Negotiation','Proposal moved to negotiation.');
    }
    if(action==='viewed'){
      this.mut('proposals', ps=>ps.map(p=>p.id===pid?{...p, status:'Viewed'}:p));
      this.addActivity(cid,'Proposal viewed','Prospect opened the proposal.');
    }
  }
  followAction(cid, oid, action){
    const T=this.state.today, c=this.companyOf(cid);
    if(action==='complete'){
      const o=this.state.data.outreach.find(x=>x.id===oid);
      const touch=(o?o.touch:1)+1;
      this.mut('outreach', os=>os.map(x=>x.id===oid?{...x, followUpDate:null}:x));
      this.mut('tasks', ts=>ts.map(t=>(t.companyId===cid&&/follow/i.test(t.type)&&t.status!=='Done')?{...t, status:'Done'}:t));
      this.mut('companies', cs=>cs.map(x=>x.id===cid?{...x, nextAction:{label:'Record response', due:T}}:x));
      this.addActivity(cid,'Follow-up done','Touch '+touch+' follow-up completed for '+(c?c.name:'')+'.');
    }
    if(action==='reschedule'){
      const nd=addDays(T,3);
      this.mut('outreach', os=>os.map(x=>x.id===oid?{...x, followUpDate:nd}:x));
      this.addActivity(cid,'Follow-up rescheduled','Moved to '+this.fdate(nd)+'.');
    }
    if(action==='skip'){
      this.mut('outreach', os=>os.map(x=>x.id===oid?{...x, followUpDate:null}:x));
      this.addActivity(cid,'Follow-up skipped','Cadence touch skipped deliberately.');
    }
  }
  openClose(cid, kind){ this.setState({showClose:true, closeFor:cid, closeKind:kind, closeReason:'', closeNotes:'', closeValue:kind==='Won'?String(this.oppValueOf(cid)||''):''}); }
  editStrategy(cid){
    const stg=this.strategyOf(cid), dmc=this.dmOf(cid);
    this.setState({detailFocus:'strategy', editing:'strategy', formError:'', editForm: stg?{stProblem:stg.problem, stOpportunity:stg.opportunity, stTarget:stg.target, stService:stg.service, stOffer:stg.entryOffer, stAngle:stg.angle, stProof:stg.proof, stNextStep:stg.nextStep, stValue:stg.dealValue, stDifficulty:stg.difficulty}:{stDifficulty:'Moderate', stTarget:dmc?dmc.name+' ('+dmc.title+')':'', stService:(this.bestOpp(cid)||{}).type||'', stOpportunity:(this.bestOpp(cid)||{}).opportunity||'', stValue:this.oppValueOf(cid)?this.money(this.oppValueOf(cid)):''}})
  }
  markSent(cid, oid){
    const T=this.state.today;
    const fu=addDays(T,3);
    this.mut('outreach', os=>os.map(x=>x.id===oid?{...x, dateSent:T, status:'Sent', outcome:'Sent', followUpDate:fu}:x));
    this.mut('tasks', ts=>[...ts, {id:uid('t'), companyId:cid, title:'Follow up — new value', type:'Follow-up', priority:'High', due:fu, status:'Open', notes:'Created when outreach was marked sent.'}]);
    this.mut('companies', cs=>cs.map(x=>{ if(x.id!==cid) return x; const adv=this.state.stages.indexOf(x.stage)<3; return {...x, stage:adv?'Outreach':x.stage, stageSince:adv?T:x.stageSince, nextAction:{label:'Follow up with decision-maker', due:fu}}; }));
    this.addActivity(cid,'Outreach sent','Draft marked as sent; follow-up task created.');
  }
  convertToClient(cid){
    const c=this.companyOf(cid), o=this.bestOpp(cid), T=this.state.today;
    if(!c || this.state.data.clients.some(cl=>cl.companyId===cid)) return;
    this.mut('clients', cl=>[...cl, {id:uid('cl'), companyId:cid, startDate:T, revenue:(o?o.estValue:0), services:[o?(o.type||o.service):'—'], status:'Active — onboarding', growthOps:['New client → retainer','New client → next service'], referral:'—'}]);
    this.mut('companies', cs=>cs.map(x=>x.id===cid?{...x, stage:'Won', stageSince:x.stage==='Won'?x.stageSince:T, nextAction:{label:'Kick off project', due:T}}:x));
    this.addActivity(cid,'Converted to client', c.name+' converted to client.');
  }
  // "Mark done" on the next best action. Real-world actions (sending, following up, converting) are
  // recorded here; steps that are complete only once their data exists open the right form instead, so a
  // step never shows as done without its record. The sales stage is never advanced on its own.
  markStageDone(cid){
    const c=this.companyOf(cid); if(!c) return;
    const T=this.state.today, D=this.state.data, nb=this.nextBest(c);
    const need=(focus, editing, msg, editForm={})=>this.setState({detailFocus:focus, editing, formError:msg, editForm});
    const outs=D.outreach.filter(o=>o.companyId===cid);
    switch(nb.label){
      case 'Research company':
        if(!(this.state.editForm.summary||c.description)) return need('research','research','Add a research summary before marking research complete.',{summary:'', findings:this.researchOf(c).findings, website:c.website});
        flushSync(()=>this.saveResearch(cid, true)); break;
      case 'Research digital experience':
        return need('assessment','scan','Assess at least 3 categories of the digital experience to complete the assessment ('+this.scansOf(cid).length+' of 3 recorded).');
      case 'Identify primary opportunity':
        return need('opportunity','opp','Record an opportunity with an estimated value to complete this step.');
      case 'Identify decision-maker':
        return need('contacts','contact','Add the decision-maker, or mark an existing contact as decision-maker.',{ctRole:'Decision Maker'});
      case 'Create acquisition strategy':
        this.editStrategy(cid); return this.setState({formError:'Save an acquisition strategy to complete this step (primary problem and outreach angle are required).'});
      case 'Prepare initial outreach':
        this.setFocus('outreach'); return this.openGen(cid);
      case 'Send initial outreach': {
        const draft=outs.find(o=>!o.dateSent); if(draft) flushSync(()=>this.markSent(cid, draft.id)); break; }
      case 'Follow up with decision-maker': {
        const due=outs.find(o=>o.followUpDate&&o.followUpDate<=T); if(due) flushSync(()=>this.followAction(cid, due.id, 'complete')); break; }
      case 'Schedule discovery':
        return need('discovery','meeting','Pick a date to schedule the discovery meeting.');
      case 'Prepare proposal':
        return need('proposal','proposal','Create the proposal to complete this step.',{prProject:(this.bestOpp(cid)||{}).type||'', prValue:String(this.oppValueOf(cid)||'')});
      case 'Convert to client':
        // Not yet marked won: capture the won outcome first (it creates the client record).
        if(c.stage!=='Won') return this.openClose(cid,'Won');
        flushSync(()=>this.convertToClient(cid)); break;
      default:
        // Follow up on proposal, nurture, growth review, awaiting a reply: log the touch and schedule the next one.
        flushSync(()=>{
          this.addActivity(cid,'Action done', nb.label+' completed for '+c.name+'.');
          this.mut('companies', cs=>cs.map(x=>x.id===cid?{...x, nextAction:{label:nb.label, due:addDays(T, /nurture/i.test(nb.label)?30:4)}}:x));
        });
        this.setState({formError:''});
        return;
    }
    const after=this.companyOf(cid);
    const next=this.nextBest(after);
    this.mut('companies', cs=>cs.map(x=>x.id===cid&&x.nextAction.label!==next.label?{...x, nextAction:{label:next.label, due:T}}:x));
    this.setState({detailFocus:this.focusForAction(next.label), editing:null, formError:''});
  }
  runWorkflowTest(){
    const T=this.state.today, cid=uid('ctest'), log=[];
    const step=(name, fn, check)=>{ try{ flushSync(fn); const ok=check(); log.push({name, ok, note: ok?'passed':'state did not update'}); }catch(e){ log.push({name, ok:false, note:String(e.message||e)}); } };
    const co=()=>this.companyOf(cid);
    step('Create prospect', ()=>{
      this.mut('companies', cs=>[{id:cid, name:'QA Test Company', industry:'Technology', subIndustry:'—', website:'qatest.co.za', location:'Cape Town, WC', size:'20–50', linkedin:'—', description:'', leadSource:'Other', dateDiscovered:T, owner:'QA', campaign:'—', stage:'New', priority:'Medium', scores:{problem:0,pay:0,need:0,access:0,growth:0}, nextAction:{label:'Research company', due:T}, digital:{website:'—',mobile:'—',app:'—',portal:'—',internal:'—',social:'—'}, stageSince:T, notReadyReason:null, overrideNotReady:false, isTest:true}, ...cs]);
    }, ()=>!!co());
    step('Research saved & complete', ()=>{
      this.mut('companies', cs=>cs.map(x=>x.id===cid?{...x, description:'QA research summary.', research:{summary:'QA research summary.', findings:'QA findings.', completed:true}, stage:'Researching'}:x));
    }, ()=>this.researchOf(co()).completed);
    step('Digital assessment (3 categories)', ()=>{
      this.mut('scans', ss=>[...ss,
        {id:'sc-qa1', companyId:cid, category:'Website', status:'Weak', severity:'High', problem:'QA problem', evidence:'QA evidence', confidence:'Observed', opportunity:'QA opportunity', impact:'QA impact'},
        {id:'sc-qa2', companyId:cid, category:'Mobile experience', status:'Missing', severity:'High', problem:'QA problem', evidence:'QA evidence', confidence:'Observed', opportunity:'QA opportunity', impact:'QA impact'},
        {id:'sc-qa3', companyId:cid, category:'Customer portal', status:'Missing', severity:'Critical', problem:'QA problem', evidence:'QA evidence', confidence:'Observed', opportunity:'QA opportunity', impact:'QA impact'}]);
    }, ()=>this.scansOf(cid).length>=3);
    step('Opportunity created with value', ()=>{
      this.mut('opportunities', os=>[...os, {id:'o-qa', companyId:cid, problems:['QA problem'], opportunity:'QA opportunity', service:'Customer portal', type:'Customer portal', group:'Business Systems', valueBand:'Medium', estValue:180000, complexity:'Low', scores:{severity:4,impact:4,fit:4,budget:3,likelihood:3}}]);
    }, ()=>this.oppValueOf(cid)>0);
    step('Decision-maker identified', ()=>{
      this.mut('contacts', ps=>[...ps, {id:'p-qa', companyId:cid, name:'QA Contact', title:'MD', department:'Executive', email:'qa@qatest.co.za', phone:'—', linkedin:'—', decisionMaker:true, role:'Decision Maker', influence:'High', relationship:'New', lastContacted:null, preferredChannel:'Email', notes:''}]);
    }, ()=>!!this.dmOf(cid));
    step('Lead score set (prioritize)', ()=>{
      this.mut('companies', cs=>cs.map(x=>x.id===cid?{...x, scores:{problem:4,pay:4,need:4,access:4,growth:3}}:x));
    }, ()=>Object.values(co().scores).every(v=>v>0));
    step('Strategy created', ()=>{
      this.mut('strategies', ss=>[...ss, {id:'st-qa', companyId:cid, problem:'QA problem', opportunity:'QA opportunity', target:'QA Contact (MD)', service:'Web App', entryOffer:'QA preview', angle:'QA angle', proof:'QA proof', nextStep:'15-minute call', dealValue:'R180 000', difficulty:'Moderate'}]);
    }, ()=>!!this.strategyOf(cid));
    step('Action readiness reaches 100%', ()=>{}, ()=>this.readiness(co()).pct===100);
    step('Outreach sent + follow-up task created', ()=>{
      const fu=addDays(T,3);
      this.mut('outreach', os=>[...os, {id:'r-qa', companyId:cid, channel:'Email', touch:1, purpose:'Initial observation', message:'QA message', dateSent:T, status:'Sent', outcome:'Sent', response:'', responseNotes:'', followUpDate:fu}]);
      this.mut('tasks', ts=>[...ts, {id:'t-qa', companyId:cid, title:'Follow up — new value', type:'Follow-up', priority:'High', due:fu, status:'Open', notes:'QA'}]);
      this.mut('companies', cs=>cs.map(x=>x.id===cid?{...x, stage:'Outreach', stageSince:T}:x));
    }, ()=>this.state.data.outreach.some(o=>o.companyId===cid&&o.dateSent)&&this.state.data.tasks.some(t=>t.companyId===cid));
    step('Response recorded → next action set', ()=>{
      this.mut('outreach', os=>os.map(o=>o.id==='r-qa'?{...o, outcome:'Positive', status:'Positive', responseNotes:'QA positive', followUpDate:null}:o));
      this.mut('companies', cs=>cs.map(x=>x.id===cid?{...x, stage:'Responded', stageSince:T, nextAction:{label:'Schedule discovery', due:T}}:x));
    }, ()=>this.nextBest(co()).label==='Schedule discovery');
    this.setState({testLog:log, testRan:true});
  }
  clearTestData(){
    this.mut('companies', cs=>cs.filter(c=>!c.isTest));
    ['scans','opportunities','contacts','strategies','outreach','tasks'].forEach(k=>{
      this.mut(k, arr=>arr.filter(x=>!String(x.id).includes('-qa')&&!String(x.companyId||'').startsWith('ctest')));
    });
    this.setState({testLog:[], testRan:false});
  }
  // Simulated generation delay. Armed via _armGen so a remount (hot reload, prop change)
  // can never leave the modal stuck in its loading state.
  _armGen(ms){ if(this._genTimer) clearTimeout(this._genTimer);
    this._genTimer=setTimeout(()=>{ this._genTimer=null; this.setState({genLoading:false}); }, ms||850); }
  openGen(cid){ this.setState({showGen:true, genFor:cid, genVariant:'LinkedIn', genLoading:true, genEdit:null, genStep:'preview'}); this._armGen(850); }
  componentDidUpdate(_prevProps, prev: State){
    if(prev.data!==this.state.data || prev.notes!==this.state.notes || prev.demo!==this.state.demo) this.persist();
    if(this._dirty.size) this.syncLoggedNext();
    if(this.state.showGen && this.state.genLoading && !this._genTimer) this._armGen(400);
    if(this.state.showBrief && this.state.briefLoading && !this._briefTimer){
      this._briefTimer=setTimeout(()=>{ this._briefTimer=null; this.setState({briefLoading:false}); }, 400);
    }
  }
  // ---------- V2 intelligence layer ----------
  oppsOf(cid){ return this.state.data.opportunities.filter(o=>o.companyId===cid); }
  bestOpp(cid){ return this.oppsOf(cid).slice().sort((a,b)=>this.oppScore(b)-this.oppScore(a))[0]||null; }
  oppValueOf(cid){ const os=this.oppsOf(cid); return os.length?Math.max(...os.map(o=>o.estValue)):0; }
  scansOf(cid){ return (this.state.data.scans||[]).filter(s=>s.companyId===cid); }
  contactsOf(cid){ return this.state.data.contacts.filter(c=>c.companyId===cid); }
  dmOf(cid){ return this.contactsOf(cid).find(c=>c.role==='Decision Maker')||null; }
  signalsOf(cid){ return (this.state.data.signals||[]).filter(s=>s.companyId===cid); }
  strategyOf(cid){ return (this.state.data.strategies||[]).find(s=>s.companyId===cid)||null; }
  whyOf(cid){ return (this.state.data.whys||[]).find(s=>s.companyId===cid)||null; }
  sevRank(s){ return {Critical:4,High:3,Medium:2,Low:1}[s]||0; }
  sevColor(s){ return {Critical:'#8a3b34',High:'#b0453c',Medium:'#a8863d',Low:'#8a8474'}[s]||'#8a8474'; }
  lastTouch(cid){ const ds=[...this.state.data.activities.filter(a=>a.companyId===cid).map(a=>a.ts.split(' ')[0]), ...this.state.data.outreach.filter(o=>o.companyId===cid&&o.dateSent).map(o=>o.dateSent)]; return ds.sort().pop()||null; }
  daysSince(d){ if(!d) return 999; return daysBetween(d, this.state.today); }

  acq(c){
    const lead = this.score(c);
    const bo = this.bestOpp(c.id);
    const opp = bo?this.oppScore(bo):0;
    const cts = this.contactsOf(c.id), dm = this.dmOf(c.id);
    let access = 0;
    if(dm){ access = 6; if(dm.influence==='High') access+=2; if(/warm|positive|strong|client/i.test(dm.relationship||'')) access+=2; }
    else { access = cts.some(x=>x.role==='Gatekeeper'||x.role==='Influencer')?3:1; }
    if(cts.some(x=>x.role==='Champion')) access+=1;
    access = Math.min(10, access);
    const scans = this.scansOf(c.id);
    const worst = scans.length?Math.max(...scans.map(s=>this.sevRank(s.severity))):0;
    const sig = this.signalsOf(c.id).length;
    const urgency = Math.min(10, Math.round(worst*1.6 + sig*1.6));
    const fit = bo?bo.scores.fit*2:0;
    const v = this.oppValueOf(c.id);
    const value = v>=350000?10:v>=250000?8:v>=150000?6:v>=80000?4:v>0?2:0;
    const dsl = this.daysSince(this.lastTouch(c.id));
    const recency = dsl<=3?10:dsl<=7?8:dsl<=14?6:dsl<=30?4:2;
    const total = lead+opp+access+urgency+fit+value+recency;
    const band = total>=80?'Priority':total>=60?'Pursue':total>=40?'Nurture':'Low priority';
    const bandColor = total>=80?'#8a3b34':total>=60?'#a8863d':total>=40?'#6b6f78':'#a39d8f';
    const bandBg = total>=80?'#f6e6e4':total>=60?'#f6f0e0':total>=40?'#f0ede4':'#f6f4ef';
    const parts=[{label:'Lead quality',val:lead,max:25},{label:'Opportunity strength',val:opp,max:25},{label:'Decision-maker access',val:access,max:10},{label:'Business urgency',val:urgency,max:10},{label:'Service fit',val:fit,max:10},{label:'Potential value',val:value,max:10},{label:'Recency & activity',val:recency,max:10}];
    const weakest = parts.slice().sort((a,b)=>(a.val/a.max)-(b.val/b.max))[0];
    const strongest = parts.slice().sort((a,b)=>(b.val/b.max)-(a.val/a.max))[0];
    const reason = 'Strongest signal is '+strongest.label.toLowerCase()+' ('+strongest.val+'/'+strongest.max+'); the limiting factor is '+weakest.label.toLowerCase()+' ('+weakest.val+'/'+weakest.max+').';
    return {total, parts, band, bandColor, bandBg, reason, weakest:weakest.label};
  }

  dxDims(cid){
    const scans=this.scansOf(cid);
    const pts={Excellent:100,Good:80,Average:55,Weak:25,Missing:5};
    const map={'Website':['Website'],'Mobile':['Mobile experience','Mobile app'],'UX':['Website','Digital brand / Trust'],'Conversion':['Booking / Lead generation','E-commerce','Website'],'Digital infrastructure':['Dashboard / Reporting','Customer portal'],'Internal systems':['Internal systems'],'Customer experience':['Customer portal','Booking / Lead generation'],'AI / automation maturity':['Automation','AI opportunities']};
    return Object.entries(map).map(([dim,cats])=>{
      const rel=scans.filter(s=>cats.includes(s.category));
      const assessed=rel.length>0;
      const val=assessed?Math.round(rel.reduce((a,s)=>a+(pts[s.status]??50),0)/rel.length):50;
      return {dim, val, assessed};
    });
  }
  dxScore(cid){ const d=this.dxDims(cid); return Math.round(d.reduce((a,x)=>a+x.val,0)/d.length); }
  completeness(c){
    const cid=c.id, scans=this.scansOf(cid);
    const checks=[
      {k:'Decision-maker identified', ok:!!this.dmOf(cid)},
      {k:'Website assessment', ok:scans.some(s=>s.category==='Website')},
      {k:'Digital scan (3+ categories)', ok:scans.length>=3},
      {k:'Opportunity recorded', ok:this.oppsOf(cid).length>0},
      {k:'Estimated value', ok:this.oppValueOf(cid)>0},
      {k:'Lead score complete', ok:Object.values(c.scores as Record<string,number>).every(v=>v>0)},
      {k:'Why-now signal', ok:this.signalsOf(cid).length>0},
      {k:'Acquisition strategy', ok:!!this.strategyOf(cid)},
      {k:'Next action set', ok:!!(c.nextAction&&c.nextAction.label&&c.nextAction.label!=='Set next action')}
    ];
    const done=checks.filter(x=>x.ok).length;
    return {pct:Math.round(done/checks.length*100), missing:checks.filter(x=>!x.ok).map(x=>x.k), checks};
  }
  quadrant(o){ const hi=(o.scores.impact+o.scores.severity)>=8; const cx=o.complexity==='High'; return hi?(cx?'Strategic':'Quick Win'):(cx?'Avoid':'Low Priority'); }
  genMessages(cid){
    const c=this.companyOf(cid); const dm=this.dmOf(cid)||this.contactsOf(cid)[0]; const o=this.bestOpp(cid); const st=this.strategyOf(cid); const w=this.whyOf(cid);
    const scans=this.scansOf(cid).slice().sort((a,b)=>this.sevRank(b.severity)-this.sevRank(a.severity));
    const worst=scans[0]; const name=dm?dm.name.split(' ')[0]:'there';
    const problem=worst?worst.problem:(o?o.problems[0]:'gaps in the digital experience');
    const evidence=worst?worst.evidence:'a quick review of your current experience';
    const opp=o?o.opportunity:(w?w.primary:'a clear digital improvement');
    const svc=o?(o.type||o.service):'UX/UI Design';
    const angle=st?st.angle:'lead with the specific observation, not a service pitch';
    const offer=st?st.entryOffer:'a free 10-minute digital opportunity preview';
    const cat = worst?worst.category.toLowerCase():'digital experience';
    const impact = worst?worst.impact.toLowerCase():'lost time and lost enquiries';
    const cta = st?st.nextStep:'a 15-minute call';
    return [
      {variant:'LinkedIn', note:'Observation → relevance → opportunity → credibility → low-friction ask. Short and human.',
        cta:'Ask if they want the preview sent over',
        body:'Hi '+name+' — I was looking at '+c.name+'\u2019s '+cat+' and noticed '+problem+'. ('+evidence+'.)\n\nFor a '+c.industry.toLowerCase()+' operation your size that usually means '+impact+'.\n\nThere\u2019s a fairly contained fix: '+opp+'. We do this kind of work for SA '+c.industry.toLowerCase()+' businesses — I put together a short preview of how I\u2019d approach it.\n\nHappy to send it over if useful.'},
      {variant:'Email', note:'Same structure, a little more context. No pleasantries, no "leading agency" language.',
        cta:cta,
        body:'Subject: '+c.name+' — '+(worst?worst.category:'digital')+'\n\nHi '+(dm?dm.name:'there')+',\n\nI was reviewing '+c.name+'\u2019s '+cat+' and one thing stood out: '+problem+'. What I saw: '+evidence+'.\n\nThat matters because it tends to cost you '+impact+' — quietly, and every week.\n\nThe opportunity as I see it: '+opp+'. Practically that\u2019s a '+svc.toLowerCase()+' piece of work.\n\nWhy me: AX-Channels builds digital systems for businesses whose tools stopped keeping up with the operation — infrastructure, not a launch-day website.\n\nI\u2019d rather show than tell, so I made you '+offer.toLowerCase()+'. Want me to send it, or set up '+cta.toLowerCase()+'?\n\nSipho M. · AX-Channels'},
      {variant:'Follow-up', note:'Touch 2 — carries new value, never "just following up".',
        cta:'Offer the two concept screens',
        body:'Hi '+name+' — since my note about '+problem+' I mapped what fixing it actually looks like for '+c.name+': '+opp+'.\n\nOne thing that came out of it: '+angle+'.\n\nI\u2019ve got two screens showing the change. Want them?'+(dm&&dm.role!=='Decision Maker'?'\n\nAnd if this really sits with someone else internally, happy to be pointed their way.':'')},
      {variant:'Final follow-up', note:'Touch 4 — closes the loop, leaves the door open, no pressure.',
        cta:'Leave the preview with them and close the loop',
        body:'Hi '+name+' — last note from me on this.\n\nIf '+problem+' isn\u2019t a priority this quarter, that\u2019s fair enough. I\u2019ll leave the preview with you either way — it\u2019s yours to use whether or not you work with us.\n\nIf '+(o?(o.type||o.service).toLowerCase():'this')+' comes up in planning later, I\u2019m one reply away.\n\nSipho M. · AX-Channels'}
    ];
  }

  renderVals() {
    const S = this.state;
    const D = S.data, T = S.today;
    const money = this.money.bind(this), fdate=this.fdate.bind(this);
    const active = D.companies.filter(c=>c.stage!=='Won'&&c.stage!=='Lost');
    const openProps = D.proposals.filter(p=>['Draft','Sent','Viewed','Negotiation'].includes(p.status));
    const wonRevenue = D.clients.reduce((a,c)=>a+c.revenue,0);
    const followDue = D.outreach.filter(o=>o.followUpDate && o.followUpDate<=T);
    const openTasks = D.tasks.filter(t=>t.status!=='Done');
    const tasksToday = openTasks.filter(t=>t.due<=T);
    const meetingsToday = D.meetings.filter(m=>m.date===T);
    const qualified = D.companies.filter(c=>this.score(c)>=15);
    const won = D.companies.filter(c=>c.stage==='Won').length, lost=D.companies.filter(c=>c.stage==='Lost').length;
    const convRate = (won+lost)>0 ? Math.round(won/(won+lost)*100)+'%' : '—';
    const pipeValue = active.reduce((a,c)=>{const o=this.oppOf(c.id); return a+(o?o.estValue:0);},0);
    const weighted = openProps.reduce((a,p)=>a+p.value*p.probability,0);

    const detailC = S.selId ? this.companyOf(S.selId) : null;

    // nav
    const counts: Record<string, number> = { outreach: followDue.length, tasks: tasksToday.length };
    const acqAll = D.companies.map(c=>({c, a:this.acq(c)}));
    const acqOf = cid => (acqAll.find(x=>x.c.id===cid)||{a:{total:0}}).a;
    const activeRanked = acqAll.filter(x=>x.c.stage!=='Won'&&x.c.stage!=='Lost').sort((a,b)=>b.a.total-a.a.total);
    counts.queue = activeRanked.filter(x=>x.a.total>=80).length;
    const nav = [['dashboard','Dashboard'],['queue','Priority Queue'],['prospects','Prospects'],['opportunities','Opportunity Intelligence'],['outreach','Outreach'],['pipeline','Pipeline'],['campaigns','Campaigns'],['clients','Clients'],['tasks','Tasks'],['analytics','Analytics'],['templates','Templates'],['settings','Settings']].map(([id,label])=>{
      const act = S.view===id && !S.selId || (id==='prospects' && S.selId);
      return { label, count: id==='outreach'?counts.outreach||null : id==='tasks'?counts.tasks||null : id==='queue'?counts.queue||null : null,
        color: act?'#ffffff':'rgba(255,255,255,.62)', bg: act?'rgba(255,255,255,.07)':'transparent', edge: act?'#a8863d':'transparent',
        on: ()=>this.setState({view:id, selId:null, showBell:false}) };
    });

    const titles={dashboard:'Daily Acquisition Command Center',queue:'Acquisition Priority Queue',prospects:'Prospects',opportunities:'Opportunity Intelligence',outreach:'Outreach Intelligence',pipeline:'Pipeline',campaigns:'Acquisition Campaigns',clients:'Clients',tasks:'Tasks',analytics:'Analytics',templates:'Template Library',settings:'Settings'};

    // dashboard
    const goView=(v,extra?)=>()=>this.setState({view:v, selId:null, ...(extra||{})});
    const kpis = [
      {label:'Total prospects', value:D.companies.length, sub:active.length+' active', on:goView('prospects',{savedView:'All'})},
      {label:'Qualified (B+)', value:qualified.length, sub:'lead score ≥ 15', on:goView('prospects',{savedView:'Hot prospects'})},
      {label:'Outreach due', value:followDue.length, sub:'follow-ups today', on:goView('outreach')},
      {label:'Meetings', value:D.meetings.filter(m=>m.date&&m.date>=T).length, sub:meetingsToday.length+' today', on:goView('tasks')},
      {label:'Open proposals', value:openProps.length, sub:money(openProps.reduce((a,p)=>a+p.value,0)), on:goView('pipeline',{pipeTab:'props'})},
      {label:'Pipeline value', value:money(pipeValue), sub:'active opportunities', on:goView('pipeline',{pipeTab:'board'})},
      {label:'Won revenue', value:money(wonRevenue), sub:D.clients.length+' clients', on:goView('clients')},
      {label:'Conversion rate', value:convRate, sub:won+' won · '+lost+' lost', on:goView('analytics')}
    ];
    const funnelStages = S.stages.filter(s=>s!=='Lost').map(name=>{
      const count = name==='Won' ? won : D.companies.filter(c=>c.stage===name).length;
      const on = ()=>this.setState({view:'pipeline', selId:null, pipeTab:'board'});
      return count>0 ? {name, count, on, bg:'#0c1220', border:'#0c1220', fg:'#ffffff', sub:'rgba(255,255,255,.55)'} : {name, count, on, bg:'#faf9f5', border:'#e6e2d8', fg:'#c6c0b0', sub:'#b8b2a2'};
    });
    const actions = [];
    followDue.forEach(o=>{ const c=this.companyOf(o.companyId); actions.push({tag:'Follow up', tagFg:'#7a5f24', tagBg:'#f6f0e0', text:(c?c.nextAction.label:'Follow up'), company:c?c.name:'', on:()=>this.open(o.companyId)}); });
    meetingsToday.forEach(m=>{ const c=this.companyOf(m.companyId); actions.push({tag:'Meeting', tagFg:'#2e5b7d', tagBg:'#e6eef4', text:m.type+' at '+m.time, company:c?c.name:'', on:()=>this.open(m.companyId)}); });
    D.companies.filter(c=>c.stage==='New').forEach(c=>actions.push({tag:'Research', tagFg:'#3a3f48', tagBg:'#f0ede4', text:'New prospect needs research', company:c.name, on:()=>this.open(c.id)}));
    openProps.filter(p=>p.expiry!=='—' && p.expiry<= addDays(T,7)).forEach(p=>{ const c=this.companyOf(p.companyId); actions.push({tag:'Proposal', tagFg:'#8a3b34', tagBg:'#f6e6e4', text:'Proposal expires '+fdate(p.expiry), company:c?c.name:'', on:()=>this.open(p.companyId)}); });
    tasksToday.filter(t=>t.priority==='High').slice(0,3).forEach(t=>{ if(!actions.some(a=>a.company===(this.companyOf(t.companyId)||{}).name && a.tag==='Follow up')) { const c=this.companyOf(t.companyId); actions.push({tag:'Task', tagFg:'#3a3f48', tagBg:'#f0ede4', text:t.title, company:c?c.name:'', on:()=>this.open(t.companyId)}); } });

    const rank = active.map(c=>{ const o=this.oppOf(c.id); const s=this.score(c); return {c, s, os:o?this.oppScore(o):0, v:o?o.estValue:0}; }).sort((a,b)=>(b.s+b.os)-(a.s+a.os)).slice(0,5);
    const priority = rank.map(({c,s,os,v})=>{ const g=this.grade(s); const [bg,fg]=this.gradeColors(g); return {name:c.name, grade:g, gradeBg:bg, gradeFg:fg, meta:c.industry+' · lead '+s+'/25 · opp '+os+'/25', next:c.nextAction.label, value:money(v), on:()=>this.open(c.id)}; });
    const activity = D.activities.slice(0,7).map(a=>({kind:a.kind, when:fdate(a.ts), text:a.text}));
    const forecast = [
      {label:'Potential pipeline', value:money(pipeValue)},
      {label:'Weighted pipeline', value:money(weighted)},
      {label:'Open proposal value', value:money(openProps.reduce((a,p)=>a+p.value,0))},
      {label:'Won revenue (YTD)', value:money(wonRevenue)}
    ];

    // prospects list
    const industries = [...new Set(D.companies.map(c=>c.industry))];
    let rows = D.companies.slice();
    const sv = S.savedView;
    if(sv==='Hot prospects') rows=rows.filter(c=>this.score(c)>=20);
    if(sv==='Follow up today') rows=rows.filter(c=>D.outreach.some(o=>o.companyId===c.id&&o.followUpDate&&o.followUpDate<=T)||c.nextAction.due<=T&&c.stage!=='Won'&&c.stage!=='Lost');
    if(sv==='High value') rows=rows.filter(c=>{const o=this.oppOf(c.id);return o&&o.estValue>=250000;});
    if(sv==='No response') rows=rows.filter(c=>D.outreach.some(o=>o.companyId===c.id&&o.status==='No response'));
    if(sv==='Proposal stage') rows=rows.filter(c=>c.stage==='Proposal'||c.stage==='Negotiation');
    if(sv==='Won clients') rows=rows.filter(c=>c.stage==='Won');
    if(S.fIndustry!=='All industries') rows=rows.filter(c=>c.industry===S.fIndustry);
    if(S.fStage!=='All stages') rows=rows.filter(c=>c.stage===S.fStage);
    if(S.fGrade!=='All grades') rows=rows.filter(c=>this.grade(this.score(c))===S.fGrade);
    if(S.fSource!=='All sources') rows=rows.filter(c=>c.leadSource===S.fSource);
    rows.sort((a,b)=>this.score(b)-this.score(a));
    const prospects = rows.map(c=>{ const s=this.score(c), g=this.grade(s), [bg,fg]=this.gradeColors(g); const a=this.acq(c); const r=this.readiness(c); const nb=this.nextBest(c); const st=this.stall(c);
      const dm=this.dmOf(c.id); const o=this.bestOpp(c.id);
      return {name:c.name, industry:c.industry, dm:dm?dm.name:'Not identified', dmFg:dm?'#6b6f78':'#b0453c', score:s+'/25', grade:g, gradeBg:bg, gradeFg:fg,
        acq:a.total, bandFg:a.bandColor, bandBg:a.bandBg, band:a.band,
        readiness:r.pct+'%', readyFg:r.pct===100?'#2e7d5b':r.pct>=60?'#a8863d':'#b0453c',
        opp:o?(o.type||o.service):'—', stage:c.stage, stallLabel:st?'⚠ '+st.days+'d':'', hasStall:!!st,
        action:nb.label, due:this.dueLabel(c.nextAction.due), nextColor:this.dueColor(c.nextAction.due)==='#8a8474'?'#6b6f78':this.dueColor(c.nextAction.due),
        value:o?money(o.estValue):'—', actionCta:nb.label+' \u2192',
        on:()=>this.openAt(c.id,'company'),
        onAction:(e)=>{e.stopPropagation(); this.doNext(c.id);},
        onMore:(e)=>{e.stopPropagation(); this.setState({showScore:true, scoreFor:c.id});}}; });
    const savedViews = ['All','Hot prospects','Follow up today','High value','No response','Proposal stage','Won clients'].map(v=>({label:v, on:()=>this.setState({savedView:v}), bg:sv===v?'#0c1220':'#fff', fg:sv===v?'#fff':'#3a3f48', border:sv===v?'#0c1220':'#e6e2d8'}));

    // detail
    let sel=null, qualDims=[];
    if(detailC){ const c=detailC; const s=this.score(c), g=this.grade(s), [bg,fg]=this.gradeColors(g);
      const ct=this.contactOf(c.id), o=this.oppOf(c.id);
      const dimDefs=[['problem','Digital problem'],['pay','Ability to pay'],['need','Potential need'],['access','Decision-maker access'],['growth','Company growth / activity']];
      qualDims = dimDefs.map(([key,label])=>({key,label,val:c.scores[key], dots:[1,2,3,4,5].map(n=>({n, filled:n<=c.scores[key], bg:n<=c.scores[key]?'#0c1220':'#fff', border:n<=c.scores[key]?'#0c1220':'#d8d2c2', on:()=>{ const nv = (c.scores[key]===n && n===1)?0:n; this.mut('companies', cs=>cs.map(x=>x.id===c.id?{...x, scores:{...x.scores,[key]:nv}}:x)); }}))}));
      const outs = D.outreach.filter(x=>x.companyId===c.id).map(x=>({channel:x.channel, touchLabel:x.touch?('Touch '+x.touch):'Draft', date:x.dateSent?fdate(x.dateSent):('Scheduled '+fdate(x.dateScheduled)), status:x.status, statusFg:this.statusColor(x.status), message:x.message, response:x.response||false}));
      const tks = D.tasks.filter(x=>x.companyId===c.id&&x.status!=='Done').map(x=>({title:x.title, due:this.dueLabel(x.due), dueFg:this.dueColor(x.due), on:()=>{this.mut('tasks',ts=>ts.map(t=>t.id===x.id?{...t,status:'Done'}:t)); this.addActivity(c.id,'Task done',x.title);}}));
      const acts = D.activities.filter(x=>x.companyId===c.id).map(x=>({kind:x.kind, when:fdate(x.ts), text:x.text}));
      sel = { name:c.name, meta:c.industry+' · '+c.subIndustry+' · '+c.location+' · '+c.size+' staff · '+c.website,
        score:s, grade:g, gradeBg:bg, gradeFg:fg, stage:c.stage, priority:c.priority, prioFg:c.priority==='High'?'#b0453c':c.priority==='Medium'?'#a8863d':'#8a8474',
        next:c.nextAction.label, nextDue:this.dueLabel(c.nextAction.due), nextDueColor:this.isOverdue(c.nextAction.due)?'#e08e85':this.isToday(c.nextAction.due)?'#d9b96a':'rgba(255,255,255,.6)',
        description:c.description,
        facts:[{k:'Lead source',v:c.leadSource},{k:'Discovered',v:fdate(c.dateDiscovered)},{k:'Owner',v:c.owner},{k:'Campaign',v:c.campaign||'—'}],
        digital:Object.entries(c.digital).map(([k,v])=>({k:{website:'Website',mobile:'Mobile',app:'App',portal:'Customer portal',internal:'Internal systems',social:'Social presence'}[k]||k, v})),
        hasOpp:!!o, problems:o?o.problems:[], oppText:o?o.opportunity:'', service:o?o.service:'', valueBand:o?o.valueBand:'', oppValue:o?money(o.estValue):'', oppScore:o?this.oppScore(o):0,
        contactName:ct?ct.name:'—', contactTitle:ct?ct.title:'', isDM:!!(ct&&ct.decisionMaker), notDM:!!(ct&&!ct.decisionMaker), contactEmail:ct?ct.email:'', contactPhone:ct?ct.phone:'', contactLinkedin:ct?ct.linkedin:'',
        outreach:outs, noOutreach:outs.length===0, tasks:tks, noTasks:tks.length===0, acts, noActs:acts.length===0,
        note: S.notes[c.id] ?? '' };
      // --- V2 detail intelligence ---
      const a=this.acq(c), w=this.whyOf(c.id), st=this.strategyOf(c.id), comp=this.completeness(c);
      const dims=this.dxDims(c.id), dx=this.dxScore(c.id);
      const cScans=this.scansOf(c.id).slice().sort((x,y)=>this.sevRank(y.severity)-this.sevRank(x.severity));
      const dm=this.dmOf(c.id), cts=this.contactsOf(c.id);
      const oppsHere=this.oppsOf(c.id).slice().sort((x,y)=>this.oppScore(y)-this.oppScore(x));
      const roleFg=r=>({'Decision Maker':'#2e7d5b','Champion':'#2e7d5b','Influencer':'#a8863d','Gatekeeper':'#b0453c','Unknown':'#8a8474'}[r]||'#8a8474');
      Object.assign(sel, {
        acq:a.total, acqBand:a.band, acqFg:a.bandColor, acqBg:a.bandBg, acqW:a.total+'%',
        onScore:()=>this.setState({showScore:true, scoreFor:c.id}),
        estValue: this.oppValueOf(c.id)?money(this.oppValueOf(c.id)):'Not estimated',
        hasWhy:!!w, why:w?w.why:'', whyPrimary:w?w.primary:'', whySecondary:w?w.secondary:'', whyValue:w?w.valueRange:'', whyApproach:w?w.approach:'',
        noWhy:!w,
        dx:dx, dxW:dx+'%', dxFg:dx<40?'#8a3b34':dx<60?'#a8863d':'#2e7d5b',
        dxDims:dims.map(d=>({dim:d.dim, val:d.assessed?d.val:'—', w:d.val+'%', bar:d.assessed?(d.val<40?'#b0453c':d.val<70?'#a8863d':'#2e7d5b'):'#e6e2d8'})),
        weaknesses:cScans.filter(s=>this.sevRank(s.severity)>=3).slice(0,3).map((s,i)=>({n:(i+1)+'.', text:s.category+' — '+s.problem, sev:s.severity, sevFg:this.sevColor(s.severity)})),
        noWeak:cScans.filter(s=>this.sevRank(s.severity)>=3).length===0,
        oppList:oppsHere.map(o=>({type:o.type||o.service, group:o.group||'—', text:o.opportunity, value:money(o.estValue), score:this.oppScore(o)+'/25', quad:this.quadrant(o), quadFg:{'Quick Win':'#2e7d5b','Strategic':'#a8863d','Low Priority':'#6b6f78','Avoid':'#b0453c'}[this.quadrant(o)], complexity:o.complexity||'—'})),
        noOpps:oppsHere.length===0,
        scans:cScans.map(s=>({category:s.category, status:s.status, statusFg:{Excellent:'#2e7d5b',Good:'#2e7d5b',Average:'#a8863d',Weak:'#b0453c',Missing:'#8a3b34'}[s.status]||'#6b6f78', severity:s.severity, sevFg:this.sevColor(s.severity), problem:s.problem, evidence:s.evidence, confidence:s.confidence||'Assumption', confFg:this.confFg(s.confidence), opportunity:s.opportunity, impact:s.impact})),
        noScans:cScans.length===0,
        dmFound: dm?'YES':'NO', dmFoundFg: dm?'#2e7d5b':'#b0453c', dmFoundBg: dm?'#e8f2ec':'#f6e6e4', needsDM:!dm,
        contacts:cts.map(x=>({name:x.name, title:x.title, dept:x.department||'—', role:x.role||'Unknown', roleFg:roleFg(x.role), influence:x.influence||'—', relationship:x.relationship||'—', email:x.email, phone:x.phone, linkedin:x.linkedin, channel:x.preferredChannel||'—', last:x.lastContacted?fdate(x.lastContacted):'Never', notes:x.notes||''})),
        signals:this.signalsOf(c.id).map(s=>s.label), noSignals:this.signalsOf(c.id).length===0,
        hasStrategy:!!st, noStrategy:!st,
        strategy: st?[{k:'Primary problem',v:st.problem},{k:'Primary opportunity',v:st.opportunity},{k:'Target decision-maker',v:st.target},{k:'Recommended service',v:st.service},{k:'Recommended entry offer',v:st.entryOffer},{k:'Outreach angle',v:st.angle},{k:'Proof to use',v:st.proof},{k:'Desired next step',v:st.nextStep},{k:'Estimated deal value',v:st.dealValue}]:[],
        difficulty: st?st.difficulty:'', diffFg: st?({Easy:'#2e7d5b',Moderate:'#a8863d',Difficult:'#b0453c'}[st.difficulty]):'#8a8474',
        completeness:comp.pct, completeW:comp.pct+'%', completeFg:comp.pct>=80?'#2e7d5b':comp.pct>=50?'#a8863d':'#b0453c',
        completeChecks:comp.checks.map(x=>({k:x.k, mark:x.ok?'✓':'—', fg:x.ok?'#2e7d5b':'#b0453c'})),
        hasNext: !!(c.nextAction&&c.nextAction.label&&c.nextAction.label!=='Set next action'),
        noNext: !(c.nextAction&&c.nextAction.label&&c.nextAction.label!=='Set next action'),
        nextOptions: (S.nextActionsByStage[c.stage]||['Research company','Follow up','Nurture']),
        onGen:()=>this.openGen(c.id)
      });
      // ---------- V2.5.1 workspace ----------
      const F=S.detailFocus||'company';
      const rd=this.readiness(c), nbA=this.nextBest(c);
      const st13=this.stages13(c);
      const cur=st13.find(x=>x.key===F)||st13[0];
      const rs=this.researchOf(c);
      const wcts=this.contactsOf(c.id), dmc=this.dmOf(c.id);
      const oppsH=this.oppsOf(c.id).slice().sort((x,y)=>this.oppScore(y)-this.oppScore(x));
      const stg=this.strategyOf(c.id);
      const outsH=D.outreach.filter(x=>x.companyId===c.id);
      const mtgsH=D.meetings.filter(m=>m.companyId===c.id);
      const propsH=D.proposals.filter(p=>p.companyId===c.id);
      const ed=(k,fb)=>({val:this.efv(k,fb), on:(e)=>this.ef(k,e.target.value)});
      const focusTitles={company:'Company profile', research:'Research', assessment:'Digital opportunity scanner', opportunity:'Opportunity intelligence', contacts:'Decision-maker intelligence', prioritize:'Prioritise — acquisition score', strategy:'Acquisition strategy', outreach:'Outreach workspace', followup:'Follow-up', response:'Response', discovery:'Discovery', proposal:'Proposal', outcome:'Won / lost outcome'};
      Object.assign(sel, {
        st13: st13.map(x=>({...x, active:x.key===F, ring:x.key===F?'#a8863d':x.border})),
        focus:F, focusTitle:focusTitles[F]||'Workspace', focusStatus:cur.status, focusFg:cur.fg, focusBg:cur.bg,
        isCompanyF:F==='company', isResearchF:F==='research', isAssessF:F==='assessment', isOppF:F==='opportunity',
        isContactsF:F==='contacts', isPrioF:F==='prioritize', isStratF:F==='strategy', isOutreachF:F==='outreach',
        isFollowF:F==='followup', isRespF:F==='response', isDiscF:F==='discovery', isPropF:F==='proposal', isOutcomeF:F==='outcome',
        formError:S.formError||'', hasFormError:!!S.formError,
        researchCta:(rs.completed?'Edit research':'Start research')+' \u2192',
        strategyCta:(stg?'Edit strategy':'Create acquisition strategy')+' \u2192',
        researchViewDisplay: S.editing==='research'?'none':'block',
        companyDisplay: F==='company'?'block':'none',
        qualDisplay: (F==='company'||F==='prioritize')?'block':'none',
        assessDisplay: F==='assessment'?'block':'none',
        outreachDisplay: (F==='outreach'||F==='followup'||F==='response')?'block':'none',
        notesDisplay: F==='company'?'block':'none',
        oppDisplay: (F==='opportunity'||F==='assessment')?'block':'none',
        strategyDisplay: F==='strategy'?'block':'none',
        // research
        researchDone:rs.completed, researchEmpty:!rs.summary, researchSummary:rs.summary||'', researchFindings:rs.findings||'',
        editingResearch:S.editing==='research',
        onStartResearch:()=>this.setState({editing:'research', formError:'', editForm:{summary:rs.summary, findings:rs.findings, website:c.website}}),
        rSummary:ed('summary', rs.summary), rFindings:ed('findings', rs.findings), rWebsite:ed('website', c.website),
        onSaveResearch:()=>this.saveResearch(c.id,false), onCompleteResearch:()=>this.saveResearch(c.id,true),
        onCancelEdit:()=>this.setState({editing:null, editForm:{}, formError:''}),
        // assessment
        scanCount:this.scansOf(c.id).length, editingScan:S.editing==='scan',
        onAddScan:()=>this.setState({editing:'scan', formError:'', editForm:{}}),
        onSaveScan:()=>this.saveScan(c.id),
        scanCatOpts:S.scanCats, scanStatusOpts:S.scanStatuses, sevOpts:S.severities, confOpts:S.confLevels,
        sCat:ed('scanCategory',''), sStatus:ed('scanStatus',''), sSev:ed('scanSeverity','Medium'), sProblem:ed('scanProblem',''),
        sEvidence:ed('scanEvidence',''), sConf:ed('scanConfidence','Assumption'), sOpp:ed('scanOpportunity',''), sImpact:ed('scanImpact',''),
        // opportunity
        editingOpp:S.editing==='opp',
        onAddOpp:()=>this.setState({editing:'opp', formError:'', editForm:{}}),
        onSaveOpp:()=>this.saveOpportunity(c.id),
        oppTypeOpts:Object.values(S.serviceGroups||{}).flat(),
        oType:ed('oppType',''), oText:ed('oppText',''), oProblems:ed('oppProblems',''), oValue:ed('oppValue',''),
        oComplexity:ed('oppComplexity','Low'), oSeverity:ed('oppSeverity','3'), oImpact:ed('oppImpact','3'), oFit:ed('oppFit','3'),
        oppCards:oppsH.map(o=>({type:o.type||o.service, group:o.group||'—', text:o.opportunity, value:money(o.estValue), score:this.oppScore(o)+'/25',
          quad:this.quadrant(o), quadFg:{'Quick Win':'#2e7d5b','Strategic':'#a8863d','Low Priority':'#6b6f78','Avoid':'#b0453c'}[this.quadrant(o)],
          complexity:o.complexity||'—', onStrategy:()=>this.editStrategy(c.id), onOutreach:()=>this.setFocus('outreach')})),
        // contacts
        contactCards:wcts.map(p=>({name:p.name, title:p.title, dept:p.department||'—', role:p.role||'Unknown',
          roleFg:{'Decision Maker':'#2e7d5b','Champion':'#2e7d5b','Influencer':'#a8863d','Gatekeeper':'#b0453c','Unknown':'#8a8474'}[p.role]||'#8a8474',
          influence:p.influence||'—', relationship:p.relationship||'—', email:p.email, phone:p.phone, linkedin:p.linkedin,
          channel:p.preferredChannel||'—', last:p.lastContacted?fdate(p.lastContacted):'Never', notes:p.notes||'',
          isDM:p.role==='Decision Maker', notDM:p.role!=='Decision Maker',
          onMarkDM:()=>this.markDM(c.id,p.id),
          onEdit:()=>{ const val=(x)=>x&&x!=='—'?x:''; this.setState({detailFocus:'contacts', editing:'contact', formError:'', editForm:{ctId:p.id, ctName:p.name, ctTitle:val(p.title), ctDept:val(p.department), ctEmail:val(p.email), ctPhone:val(p.phone), ctLinkedin:val(p.linkedin), ctRole:p.role||'Unknown', ctInfluence:p.influence||'Medium', ctRelationship:val(p.relationship), ctChannel:val(p.preferredChannel)||'Email', ctNotes:p.notes||''}}); },
          onLogActivity:()=>{ this.mut('contacts', ps=>ps.map(x=>x.id===p.id?{...x, lastContacted:T}:x)); this.addActivity(c.id,'Contact touched','Spoke with '+p.name+'.'); }})),
        editingContact:S.editing==='contact',
        onAddContact:()=>this.setState({editing:'contact', formError:'', editForm:{ctRole:'Decision Maker'}}),
        onSaveContact:()=>this.saveContact(c.id),
        roleOpts:S.contactRoles,
        cName:ed('ctName',''), cTitle:ed('ctTitle',''), cDept:ed('ctDept',''), cEmail:ed('ctEmail',''), cPhone:ed('ctPhone',''),
        cLinkedin:ed('ctLinkedin',''), cRole:ed('ctRole','Decision Maker'), cInfluence:ed('ctInfluence','Medium'),
        cRelationship:ed('ctRelationship',''), cChannel:ed('ctChannel','Email'), cNotes:ed('ctNotes',''),
        // strategy
        editingStrategy:S.editing==='strategy',
        onEditStrategy:()=>this.editStrategy(c.id),
        onSaveStrategy:()=>this.saveStrategy(c.id),
        stFields:[['stProblem','Primary problem',true],['stOpportunity','Primary opportunity',false],['stTarget','Target decision-maker',false],['stService','Recommended service',false],['stOffer','Recommended entry offer',false],['stAngle','Outreach angle',true],['stProof','Proof to use',false],['stNextStep','Desired next step',false],['stValue','Estimated deal value',false]]
          .map(([k,label,req])=>({label, req, required:req?'Required':'', val:this.efv(k,''), on:(e)=>this.ef(k,e.target.value)})),
        stDifficulty:ed('stDifficulty','Moderate'), difficultyOpts:['Easy','Moderate','Difficult'],
        // outreach
        outreachReady:rd.ready, outreachBlocked:rd.blocked,
        onGenerate:()=>this.openGen(c.id),
        outreachItems:outsH.map(o=>({touchLabel:o.touch?('Touch '+o.touch):'Draft', purpose:o.purpose||'—', channel:o.channel,
          date:o.dateSent?fdate(o.dateSent):(o.dateScheduled?'Scheduled '+fdate(o.dateScheduled):'Not sent'),
          outcome:o.outcome||o.status, outcomeFg:this.statusColor(o.outcome||o.status), message:o.message, notes:o.responseNotes||'',
          isDraft:!o.dateSent, hasFollow:!!o.followUpDate, followLabel:o.followUpDate?this.dueLabel(o.followUpDate):'—', followFg:this.dueColor(o.followUpDate),
          nextRec:S.outcomeNext[o.outcome||o.status]||'—',
          onRecord:()=>this.setState({showOutcome:true, outcomeFor:o.id, outcomeChoice:o.outcome||o.status, outcomeNotes:o.responseNotes||''}),
          onMarkSent:()=>this.markSent(c.id, o.id),
          onComplete:()=>this.followAction(c.id,o.id,'complete'), onResched:()=>this.followAction(c.id,o.id,'reschedule'), onSkip:()=>this.followAction(c.id,o.id,'skip'),
          onOpenGen:()=>this.openGen(c.id)})),
        noOutreachItems:outsH.length===0,
        followItems:outsH.filter(o=>o.followUpDate).length,
        // discovery
        editingMeeting:S.editing==='meeting',
        onScheduleMeeting:()=>this.setState({editing:'meeting', formError:'', editForm:{}}),
        onSaveMeeting:()=>this.saveMeeting(c.id,false), onRecordMeeting:()=>this.saveMeeting(c.id,true),
        mDate:ed('mtDate',''), mTime:ed('mtTime','10:00'), mNotes:ed('mtNotes',''),
        meetingRows:mtgsH.map(m=>({date:m.date?fdate(m.date):'Not scheduled', time:m.time||'—', type:m.type, notes:m.notes,
          held:!!(m.date&&m.date<=T), onNotes:()=>this.setState({editing:'meeting', editForm:{mtNotes:m.notes, mtDate:m.date, mtTime:m.time}})})),
        noMeetings:mtgsH.length===0,
        onMoveToProposal:()=>{ this.mut('companies', cs=>cs.map(x=>x.id===c.id?{...x, stage:'Discovery', stageSince:T, nextAction:{label:'Prepare proposal', due:T}}:x)); this.addActivity(c.id,'Stage change','Moved to proposal preparation.'); this.setFocus('proposal'); },
        // proposal
        editingProposal:S.editing==='proposal',
        onCreateProposal:()=>this.setState({editing:'proposal', formError:'', editForm:{prProject:(this.bestOpp(c.id)||{}).opportunity?(this.bestOpp(c.id).type||''):'', prValue:String(this.oppValueOf(c.id)||'')}}),
        onSaveProposal:()=>this.saveProposal(c.id),
        pProject:ed('prProject',''), pValue:ed('prValue',''), pNotes:ed('prNotes',''),
        proposalRows:propsH.map(p=>({project:p.project, value:money(p.value), status:p.status, statusFg:this.statusColor(p.status),
          date:fdate(p.date), expiry:p.expiry==='—'?'—':fdate(p.expiry), prob:Math.round(p.probability*100)+'%',
          isDraft:p.status==='Draft', canNegotiate:['Sent','Viewed'].includes(p.status), canView:p.status!=='Draft',
          onSent:()=>this.proposalAction(c.id,p.id,'sent'), onViewed:()=>this.proposalAction(c.id,p.id,'viewed'), onNegotiate:()=>this.proposalAction(c.id,p.id,'negotiation'),
          onRecordResponse:()=>this.setFocus('outcome')})),
        noProposals:propsH.length===0
      });
      // --- V2.5 detail workflow ---
      const steps=this.stepState(c), r=this.readiness(c), nb=this.nextBest(c), stl=this.stall(c);
      const dxc=this.dxConfidence(c.id), whyC=this.whyConfidence(c.id), wn=this.whyNow(c.id);
      const fmap={overview:'company', scanner:'assessment'};
      const goTo=(t)=>()=>this.setState({detailFocus:fmap[t]||t, editing:null, editForm:{}, formError:''});
      Object.assign(sel, {
        nbLabel:nb.label, nbWhy:nb.why, onNb:()=>this.openNext(c), nbCta:nb.label+' \u2192',
        readiness:r.pct, readyW:r.pct+'%', readyFg:r.pct===100?'#2e7d5b':r.pct>=60?'#a8863d':'#b0453c',
        readyItems:r.items.map(x=>({k:x.k, mark:x.ok?'☑':'☐', fg:x.ok?'#2e7d5b':'#b0453c', on:goTo(x.target)})),
        readyState: r.ready?'Ready for outreach':'Not ready', readyStateFg: r.ready?'#2e7d5b':'#b0453c', readyStateBg: r.ready?'#e8f2ec':'#f6e6e4',
        missingList: r.missing.map(x=>{
          // Each fix-it button opens the form that fills the gap (or the section, when the record exists).
          const [cta, open] = /decision/i.test(x.k) ? ['Identify decision-maker', ()=>this.setState({detailFocus:'contacts', editing:wcts.length?null:'contact', editForm:wcts.length?{}:{ctRole:'Decision Maker'}, formError:''})]
            : /channel/i.test(x.k) ? ['Set preferred channel', goTo('contacts')]
            : /problem|evidence/i.test(x.k) ? ['Assess website', ()=>this.setState({detailFocus:'assessment', editing:'scan', editForm:{scanCategory:'Website', scanConfidence:'Observed'}, formError:''})]
            : /opportunity/i.test(x.k) ? ['Create opportunity', ()=>this.setState({detailFocus:'opportunity', editing:'opp', editForm:{}, formError:''})]
            : /strategy|angle/i.test(x.k) ? ['Create strategy', ()=>this.editStrategy(c.id)]
            : ['Complete research', ()=>this.setState({detailFocus:'research', editing:'research', editForm:{summary:rs.summary, findings:rs.findings, website:c.website}, formError:''})];
          return {k:x.k, on:open, cta}; }),
        hasMissing: r.missing.length>0,
        blocked:r.blocked, blockReason:r.reason||'', onOverride:()=>{ if(window.confirm('Override the NOT READY state for '+c.name+'? It will appear in Contact now despite: '+r.reason)) { this.mut('companies', cs=>cs.map(x=>x.id===c.id?{...x, overrideNotReady:true}:x)); } },
        stalled:!!stl, stallText: stl?'⚠ Stalled for '+stl.days+' days in '+c.stage+' (threshold '+stl.threshold+' days)':'',
        dxConfN:dxc.n+' of '+dxc.total+' assessed dimensions', dxConfLabel:dxc.label, dxConfPct:dxc.pct+'%', dxConfFg:dxc.fg,
        whyConf:whyC.label, whyConfFg:whyC.fg, whyInsufficient:whyC.insufficient,
        whyNowText:wn.text, whyNowConf:wn.conf, whyNowFg:this.confFg(wn.conf),
        signalRows:this.signalsOf(c.id).map(s=>({label:s.label, conf:s.confidence, fg:this.confFg(s.confidence)})),
        canClose: c.stage!=='Won'&&c.stage!=='Lost',
        onMarkWon:()=>this.openClose(c.id,'Won'),
        onMarkLost:()=>this.openClose(c.id,'Lost'),
        outcome: (()=>{ const oc=(D.outcomes||[]).find(x=>x.companyId===c.id); if(!oc) return null;
          return {result:oc.result, resultFg:oc.result==='Won'?'#2e7d5b':'#b0453c',
            rows:[{k:'What happened',v:oc.notes||'—'},{k:'Reason',v:oc.reason||(oc.result==='Won'?'Accepted':'—')},{k:'Acquisition score at close',v:oc.acqAtClose+'/100'},{k:'Opportunity score at close',v:oc.oppAtClose+'/25'},{k:'Action readiness at close',v:oc.readinessAtClose+'%'},{k:'Industry',v:oc.industry},{k:'Service',v:oc.service},{k:'Deal value',v:money(oc.value)},{k:'Acquisition source',v:oc.source},{k:'Campaign',v:oc.campaign},{k:'Time to close',v:oc.daysToClose+' days'}]}; })(),
        hasOutcome: !!(D.outcomes||[]).find(x=>x.companyId===c.id),
        outreachRows: D.outreach.filter(x=>x.companyId===c.id).map(x=>({
          touchLabel: x.touch?('Touch '+x.touch):'Draft', purpose:x.purpose||'—', channel:x.channel,
          date: x.dateSent?fdate(x.dateSent):(x.dateScheduled?'Scheduled '+fdate(x.dateScheduled):'Not sent'),
          outcome: x.outcome||x.status, outcomeFg:this.statusColor(x.outcome||x.status),
          notes: x.responseNotes||'', message:x.message,
          nextAction: S.outcomeNext[x.outcome||x.status]||'—',
          followUp: x.followUpDate?this.dueLabel(x.followUpDate):'—', followFg:this.dueColor(x.followUpDate),
          onRecord:()=>this.setState({showOutcome:true, outcomeFor:x.id, outcomeChoice:x.outcome||x.status, outcomeNotes:x.responseNotes||''})
        }))
      });
    }

    // opportunities
    const oppRows = D.opportunities.map(o=>{ const c=this.companyOf(o.companyId); return {company:c?c.name:'', text:o.opportunity, problems:o.problems, service:o.service, band:o.valueBand+' value', bandFg:o.valueBand==='High'?'#2e7d5b':o.valueBand==='Medium'?'#a8863d':'#8a8474', value:money(o.estValue), score:this.oppScore(o), on:()=>this.openAt(o.companyId,'opportunity'),
      onCompany:(e)=>{e.stopPropagation(); this.openAt(o.companyId,'company');},
      onStrategy:(e)=>{e.stopPropagation(); this.openAt(o.companyId,'strategy');},
      onOutreach:(e)=>{e.stopPropagation(); this.openAt(o.companyId,'outreach');}}; }).sort((a,b)=>b.score-a.score);

    // outreach view
    const cadence=[{touch:'Touch 1',label:'Initial personalised outreach',timing:'Day 0'},{touch:'Touch 2',label:'Value follow-up',timing:'3–4 days later'},{touch:'Touch 3',label:'Case study / proof',timing:'5–7 days later'},{touch:'Touch 4',label:'Final follow-up',timing:'Then close the loop'}];
    const followUpsDue = followDue.map(o=>{ const c=this.companyOf(o.companyId);
      const done=()=>this.followAction(o.companyId,o.id,'complete');
      const res=()=>this.followAction(o.companyId,o.id,'reschedule');
      const skip=()=>this.followAction(o.companyId,o.id,'skip');
      return {company:c?c.name:'', detail:'Touch '+(o.touch+1)+' · '+(c?c.nextAction.label:'')+' · last: '+o.message, onOpen:()=>this.openAt(o.companyId,'followup'), onDone:done, onResched:res, onSkip:skip}; });
    const allOutreach = D.outreach.slice().sort((a,b)=>(b.dateSent||b.dateScheduled||'').localeCompare(a.dateSent||a.dateScheduled||'')).map(o=>{ const c=this.companyOf(o.companyId); return {company:c?c.name:'', channel:o.channel, touchLabel:o.touch?('T'+o.touch):'Draft', message:o.message, date:o.dateSent?fdate(o.dateSent):('Sched '+fdate(o.dateScheduled)), status:o.status, statusFg:this.statusColor(o.status), onOpen:()=>this.open(o.companyId)}; });

    // pipeline
    const cols = S.stages.map(stage=>{ const cards=D.companies.filter(c=>c.stage===stage);
      return { name:stage, fg:stage==='Won'?'#2e7d5b':stage==='Lost'?'#b0453c':'#3a3f48', count:cards.length, total:money(cards.reduce((a,c)=>{const o=this.oppOf(c.id);return a+(o?o.estValue:0);},0)),
        onDrop:(e)=>{e.preventDefault(); if(this._drag){ this.setStage(this._drag, stage); this._drag=null; }},
        cards:cards.map(c=>{ const s=this.score(c), g=this.grade(s), [bg,fg]=this.gradeColors(g); const o=this.oppOf(c.id);
          const isClient = D.clients.some(cl=>cl.companyId===c.id);
          return {name:c.name, grade:g, gradeBg:bg, gradeFg:fg, service:o?o.service:c.industry, value:o?money(o.estValue):'—', due:this.dueLabel(c.nextAction.due), dueFg:this.dueColor(c.nextAction.due), next:c.nextAction.label,
            canConvert: stage==='Won' && !isClient,
            onConvert:(e)=>{ e.stopPropagation(); this.convertToClient(c.id); this.setState({view:'clients', selId:null}); },
            onDrag:()=>{ this._drag=c.id; }, on:()=>this.open(c.id)}; }) }; });
    const proposals = D.proposals.map(q=>{ const c=this.companyOf(q.companyId); return {company:c?c.name:'', project:q.project, value:money(q.value), prob:Math.round(q.probability*100)+'%', weighted:money(q.value*q.probability), expiry:q.expiry==='—'?'—':fdate(q.expiry), expiryFg:q.expiry!=='—'&&q.expiry<=addDays(T,7)?'#b0453c':'#6b6f78', status:q.status, statusFg:this.statusColor(q.status), on:()=>this.open(q.companyId)}; });

    // clients
    const clients = D.clients.map(cl=>{ const c=this.companyOf(cl.companyId); const ct=this.contactOf(cl.companyId); return {name:c?c.name:'', revenue:money(cl.revenue), meta:(ct?ct.name+' · '+ct.title+' · ':'')+'client since '+fdate(cl.startDate)+' · '+cl.status, services:cl.services, growth:cl.growthOps, referral:cl.referral==='—'?'No referrals yet — ask at next review.':cl.referral, on:()=>this.open(cl.companyId)}; });
    const clientStats=[{label:'Active clients', value:D.clients.length},{label:'Won revenue', value:money(wonRevenue)},{label:'Upsell opportunities', value:D.clients.reduce((a,c)=>a+c.growthOps.length,0)}];

    // tasks
    const taskFocus=(t)=>{ const byType={Research:'research', Outreach:'outreach', 'Follow-up':'followup', Meeting:'discovery', Proposal:'proposal', Client:'outcome', Nurture:'followup'}[t.type];
      return this.focusForAction(t.title)!=='company'?this.focusForAction(t.title):(byType||'company'); };
    const mkTask=(t)=>{ const c=this.companyOf(t.companyId); const done=t.status==='Done';
      return {title:t.title, company:c?c.name:'', type:t.type, priority:t.priority, prioFg:t.priority==='High'?'#b0453c':t.priority==='Medium'?'#a8863d':'#8a8474', due:this.dueLabel(t.due), dueFg:this.dueColor(t.due), check:done?'✓':'', circleBg:done?'#2e7d5b':'#fff', circleBorder:done?'#2e7d5b':'#b8b2a2', titleFg:done?'#a39d8f':'#10151e', deco:done?'line-through':'none',
        onDone:()=>{ this.mut('tasks',ts=>ts.map(x=>x.id===t.id?{...x,status:done?'Open':'Done'}:x)); if(!done) this.addActivity(t.companyId,'Task done',t.title); },
        onOpen:()=>this.openAt(t.companyId, taskFocus(t)),
        onReschedule:()=>{ const nd=addDays(t.due>T?t.due:T,3); this.mut('tasks',ts=>ts.map(x=>x.id===t.id?{...x,due:nd}:x)); this.addActivity(t.companyId,'Task rescheduled',t.title+' moved to '+fdate(nd)+'.'); }}; };
    const og = D.tasks.filter(t=>t.status!=='Done');
    const taskGroups=[
      {label:'Overdue', fg:'#b0453c', items:og.filter(t=>this.isOverdue(t.due)).map(mkTask)},
      {label:'Due today', fg:'#a8863d', items:og.filter(t=>this.isToday(t.due)).map(mkTask)},
      {label:'Upcoming', fg:'#3a3f48', items:og.filter(t=>t.due>T).sort((a,b)=>a.due.localeCompare(b.due)).map(mkTask)},
      {label:'Done', fg:'#2e7d5b', items:D.tasks.filter(t=>t.status==='Done').map(mkTask)}
    ].map(g=>({...g, count:g.items.length+(g.items.length===1?' task':' tasks'), empty:g.items.length===0}));

    // analytics
    const outSent = D.outreach.filter(o=>o.status!=='Draft'&&o.status!=='Scheduled');
    const responded = outSent.filter(o=>['Replied','Positive','Negative','Not interested'].includes(o.status));
    const positive = outSent.filter(o=>['Replied','Positive'].includes(o.status));
    const anGroups=[
      {label:'Acquisition', rows:[{k:'Prospects added',v:D.companies.length},{k:'Qualified (score ≥15)',v:qualified.length},{k:'Outreach sent',v:outSent.length},{k:'Response rate',v:outSent.length?Math.round(responded.length/outSent.length*100)+'%':'—'},{k:'Positive response rate',v:outSent.length?Math.round(positive.length/outSent.length*100)+'%':'—'}]},
      {label:'Sales', rows:[{k:'Meetings held / booked',v:D.meetings.length},{k:'Proposals sent',v:D.proposals.length},{k:'Acceptance rate',v:D.proposals.length?Math.round(D.proposals.filter(p=>p.status==='Accepted').length/D.proposals.filter(p=>p.status!=='Draft').length*100)+'%':'—'},{k:'Won projects',v:won},{k:'Lost projects',v:lost}]},
      {label:'Revenue', rows:[{k:'Pipeline value',v:money(pipeValue)},{k:'Weighted pipeline',v:money(weighted)},{k:'Won revenue',v:money(wonRevenue)},{k:'Avg project value',v:D.clients.length?money(wonRevenue/D.clients.length):'—'}]}
    ];
    const stageIdx = s=>S.stages.indexOf(s);
    const reached = min => D.companies.filter(c=> stageIdx(c.stage)>=min || c.stage==='Won').length;
    const convSteps=[['Prospects',D.companies.length],['Qualified',D.companies.filter(c=>stageIdx(c.stage)>=2&&c.stage!=='Lost').length],['Contacted',D.companies.filter(c=>stageIdx(c.stage)>=3&&c.stage!=='Lost').length],['Responded',D.companies.filter(c=>stageIdx(c.stage)>=4&&c.stage!=='Lost').length],['Meeting',D.companies.filter(c=>stageIdx(c.stage)>=5&&c.stage!=='Lost').length],['Proposal',D.companies.filter(c=>stageIdx(c.stage)>=6&&c.stage!=='Lost').length],['Won',won]] as [string, number][];
    const base=convSteps[0][1]||1;
    const convFunnel = convSteps.map(([stage,count])=>({stage, count, w:Math.max(2,Math.round(count/base*100))+'%', pct:Math.round(count/base*100)+'% of total'}));
    const mkBreak=(label, keyFn)=>{ const m:Record<string,any>={}; D.companies.forEach(c=>{ const k=keyFn(c); if(!k) return; const o=this.oppOf(c.id); m[k]=m[k]||{n:0,v:0}; m[k].n++; m[k].v+=(o?o.estValue:0); }); const max=Math.max(...Object.values(m).map(x=>x.v),1);
      return {label, rows:Object.entries(m).sort((a,b)=>b[1].v-a[1].v).map(([k,x])=>({k, meta:x.n+' · '+money(x.v), w:Math.max(3,Math.round(x.v/max*100))+'%'}))}; };
    const breakdowns=[mkBreak('By industry',c=>c.industry), mkBreak('By lead source',c=>c.leadSource), mkBreak('By service',c=>{const o=this.oppOf(c.id);return o?o.service:null;})];

    // templates
    const cats=['All','LinkedIn','Email','Discovery','Proposal'];
    const tplCats=cats.map(c=>({label:c, on:()=>this.setState({tplCat:c}), bg:S.tplCat===c?'#0c1220':'#fff', fg:S.tplCat===c?'#fff':'#3a3f48', border:S.tplCat===c?'#0c1220':'#e6e2d8'}));
    const tpls=D.templates.filter(t=>S.tplCat==='All'||t.category===S.tplCat).map(t=>({name:t.name, category:t.category, body:t.body, copyLabel:S.copiedTpl===t.id?'Copied ✓':'Copy',
      onCopy:()=>{ try{navigator.clipboard.writeText(t.body);}catch(e){} this.setState({copiedTpl:t.id}); setTimeout(()=>this.setState({copiedTpl:null}),1500); }}));
    const tplVars=['{'+'{company}'+'}','{'+'{contact}'+'}','{'+'{industry}'+'}','{'+'{problem}'+'}','{'+'{opportunity}'+'}','{'+'{service}'+'}'];

    // settings
    const settingsRows=[{k:'Studio',v:'AX-Channels — digital systems studio'},{k:'Currency',v:'ZAR (R) · USD invoicing +3% admin'},{k:'Owners',v:'Sipho M. · Thandi N.'},{k:'Follow-up cadence',v:'Touch 2 +3–4d · Touch 3 +5–7d · Touch 4 final'},{k:'Deposit policy',v:'50% to begin · 50% on delivery'},{k:'Sample data',v:S.demo?'Demo dataset — clearly labelled':'None — live workspace'}];
    const aiRows=[{k:'AI prospect research',d:'Company URL → generated overview'},{k:'AI opportunity detection',d:'Website analysis → UX/digital gaps'},{k:'AI lead scoring',d:'Recommended score from signals'},{k:'AI outreach drafting',d:'Personalised messages from the opportunity'},{k:'AI follow-up suggestions',d:'Based on conversation history'},{k:'AI sales assistant',d:'“What should I do today?”'}];

    // ---- V2.5: workflow-driven day plan ----
    const wrap = c => ({c, a:this.acq(c), r:this.readiness(c), nb:this.nextBest(c), stall:this.stall(c)});
    const activeW = D.companies.filter(c=>c.stage!=='Won'&&c.stage!=='Lost').map(wrap);
    const rowFor = ({c,a,r,nb,stall}) => ({name:c.name, acq:a.total, band:a.band, bandFg:a.bandColor, bandBg:a.bandBg,
      readiness:r.pct+'%', readyFg:r.pct===100?'#2e7d5b':r.pct>=60?'#a8863d':'#b0453c',
      action:nb.label, actionCta:nb.label+' \u2192', why:nb.why, value:this.oppValueOf(c.id)?money(this.oppValueOf(c.id)):'—', stage:c.stage,
      stallLabel: stall?'⚠ Stalled '+stall.days+'d':'', hasStall:!!stall,
      on:()=>this.openAt(c.id,'company'),
      onAction:(e)=>{e.stopPropagation(); this.doNext(c.id);}});
    const contactNow = activeW.filter(x=>x.r.ready&&x.nb.label.match(/outreach/i)).map(rowFor);
    const followNow = activeW.filter(x=>D.outreach.some(o=>o.companyId===x.c.id&&o.followUpDate&&o.followUpDate<=T)).map(rowFor);
    const researchNow = activeW.filter(x=>!x.r.ready&&x.a.total>=50&&x.nb.label.match(/research|identify|reassess/i)).sort((p,q)=>q.a.total-p.a.total).map(rowFor);
    const prepareNow = activeW.filter(x=>x.nb.label.match(/strategy|prepare|create opportunity/i)).map(rowFor);
    const waiting = activeW.filter(x=>{
      const outs=D.outreach.filter(o=>o.companyId===x.c.id&&o.dateSent&&(!o.followUpDate||o.followUpDate>T));
      const prop=D.proposals.some(p=>p.companyId===x.c.id&&['Sent','Viewed','Negotiation'].includes(p.status));
      const mtg=D.meetings.some(m=>m.companyId===x.c.id&&m.date&&m.date>=T);
      return outs.length>0||prop||mtg;
    }).map(x=>{ const r=rowFor(x); const prop=D.proposals.find(p=>p.companyId===x.c.id&&['Sent','Viewed','Negotiation'].includes(p.status));
      const mtg=D.meetings.find(m=>m.companyId===x.c.id&&m.date&&m.date>=T);
      return {...r, waitingOn: prop?'Proposal decision ('+prop.status.toLowerCase()+')':mtg?'Meeting '+fdate(mtg.date):'Reply to outreach'}; });
    const atRisk = activeW.filter(x=>x.stall||this.isOverdue(x.c.nextAction.due)||D.proposals.some(p=>p.companyId===x.c.id&&p.expiry!=='—'&&p.expiry<=T&&['Sent','Viewed'].includes(p.status))||this.daysSince(this.lastTouch(x.c.id))>21)
      .map(x=>{ const r=rowFor(x); const prop=D.proposals.find(p=>p.companyId===x.c.id&&p.expiry!=='—'&&['Sent','Viewed','Negotiation'].includes(p.status));
        const risk = x.stall?'Stalled '+x.stall.days+' days in '+x.c.stage+' (threshold '+x.stall.threshold+')'
          : this.isOverdue(x.c.nextAction.due)?'Next action overdue since '+fdate(x.c.nextAction.due)
          : prop&&prop.expiry<=T?'Proposal expired '+fdate(prop.expiry)
          : 'No activity for '+this.daysSince(this.lastTouch(x.c.id))+' days';
        return {...r, risk}; });
    const planTabs=([['contact','Contact now',contactNow.length],['follow','Follow up now',followNow.length],['research','Research now',researchNow.length],['prepare','Prepare now',prepareNow.length],['waiting','Waiting',waiting.length],['risk','At risk',atRisk.length]] as [string, string, number][])
      .map(([k,label,n])=>({label, n, on:()=>this.setState({planTab:k}), bg:S.planTab===k?'#a8863d':'transparent', fg:S.planTab===k?'#0c1220':'#e8e6e0', border:S.planTab===k?'#a8863d':'rgba(255,255,255,.18)'}));
    const planSets = {contact:contactNow, follow:followNow, research:researchNow, prepare:prepareNow, waiting:waiting, risk:atRisk};
    const planRows = planSets[S.planTab]||[];
    const planEmptyMsg = {contact:'Nothing is outreach-ready today — clear the Research now list first.', follow:'No follow-ups due today.', research:'No high-value prospects are missing critical information.', prepare:'Nothing waiting on a brief, strategy or proposal.', waiting:'Nothing outstanding with prospects right now.', risk:'Nothing at risk — every prospect is moving.'}[S.planTab];
    const isWaitingTab = S.planTab==='waiting', isRiskTab = S.planTab==='risk';
    const tg = D.targets||{};
    const doneToday = {
      newProspects: D.companies.filter(c=>c.dateDiscovered===T).length,
      qualified: D.companies.filter(c=>this.score(c)>=15&&c.stageSince===T).length,
      outreach: D.outreach.filter(o=>o.dateSent===T).length,
      followUps: D.activities.filter(a=>a.ts.startsWith(T)&&/follow-up done/i.test(a.kind)).length,
      meetings: D.meetings.filter(m=>m.date===T).length,
      proposals: D.proposals.filter(p=>p.date===T).length
    };
    const targets=[['newProspects','New prospects'],['qualified','Qualified'],['outreach','Outreach'],['followUps','Follow-ups'],['meetings','Discovery meetings'],['proposals','Proposals']]
      .map(([k,label])=>{ const goal=tg[k]||0, done=doneToday[k]||0; const pct=goal?Math.min(100,Math.round(done/goal*100)):0;
        return {label, text:done+' / '+goal, w:pct+'%', bar:pct>=100?'#2e7d5b':pct>0?'#a8863d':'#e6e2d8'}; });

    // ---- V2: today's acquisition plan ----
    const bandDot = a => ({color:a.bandColor, bg:a.bandBg});
    const topProspects = activeRanked.slice(0,5).map(({c,a})=>{ const o=this.bestOpp(c.id); const dm=this.dmOf(c.id); const cts=this.contactsOf(c.id);
      return {name:c.name, acq:a.total+'/100', band:a.band, bandFg:a.bandColor, bandBg:a.bandBg, opp:o?(o.type||o.service):'No opportunity recorded', value:o?money(o.estValue):'—',
        dm:dm?dm.name+' · '+dm.title:(cts.length?'Not identified ('+cts[0].name+' is '+(cts[0].role||'unknown')+')':'Not identified'), dmFg:dm?'#3a3f48':'#b0453c',
        next:c.nextAction&&c.nextAction.label?c.nextAction.label:'No next action', nextFg:c.nextAction&&c.nextAction.label?this.dueColor(c.nextAction.due):'#b0453c',
        on:()=>this.open(c.id), onScore:(e)=>{e.stopPropagation(); this.setState({showScore:true, scoreFor:c.id});}}; });
    const outreachToday = [
      ...D.outreach.filter(o=>o.status==='Draft'||o.dateScheduled===T).map(o=>{const c=this.companyOf(o.companyId); return {company:c?c.name:'', detail:o.channel+' · '+(o.status==='Draft'?'draft ready to send':'scheduled today')+' · '+o.message, on:()=>this.open(o.companyId), onGen:(e)=>{e.stopPropagation(); this.openGen(o.companyId);}};}),
      ...activeRanked.filter(({c})=>c.stage==='Qualified'&&!D.outreach.some(o=>o.companyId===c.id)).map(({c})=>({company:c.name, detail:'Qualified with no outreach yet — start Touch 1', on:()=>this.open(c.id), onGen:(e)=>{e.stopPropagation(); this.openGen(c.id);}}))
    ];
    const researchNeeded = acqAll.filter(({c})=>c.stage!=='Won'&&c.stage!=='Lost').map(({c})=>{ const comp=this.completeness(c); return {c, comp}; })
      .filter(x=>x.comp.missing.length>0).sort((a,b)=>a.comp.pct-b.comp.pct)
      .map(({c,comp})=>({company:c.name, pct:comp.pct+'%', missing:comp.missing.slice(0,3).join(' · '), on:()=>this.open(c.id), w:comp.pct+'%'}));
    const revStages=['Qualified','Outreach','Responded','Discovery','Proposal','Negotiation'];
    const revenueOps = acqAll.filter(({c})=>revStages.includes(c.stage)).map(({c,a})=>({c,a,v:this.oppValueOf(c.id)})).sort((x,y)=>y.v-x.v).slice(0,6)
      .map(({c,a,v})=>{const o=this.bestOpp(c.id); return {company:c.name, stage:c.stage, opp:o?(o.type||o.service):'—', value:money(v), acq:a.total, on:()=>this.open(c.id)};});
    const recs=[];
    activeRanked.filter(({c})=>D.outreach.some(o=>o.companyId===c.id&&o.followUpDate&&o.followUpDate<=T)).forEach(({c,a})=>recs.push({why:'Follow-up due · acq '+a.total, text:'Follow up with '+c.name+' — '+(c.nextAction?c.nextAction.label:''), on:()=>this.open(c.id)}));
    openProps.filter(p=>p.expiry!=='—'&&p.expiry<=addDays(T,7)).forEach(p=>{const c=this.companyOf(p.companyId); recs.push({why:'Proposal expires '+fdate(p.expiry), text:'Call '+(c?c.name:'')+' before the proposal lapses', on:()=>this.open(p.companyId)});});
    meetingsToday.forEach(m=>{const c=this.companyOf(m.companyId); recs.push({why:'Meeting today '+m.time, text:'Run '+m.type.toLowerCase()+' with '+(c?c.name:'')+' — '+m.notes, on:()=>this.open(m.companyId)});});
    activeRanked.filter(({c,a})=>a.total>=60&&!this.dmOf(c.id)).forEach(({c,a})=>recs.push({why:'No decision-maker · acq '+a.total, text:'Identify the decision-maker at '+c.name+' before outreach', on:()=>this.open(c.id)}));
    activeRanked.filter(({c})=>c.stage==='Qualified'&&!D.outreach.some(o=>o.companyId===c.id)).forEach(({c,a})=>recs.push({why:'Qualified, no outreach · acq '+a.total, text:'Send opening outreach to '+c.name, on:()=>this.open(c.id)}));
    activeRanked.filter(({c})=>this.scansOf(c.id).length===0).forEach(({c,a})=>recs.push({why:'No digital scan · acq '+a.total, text:'Run the digital opportunity scan for '+c.name, on:()=>this.open(c.id)}));
    const recommended = recs.slice(0,7).map((r,i)=>({...r, n:(i+1)+'.'}));
    const planCounts=[{label:'Priority prospects', value:activeRanked.filter(x=>x.a.total>=80).length, sub:'acq score ≥ 80'},
      {label:'Outreach today', value:outreachToday.length, sub:'drafts + qualified'},
      {label:'Follow-ups today', value:followDue.length, sub:'cadence due'},
      {label:'Research needed', value:researchNeeded.length, sub:'incomplete profiles'}];

    // ---- V2: priority queue ----
    let queueRows = activeRanked.map(({c,a})=>({c, a, r:this.readiness(c), nb:this.nextBest(c), stall:this.stall(c)}));
    // V2.5 default ranking: acquisition score weighted by whether we can actually act today
    queueRows.sort((x,y)=>{
      const boost=(z)=>{ let b=0; if(z.r.ready) b+=14; if(D.outreach.some(o=>o.companyId===z.c.id&&o.followUpDate&&o.followUpDate<=T)) b+=12;
        if(this.isOverdue(z.c.nextAction.due)) b+=8; if(z.stall) b+=6; if(z.r.blocked) b-=25;
        b += Math.min(8, Math.round(this.oppValueOf(z.c.id)/60000));
        b += S.stages.indexOf(z.c.stage); return z.a.total+b; };
      return boost(y)-boost(x);
    });
    const qs=S.queueSort;
    if(qs==='Acquisition score') queueRows.sort((a,b)=>b.a.total-a.a.total);
    if(qs==='Action readiness') queueRows.sort((a,b)=>b.r.pct-a.r.pct);
    if(qs==='Opportunity value') queueRows.sort((a,b)=>this.oppValueOf(b.c.id)-this.oppValueOf(a.c.id));
    if(qs==='Urgency') queueRows.sort((a,b)=>(a.c.nextAction.due||'9').localeCompare(b.c.nextAction.due||'9'));
    if(qs==='Follow-up date') queueRows.sort((a,b)=>{const fa=(D.outreach.find(o=>o.companyId===a.c.id&&o.followUpDate)||{}).followUpDate||'9999'; const fb=(D.outreach.find(o=>o.companyId===b.c.id&&o.followUpDate)||{}).followUpDate||'9999'; return fa.localeCompare(fb);});
    if(qs==='Stage') queueRows.sort((a,b)=>S.stages.indexOf(b.c.stage)-S.stages.indexOf(a.c.stage));
    const queue = queueRows.map(({c,a,r,nb,stall},i)=>{ const o=this.bestOpp(c.id); const dm=this.dmOf(c.id);
      const whyNow = stall?'Stalled '+stall.days+'d in '+c.stage
        : D.outreach.some(x=>x.companyId===c.id&&x.followUpDate&&x.followUpDate<=T)?'Follow-up due'
        : r.blocked?'Not ready — '+r.reason
        : r.ready?'Outreach ready'
        : this.isOverdue(c.nextAction.due)?'Action overdue'
        : nb.why;
      return {rank:String(i+1).padStart(2,'0'), name:c.name, acq:a.total, band:a.band, bandFg:a.bandColor, bandBg:a.bandBg, w:a.total+'%',
        readiness:r.pct+'%', readyW:r.pct+'%', readyFg:r.pct===100?'#2e7d5b':r.pct>=60?'#a8863d':'#b0453c',
        opp:o?(o.type||o.service):'—', value:o?money(o.estValue):'—', dm:dm?dm.name:'Not identified', dmFg:dm?'#3a3f48':'#b0453c',
        stage:c.stage, whyNow, action:nb.label, blocked:r.blocked,
        due:this.dueLabel(c.nextAction.due), dueFg:this.dueColor(c.nextAction.due),
        actionCta:nb.label+' \u2192',
        on:()=>this.openAt(c.id,'company'), onScore:(e)=>{e.stopPropagation(); this.setState({showScore:true, scoreFor:c.id});},
        onAction:(e)=>{e.stopPropagation(); this.doNext(c.id);}}; });
    const queueSorts=['Smart (default)','Acquisition score','Action readiness','Opportunity value','Urgency','Follow-up date','Stage'].map(k=>({label:k, on:()=>this.setState({queueSort:k}), bg:qs===k?'#0c1220':'#fff', fg:qs===k?'#fff':'#3a3f48', border:qs===k?'#0c1220':'#e6e2d8'}));

    // ---- V2: scanner + matrix ----
    const scanCompanies = D.companies.filter(c=>this.scansOf(c.id).length>0).map(c=>{ const dims=this.dxDims(c.id); const dx=this.dxScore(c.id); const scans=this.scansOf(c.id).slice().sort((a,b)=>this.sevRank(b.severity)-this.sevRank(a.severity));
      return {name:c.name, dx:dx+'/100', dxW:dx+'%', dxFg:dx<40?'#8a3b34':dx<60?'#a8863d':'#2e7d5b', industry:c.industry, on:()=>this.open(c.id),
        dims:dims.map(d=>({dim:d.dim, val:d.assessed?d.val:'—', w:d.val+'%', fg:d.assessed?(d.val<40?'#b0453c':d.val<70?'#a8863d':'#2e7d5b'):'#c6c0b0', bar:d.assessed?(d.val<40?'#b0453c':d.val<70?'#a8863d':'#2e7d5b'):'#e6e2d8'})),
        scans:scans.map(s=>({category:s.category, status:s.status, statusFg:{Excellent:'#2e7d5b',Good:'#2e7d5b',Average:'#a8863d',Weak:'#b0453c',Missing:'#8a3b34'}[s.status]||'#6b6f78', severity:s.severity, sevFg:this.sevColor(s.severity), problem:s.problem, evidence:s.evidence, opportunity:s.opportunity, impact:s.impact}))}; });
    const allScanned = D.companies.filter(c=>this.scansOf(c.id).length===0&&c.stage!=='Won'&&c.stage!=='Lost').map(c=>({name:c.name, on:()=>this.open(c.id)}));
    const quadDefs=[{key:'Quick Win', note:'High impact · low complexity — pitch first', fg:'#2e7d5b'},{key:'Strategic', note:'High impact · high complexity — phase it', fg:'#a8863d'},{key:'Low Priority', note:'Low impact · low complexity — bundle only', fg:'#6b6f78'},{key:'Avoid', note:'Low impact · high complexity — decline', fg:'#b0453c'}];
    const matrix = quadDefs.map(q=>({...q, items:D.opportunities.filter(o=>this.quadrant(o)===q.key).map(o=>{const c=this.companyOf(o.companyId); return {company:c?c.name:'', type:o.type||o.service, value:money(o.estValue), score:this.oppScore(o)+'/25', on:()=>this.open(o.companyId)};}), empty:D.opportunities.filter(o=>this.quadrant(o)===q.key).length===0}));
    const serviceTaxonomy = Object.entries(S.serviceGroups||{}).map(([g,items])=>({group:g, items:items.map(i=>({label:i, count:D.opportunities.filter(o=>o.type===i).length}))}));

    // ---- V2: campaigns ----
    const campaigns = (D.campaigns||[]).map(cam=>{ const cs=D.companies.filter(c=>c.campaign===cam.name);
      const outs=D.outreach.filter(o=>cs.some(c=>c.id===o.companyId)&&o.status!=='Draft');
      const replies=outs.filter(o=>['Replied','Positive'].includes(o.status));
      const mtgs=D.meetings.filter(m=>cs.some(c=>c.id===m.companyId));
      const props=D.proposals.filter(p=>cs.some(c=>c.id===p.companyId));
      const wonC=cs.filter(c=>c.stage==='Won');
      const rev=D.clients.filter(cl=>wonC.some(c=>c.id===cl.companyId)).reduce((a,c)=>a+c.revenue,0);
      return {name:cam.name, target:cam.target, offer:cam.offer, goal:cam.goal,
        stats:[{k:'Prospects',v:cs.length},{k:'Outreach',v:outs.length},{k:'Replies',v:replies.length},{k:'Meetings',v:mtgs.length},{k:'Proposals',v:props.length},{k:'Won',v:wonC.length}],
        revenue:money(rev), conv: outs.length?Math.round(replies.length/outs.length*100)+'% reply':'No outreach yet',
        avgAcq: cs.length?Math.round(cs.reduce((a,c)=>a+acqOf(c.id).total,0)/cs.length)+'/100':'—'}; });
    const unassigned = D.companies.filter(c=>!c.campaign||c.campaign==='—').length;

    // ---- V2: acquisition analytics ----
    const wonCos=D.companies.filter(c=>c.stage==='Won'), lostCos=D.companies.filter(c=>c.stage==='Lost');
    const avg=(arr)=>arr.length?Math.round(arr.reduce((a,b)=>a+b,0)/arr.length):null;
    const avgWonAcq=avg(wonCos.map(c=>acqOf(c.id).total)), avgLostAcq=avg(lostCos.map(c=>acqOf(c.id).total));
    const insuff='Insufficient data';
    const propDays=D.proposals.filter(p=>p.status==='Accepted').map(p=>{const c=this.companyOf(p.companyId); return c?daysBetween(c.dateDiscovered,p.date):null;}).filter(x=>x!==null);
    const closeDays=D.clients.map(cl=>{const p=D.proposals.find(x=>x.companyId===cl.companyId&&x.status==='Accepted'); return p?daysBetween(p.date,cl.startDate):null;}).filter(x=>x!==null);
    const bestBy=(keyFn)=>{ const m:Record<string,any>={}; wonCos.concat(lostCos).forEach(c=>{const k=keyFn(c); if(!k)return; m[k]=m[k]||{w:0,t:0}; m[k].t++; if(c.stage==='Won')m[k].w++;}); const e=Object.entries(m).filter(([,v])=>v.t>0).sort((a,b)=>(b[1].w/b[1].t)-(a[1].w/a[1].t)); return e.length?e[0][0]+' ('+e[0][1].w+'/'+e[0][1].t+')':insuff; };
    const chanPerf=(()=>{ const m:Record<string,any>={}; outSent.forEach(o=>{m[o.channel]=m[o.channel]||{r:0,t:0}; m[o.channel].t++; if(['Replied','Positive'].includes(o.status))m[o.channel].r++;}); const e=Object.entries(m).sort((a,b)=>(b[1].r/b[1].t)-(a[1].r/a[1].t)); return e.length?e[0][0]+' ('+Math.round(e[0][1].r/e[0][1].t*100)+'% reply)':insuff; })();
    const acqPerf=[
      {k:'Avg acquisition score — won', v:avgWonAcq!==null?avgWonAcq+'/100':insuff},
      {k:'Avg acquisition score — lost', v:avgLostAcq!==null?avgLostAcq+'/100':insuff},
      {k:'Best-performing industry', v:bestBy(c=>c.industry)},
      {k:'Best-performing service', v:(()=>{const m:Record<string,any>={};D.opportunities.forEach(o=>{const c=this.companyOf(o.companyId); if(!c)return; const k=o.type||o.service; m[k]=m[k]||{w:0,t:0}; m[k].t++; if(c.stage==='Won')m[k].w++;}); const e=Object.entries(m).filter(([,v])=>v.w>0).sort((a,b)=>b[1].w-a[1].w); return e.length?e[0][0]+' ('+e[0][1].w+' won)':insuff;})()},
      {k:'Best-performing campaign', v:bestBy(c=>c.campaign&&c.campaign!=='—'?c.campaign:null)},
      {k:'Best outreach channel', v:chanPerf},
      {k:'Prospect → proposal (avg days)', v:propDays.length>=2?avg(propDays)+' days':insuff},
      {k:'Proposal → won (avg days)', v:closeDays.length>=2?avg(closeDays)+' days':insuff},
      {k:'Discovery → proposal', v:insuff+' — dates not tracked yet'},
      {k:'Avg project value', v:D.clients.length?money(wonRevenue/D.clients.length):insuff},
      {k:'Revenue by campaign', v:(()=>{const m:Record<string,any>={};D.clients.forEach(cl=>{const c=this.companyOf(cl.companyId); const k=c&&c.campaign&&c.campaign!=='—'?c.campaign:'Unassigned'; m[k]=(m[k]||0)+cl.revenue;}); const e=Object.entries(m).sort((a,b)=>b[1]-a[1]); return e.length?e.map(([k,v])=>k+' '+money(v)).join(' · '):insuff;})()}
    ];
    const predictors=(()=>{ const rows=[];
      if(wonCos.length<3||lostCos.length<3){ rows.push({k:'Win predictors', v:insuff+' — need ≥3 won and ≥3 lost outcomes'}); }
      if(avgWonAcq!==null&&avgLostAcq!==null) rows.push({k:'Observed (not conclusive)', v:'Won prospects average '+avgWonAcq+'/100 vs '+avgLostAcq+'/100 for lost — directional only at n='+(wonCos.length+lostCos.length)});
      rows.push({k:'Decision-maker access', v:wonCos.every(c=>this.dmOf(c.id))?'All won deals had an identified decision-maker ('+wonCos.length+'/'+wonCos.length+')':insuff});
      rows.push({k:'Referral source', v:wonCos.filter(c=>c.leadSource==='Referral'||c.leadSource==='Existing client').length+' of '+wonCos.length+' wins came from referral or existing client'});
      return rows; })();

    // search
    const q=S.search.trim().toLowerCase();
    const searchResults=q?D.companies.filter(c=>{const ct=this.contactOf(c.id); return c.name.toLowerCase().includes(q)||c.industry.toLowerCase().includes(q)||(ct&&ct.name.toLowerCase().includes(q));}).slice(0,6).map(c=>({name:c.name, meta:c.industry+' · '+c.stage, on:()=>this.openAt(c.id,'company')})):[];

    // notifications
    const bellItems=[];
    followDue.forEach(o=>{const c=this.companyOf(o.companyId); bellItems.push({tag:'Follow-up due', color:'#a8863d', text:(c?c.name:'')+' — touch '+(o.touch+1)+' due today', on:()=>this.openAt(o.companyId,'followup')});});
    og.filter(t=>this.isOverdue(t.due)).forEach(t=>{const c=this.companyOf(t.companyId); bellItems.push({tag:'Overdue task', color:'#b0453c', text:t.title+' ('+(c?c.name:'')+')', on:()=>this.openAt(t.companyId, taskFocus(t))});});
    meetingsToday.forEach(m=>{const c=this.companyOf(m.companyId); bellItems.push({tag:'Meeting today', color:'#2e5b7d', text:m.type+' with '+(c?c.name:'')+' at '+m.time, on:()=>this.openAt(m.companyId,'discovery')});});
    openProps.filter(p=>p.expiry!=='—'&&this.daysSince(p.expiry)>-7).forEach(p=>{const c=this.companyOf(p.companyId); bellItems.push({tag:'Proposal expiring', color:'#b0453c', text:(c?c.name:'')+' proposal expires '+fdate(p.expiry), on:()=>this.openAt(p.companyId,'proposal')});});
    activeW.filter(x=>!x.c.nextAction||!x.c.nextAction.label||x.c.nextAction.label==='Set next action').forEach(x=>bellItems.push({tag:'No next action', color:'#8a3b34', text:x.c.name+' has no next action set', on:()=>this.openAt(x.c.id,'company')}));

    // add modal
    const F=S.form; const setF=(k)=>(e)=>this.setState(s=>({form:{...s.form,[k]:e.target.value}}));
    const addFields=[
      {key:'name',label:'Company name',ph:'e.g. Highveld Grain Co',span:'span 2'},
      {key:'website',label:'Website',ph:'company.co.za',span:'auto'},
      {key:'location',label:'Location',ph:'City, Province',span:'auto'},
      {key:'contactName',label:'Contact name',ph:'Full name',span:'auto'},
      {key:'contactTitle',label:'Job title',ph:'e.g. Operations Director',span:'auto'},
      {key:'email',label:'Email',ph:'name@company.co.za',span:'auto'},
      {key:'size',label:'Company size',ph:'e.g. 50–100',span:'auto'},
      {key:'description',label:'Description',ph:'What they do, why they might need AX-Channels',span:'span 2'}
    ].map(f=>({...f, val:F[f.key]??'', on:setF(f.key)}));

    // brief
    let brief=[], briefCompanyName='';
    if(S.briefFor){ const c=this.companyOf(S.briefFor); const o=this.oppOf(S.briefFor); const ct=this.contactOf(S.briefFor);
      briefCompanyName=c?c.name:'';
      if(c){ brief=[
        {h:'Company', t:c.name+' — '+c.industry+' ('+c.subIndustry+'), '+c.location+', '+c.size+' staff. '+c.description},
        {h:'Current situation', t:Object.entries(c.digital).map(([k,v])=>'• '+({website:'Website',mobile:'Mobile',app:'App',portal:'Customer portal',internal:'Internal systems',social:'Social'}[k]||k)+': '+v).join('\n')},
        {h:'Problems', t:o?o.problems.map(p=>'• '+p).join('\n'):'No problems documented yet.'},
        {h:'Business impact', t:o?'These gaps cost '+c.name+' time, margin and customer trust — the exact failure mode AX-Channels targets: digital tools that worked at launch but break under growth.':'—'},
        {h:'Opportunity', t:o?o.opportunity:'—'},
        {h:'Recommended solution', t:o?o.service+' engagement, '+o.valueBand.toLowerCase()+'-value band, estimated '+money(o.estValue)+'.':'—'},
        {h:'Why AX-Channels', t:'We build digital infrastructure — systems that scale with the team, adapt to real users, and don\u2019t break as the business evolves. Not a template factory.'},
        {h:'Suggested approach', t:'1. Short discovery with '+(ct?ct.name+' ('+ct.title+')':'the decision-maker')+'\n2. Expert teardown of the current experience\n3. Phased proposal — 50% deposit to begin, middle tier as default recommendation'},
        {h:'Estimated scope & value', t:o?('Opportunity score '+this.oppScore(o)+'/25 · Lead score '+this.score(c)+'/25 · Estimated value '+money(o.estValue)+' (ZAR)'):'To be scoped after discovery.'}
      ]; } }

    return {
      nav, viewTitle: S.selId?'Prospect':titles[S.view], isDemo:S.demo, today:T,
      search:S.search, setSearch:(e)=>this.setState({search:e.target.value}), hasSearch:searchResults.length>0, searchResults,
      toggleBell:()=>this.setState(s=>({showBell:!s.showBell})), showBell:S.showBell, bellCount:bellItems.length||null, bellItems,
      openAdd:()=>this.setState({showAdd:true, form:{}, addIndustry:'Mining', addSource:'LinkedIn'}),
      isDash:S.view==='dashboard'&&!S.selId, isProspects:S.view==='prospects'&&!S.selId, isDetail:!!S.selId,
      isOpps:S.view==='opportunities'&&!S.selId, isOutreach:S.view==='outreach'&&!S.selId, isPipeline:S.view==='pipeline'&&!S.selId,
      isClients:S.view==='clients'&&!S.selId, isTasks:S.view==='tasks'&&!S.selId, isAnalytics:S.view==='analytics'&&!S.selId,
      isTemplates:S.view==='templates'&&!S.selId, isSettings:S.view==='settings'&&!S.selId,
      kpis, funnelStages, actions, actionCount:actions.length, priority, activity, forecast,
      savedViews, prospects, prospectCount:prospects.length,
      industryFilterOpts:['All industries',...industries], stageFilterOpts:['All stages',...S.stages], gradeFilterOpts:['All grades','A','B','C'], sourceFilterOpts:['All sources',...S.sources],
      fIndustry:S.fIndustry, setFIndustry:(e)=>this.setState({fIndustry:e.target.value}),
      fStage:S.fStage, setFStage:(e)=>this.setState({fStage:e.target.value}),
      fGrade:S.fGrade, setFGrade:(e)=>this.setState({fGrade:e.target.value}),
      fSource:S.fSource, setFSource:(e)=>this.setState({fSource:e.target.value}),
      clearFilters:()=>this.setState({fIndustry:'All industries',fStage:'All stages',fGrade:'All grades',fSource:'All sources',savedView:'All'}),
      sel, qualDims, back:()=>this.setState({selId:null}), stageOpts:S.stages,
      setSelStage:(e)=>this.setStage(S.selId, e.target.value),
      setNote:(e)=>{const v=e.target.value; this.setState(s=>({notes:{...s.notes,[s.selId]:v}}));},
      completeNext:()=>this.markStageDone(S.selId),
      genBrief:()=>{ this.setState({showBrief:true, briefLoading:true, briefFor:S.selId}); if(this._briefTimer) clearTimeout(this._briefTimer); this._briefTimer=setTimeout(()=>{this._briefTimer=null; this.setState({briefLoading:false});},900); },
      showBrief:S.showBrief, briefLoading:S.briefLoading, briefReady:S.showBrief&&!S.briefLoading, brief, briefCompany:briefCompanyName, closeBrief:()=>this.setState({showBrief:false}),
      opps:oppRows, oppTotal:money(D.opportunities.reduce((a,o)=>a+o.estValue,0)),
      cadence, followUpsDue, dueCount:followUpsDue.length, noDue:followUpsDue.length===0, allOutreach,
      isBoard:S.pipeTab==='board', isProps:S.pipeTab==='props',
      setTabBoard:()=>this.setState({pipeTab:'board'}), setTabProps:()=>this.setState({pipeTab:'props'}),
      tabBoardBg:S.pipeTab==='board'?'#0c1220':'#fff', tabBoardFg:S.pipeTab==='board'?'#fff':'#3a3f48',
      tabPropsBg:S.pipeTab==='props'?'#0c1220':'#fff', tabPropsFg:S.pipeTab==='props'?'#fff':'#3a3f48',
      cols, allowDrop:(e)=>e.preventDefault(), proposals,
      pTotal:money(openProps.reduce((a,p)=>a+p.value,0)), wTotal:money(weighted), wonTotal:money(D.proposals.filter(p=>p.status==='Accepted').reduce((a,p)=>a+p.value,0)),
      clientStats, clients, taskGroups, anGroups, convFunnel, breakdowns,
      tplCats, tpls, tplVars,
      settingsRows, aiRows,
      // --- V2 ---
      isQueue:S.view==='queue'&&!S.selId, isCampaigns:S.view==='campaigns'&&!S.selId,
      planCounts, topProspects, outreachToday, noOutreachToday:outreachToday.length===0,
      researchNeeded, noResearch:researchNeeded.length===0, revenueOps, recommended,
      queue, queueSorts, queueCount:queue.length,
      oppTabOpps:S.oppTab==='opportunities', oppTabScanner:S.oppTab==='scanner', oppTabMatrix:S.oppTab==='matrix',
      oppTabs:[['opportunities','Opportunities'],['scanner','Digital Opportunity Scanner'],['matrix','Opportunity Matrix']].map(([k,label])=>({label, on:()=>this.setState({oppTab:k}), bg:S.oppTab===k?'#0c1220':'#fff', fg:S.oppTab===k?'#fff':'#3a3f48'})),
      scanCompanies, allScanned, noUnscanned:allScanned.length===0, matrix, serviceTaxonomy,
      campaigns, unassignedCount:unassigned,
      acqPerf, predictors,
      showScore:S.showScore, closeScore:()=>this.setState({showScore:false}),
      scoreCompany: S.scoreFor?(this.companyOf(S.scoreFor)||{}).name:'',
      scoreParts: S.scoreFor?this.acq(this.companyOf(S.scoreFor)).parts.map(p=>({label:p.label, val:p.val+'/'+p.max, w:Math.round(p.val/p.max*100)+'%', bar:(p.val/p.max)>=0.7?'#2e7d5b':(p.val/p.max)>=0.4?'#a8863d':'#b0453c'})):[],
      scoreTotal: S.scoreFor?this.acq(this.companyOf(S.scoreFor)).total+'/100':'',
      scoreBand: S.scoreFor?this.acq(this.companyOf(S.scoreFor)).band:'',
      scoreBandFg: S.scoreFor?this.acq(this.companyOf(S.scoreFor)).bandColor:'',
      scoreReason: S.scoreFor?this.acq(this.companyOf(S.scoreFor)).reason:'',
      showGen:S.showGen, genLoading:S.genLoading, genReady:S.showGen&&!S.genLoading,
      closeGen:()=>this.setState({showGen:false}),
      genCompany: S.genFor?(this.companyOf(S.genFor)||{}).name:'',
      genContext: S.genFor?(()=>{const c=this.companyOf(S.genFor); const dm=this.dmOf(S.genFor)||this.contactsOf(S.genFor)[0]; const o=this.bestOpp(S.genFor); const st=this.strategyOf(S.genFor);
        return [{k:'Company',v:c.name+' · '+c.industry},{k:'Decision-maker',v:dm?dm.name+' · '+dm.title+' ('+(dm.role||'Unknown')+')':'Not identified'},{k:'Problem',v:o?o.problems.join(', '):'—'},{k:'Opportunity',v:o?o.opportunity:'—'},{k:'Recommended service',v:o?(o.type||o.service):'—'},{k:'Outreach angle',v:st?st.angle:'No strategy recorded — using observed scan data'}];})():[],
      genVariants: S.genFor?this.genMessages(S.genFor).map(m=>({label:m.variant, on:()=>this.setState({genVariant:m.variant, genEdit:null}), bg:S.genVariant===m.variant?'#0c1220':'#fff', fg:S.genVariant===m.variant?'#fff':'#3a3f48'})):[],
      genBody: S.genFor?(S.genEdit ?? (this.genMessages(S.genFor).find(m=>m.variant===S.genVariant)||{}).body):'',
      genNote: S.genFor?(this.genMessages(S.genFor).find(m=>m.variant===S.genVariant)||{}).note:'',
      genCta: S.genFor?(this.genMessages(S.genFor).find(m=>m.variant===S.genVariant)||{}).cta:'',
      genEditing: S.genStep==='edit', genPreviewing: S.genStep==='preview',
      genOnEdit:()=>this.setState(s=>({genStep:'edit', genEdit: s.genEdit ?? (this.genMessages(s.genFor).find(m=>m.variant===s.genVariant)||{}).body})),
      genSetBody:(e)=>this.setState({genEdit:e.target.value}),
      genDoneEdit:()=>this.setState({genStep:'preview'}),
      genRegenerate:()=>{ this.setState({genEdit:null, genStep:'preview', genLoading:true}); this._armGen(700); },
      genFollowUpDate: fdate(addDays(T,3)),
      genChannel: S.genVariant==='LinkedIn'?'LinkedIn':'Email',
      genReadyState: S.genFor?(this.readiness(this.companyOf(S.genFor)).ready?'Ready for outreach':'Not ready'):'',
      genReadyFg: S.genFor?(this.readiness(this.companyOf(S.genFor)).ready?'#2e7d5b':'#b0453c'):'',
      genReadyMissing: S.genFor?this.readiness(this.companyOf(S.genFor)).missing.map(x=>x.k):[],
      genHasMissing: S.genFor?this.readiness(this.companyOf(S.genFor)).missing.length>0:false,
      genCopy:()=>{ if(!S.genFor) return; const body=S.genEdit ?? (this.genMessages(S.genFor).find(x=>x.variant===S.genVariant)||{}).body; try{navigator.clipboard.writeText(body);}catch(e){} this.setState({copiedTpl:'gen'}); setTimeout(()=>this.setState({copiedTpl:null}),1500); },
      genCopyLabel: S.copiedTpl==='gen'?'Copied ✓':'Copy message',
      genLog:()=>{ const cid=S.genFor; const c=this.companyOf(cid); const chan=S.genVariant==='LinkedIn'?'LinkedIn':'Email';
        const rdy=this.readiness(c);
        if(!rdy.ready && !window.confirm(c.name+' is NOT READY for outreach.\n\n'+[...(rdy.blocked?['Do not contact yet: '+rdy.reason]:[]), ...rdy.missing.map(x=>'Missing: '+x.k)].join('\n')+'\n\nSend anyway?')) return;
        const touch=D.outreach.filter(o=>o.companyId===cid).length+1;
        const fu=addDays(T,3);
        this.mut('outreach', os=>[...os, {id:uid('r'), companyId:cid, channel:chan, touch, purpose:(S.touchPurposes[touch]||'Follow-up'), dateScheduled:null, message:S.genEdit ?? (this.genMessages(cid).find(m=>m.variant===S.genVariant)||{}).body ?? S.genVariant+' message', dateSent:T, status:'Sent', outcome:'Sent', response:'', responseNotes:'', followUpDate:fu}]);
        this.mut('tasks', ts=>[...ts, {id:uid('t'), companyId:cid, title:'Follow up — '+(S.touchPurposes[touch+1]||'new value'), type:'Follow-up', priority:'High', due:fu, status:'Open', notes:'Auto-created when Touch '+touch+' was approved.'}]);
        if(this.state.stages.indexOf(c.stage)<3) this.mut('companies', cs=>cs.map(x=>x.id===cid?{...x, stage:'Outreach', stageSince:T}:x));
        this.mut('companies', cs=>cs.map(x=>x.id===cid?{...x, nextAction:{label:'Follow up with decision-maker', due:fu}}:x));
        this.addActivity(cid,'Outreach sent', S.genVariant+' message approved and sent to '+c.name+'; follow-up task created for '+fdate(fu)+'.');
        this.setState({showGen:false, genEdit:null});
      },
      setNextAction:(e)=>{ const v=e.target.value; if(!v) return; this.mut('companies', cs=>cs.map(x=>x.id===S.selId?{...x, nextAction:{label:v, due:T}}:x)); },
      // --- V2.5 ---
      todayLabelReal: new Date(T+'T12:00:00').toLocaleDateString('en-ZA',{weekday:'long', day:'numeric', month:'long', year:'numeric'}),
      planTabs, planRows, planEmpty:planRows.length===0, planEmptyMsg, isWaitingTab, isRiskTab, targets,
      detailFocus:S.detailFocus||'overview',
      showOutcome:S.showOutcome, closeOutcome:()=>this.setState({showOutcome:false}),
      outcomeOpts:S.outcomes.map(o=>({label:o, on:()=>this.setState({outcomeChoice:o}), bg:S.outcomeChoice===o?'#0c1220':'#fff', fg:S.outcomeChoice===o?'#fff':'#3a3f48'})),
      outcomeChoice:S.outcomeChoice, outcomeNotes:S.outcomeNotes,
      setOutcomeNotes:(e)=>this.setState({outcomeNotes:e.target.value}),
      outcomeRec: S.outcomeNext[S.outcomeChoice]||'Set a next action',
      saveOutcome:()=>{ const id=S.outcomeFor; const rec=S.outcomeNext[S.outcomeChoice]||'Follow up';
        const o=D.outreach.find(x=>x.id===id); if(!o){this.setState({showOutcome:false}); return;}
        const nurture=['Not interested','Negative'].includes(S.outcomeChoice);
        const clearFollow=['Positive','Meeting booked','Not interested','Negative','Wrong person'].includes(S.outcomeChoice);
        this.mut('outreach', os=>os.map(x=>x.id===id?{...x, outcome:S.outcomeChoice, status:S.outcomeChoice, responseNotes:S.outcomeNotes, response:S.outcomeNotes, followUpDate: clearFollow?null:x.followUpDate}:x));
        this.mut('companies', cs=>cs.map(x=>x.id===o.companyId?{...x, nextAction:{label:rec, due:T}}:x));
        this.mut('tasks', ts=>[...ts, {id:uid('t'), companyId:o.companyId, title:rec, type:nurture?'Nurture':'Follow-up', priority:nurture?'Low':'High', due:T, status:'Open', notes:S.outcomeNotes}]);
        this.addActivity(o.companyId,'Response recorded', S.outcomeChoice+' — '+(S.outcomeNotes||'no notes')+' → '+rec+'.');
        this.setState({showOutcome:false});
      },
      showClose:S.showClose, closeCloseModal:()=>this.setState({showClose:false}),
      closeKind:S.closeKind, isLostClose:S.closeKind==='Lost', isWonClose:S.closeKind==='Won',
      closeCompany: S.closeFor?(this.companyOf(S.closeFor)||{}).name:'',
      closeReasons: (S.lostReasons||[]).map(r=>({label:r, on:()=>this.setState({closeReason:r}), bg:S.closeReason===r?'#0c1220':'#fff', fg:S.closeReason===r?'#fff':'#3a3f48'})),
      closeReason:S.closeReason, closeNotes:S.closeNotes, closeValue:S.closeValue,
      setCloseNotes:(e)=>this.setState({closeNotes:e.target.value}), setCloseValue:(e)=>this.setState({closeValue:e.target.value}),
      confirmClose:()=>{ const cid=S.closeFor; const c=this.companyOf(cid); if(!c) return;
        const a=this.acq(c), r=this.readiness(c), bo=this.bestOpp(cid);
        const val=S.closeKind==='Won'?(parseInt(S.closeValue,10)||this.oppValueOf(cid)):(this.oppValueOf(cid)||0);
        this.mut('outcomes', ocs=>[...(ocs||[]), {companyId:cid, result:S.closeKind, acqAtClose:a.total, oppAtClose:bo?this.oppScore(bo):0, readinessAtClose:r.pct,
          industry:c.industry, service:bo?(bo.type||bo.service):'—', value:val, source:c.leadSource, campaign:c.campaign||'—',
          daysToClose:this.daysSince(c.dateDiscovered), reason:S.closeKind==='Lost'?(S.closeReason||'Other'):'Accepted', notes:S.closeNotes}]);
        this.mut('companies', cs=>cs.map(x=>x.id===cid?{...x, stage:S.closeKind, stageSince:T, nextAction:{label:S.closeKind==='Won'?'Kick off project':'Nurture', due:T}}:x));
        if(S.closeKind==='Won'&&!D.clients.some(cl=>cl.companyId===cid)){
          this.mut('clients', cl=>[...cl, {id:uid('cl'), companyId:cid, startDate:T, revenue:val, services:[bo?(bo.type||bo.service):'—'], status:'Active — onboarding', growthOps:['New client → retainer','New client → next service'], referral:'—'}]);
        }
        this.addActivity(cid, S.closeKind==='Won'?'Won':'Lost', c.name+' marked '+S.closeKind.toLowerCase()+(S.closeKind==='Lost'?' — '+(S.closeReason||'Other'):' — '+money(val))+'.');
        this.setState({showClose:false});
      },
      audit:S.audit?'on':'off', auditOn:S.audit, toggleAudit:()=>this.setState(s=>({audit:!s.audit})),
      auditLabel:S.audit?'On':'Off', auditBg:S.audit?'#0c1220':'#fff', auditFg:S.audit?'#fff':'#3a3f48',
      runTest:()=>this.runWorkflowTest(), clearTest:()=>this.clearTestData(),
      testRan:S.testRan, testLog:(S.testLog||[]).map(x=>({name:x.name, mark:x.ok?'✓ pass':'✗ fail', fg:x.ok?'#2e7d5b':'#b0453c', note:x.note})),
      testSummary:(S.testLog||[]).length?((S.testLog.filter(x=>x.ok).length)+' of '+S.testLog.length+' steps passed'):'',
      settingsTargets: [['newProspects','New prospects'],['qualified','Qualified'],['outreach','Outreach'],['followUps','Follow-ups'],['meetings','Discovery meetings'],['proposals','Proposals']]
        .map(([k,label])=>({label, val:String((D.targets||{})[k]??0), on:(e)=>{ const v=parseInt(e.target.value,10)||0; this.setState(s=>({data:{...s.data, targets:{...s.data.targets, [k]:v}}})); }})),
      resetDemo:()=>{ if(window.confirm('Reset all demo data to its original state? Any changes you have made will be discarded.')) this.setState({data:demoDb(T), notes:{}, demo:true, selId:null}); },
      clearDemo:()=>{ if(window.confirm('Remove all demo data and start an empty workspace for real prospects? This cannot be undone (you can restore the demo with Reset).')) this.setState({data:{...emptyDb(), targets:S.data.targets}, notes:{}, demo:false, selId:null}); },
      demoLabel:S.demo?'Demo data':'Live workspace',
      showAdd:S.showAdd, closeAdd:()=>this.setState({showAdd:false}),
      addFields, industryOpts:['Mining','Logistics','Property','Construction','Technology','Professional services','Other'], sourceOpts:S.sources,
      addIndustry:S.addIndustry??'Mining', setAddIndustry:(e)=>this.setState({addIndustry:e.target.value}),
      addSource:S.addSource??'LinkedIn', setAddSource:(e)=>this.setState({addSource:e.target.value}),
      addError: S.formError==='addName'?'Company name is required.':'',
      hasAddError: S.formError==='addName',
      saveAdd:()=>{ const f=S.form; if(!f.name){ this.setState({formError:'addName'}); return; } const cid=uid('c');
        this.mut('companies', cs=>[{id:cid, name:f.name, industry:S.addIndustry??'Other', subIndustry:'—', website:f.website||'—', location:f.location||'—', size:f.size||'—', linkedin:'—', description:f.description||'', leadSource:S.addSource??'Other', dateDiscovered:T, owner:'Sipho M.', campaign:'—', stage:'New', priority:'Medium', scores:{problem:0,pay:0,need:0,access:0,growth:0}, nextAction:{label:'Research company', due:T}, digital:{website:'—',mobile:'—',app:'—',portal:'—',internal:'—',social:'—'}, stageSince:T, notReadyReason:'Insufficient research', overrideNotReady:false, research:{summary:f.description||'', findings:'', completed:false}}, ...cs]);
        if(f.contactName){ this.mut('contacts', ps=>[...ps, {id:uid('p'), companyId:cid, name:f.contactName, title:f.contactTitle||'—', department:'—', email:f.email||'—', phone:'—', linkedin:'—', decisionMaker:false, role:'Unknown', influence:'Medium', relationship:'New — not contacted', lastContacted:null, preferredChannel:f.email?'Email':'—', notes:''}]); }
        this.addActivity(cid,'Prospect added', f.name+' added manually.');
        this.setState({showAdd:false, selId:cid, detailFocus:'research', formError:'', editing:'research', editForm:{summary:f.description||'', website:f.website||''}});
      }
    };
  }

  render(){ return <Layout v={this.renderVals()} />; }
}
