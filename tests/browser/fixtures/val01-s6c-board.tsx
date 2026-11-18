import React,{useRef,useState} from 'react';
import {boardDocument,boardScope} from './val01-s6c-data';
import {projectEvidenceBoard} from '../../../src/assessment/individualEvidenceBoard';
import {previewIndividualObservation,confirmIndividualObservation} from '../../../src/assessment/individualObservation';
import type {IndividualObservationPreview} from '../../../src/assessment/individualObservation';
import {previewEvidenceRevision,confirmEvidenceRevision} from '../../../src/assessment/individualEvidenceRevision';
import type {EvidenceRevisionPreview} from '../../../src/assessment/individualEvidenceRevision';
import type {IndividualEvidenceRevision,EvidenceKind,AssessmentEvidenceV1} from '../../../src/assessment/assessmentEvidence';
import type {EvidenceCommitRequest} from '../../../src/assessment/assessmentEvidenceMutation';
import type {EvidenceSaveReceipt} from '../../../src/persistence/assessmentEvidenceCommit';
import {listEvidenceInterpretationOptions} from '../../../src/assessment/evidenceInterpretationOptions';

const labels={observed:'Osservato',not_observed:'Non osservato',not_applicable:'Non pertinente',withdrawn:'Ritirato'} as const;
const control='block w-full min-w-0 max-w-full min-h-[44px] rounded border p-2 whitespace-normal [overflow-wrap:anywhere]';
const button='min-h-[44px] max-w-full rounded border px-2 py-1 whitespace-normal [overflow-wrap:anywhere]';
type Edit={studentId:string; action:'new'|'correct'|'withdraw'; previous?:IndividualEvidenceRevision};
type Review={kind:'new';value:IndividualObservationPreview}|{kind:'revision';value:EvidenceRevisionPreview};
type State='observed'|'not_observed'|'not_applicable';
interface Props{onDraftChange?:(dirty:boolean)=>void;onDocumentChange?:(document:AssessmentEvidenceV1)=>void;onOpenStudentReport?:(studentId:string)=>void;committedDocument?:AssessmentEvidenceV1;onCommit?:(request:EvidenceCommitRequest,confirmation:unknown)=>Promise<EvidenceSaveReceipt>;onRecover?:()=>Promise<void>;recoveryRequired?:boolean;}
export function SyntheticEvidenceBoard({onDraftChange,onDocumentChange,onOpenStudentReport,committedDocument,onCommit,onRecover,recoveryRequired=false}:Props){
 const [localDocument,setDocument]=useState(boardDocument);
 const document=committedDocument??localDocument;
 const [saving,setSaving]=useState(false);
 const inFlight=useRef(false);
 const [assessment,setAssessment]=useState('');
 const [criterion,setCriterion]=useState('');
 const [student,setStudent]=useState('');
 const [edit,setEdit]=useState<Edit|null>(null);
 const [state,setState]=useState<State|''>('');
 const [kind,setKind]=useState<EvidenceKind|''>('');
 const [description,setDescription]=useState('');
 const [method,setMethod]=useState('');
 const [interpretation,setInterpretation]=useState('');
 const [mode,setMode]=useState<''|'pending'|'level'|'description'>('');
 const [levelId,setLevelId]=useState('');
 const [reason,setReason]=useState('');
 const [review,setReview]=useState<Review|null>(null);
 const [message,setMessage]=useState('');
 const [serial,setSerial]=useState(()=>Math.max(1,...document.evidence.map(e=>Number(/^board-revision-(\d+)$/.exec(e.revisionId)?.[1]??0)+1)));
 const active=document.assessments.filter(a=>a.status==='completed'&&!document.assessments.some(x=>x.supersedesRevisionId===a.revisionId));
 const selected=active.find(a=>a.revisionId===assessment);
 const result=assessment&&criterion?projectEvidenceBoard(document,boardScope,assessment,criterion):null;
 const options=assessment&&criterion?listEvidenceInterpretationOptions(document,boardScope,assessment,criterion):null;
 const levels=options?.valid&&options.mode==='rubric'?options.levels:[];
 const level=levels.find(l=>l.levelId===levelId);
 const row=result?.valid?result.rows.find(r=>r.studentId===student):undefined;
 const name=(id:string)=>'Studente '+(boardScope.studentIds.indexOf(id)+1);
 function reset(){if(inFlight.current)return;setEdit(null);setReview(null);setMessage('');onDraftChange?.(false);}
 function begin(action:Edit['action'],previous?:IndividualEvidenceRevision){
   setEdit({studentId:student,action,previous});setReview(null);setMessage('');onDraftChange?.(true);
   setState(previous&&previous.state!=='withdrawn'?previous.state:'');
   setKind(previous?.state==='observed'?previous.fact.kind:'');
   setDescription(previous?.state==='observed'?previous.fact.description:'');
   setMethod(previous?.state==='observed'?previous.fact.method:'');
   setInterpretation(previous?.state==='observed'&&previous.interpretation.kind==='description'?previous.interpretation.description:'');
   setMode(previous?.state==='observed'?previous.interpretation.kind:'');
   setLevelId(previous?.state==='observed'&&previous.interpretation.kind==='level'?previous.interpretation.levelId:'');
   setReason('');
 }
 function prepare(){
   if(!edit||inFlight.current||recoveryRequired)return;
   const recordedAt=new Date(Math.max(Date.UTC(2026,10,22,10,serial),edit.previous?Date.parse(edit.previous.confirmedAt)+1:0)).toISOString();
   const revisionId='board-revision-'+serial;
   const choice=options?.valid?(mode==='pending'?{kind:'pending'}:mode==='level'&&options.mode==='rubric'&&level?{kind:'level',levelId:level.levelId}:mode==='description'&&options.mode==='descriptive'&&interpretation.trim()?{kind:'description',description:interpretation.trim()}:null):null;
   const observed=state==='observed'&&kind&&description.trim()&&method.trim()&&choice?
     {state,fact:{...(edit.previous?.state==='observed'?edit.previous.fact:{}),kind,description:description.trim(),method:method.trim()},interpretation:choice}:
     state==='not_observed'||state==='not_applicable'?{state}:null;
   if(edit.action!=='withdraw'&&!observed){setMessage('Seleziona lo stato e completa i campi richiesti.');return;}
   if(edit.action==='new'){
     const r=previewIndividualObservation(document,boardScope,{...observed,evidenceId:'board-evidence-'+serial,revisionId,observationEventId:'board-event-'+serial,assessmentRevisionId:assessment,criterionRevisionId:criterion,studentId:edit.studentId,observedOn:'2026-11-20',recordedAt});
     if(!r.valid){setMessage('Rilevazione non valida: '+r.issue);return;}setReview({kind:'new',value:r.preview});
   }else{
     const r=previewEvidenceRevision(document,boardScope,{evidenceRevisionId:edit.previous?.revisionId,revisionId,recordedAt,...(edit.action==='withdraw'?{action:'withdraw',reason:reason.trim()}:{action:'correct',...observed})});
     if(!r.valid){setMessage('Revisione non valida: '+r.issue);return;}setReview({kind:'revision',value:r.preview});
   }setMessage('');
 }
 async function confirm(){
   if(!review||!edit||inFlight.current||recoveryRequired)return;
   const confirmation={confirmedByTeacher:true,confirmedAt:new Date(Math.max(Date.UTC(2026,10,22,10,serial,30),Date.parse(review.value.request.recordedAt)+1)).toISOString()};
   if(onCommit){
    inFlight.current=true;setSaving(true);setMessage('');
    try{
     const request:EvidenceCommitRequest=review.kind==='new'?{kind:'new',preview:review.value}:{kind:'revision',preview:review.value};
     const receipt=await onCommit(request,confirmation);
     if(receipt.revisionId!==request.preview.request.revisionId||!receipt.document.evidence.some(e=>e.revisionId===receipt.revisionId))throw Error('Ricevuta non valida');
     setDocument(receipt.document);onDocumentChange?.(receipt.document);setSerial(n=>n+1);
     inFlight.current=false;reset();setMessage('Rilevazione salvata nell’archivio protetto.');
    }catch{setMessage('Salvataggio non confermato. La bozza è conservata. Riapri l’archivio prima di riprovare.');}
    finally{inFlight.current=false;setSaving(false);}
    return;
   }
   const r=review.kind==='new'?confirmIndividualObservation(document,boardScope,review.value,confirmation):confirmEvidenceRevision(document,boardScope,review.value,confirmation);
   if(!r.valid){setReview(null);setMessage('Conferma rifiutata: '+r.issue);return;}
   const next={...document,evidence:[...document.evidence,r.evidence]};setDocument(next);onDocumentChange?.(next);setSerial(n=>n+1);reset();setMessage('Confermato nella dimostrazione. Nessun dato salvato.');
 }
 const invalidate=()=>{if(inFlight.current)return;setReview(null);setMessage('');};
 async function recover(){
  if(!onRecover||inFlight.current)return;
  inFlight.current=true;setSaving(true);setMessage('');
  try{await onRecover();setMessage('Archivio riaperto. Verifica la bozza prima di confermare.');}
  catch{setMessage('Riapertura non riuscita. La bozza è conservata.');}
  finally{inFlight.current=false;setSaving(false);}
 }
 return <main className="mx-auto w-full max-w-xl min-w-0 p-2 space-y-3 [overflow-wrap:anywhere]">
  <h1 className="text-xl font-semibold">Tabellone Smart — evidenze</h1>
  <p className="text-sm">{onCommit?'Laboratorio protetto · Dati sintetici · Voti ordinari indipendenti':'Dimostrazione sintetica · Nessun archivio reale · Voti ordinari indipendenti'}</p>
  <label className="block">Prova<select aria-label="Prova" className={control} value={assessment} disabled={!!edit} onChange={e=>{setAssessment(e.target.value);setCriterion('');setStudent('');reset();}}><option value="">Seleziona prova</option>{active.map(a=><option key={a.revisionId} value={a.revisionId}>{a.title}</option>)}</select></label>
  <label className="block">Criterio<select aria-label="Criterio" className={control} value={criterion} disabled={!selected||!!edit} onChange={e=>{setCriterion(e.target.value);setStudent('');reset();}}><option value="">Seleziona criterio</option>{selected?.criteria.map(c=><option key={c.criterionRevisionId} value={c.criterionRevisionId}>{document.criteria.find(x=>x.revisionId===c.criterionRevisionId)?.description}</option>)}</select></label>
  {result&&!result.valid&&<p role="alert">Contesto non valido.</p>}
  {result?.valid&&<section aria-label="Righe studenti" className="space-y-1">
   {result.rows.map(r=><div key={r.studentId} className="grid grid-cols-2 gap-2 items-center border-b py-1 min-w-0">
    <button type="button" disabled={!!edit} className={button+' text-left'} aria-pressed={student===r.studentId} onClick={()=>{setStudent(r.studentId);reset();}}>{name(r.studentId)}</button>
    <div className="min-w-0">{r.entries.length?r.entries.map(e=><div key={e.revisionId}>{labels[e.state]}</div>):'Non registrato'}</div>
   </div>)}
  </section>}
  {row&&<section aria-label="Rilevazione individuale" className="border rounded p-2 space-y-2 min-w-0">
   <h2 className="font-semibold">{name(row.studentId)} — rilevazione individuale</h2>
   {!edit&&<>
    <button type="button" className={button} onClick={()=>begin('new')}>Nuova rilevazione</button>
    {onOpenStudentReport&&<button type="button" className={button+' ml-2'} onClick={()=>onOpenStudentReport(row.studentId)}>Apri scheda alunno</button>}
    {row.entries.map(e=><div key={e.revisionId} className="border-t py-2 space-y-1">
      <p>{labels[e.state]} · {e.observedOn}</p>
      {e.state==='observed'&&<><p>Fatto: {e.fact.description}</p><p>Interpretazione: {e.interpretation.kind==='pending'?'Da definire':e.interpretation.kind==='description'?e.interpretation.description:levels.find(l=>l.levelId===(e.interpretation.kind==='level'?e.interpretation.levelId:''))?.label??'Livello confermato'}</p></>}
      <div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={()=>begin('correct',e)}>Correggi</button><button type="button" className={button} onClick={()=>begin('withdraw',e)}>Ritira</button></div>
    </div>)}
   </>}
   {edit&&<fieldset disabled={saving||recoveryRequired} className="space-y-2 min-w-0">
    <h3>{edit.action==='new'?'Nuova rilevazione':edit.action==='correct'?'Correzione':'Ritiro motivato'}</h3>
    {edit.action==='withdraw'?<label className="block">Motivo del ritiro<textarea aria-label="Motivo del ritiro" className={control} value={reason} onChange={e=>{setReason(e.target.value);invalidate();}}/></label>:<>
     <label className="block">Stato<select aria-label="Stato" className={control} value={state} onChange={e=>{setState(e.target.value as State|'');invalidate();}}><option value="">Seleziona stato</option><option value="observed">Osservato</option><option value="not_observed">Non osservato</option><option value="not_applicable">Non pertinente</option></select></label>
     {state==='observed'&&<>
      <label className="block">Tipo di evidenza<select aria-label="Tipo di evidenza" className={control} value={kind} onChange={e=>{setKind(e.target.value as EvidenceKind|'');invalidate();}}><option value="">Seleziona tipo</option><option value="process">Processo</option><option value="product">Prodotto</option><option value="performance">Prestazione</option><option value="argumentation">Argomentazione</option></select></label>
      <label className="block">Fatto osservato<textarea aria-label="Fatto osservato" className={control} value={description} onChange={e=>{setDescription(e.target.value);invalidate();}}/></label>
      <label className="block">Metodo<input aria-label="Metodo" className={control} value={method} onChange={e=>{setMethod(e.target.value);invalidate();}}/></label>
      <label className="block">Interpretazione<select aria-label="Interpretazione" className={control} value={mode} onChange={e=>{setMode(e.target.value as typeof mode);setLevelId('');setInterpretation('');invalidate();}}><option value="">Seleziona interpretazione</option><option value="pending">Da definire</option>{options?.valid&&options.mode==='rubric'?<option value="level">Livello della rubrica</option>:options?.valid?<option value="description">Descrittiva</option>:null}</select></label>
      {mode==='level'&&<><label className="block">Livello<select aria-label="Livello" className={control} value={levelId} onChange={e=>{setLevelId(e.target.value);invalidate();}}><option value="">Seleziona livello</option>{levels.map(l=><option key={l.levelId} value={l.levelId}>{l.label}</option>)}</select></label>{level&&<p>{level.description}</p>}</>}
      {mode==='description'&&<label className="block">Interpretazione descrittiva<textarea aria-label="Interpretazione descrittiva" className={control} value={interpretation} onChange={e=>{setInterpretation(e.target.value);invalidate();}}/></label>}
     </>}
    </>}
    {!review?<button type="button" className={button} onClick={prepare}>Rivedi rilevazione</button>:<section aria-label="Riepilogo prima della conferma" className="border rounded p-2 space-y-1">
     <h3>Riepilogo prima della conferma</h3><p>{name(edit.studentId)} · {selected?.title} · {document.criteria.find(c=>c.revisionId===criterion)?.description}</p>
     {edit.action==='withdraw'?<p>Ritiro: {reason}</p>:<><p>{state&&labels[state]}</p>{state==='observed'&&<><p>Fatto: {description}</p><p>Metodo: {method}</p><p>Interpretazione: {mode==='level'?level?.label:mode==='description'?interpretation:'Da definire'}</p></>}</>}
     <button type="button" className={button} onClick={confirm}>Conferma rilevazione</button>
    </section>}
    <button type="button" className={button} onClick={reset}>Abbandona bozza</button>
   </fieldset>}
   {saving&&<p role="status">Operazione in corso…</p>}
   {recoveryRequired&&onRecover&&<button type="button" className={button} disabled={saving} onClick={recover}>Riapri archivio dimostrativo</button>}
  </section>}
  {message&&<p role={message.startsWith('Confermato')||message.startsWith('Rilevazione salvata')||message.startsWith('Archivio riaperto')?'status':'alert'}>{message}</p>}
 </main>;
}

