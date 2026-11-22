import React,{useLayoutEffect,useMemo,useRef,useState} from 'react';
import type {AppSettings,ClassData} from '../types';
import type {AssessmentScopeV1} from '../assessment/assessmentEvidence';
import {previewIndividualObservation,type IndividualObservationPreview} from '../assessment/individualObservation';
import type {EvidenceCommitRequest} from '../assessment/assessmentEvidenceMutation';
import {resolveDailyCriterionRecordingContext} from '../assessment/dailyCriterionRecordingContext';
import {formatStudentNameWithPrivacy} from '../utils';
import type {EvaluationDraftGuard} from './MatrixEvaluationEntry';

export type CriterionSave=(
 scope:AssessmentScopeV1,request:EvidenceCommitRequest,
 confirmation:{readonly confirmedByTeacher:true;readonly confirmedAt:string}
)=>Promise<{readonly revisionId:string}>;

type EvidenceState=''|'observed'|'not_observed'|'not_applicable';
type EvidenceKind=''|'process'|'product'|'performance'|'argumentation';
const initial=()=>({proof:'',criterion:'',student:'',state:'' as EvidenceState,
 kind:'' as EvidenceKind,description:'',method:'',reviewed:null as IndividualObservationPreview|null});
type Draft=ReturnType<typeof initial>;

/** Explicit opt-in; completed qualified proof required, no grade inference.
 * A preview never writes. Only a durable application owner can issue a receipt.
 */
