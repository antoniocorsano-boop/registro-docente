/** DOC-01/D4c2a — isolated V1 historical projection validation.
 * The digest is an integrity check, not authentication or a storage receipt.
 * No current sources, runtime wiring, or authority derived from the record.
 */
import type {DocumentArchiveCandidateV1} from './documentArchiveCandidate';
type Result={valid:true;record:DocumentArchiveCandidateV1}|{valid:false;issue:'NOT_IMPLEMENTED'|'INVALID_RECORD'|'INVALID_SCOPE'|'INVALID_CONTENT'|'INVALID_DIGEST'};
type Row=Record<string,unknown>;
const fail=(issue:Extract<Result,{valid:false}>['issue']):Result=>({valid:false,issue});
const exact=(v:unknown,keys:readonly string[]):v is Row=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.prototype.hasOwnProperty.call(v,k));
const list=(v:unknown,max=1000):v is unknown[]=>Array.isArray(v)&&v.length<=max;
const text=(v:unknown,max=2000):v is string=>typeof v==='string'&&v.length<=max&&v.trim().length>0;
const demo=(v:unknown):v is string=>typeof v==='string'&&/^demo-[a-z0-9-]{1,64}$/.test(v);
const one=(v:unknown,values:readonly string[])=>typeof v==='string'&&values.includes(v);
const integer=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const day=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00.000Z'))&&new Date(v+'T00:00:00.000Z').toISOString().slice(0,10)===v;
const utc=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const scopeKeys=['institutionRef','siteRef','classId','cohortRef','schoolYear','schoolOrder','gradeLevel','subjectCode','regimeRef','purpose'];
const markers=(r:Row)=>r.official===false&&r.complete===false&&r.labOnly===true;
const purposes=['diagnostic','formative','summative'];
// Bounded, descriptor-only copy. Do not invoke accessors or input array methods.
function detach(raw:unknown):unknown{
 let budget=300000;const ancestors=new Set<object>();
 function visit(v:unknown,depth:number):unknown{
  if(--budget<0||depth>24)throw Error('limit');
  if(v===null||typeof v==='boolean')return v;
  if(typeof v==='string'){if(v.length>16000)throw Error('text limit');return v;}
  if(typeof v==='number'&&Number.isFinite(v))return v;
  if(typeof v!=='object'||v===null||ancestors.has(v))throw Error('invalid data');
  ancestors.add(v);
  try{
   const proto=Object.getPrototypeOf(v),keys=Reflect.ownKeys(v);
   if(Array.isArray(v)){
    const n=Object.getOwnPropertyDescriptor(v,'length')?.value;
    if(proto!==Array.prototype||!integer(n,0,10000)||keys.length!==n+1)throw Error('array');
    const out:unknown[]=[];
    for(let i=0;i<n;i++){
     const d=Object.getOwnPropertyDescriptor(v,String(i));
     if(!d?.enumerable||!('value' in d))throw Error('item');
     out.push(visit(d.value,depth+1));
    }
    return out;
   }
   if(proto!==Object.prototype&&proto!==null)throw Error('prototype');
   const out:Row=Object.create(null);
   for(const k of keys){
    if(typeof k!=='string'||['__proto__','constructor','prototype'].includes(k))throw Error('key');
    const d=Object.getOwnPropertyDescriptor(v,k);
    if(!d?.enumerable||!('value' in d))throw Error('property');
    out[k]=visit(d.value,depth+1);
   }
   return out;
  }finally{ancestors.delete(v);}
 }
 return visit(raw,0);
}
// Same canonical V1 domain and representation as D4c1, on detached JSON only.
function canonical(v:unknown):string{
 if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
 if(v!==null&&typeof v==='object'){const r=v as Row;return '{'+Object.keys(r).sort().map(k=>JSON.stringify(k)+':'+canonical(r[k])).join(',')+'}';}
 return JSON.stringify(v);
}
function freeze<T>(v:T):T{
 if(v!==null&&typeof v==='object'){for(const item of Object.values(v))freeze(item);Object.freeze(v);}
 return v;
}
function scope(v:unknown):v is Row{
 return exact(v,scopeKeys)&&['institutionRef','siteRef','classId','cohortRef','regimeRef'].every(k=>demo(v[k]))&&
 v.schoolYear==='2026/2027'&&v.schoolOrder==='lower_secondary'&&integer(v.gradeLevel,1,3)&&
 typeof v.subjectCode==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(v.subjectCode)&&one(v.purpose,['disciplinary-plan','council-contribution']);
}
type Period={from:string;to:string};
function period(v:unknown):v is Period{
 return exact(v,['from','to'])&&day(v.from)&&day(v.to)&&v.from<=v.to&&v.from>='2026-09-01'&&v.to<='2027-08-31';
}
const within=(v:unknown,p:Period):v is string=>day(v)&&v>=p.from&&v<=p.to;
function identity(v:unknown):v is Row&{scope:Row;period:Period}{
 if(!exact(v,['documentId','kind','scope','period','model','mappingVersion'])||!demo(v.documentId)||!scope(v.scope)||!period(v.period)||v.mappingVersion!=='2026-27-map-v1'||!one(v.kind,['final-report','program-completed','disciplinary-plan','council-disciplinary-contribution']))return false;
 const council=v.kind==='council-disciplinary-contribution';
 return v.scope.purpose===(council?'council-contribution':'disciplinary-plan')&&v.model===(council?'council-contribution':v.scope.gradeLevel===1?'disciplinary-first':'disciplinary-second-third')&&
 ((v.kind!=='disciplinary-plan'&&!council)||(v.period.from==='2026-09-01'&&v.period.to==='2027-08-31'));
}
function revision(v:unknown,id:Row):v is Row{
 if(!exact(v,['revisionId','number','previousRevisionId','reason','state'])||!demo(v.revisionId)||v.revisionId===id.documentId||!integer(v.number,1,1000)||v.state!=='draft')return false;
 return v.number===1?v.previousRevisionId===null&&v.reason==='initial':demo(v.previousRevisionId)&&v.previousRevisionId!==v.revisionId&&v.previousRevisionId!==id.documentId&&one(v.reason,['content-update','source-update','correction']);
}
function finalContent(c:unknown,id:Row&{period:Period}):boolean{
 const program=id.kind==='program-completed';
 const base=['official','complete','labOnly','coverage','period','recorded','coverageAssessment','institutionalModel'];
 if(!exact(c,program?base:[...base,'assessments','links','summary'])||!markers(c)||c.coverage!=='selected-only'||c.coverageAssessment!=='not-established'||c.institutionalModel!=='reference-only'||!period(c.period)||canonical(c.period)!==canonical(id.period))return false;
 const r=c.recorded,p=id.period;
 if(!exact(r,['status','count','hours','activities'])||!list(r.activities,10000))return false;
 const acts=r.activities;
 if(r.status==='not-selected'){
  if(program||r.count!==null||r.hours!==null||acts.length)return false;
 }else if(r.status==='selected'){
  let sum=0;
  if(!acts.length||r.count!==acts.length)return false;
  for(const a of acts){
   if(!exact(a,['date','hours','title'])||!within(a.date,p)||typeof a.hours!=='number'||a.hours<0.5||a.hours>10||!Number.isInteger(a.hours*2)||!(a.title===null||text(a.title,500)))return false;
   sum+=a.hours;
  }
  if(r.hours!==sum)return false;
 }else return false;
 if(program)return true;
 const a=c.assessments;
 if(!exact(a,['status','completed'])||!list(a.completed)||a.status!==(a.completed.length?'selected':'not-selected'))return false;
 const completed=a.completed;
 for(const item of completed)if(!exact(item,['title','purpose','completedOn'])||!text(item.title)||!one(item.purpose,purposes)||!within(item.completedOn,p))return false;
 if(!list(c.links)||!list(c.summary))return false;
 const linked=new Set<number>();
 for(const l of c.links){
  if(!exact(l,['activityIndex','assessmentIndex'])||!integer(l.activityIndex,0,acts.length-1)||!integer(l.assessmentIndex,0,completed.length-1)||linked.has(l.assessmentIndex)||(acts[l.activityIndex] as Row).date!==(completed[l.assessmentIndex] as Row).completedOn)return false;
  linked.add(l.assessmentIndex);
 }
 const sections=new Set<unknown>();
 for(const s of c.summary){
  if(!exact(s,['section','text'])||!one(s.section,['methodologies','resources','interventions','civic-education','orientation','professional-reflection'])||!text(s.text,4000)||sections.has(s.section))return false;
  sections.add(s.section);
 }
 return r.status==='selected'||completed.length>0||c.summary.length>0;
}
// Freeze the historical V1 mapping vocabulary here, independent of future model changes.
function fieldLists(model:unknown){
 const excluded=['class-composition','initial-profile'];
 const unfilled=['identity','interventions'];
 if(model==='disciplinary-first')unfilled.push('core-domains','expected-competences','specific-objectives','knowledge');
 else if(model==='disciplinary-second-third')unfilled.push('term-content','disciplinary-objectives','observable-descriptors','significant-tasks','skills','knowledge');
 else{unfilled.push('disciplinary-objectives');excluded.push('shared-objectives','collegial-profile');}
 unfilled.push('transversal-competences','methodologies','resources','assessment-methods','civic-education','orientation');
 excluded.push('common-assessment-criteria');
 if(model==='council-contribution')excluded.push('council-approval');
 return {unfilled,excluded};
}
function plannedAssessment(a:unknown,udas:unknown[],p:Period):boolean{
 if(!exact(a,['status','coverage','expected','localTargets','links','linkAuthority','curriculumEquivalence'])||a.curriculumEquivalence!=='not-established'||!list(a.expected)||!list(a.localTargets,10000)||!list(a.links))return false;
 const expected=a.expected,groups=a.localTargets;
 if(a.status==='missing')return a.coverage===null&&a.linkAuthority===null&&!expected.length&&!groups.length&&!a.links.length;
 if(a.status!=='selected'||a.coverage!=='selected-only'||a.linkAuthority!=='teacher-declared'||!expected.length)return false;
 let groupIndex=0;
 for(const [i,e] of expected.entries()){
  if(!exact(e,['title','purpose','plannedDate','criteria'])||!text(e.title)||!one(e.purpose,purposes)||!within(e.plannedDate,p)||!list(e.criteria,10000)||!e.criteria.length)return false;
  for(const [j,criterion] of e.criteria.entries()){
   if(!exact(criterion,['criterion','kind','description','method'])||!text(criterion.criterion)||!one(criterion.kind,['process','product','performance','argumentation'])||!text(criterion.description)||!text(criterion.method))return false;
   const g=groups[groupIndex++];
   if(!exact(g,['assessmentIndex','criterionIndex','targets'])||g.assessmentIndex!==i||g.criterionIndex!==j||!list(g.targets,10000)||!g.targets.length)return false;
   for(const t of g.targets)if(!exact(t,['kind','text','origin'])||t.origin!=='local'||!one(t.kind,['competence','general-objective','specific-objective'])||!text(t.text))return false;
  }
 }
 if(groupIndex!==groups.length)return false;
 const seen=new Set<string>();
 for(const l of a.links){
  if(!exact(l,['udaIndex','assessmentIndex'])||!integer(l.udaIndex,0,udas.length-1)||!integer(l.assessmentIndex,0,expected.length-1))return false;
  const k=l.udaIndex+':'+l.assessmentIndex;if(seen.has(k))return false;seen.add(k);
 }
 return true;
}
function planningContent(c:unknown,id:Row&{period:Period}):boolean{
 if(!exact(c,['planning','curriculum'])&&!exact(c,['planning','curriculum','assessment']))return false;
 const p=c.planning,k=c.curriculum;
 if(!exact(p,['model','mappingVersion','official','complete','origin','nature','placement','udas','unfilled','excluded'])||p.model!==id.model||p.mappingVersion!==id.mappingVersion||p.official!==false||p.complete!==false||p.origin!=='docente-os'||p.nature!=='planned'||p.placement!==(id.model==='disciplinary-first'?'supporting-plan':'planned-uda')||!list(p.udas)||!p.udas.length)return false;
 for(const u of p.udas)if(!exact(u,['title','focus','sourcePeriod','plannedHours'])||!text(u.title,16000)||!text(u.focus,16000)||!text(u.sourcePeriod,16000)||typeof u.plannedHours!=='number'||!Number.isFinite(u.plannedHours)||u.plannedHours<=0)return false;
 const fields=fieldLists(id.model);
 if(canonical(p.unfilled)!==canonical(fields.unfilled)||canonical(p.excluded)!==canonical(fields.excluded))return false;
 if(!exact(k,['status','annualReferenceCount','objectives'])||k.objectives!==null||!(k.status==='missing'?k.annualReferenceCount===null:k.status==='reference-only'&&integer(k.annualReferenceCount,1,1000)))return false;
 return !Object.prototype.hasOwnProperty.call(c,'assessment')||plannedAssessment(c.assessment,p.udas,id.period);
}
export async function validateHistoricalDocumentRecord(raw:unknown,approvedScope:unknown):Promise<Result>{
 try{
  const approved=detach(approvedScope);
  if(!scope(approved))return fail('INVALID_SCOPE');
  const r=detach(raw);
  if(!exact(r,['schemaVersion','labOnly','official','complete','identity','revision','confirmedAt','confirmedByTeacher','preview','contentDigest'])||r.schemaVersion!==1||!markers(r)||r.confirmedByTeacher!==true||!utc(r.confirmedAt)||!identity(r.identity)||!revision(r.revision,r.identity))return fail('INVALID_RECORD');
  if(canonical(approved)!==canonical(r.identity.scope))return fail('INVALID_SCOPE');
  const p=r.preview,id=r.identity;
  if(!exact(p,['official','complete','labOnly','kind','documentId','revisionId','number','content'])||!markers(p)||p.kind!==id.kind||p.documentId!==id.documentId||p.revisionId!==r.revision.revisionId||p.number!==r.revision.number)return fail('INVALID_CONTENT');
  if(!(id.kind==='final-report'||id.kind==='program-completed'?finalContent(p.content,id):planningContent(p.content,id)))return fail('INVALID_CONTENT');
  if(typeof r.contentDigest!=='string'||!(/^[0-9a-f]{64}$/).test(r.contentDigest))return fail('INVALID_DIGEST');
  const {contentDigest,...unsigned}=r;
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(['DOC-01/archive-candidate/v1',unsigned])));
  const digest=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
  if(digest!==contentDigest)return fail('INVALID_DIGEST');
  return {valid:true,record:freeze(r) as unknown as DocumentArchiveCandidateV1};
 }catch{return fail('INVALID_RECORD');}
}
