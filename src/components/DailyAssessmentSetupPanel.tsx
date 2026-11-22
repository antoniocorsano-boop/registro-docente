import React,{useLayoutEffect,useRef,useState} from 'react';
import type {ClassData,AppSettings} from '../types';
import type {ApprovedAssessmentScope} from '../assessment/assessmentArchive';
import type {AssessmentPurpose,EvidenceKind} from '../assessment/assessmentEvidence';
import {previewDailyAssessmentSetup,type AssessmentSetupReview,type AssessmentSetupCriterion} from '../assessment/dailyAssessmentSetup';
import type {EvaluationDraftGuard} from './MatrixEvaluationEntry';
import {listDailyPlannedProofs,previewDailyPlannedCompletion,type PlannedCompletionReview} from '../assessment/dailyPlannedAssessmentCompletion';

export type AssessmentSetupSave=(
 reviewed:AssessmentSetupReview,
 confirmation:{readonly confirmedByTeacher:true;readonly confirmedAt:string}
)=>Promise<{readonly revisionId:string}>;

export type PlannedCompletionSave=(review:PlannedCompletionReview,
 confirmation:{readonly confirmedByTeacher:true;readonly confirmedAt:string})=>Promise<{readonly revisionId:string}>;
type CriterionDraft={description:string;expectedDescription:string;method:string;kind:EvidenceKind|''};
type SetupDraft={title:string;objective:string;period:'Q1'|'Q2';purpose:AssessmentPurpose;
 proofDate:string;intention:'planned'|'completed';
 criteria:CriterionDraft[];review:AssessmentSetupReview|null};
type CompletionDraft={proof:string;day:string;review:PlannedCompletionReview|null};
const blankCriterion=():CriterionDraft=>({description:'',expectedDescription:'',method:'',kind:''});
const fresh=(date:string):SetupDraft=>({title:'',objective:'',period:'Q1',purpose:'formative',
 proofDate:date,intention:'completed',criteria:[blankCriterion()],review:null});
const freshCompletion=(date:string):CompletionDraft=>({proof:'',day:date,review:null});
const input='block w-full min-w-0 max-w-full min-h-[48px] rounded-lg neon-input px-2 py-2 text-base';

/** A first-run classroom action: no inferred school curriculum, grades or proof.
 * Only explicit teacher data and confirmation can reach the existing vault.
 */