export function DailyCriterionRecorder({currentClass,settings,date,isPrivacyShieldActive,
 externalBusy,onBusyChange,onRegisterDraftGuard,onSave}:{
 currentClass:ClassData;settings?:AppSettings;date:string;isPrivacyShieldActive:boolean;
 externalBusy:boolean;onBusyChange:(busy:boolean)=>void;
 onRegisterDraftGuard:(guard:EvaluationDraftGuard|null)=>void;onSave:CriterionSave;
}){
 const context=useMemo(()=>resolveDailyCriterionRecordingContext(currentClass,settings),
  [currentClass,settings?.year,settings?.subject]);
 const [draft,setDraft]=useState<Draft>(initial);
 const draftRef=useRef(draft);draftRef.current=draft;
 const [pending,setPending]=useState(false);
 const pendingRef=useRef(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const mounted=useRef(true);
 const dirty=()=>{const d=draftRef.current;return pendingRef.current||Boolean(d.proof||d.criterion||d.student||d.state||d.description||d.method||d.reviewed);};
 const discard=()=>{if(pendingRef.current)return;setDraft(initial());setError('');setSuccess('');};
 useLayoutEffect(()=>{
  mounted.current=true;
  onRegisterDraftGuard({hasUnsavedChanges:dirty,discardChanges:discard});
  return ()=>{mounted.current=false;onRegisterDraftGuard(null);};
 },[onRegisterDraftGuard]);
 const update=(patch:Partial<Draft>)=>{
  if(pendingRef.current||externalBusy)return;
  setDraft(old=>({...old,...patch,reviewed:null}));
  setError('');setSuccess('');
 };
 const ready=context.status==='ready';
 const selected=ready?context.assessments.find(a=>a.assessmentRevisionId===draft.proof):undefined;
 const criterion=selected?.criteria.find(c=>c.revisionId===draft.criterion);
 const selectedStudent=currentClass.students.find(s=>s.id===draft.student);
 const blocked=pending||externalBusy||!isPrivacyShieldActive;
 const makePreview=()=>{
  if(!ready||blocked||!selected||!criterion||!selectedStudent||!draft.state||
    (draft.state==='observed'&&(!draft.kind||!draft.description.trim()||!draft.method.trim()))){
   setError('Scegli la prova svolta, il criterio, l’alunno e lo stato della rilevazione.');return;
  }
  const identity={evidenceId:crypto.randomUUID(),revisionId:crypto.randomUUID(),
   observationEventId:crypto.randomUUID(),assessmentRevisionId:selected.assessmentRevisionId,
   criterionRevisionId:criterion.revisionId,studentId:selectedStudent.id,
   observedOn:date,recordedAt:new Date().toISOString()};
  const request=draft.state==='observed'?
   {...identity,state:'observed' as const,
    fact:{kind:draft.kind,description:draft.description.trim(),method:draft.method.trim()},
    interpretation:{kind:'pending' as const}}:
   {...identity,state:draft.state};
  const result=previewIndividualObservation(context.document,context.scope,request);
  if(!result.valid){setError('Rilevazione non verificabile. Controlla data, contenuto e prova scelta.');return;}
  setDraft(old=>({...old,reviewed:result.preview}));setError('');
 };
 const commit=async()=>{
  const reviewed=draftRef.current.reviewed;
  if(!reviewed||!ready||pendingRef.current||externalBusy||!isPrivacyShieldActive)return;
  if(reviewed.scope.classId!==context.scope.classId||
    reviewed.scope.schoolYear!==context.scope.schoolYear||
    reviewed.scope.subjectCode!==context.scope.subjectCode){setError('Contesto cambiato: verifica nuovamente la rilevazione.');return;}
  pendingRef.current=true;setPending(true);onBusyChange(true);setError('');setSuccess('');
  try{
   const receipt=await onSave(context.scope,{kind:'new',preview:reviewed},
    {confirmedByTeacher:true,confirmedAt:new Date().toISOString()});
   if(!mounted.current)return;
   if(receipt.revisionId!==reviewed.request.revisionId)throw Error('Missing durable receipt');
   setDraft(initial());
   setSuccess('Rilevazione salvata e verificata nell’archivio protetto.');
  }catch{
   if(mounted.current)setError('Salvataggio non confermato. Controlla lo storico prima di riprovare: nessun invio automatico.');
  }finally{
   pendingRef.current=false;onBusyChange(false);if(mounted.current)setPending(false);
  }
 };
 const stateLabel=(s:EvidenceState)=>s==='observed'?'Osservato':s==='not_observed'?'Non osservato':s==='not_applicable'?'Non pertinente':'';
 return <details data-testid="daily-criterion-recorder" className="min-w-0 rounded-lg border border-[var(--border)]">
  <summary className="min-h-[48px] cursor-pointer px-3 py-3 text-sm font-semibold">
   Rileva evidenza per criterio
  </summary>
  <div className="space-y-3 px-3 pb-3 text-sm min-w-0">
   <p className="text-xs text-slate-400">Operazione distinta dal voto e dal comportamento. Solo prove già svolte e criteri confermati.</p>
   {!isPrivacyShieldActive?<p role="status">Attiva la protezione dei nominativi per registrare evidenze.</p>:
    context.status!=='ready'?(context.status==='absent'?
      <p role="status">Nessuna prova con criteri predisposta per questa classe. Non vengono create evidenze dai voti.</p>:
      <p role="alert">Archivio o contesto della prova non verificabile. Registrazione disabilitata.</p>):
    context.assessments.length===0?<p role="status">Nessuna prova con criteri risulta confermata come svolta.</p>:
    <>
     <fieldset disabled={blocked||Boolean(draft.reviewed)} className="grid gap-2 sm:grid-cols-2 min-w-0">
      <label className="min-w-0">Prova svolta
       <select aria-label="Prova svolta con criteri" value={draft.proof}
        onChange={e=>update({proof:e.target.value,criterion:'',student:'',state:''})}
        className="block w-full min-h-[48px] neon-input px-2">
        <option value="">Scegli la prova</option>
        {context.assessments.map(a=><option key={a.assessmentRevisionId} value={a.assessmentRevisionId}>{a.title} · {a.completedOn}</option>)}
       </select>
      </label>
      <label className="min-w-0">Criterio
       <select aria-label="Criterio della prova" value={draft.criterion}
        onChange={e=>update({criterion:e.target.value})} className="block w-full min-h-[48px] neon-input px-2">
        <option value="">Scegli il criterio</option>
        {selected?.criteria.map(c=><option key={c.revisionId} value={c.revisionId}>{c.description}</option>)}
       </select>
      </label>
      <label className="min-w-0">Alunno
       <select aria-label="Alunno per rilevazione" value={draft.student}
        onChange={e=>update({student:e.target.value})} className="block w-full min-h-[48px] neon-input px-2">
        <option value="">Scegli l’alunno</option>
        {currentClass.students.map(s=><option key={s.id} value={s.id}>{formatStudentNameWithPrivacy(s.name,isPrivacyShieldActive)}</option>)}
       </select>
      </label>
      <label className="min-w-0">Esito della rilevazione
       <select aria-label="Stato della rilevazione" value={draft.state}
        onChange={e=>update({state:e.target.value as EvidenceState})} className="block w-full min-h-[48px] neon-input px-2">
        <option value="">Scegli lo stato</option>
        <option value="observed">Osservato</option>
        <option value="not_observed">Non osservato</option>
        <option value="not_applicable">Non pertinente</option>
       </select>
      </label>
      {draft.state==='observed'&&<>
       <label className="min-w-0">Tipo di evidenza
        <select aria-label="Tipo di evidenza" value={draft.kind}
         onChange={e=>update({kind:e.target.value as EvidenceKind})} className="block w-full min-h-[48px] neon-input px-2">
         <option value="">Scegli il tipo</option><option value="product">Prodotto</option><option value="process">Processo</option>
         <option value="performance">Prestazione</option><option value="argumentation">Argomentazione</option>
        </select>
       </label>
       <label className="min-w-0">Metodo di osservazione
        <input aria-label="Metodo della rilevazione" value={draft.method} maxLength={2000}
         onChange={e=>update({method:e.target.value})} className="block w-full min-h-[48px] neon-input px-2"/>
       </label>
       <label className="sm:col-span-2 min-w-0">Fatto osservato
        <textarea aria-label="Fatto osservato" value={draft.description} maxLength={2000} rows={2}
         onChange={e=>update({description:e.target.value})} className="block w-full neon-input p-2"/>
       </label>
      </>}
     </fieldset>
     {!draft.reviewed?<button type="button" disabled={blocked}
      onClick={makePreview} className="min-h-[48px] px-3 rounded-lg border border-[var(--border)]">
      Esamina rilevazione
     </button>:<div data-testid="criterion-confirmation" className="space-y-2 p-3 rounded-lg border border-[var(--border)]">
      <p className="font-semibold">Conferma prima del salvataggio</p>
      <p className="break-words">{selected?.title} · {criterion?.description} · {selectedStudent?formatStudentNameWithPrivacy(selectedStudent.name,isPrivacyShieldActive):''}</p>
      <p>{date} · {stateLabel(draft.state)}</p>
      {draft.state==='observed'&&<p className="break-words">Fatto: {draft.description} · Metodo: {draft.method}. Interpretazione da confermare separatamente.</p>}
      <div className="flex flex-wrap gap-2">
       <button type="button" disabled={blocked} onClick={()=>setDraft(old=>({...old,reviewed:null}))}
        className="min-h-[48px] px-3 rounded-lg border border-[var(--border)]">Modifica</button>
       <button type="button" disabled={blocked} onClick={()=>void commit()}
        className="min-h-[48px] px-3 rounded-lg neon-btn-primary">{pending?'Salvataggio…':'Conferma e salva'}</button>
      </div>
     </div>}
    </>
   }
   {error&&<p role="alert" className="text-amber-300 break-words">{error}</p>}
   {success&&<p role="status" className="text-emerald-300">{success}</p>}
  </div>
 </details>;
}
