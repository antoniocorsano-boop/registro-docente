import React,{useEffect,useRef,useState} from 'react';
import type {AssessmentEvidenceV1,AssessmentScopeV1} from '../../../src/assessment/assessmentEvidence';
import type {ClassData,CouncilSession} from '../../../src/types';
import {prepareCouncilContribution,confirmCouncilContribution,type ConfirmedFormativeBalance,type CouncilContributionPreview,type CouncilContributionSelection} from '../../../src/council/councilDisciplinaryContribution';
type Current={document:AssessmentEvidenceV1;classData:ClassData;changes:number};
type Props={scope:AssessmentScopeV1;balance:ConfirmedFormativeBalance;session:CouncilSession;classData:ClassData;schoolYear:string;version:number;getCurrent:()=>Current;onDraftChange:(value:boolean)=>void};
const labels=[['learning','Apprendimenti'],['progress','Progresso documentato'],['nextStep','Prossimo passo']] as const;
const states={observed:'Osservato',not_observed:'Non osservato',not_applicable:'Non pertinente'};
const button='min-h-[44px] rounded border px-3 py-2 max-w-full whitespace-normal';
export function SyntheticCouncilContribution({scope,balance,session,classData,schoolYear,version,getCurrent,onDraftChange}:Props){
 const [sections,setSections]=useState<CouncilContributionSelection['sections']>([]);
 const [review,setReview]=useState<{preview:CouncilContributionPreview;version:number}|null>(null);
 const [confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const active=useRef(true),operation=useRef(false);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 const context={...balance.context,classId:classData.id,schoolYear,sessionId:session.id};
 const recipient='Studente '+(scope.studentIds.indexOf(balance.context.studentId)+1);
 const selection={sections};
 const visible=review?.version===version?review.preview:null;
 function invalidate(){setReview(null);setConfirmed(false);setMessage('');}
 function discard(){if(operation.current)return;invalidate();setSections([]);onDraftChange(false);}
 useEffect(()=>{
  if(!review||review.version===version)return;
  let cancelled=false;
  void(async()=>{
   try{
    const current=getCurrent();
    const next=await prepareCouncilContribution(current.document,scope,current.classData,context,balance,selection);
    if(cancelled||!active.current||getCurrent().changes!==current.changes)return;
    if(next.valid&&JSON.stringify(next.preview)===JSON.stringify(review.preview))setReview({preview:next.preview,version:current.changes});
    else{invalidate();setMessage('Il bilancio o le fonti sono cambiati. Torna alla scheda individuale per una nuova conferma.');}
   }catch{if(!cancelled&&active.current){invalidate();setMessage('Fonti non disponibili.');}}
  })();
  return()=>{cancelled=true;};
 },[version,review]);
 async function prepare(){
  if(operation.current)return;
  operation.current=true;setBusy(true);setMessage('');onDraftChange(true);
  try{
   const current=getCurrent();
   const next=await prepareCouncilContribution(current.document,scope,current.classData,context,balance,selection);
   if(!active.current)return;
   if(getCurrent().changes!==current.changes||!next.valid){invalidate();setMessage(!next.valid&&next.issue==='INVALID_SESSION'?'La seduta non corrisponde al periodo del bilancio.':'Bilancio non più valido o contesto non corrispondente. Torna alla scheda individuale.');return;}
   setReview({preview:next.preview,version:current.changes});setConfirmed(false);
  }catch{if(active.current)setMessage('Contributo non disponibile.');}
  finally{operation.current=false;if(active.current)setBusy(false);}
 }
 async function confirm(){
  if(operation.current||!visible||confirmed)return;
  operation.current=true;setBusy(true);setMessage('');
  try{
   const current=getCurrent();
   if(current.changes!==review?.version){invalidate();setMessage('Rivedi il contributo.');return;}
   const next=await confirmCouncilContribution(current.document,scope,current.classData,context,balance,selection,visible,{confirmedByTeacher:true,confirmedAt:'2027-08-31T13:00:00.000Z'});
   if(!active.current)return;
   if(!next.valid||getCurrent().changes!==current.changes){invalidate();setMessage('Il bilancio o le fonti sono cambiati. Torna alla scheda individuale per una nuova conferma.');return;}
   setConfirmed(true);
  }catch{if(active.current)setMessage('Conferma non disponibile.');}
  finally{operation.current=false;if(active.current)setBusy(false);}
 }
 return <section aria-label="Contributo disciplinare" className="min-w-0 space-y-3 rounded border p-2 [overflow-wrap:anywhere]">
  <h3 className="font-semibold">Contributo disciplinare al Consiglio</h3>
  <p>{recipient} · Identità protetta · {scope.subjectCode==='TECH'?'Tecnologia':scope.subjectCode}</p>
  <p>Bilancio di periodo già confermato nella dimostrazione. Seleziona soltanto i testi pertinenti alla seduta.</p>
  <p>Non è un voto proposto, un verbale, una decisione di scrutinio o una certificazione delle competenze.</p>
  {review&&!visible?<p role="status">Verifica delle fonti…</p>:visible?<section aria-label="Anteprima del contributo" className="space-y-2 min-w-0">
   <h4 className="font-semibold">Anteprima del contributo personale</h4>
   <p>{recipient} · {visible.context.period==='Q1'?'Primo periodo':'Secondo periodo'}</p>
   <p>Periodo dal {visible.context.from} al {visible.context.to} · Seduta {visible.session.date}</p>
   <h4 className="font-semibold">Evidenze di riferimento</h4>
   {visible.evidence.map((e,i)=><div key={i} className="border-t py-2"><p>{e.date} · {e.activity}</p><p>{e.criterion} · {states[e.state]}</p>{e.objectives.map((o,j)=><p key={j}>Obiettivo: {o}</p>)}</div>)}
   {labels.map(([key,label])=>visible.teacherText[key]!==undefined?<div key={key}><h4 className="font-semibold">{label}</h4><p className="whitespace-pre-wrap">{visible.teacherText[key]}</p></div>:null)}
   <p>Verifica pertinenza e riservatezza dei testi. Nessuna deliberazione collegiale.</p>
   {confirmed?<p role="status">Contributo personale confermato nella dimostrazione. Non salvato né trasmesso.</p>:<button type="button" className={button} disabled={busy} onClick={confirm}>Conferma contributo personale</button>}
   <button type="button" className={button} disabled={busy} onClick={invalidate}>Rivedi selezione</button>
  </section>:<fieldset disabled={busy} className="space-y-2 min-w-0">
   <legend className="font-semibold">Testi da riutilizzare</legend>
   {labels.map(([key,label])=>balance.request.teacherText[key].trim()?<label key={key} className="flex gap-2 items-start min-w-0"><input type="checkbox" aria-label={'Includi '+label.toLowerCase()} checked={sections.includes(key)} onChange={e=>{const checked=e.target.checked;onDraftChange(true);invalidate();setSections(old=>checked?[...old,key]:old.filter(x=>x!==key));}}/><span className="min-w-0">{label}<span className="block whitespace-pre-wrap">{balance.request.teacherText[key]}</span></span></label>:null)}
   <p>Le evidenze selezionate nel bilancio restano le fonti del contributo. Nessuna nuova valutazione automatica.</p>
   <button type="button" className={button} onClick={prepare}>Rivedi contributo</button>
  </fieldset>}
  {message&&<p role="alert">{message}</p>}
  <button type="button" className={button} disabled={busy} onClick={discard}>Abbandona contributo</button>
 </section>;
}