export function DailyAssessmentSetupPanel({currentClass,settings,date,isPrivacyShieldActive,approvedScopes,
 externalBusy,onBusyChange,onRegisterDraftGuard,onSave,onComplete}:{
 currentClass:ClassData;settings:AppSettings;date:string;isPrivacyShieldActive:boolean;
 approvedScopes?:readonly ApprovedAssessmentScope[];
 externalBusy:boolean;onBusyChange:(value:boolean)=>void;
 onRegisterDraftGuard:(guard:EvaluationDraftGuard|null)=>void;onSave:AssessmentSetupSave;
 onComplete:PlannedCompletionSave;
}){
 const [draft,setDraft]=useState<SetupDraft>(()=>fresh(date));
 const [completion,setCompletion]=useState<CompletionDraft>(()=>freshCompletion(date));
 const ref=useRef(draft);ref.current=draft;
 const completionRef=useRef(completion);completionRef.current=completion;
 const [pending,setPending]=useState(false),pendingRef=useRef(false),mounted=useRef(true);
 const [error,setError]=useState(''),[success,setSuccess]=useState('');
 const dirty=()=>{
  const d=ref.current;
  const c=completionRef.current;
  return pendingRef.current||Boolean(d.title||d.objective||d.review||d.period!=='Q1'||d.purpose!=='formative'||
   d.intention!=='completed'||d.proofDate!==date||
   d.criteria.length!==1||d.criteria.some(x=>x.description||x.expectedDescription||x.method||x.kind)||
   c.proof||c.review||c.day!==date);
 };
 const discard=()=>{if(pendingRef.current)return;setDraft(fresh(date));
  setCompletion(freshCompletion(date));setError('');setSuccess('');};
 useLayoutEffect(()=>{
  mounted.current=true;
  onRegisterDraftGuard({hasUnsavedChanges:dirty,discardChanges:discard});
  return ()=>{mounted.current=false;onRegisterDraftGuard(null);};
 },[onRegisterDraftGuard]);
 const blocked=pending||externalBusy||!isPrivacyShieldActive;
 const update=(patch:Partial<SetupDraft>)=>{
  if(blocked)return;
  setDraft(d=>({...d,...patch,review:null}));setError('');setSuccess('');
 };
 const editCompletion=(patch:Partial<CompletionDraft>)=>{
  if(blocked)return;
  setCompletion(old=>({...old,...patch,review:null}));setError('');setSuccess('');
 };
 const planned=listDailyPlannedProofs(currentClass,settings,approvedScopes);
 const editCriterion=(index:number,patch:Partial<CriterionDraft>)=>
  update({criteria:draft.criteria.map((c,i)=>i===index?{...c,...patch}:c)});
 const review=()=>{
  if(blocked)return;
  if(!draft.title.trim()||!draft.objective.trim()||draft.criteria.some(c=>
    !c.description.trim()||!c.expectedDescription.trim()||!c.method.trim()||!c.kind)){
   setError('Compila titolo, obiettivo, criterio, evidenza attesa e metodo per ogni criterio.');return;
  }
  const request={
   activityId:crypto.randomUUID(),assessmentId:crypto.randomUUID(),
   plannedRevisionId:crypto.randomUUID(),completedRevisionId:crypto.randomUUID(),
   objectiveId:crypto.randomUUID(),objectiveRevisionId:crypto.randomUUID(),
   title:draft.title.trim(),date:draft.proofDate,period:draft.period,purpose:draft.purpose,
   objectiveText:draft.objective.trim(),preparedAt:new Date().toISOString(),
   criteria:draft.criteria.map(c=>({
    criterionId:crypto.randomUUID(),revisionId:crypto.randomUUID(),
    description:c.description.trim(),
    expected:{kind:c.kind as EvidenceKind,description:c.expectedDescription.trim(),method:c.method.trim()}
   }))
  };
  const result=previewDailyAssessmentSetup(currentClass,settings,request,draft.intention,approvedScopes);
  if(!result.valid){setError('Impossibile verificare la prova. Controlla la data e il contesto della classe.');return;}
  setDraft(old=>({...old,review:result.review}));setError('');
 };
 const reviewCompletion=()=>{
  if(blocked||!completion.proof||!completion.day){setError('Seleziona una prova programmata e la data effettiva.');return;}
  const revisionId=crypto.randomUUID();
  const next=previewDailyPlannedCompletion(currentClass,settings,{
   assessmentRevisionId:completion.proof,revisionId,completedOn:completion.day},approvedScopes);
  if(!next.valid){setError('Non è possibile concludere la prova: verifica i dati e lo storico.');return;}
  setCompletion(c=>({...c,review:next.review}));setError('');
 };
 const complete=async()=>{
  const reviewed=completionRef.current.review;
  if(!reviewed||blocked||pendingRef.current)return;
  pendingRef.current=true;setPending(true);onBusyChange(true);setError('');setSuccess('');
  try{
   const receipt=await onComplete(reviewed,{confirmedByTeacher:true,confirmedAt:new Date().toISOString()});
   if(!mounted.current)return;
   if(receipt.revisionId!==reviewed.preview.request.revisionId)throw Error('Missing durable receipt');
   setCompletion(freshCompletion(date));
   setSuccess('Prova conclusa e verificata nell’archivio protetto. Ora puoi registrare le evidenze.');
  }catch{
   if(mounted.current)setError('Conclusione non confermata. Verifica lo storico prima di riprovare.');
  }finally{
   pendingRef.current=false;onBusyChange(false);if(mounted.current)setPending(false);
  }
 };
 const save=async()=>{
  const reviewed=ref.current.review;
  if(!reviewed||blocked||pendingRef.current)return;
  pendingRef.current=true;setPending(true);onBusyChange(true);setError('');setSuccess('');
  try{
   const receipt=await onSave(reviewed,{confirmedByTeacher:true,confirmedAt:new Date().toISOString()});
   if(!mounted.current)return;
   if(receipt.revisionId!==(reviewed.mode==='planned'?reviewed.request.plannedRevisionId:reviewed.request.completedRevisionId))throw Error('Unverified receipt');
   setDraft(fresh(date));
   setSuccess(reviewed.mode==='planned'?'Prova programmata e criteri salvati nell’archivio protetto.':
    'Prova svolta e criteri salvati nell’archivio protetto.');
  }catch{
   if(mounted.current)setError('Salvataggio non confermato. Verifica le prove già presenti prima di un nuovo tentativo.');
  }finally{
   pendingRef.current=false;onBusyChange(false);if(mounted.current)setPending(false);
  }
 };
 return <details data-testid="daily-assessment-setup" className="min-w-0 rounded-lg border border-[var(--border)]">
  <summary className="min-h-[48px] cursor-pointer px-3 py-3 text-sm font-semibold">Predisponi prova e criteri</summary>
  <div className="space-y-3 p-3 min-w-0">
   <p className="text-xs text-slate-400">Programma una prova oppure registra una prova già svolta. Obiettivo e criteri sono dichiarati dal docente; nessun voto o livello viene generato.</p>
   {!isPrivacyShieldActive?<p role="status">Attiva la protezione dei nominativi per predisporre una prova.</p>:
   <>
    <fieldset disabled={blocked||Boolean(draft.review)} className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
     <label className="min-w-0">Stato della nuova prova
      <select aria-label="Stato iniziale della prova" className={input} value={draft.intention}
       onChange={e=>update({intention:e.target.value as 'planned'|'completed'})}>
       <option value="completed">Già svolta</option><option value="planned">Da svolgere</option>
      </select>
     </label>
     <label className="min-w-0">{draft.intention==='planned'?'Data prevista':'Data della prova svolta'}
      <input type="date" aria-label="Data prevista o svolta" className={input}
       value={draft.proofDate} onChange={e=>update({proofDate:e.target.value})}/>
     </label>
     <label className="min-w-0 sm:col-span-2">Titolo della prova
      <input aria-label="Titolo prova con criteri" className={input} maxLength={2000} value={draft.title} onChange={e=>update({title:e.target.value})}/>
     </label>
     <label className="min-w-0">Periodo
      <select aria-label="Periodo prova con criteri" className={input} value={draft.period}
       onChange={e=>update({period:e.target.value as 'Q1'|'Q2'})}>
       <option value="Q1">Primo periodo della prova</option><option value="Q2">Secondo periodo della prova</option>
      </select>
     </label>
     <label className="min-w-0">Finalità
      <select aria-label="Finalità prova con criteri" className={input} value={draft.purpose}
       onChange={e=>update({purpose:e.target.value as AssessmentPurpose})}>
       <option value="diagnostic">Diagnostica</option><option value="formative">Formativa</option>
       <option value="summative">Sommativa</option>
      </select>
     </label>
     <label className="min-w-0 sm:col-span-2">Obiettivo di apprendimento
      <textarea aria-label="Obiettivo dichiarato dal docente" className={input} rows={2} maxLength={2000}
       value={draft.objective} onChange={e=>update({objective:e.target.value})}/>
     </label>
     {draft.criteria.map((c,i)=><div key={i} data-testid="setup-criterion" className="min-w-0 sm:col-span-2 space-y-2 rounded-lg border border-[var(--border)] p-2">
      <div className="flex flex-wrap justify-between gap-2"><strong>Criterio {i+1}</strong>
       {draft.criteria.length>1&&<button type="button" disabled={blocked||!!draft.review} onClick={()=>update({criteria:draft.criteria.filter((_,j)=>i!==j)})}
        className="min-h-[44px] px-2 rounded border border-[var(--border)]">Rimuovi criterio</button>}
      </div>
      <label className="block min-w-0">Descrizione del criterio
       <textarea aria-label={'Criterio '+(i+1)} maxLength={2000} rows={2} className={input}
        value={c.description} onChange={e=>editCriterion(i,{description:e.target.value})}/>
      </label>
      <label className="block min-w-0">Tipo di evidenza attesa
       <select aria-label={'Tipo evidenza attesa '+(i+1)} className={input} value={c.kind}
        onChange={e=>editCriterion(i,{kind:e.target.value as EvidenceKind})}>
        <option value="">Scegli</option><option value="process">Processo</option><option value="product">Prodotto</option>
        <option value="performance">Prestazione</option><option value="argumentation">Argomentazione</option>
       </select>
      </label>
      <label className="block min-w-0">Che cosa si intende osservare
       <textarea aria-label={'Evidenza attesa '+(i+1)} rows={2} maxLength={2000} className={input}
        value={c.expectedDescription} onChange={e=>editCriterion(i,{expectedDescription:e.target.value})}/>
      </label>
      <label className="block min-w-0">Metodo di osservazione
       <input aria-label={'Metodo atteso '+(i+1)} className={input} maxLength={2000}
        value={c.method} onChange={e=>editCriterion(i,{method:e.target.value})}/>
      </label>
     </div>)}
    </fieldset>
    {!draft.review?<div className="flex flex-wrap gap-2">
     <button type="button" disabled={blocked||draft.criteria.length>=4}
      onClick={()=>update({criteria:[...draft.criteria,blankCriterion()]})}
      className="min-h-[48px] px-3 rounded border border-[var(--border)]">Aggiungi criterio</button>
     <button type="button" disabled={blocked} onClick={review}
      className="min-h-[48px] px-3 rounded-lg border border-[var(--border)]">Esamina prova e criteri</button>
    </div>:<div data-testid="assessment-setup-confirmation" className="space-y-2 rounded-lg border border-[var(--border)] p-3">
     <p className="font-semibold">{draft.review.mode==='planned'?'Conferma programmazione':'Conferma prova svolta'}</p>
     <p className="break-words">{draft.review.request.title} · {draft.review.request.date} · {draft.criteria.length} {draft.criteria.length===1?'criterio':'criteri'}</p>
     <p className="break-words">Obiettivo: {draft.review.request.objectiveText}</p>
     <ul className="list-disc pl-5 break-words">{draft.review.request.criteria.map(c=>
      <li key={c.revisionId}>{c.description} · {c.expected.description} · {c.expected.method}</li>)}</ul>
     <p className="text-xs text-slate-400">La conferma registra obiettivo e criteri, non voti o giudizi individuali. Le prove da svolgere richiederanno un'ulteriore conferma dopo la lezione.</p>
     <div className="flex flex-wrap gap-2">
      <button type="button" disabled={blocked} onClick={()=>setDraft(d=>({...d,review:null}))}
       className="min-h-[48px] px-3 border rounded border-[var(--border)]">Modifica</button>
      <button type="button" disabled={blocked} onClick={()=>void save()}
       className="min-h-[48px] px-3 rounded-lg neon-btn-primary">{pending?'Salvataggio…':'Conferma e registra'}</button>
     </div>
    </div>}
    {planned.status==='ready'&&planned.proofs.length>0&&<section data-testid="planned-assessment-completion" className="space-y-2 border-t border-[var(--border)] pt-3">
     <h4 className="font-semibold">Concludi una prova programmata</h4>
     <p className="text-xs text-slate-400">Conferma lo svolgimento effettivo, senza cancellare la programmazione originale.</p>
     <fieldset disabled={blocked||Boolean(completion.review)} className="grid gap-2 sm:grid-cols-2">
      <label className="min-w-0">Prova da concludere
       <select aria-label="Prova programmata da concludere" className={input} value={completion.proof}
        onChange={e=>editCompletion({proof:e.target.value})}>
        <option value="">Scegli una prova</option>
        {planned.proofs.map(p=><option key={p.revisionId} value={p.revisionId}>{p.title} · {p.scheduledFor}</option>)}
       </select>
      </label>
      <label className="min-w-0">Data effettiva
       <input type="date" aria-label="Data effettiva di svolgimento" className={input}
        value={completion.day} onChange={e=>editCompletion({day:e.target.value})}/>
      </label>
     </fieldset>
     {!completion.review?
      <button type="button" disabled={blocked} onClick={reviewCompletion}
       className="min-h-[48px] rounded-lg border border-[var(--border)] px-3">Esamina conclusione della prova</button>:
      <div data-testid="planned-completion-confirmation" className="space-y-2 p-3 rounded-lg border border-[var(--border)]">
       <p className="font-semibold">Conferma svolgimento effettivo</p>
       <p className="break-words">{completion.review.preview.planned.title} · {completion.review.preview.request.completedOn}</p>
       <p className="text-xs text-slate-400">{completion.review.preview.planned.criteria.length} criteri conservati dalle revisioni originali.</p>
       <div className="flex flex-wrap gap-2">
        <button type="button" disabled={blocked} onClick={()=>setCompletion(old=>({...old,review:null}))}
         className="min-h-[48px] rounded border border-[var(--border)] px-3">Modifica</button>
        <button type="button" disabled={blocked} onClick={()=>void complete()}
         className="min-h-[48px] rounded-lg neon-btn-primary px-3">{pending?'Salvataggio…':'Conferma svolgimento'}</button>
       </div>
      </div>}
    </section>}
   </>}
   {error&&<p role="alert" className="text-sm text-amber-200 break-words">{error}</p>}
   {success&&<p role="status" className="text-sm text-emerald-300">{success}</p>}
  </div>
 </details>;
}
