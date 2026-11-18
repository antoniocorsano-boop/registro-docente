import React,{useEffect,useRef,useState} from 'react';
import type {AssessmentEvidenceV1,AssessmentScopeV1} from '../../../src/assessment/assessmentEvidence';
import {projectIndividualAssessmentEvidence} from '../../../src/assessment/assessmentEvidenceProjection';
import {prepareFormativeBalance,confirmFormativeBalance,type FormativeBalanceContext,type FormativeBalancePreview,type FormativeBalanceRequest} from '../../../src/assessment/formativeBalance';
import {projectFormativeRestitution} from '../../../src/assessment/formativeRestitutionProjection';

const blank={learning:'',progress:'',nextStep:''};
const states={observed:'Osservato',not_observed:'Non osservato',not_applicable:'Non pertinente'};
const field='block w-full min-w-0 max-w-full rounded border p-2 min-h-[44px]';
const button='min-h-[44px] max-w-full rounded border px-3 py-2 whitespace-normal [overflow-wrap:anywhere]';
type Current={document:AssessmentEvidenceV1;changes:number};
type Props={scope:AssessmentScopeV1;studentId:string;document:AssessmentEvidenceV1;version:number;getCurrent:()=>Current;onDraftChange:(dirty:boolean)=>void};
function available(document:AssessmentEvidenceV1,scope:AssessmentScopeV1,c:FormativeBalanceContext){
 const p=projectIndividualAssessmentEvidence(document,scope,c.studentId);
 if(!p.valid||!c.from||!c.to||c.from>c.to)return [];
 return p.entries.flatMap(e=>{
  const record=document.evidence.find(x=>x.revisionId===e.evidenceRevisionId);
  const assessment=document.assessments.find(x=>x.revisionId===e.assessmentRevisionId);
  const criterion=document.criteria.find(x=>x.revisionId===e.criterionRevisionId);
  return record&&record.state!=='withdrawn'&&assessment&&criterion&&assessment.period===c.period&&record.observedOn>=c.from&&record.observedOn<=c.to?
   [{record,assessment,criterion}]:[];
 });
}
export function SyntheticFormativeBalance({scope,studentId,document,version,getCurrent,onDraftChange}:Props){
 const [period,setPeriod]=useState<'Q1'|'Q2'>('Q1'),[from,setFrom]=useState(''),[to,setTo]=useState('');
 const [selected,setSelected]=useState<string[]>([]),[earlier,setEarlier]=useState(''),[later,setLater]=useState('');
 const [teacherText,setTeacherText]=useState(blank);
 const [review,setReview]=useState<{preview:FormativeBalancePreview;version:number}|null>(null);
 const [confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const alive=useRef(true),operation=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const context:FormativeBalanceContext={classId:scope.classId,schoolYear:scope.schoolYear,subjectCode:scope.subjectCode,studentId,period,from,to};
 const rows=available(document,scope,context);
 const selectedObserved=rows.filter(r=>r.record.state==='observed'&&selected.includes(r.record.revisionId));
 const recipient='Studente '+(scope.studentIds.indexOf(studentId)+1);
 const request:FormativeBalanceRequest={evidenceRevisionIds:selected,comparisons:earlier&&later?[{earlierRevisionId:earlier,laterRevisionId:later}]:[],teacherText};
 function invalidate(){setReview(null);setConfirmed(false);setMessage('');}
 function dirty(){onDraftChange(true);invalidate();}
 function changeContext(action:()=>void){dirty();action();setSelected([]);setEarlier('');setLater('');}
 function reset(){
  if(operation.current)return;
  invalidate();setPeriod('Q1');setFrom('');setTo('');setSelected([]);setEarlier('');setLater('');setTeacherText(blank);onDraftChange(false);
 }
 function sourceChanged(next:Current){
  setReview(null);setConfirmed(false);
  const allowed=new Set(available(next.document,scope,context).map(r=>r.record.revisionId));
  setSelected(ids=>ids.filter(id=>allowed.has(id)));setEarlier('');setLater('');
  setMessage('Le evidenze sono cambiate. Rivedi le fonti e il testo prima di confermare.');
 }
 // A changed committed version hides the recipient preview immediately,
 // including the brief interval before asynchronous revalidation finishes.
 useEffect(()=>{
  if(!review||review.version===version)return;
  let cancelled=false;
  void (async()=>{
   try{
    const next=getCurrent();
    const fresh=await prepareFormativeBalance(next.document,scope,review.preview.context,review.preview.request);
    if(cancelled||!alive.current||getCurrent().changes!==next.changes)return;
    if(fresh.valid&&fresh.preview.basisDigest===review.preview.basisDigest)setReview({preview:fresh.preview,version:next.changes});
    else sourceChanged(next);
   }catch{if(!cancelled&&alive.current){setReview(null);setConfirmed(false);setMessage('Fonti non disponibili. Rivedi il bilancio.');}}
  })();
  return()=>{cancelled=true;};
 },[version,review]);
 async function prepare(){
  if(operation.current)return;
  if(!selected.length){setMessage('Seleziona almeno una evidenza.');return;}
  if((earlier&&!later)||(!earlier&&later)){setMessage('Seleziona entrambe le osservazioni del confronto.');return;}
  operation.current=true;setBusy(true);setMessage('');
  try{
   const current=getCurrent(),r=await prepareFormativeBalance(current.document,scope,context,request);
   if(!alive.current)return;
   if(getCurrent().changes!==current.changes){sourceChanged(getCurrent());return;}
   if(!r.valid){setMessage(r.issue==='INVALID_COMPARISON'?'Il confronto richiede due osservazioni pertinenti e distinte.':r.issue==='NO_SOURCES'?'Il testo richiede almeno un fatto osservato.':'Controlla il periodo e le evidenze selezionate.');return;}
   setReview({preview:r.preview,version:current.changes});setConfirmed(false);
  }catch{if(alive.current)setMessage('Anteprima non disponibile.');}
  finally{operation.current=false;if(alive.current)setBusy(false);}
 }
 async function confirm(){
  if(operation.current||!review||review.version!==version||confirmed)return;
  operation.current=true;setBusy(true);setMessage('');
  try{
   const current=getCurrent();
   if(current.changes!==review.version){sourceChanged(current);return;}
   // Fixed clock belongs solely to the synthetic school-year fixture.
   const r=await confirmFormativeBalance(current.document,scope,context,review.preview,{confirmedByTeacher:true,confirmedAt:'2027-08-31T12:00:00.000Z'});
   if(!alive.current)return;
   if(getCurrent().changes!==current.changes||!r.valid){sourceChanged(getCurrent());return;}
   setConfirmed(true);
  }catch{if(alive.current){setConfirmed(false);setMessage('Conferma non disponibile.');}}
  finally{operation.current=false;if(alive.current)setBusy(false);}
 }
 const visibleReview=review&&review.version===version?projectFormativeRestitution(review.preview):null;
 return <section aria-label="Bilancio formativo individuale" className="min-w-0 rounded border p-2 space-y-3 [overflow-wrap:anywhere]">
  <h2 className="text-lg font-semibold">Bilancio formativo individuale</h2>
  <p>{recipient} · Identità protetta</p>
  <p className="text-sm">Dimostrazione locale. Nessun voto, certificazione, invio o salvataggio del bilancio.</p>
  {review&&!visibleReview?<p role="status">Verifica delle fonti…</p>:visibleReview?<section aria-label="Anteprima per il destinatario" className="space-y-3 rounded border p-2 min-w-0">
   <h3 className="font-semibold">Anteprima della restituzione</h3><p>{recipient} · {visibleReview.period==='Q1'?'Primo periodo':'Secondo periodo'}</p><p>Dal {visibleReview.from} al {visibleReview.to}</p>
   <h4 className="font-semibold">Evidenze di riferimento</h4>
   {visibleReview.sources.map((s,i)=><div key={i} className="border-t py-2 space-y-1"><p>{s.date} · {s.activity}</p><p>{s.criterion} · {states[s.state]}</p>{s.objectives.map((o,j)=><p key={j}>Obiettivo: {o}</p>)}</div>)}
   {([['learning','Apprendimenti'],['progress','Progresso documentato'],['nextStep','Prossimo passo']] as const).map(([key,label])=>visibleReview.teacherText[key].trim()?<div key={key} className="space-y-1"><h4 className="font-semibold">{label}</h4><p className="whitespace-pre-wrap">{visibleReview.teacherText[key]}</p></div>:null)}
   <p className="text-sm">Verifica che il testo non contenga informazioni riservate o riferite ad altri studenti.</p>
   {confirmed?<p role="status">Bilancio confermato nella dimostrazione. Non salvato né inviato.</p>:<button type="button" disabled={busy} className={button} onClick={confirm}>Conferma bilancio</button>}
   <button type="button" disabled={busy} className={button} onClick={invalidate}>Modifica bozza</button>
  </section>:<fieldset disabled={busy} className="space-y-3 min-w-0">
   <legend className="font-semibold">Periodo e fonti</legend>
   <label className="block">Periodo<select className={field} value={period} onChange={e=>changeContext(()=>setPeriod(e.target.value as 'Q1'|'Q2'))}><option value="Q1">Primo periodo</option><option value="Q2">Secondo periodo</option></select></label>
   <label className="block">Dal<input className={field} type="date" value={from} onChange={e=>changeContext(()=>setFrom(e.target.value))}/></label>
   <label className="block">Al<input className={field} type="date" value={to} onChange={e=>changeContext(()=>setTo(e.target.value))}/></label>
   <section aria-label="Fonti disponibili" className="space-y-2">
    <h3 className="font-semibold">Seleziona le evidenze</h3>
    {!from||!to?<p>Indica le date effettive del periodo.</p>:!rows.length?<p>Nessuna evidenza disponibile per il periodo selezionato.</p>:rows.map(r=><label className="flex items-start gap-2 border-b py-2 min-w-0" key={r.record.revisionId}>
     <input className="mt-1 shrink-0" type="checkbox" checked={selected.includes(r.record.revisionId)} onChange={e=>{dirty();setSelected(ids=>e.target.checked?[...ids,r.record.revisionId]:ids.filter(id=>id!==r.record.revisionId));setEarlier('');setLater('');}}/>
     <span className="min-w-0">{r.record.observedOn} · {r.assessment.title} · {r.criterion.description} · {states[r.record.state]}{r.record.state==='observed'&&<span className="block text-sm">{r.record.fact.description}</span>}</span>
    </label>)}
   </section>
   <section aria-label="Confronto delle osservazioni" className="space-y-2">
    <h3 className="font-semibold">Confronto facoltativo</h3><p className="text-sm">Seleziona due fatti osservati. Il confronto non determina automaticamente un progresso.</p>
    {([['Prima osservazione',earlier,setEarlier],['Seconda osservazione',later,setLater]] as const).map(([label,value,set])=><label className="block" key={label}>{label}<select className={field} value={value} onChange={e=>{dirty();set(e.target.value);}}><option value="">Nessun confronto</option>{selectedObserved.map(r=><option key={r.record.revisionId} value={r.record.revisionId}>{r.record.observedOn} · {r.criterion.description}</option>)}</select></label>)}
   </section>
   {([['learning','Apprendimenti'],['progress','Progresso documentato'],['nextStep','Prossimo passo']] as const).map(([key,label])=><label className="block" key={key}>{label}<textarea maxLength={2000} rows={3} className={field} value={teacherText[key]} onChange={e=>{dirty();setTeacherText(t=>({...t,[key]:e.target.value}));}}/></label>)}
   <button className={button} type="button" onClick={prepare}>Rivedi bilancio</button>
  </fieldset>}
  {message&&<p role="alert">{message}</p>}
  <button className={button} type="button" disabled={busy} onClick={reset}>Abbandona bilancio</button>
 </section>;
}
