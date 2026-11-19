/** VAL-01/S5c — isolated preparation UI. Synthetic host only; no persistence. */
import React,{useId,useState,useRef,useEffect} from 'react';
import type {AssessmentEvidenceV1,AssessmentScopeV1,AssessmentDefinitionRevision,EvidenceKind} from '../assessment/assessmentEvidence';
import {listAssessmentPreparationOptions} from '../assessment/assessmentPreparationOptions';
import {previewAssessmentDefinition,confirmAssessmentDefinition} from '../assessment/assessmentDefinitionPreparation';
import type {AssessmentPreparationPreview} from '../assessment/assessmentDefinitionPreparation';

interface Props{
  document:AssessmentEvidenceV1; scope:AssessmentScopeV1; classLabel:string; activityLabel:string;
  activityId:string;assessmentId:string;revisionId:string; onExit:()=>void;
  confirmationTime:()=>string; onConfirmed:(definition:AssessmentDefinitionRevision)=>void;
}
type Choice={rubric:string;kind:EvidenceKind|'';description:string;method:string};
const emptyChoice=():Choice=>({rubric:'',kind:'',description:'',method:''});
const field='neon-input block box-border min-h-[48px] w-full min-w-0 max-w-full rounded-lg px-[8px] py-[8px] text-base';
const button='min-h-[48px] w-full min-w-0 max-w-full rounded-lg border border-[var(--border)] px-[8px] py-[8px] whitespace-normal [overflow-wrap:anywhere] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:opacity-50';
const kinds=[['process','Processo'],['product','Prodotto'],['performance','Prestazione'],['argumentation','Argomentazione']] as const;
const purposes=[['diagnostic','Diagnostica'],['formative','Formativa'],['summative','Sommativa']] as const;
const issueText:Record<string,string>={INVALID_DOCUMENT:'Il contesto valutativo non è disponibile.',INVALID_REQUEST:'Completa tutti i campi richiesti e seleziona almeno un criterio.',EXISTING_ACTIVITY:'Questa attività è già configurata.',CONFLICT:'Identità della prova già utilizzata.',UNAVAILABLE_SELECTION:'Un riferimento non è più disponibile. Rivedi i criteri.',STALE_PREVIEW:'I riferimenti sono cambiati. Rivedi la configurazione.',INVALID_CONFIRMATION:'Conferma non valida. Rivedi la configurazione.'};
function contextKey(p:Props){return JSON.stringify([p.scope.classId,p.scope.schoolYear,p.scope.subjectCode,p.activityId,p.assessmentId,p.revisionId]);}
export function AssessmentPreparationPanel(p:Props){
  const prefix=useId(),original=useRef(contextKey(p));
  const [title,setTitle]=useState(''),[date,setDate]=useState(''),[period,setPeriod]=useState(''),[purpose,setPurpose]=useState('');
  const [choices,setChoices]=useState<Record<string,Choice>>({});
  const [review,setReview]=useState<AssessmentPreparationPreview|null>(null);
  const [confirmed,setConfirmed]=useState<AssessmentDefinitionRevision|null>(null);
  const [error,setError]=useState(''),[cancel,setCancel]=useState(false);
  const reviewHeading=useRef<HTMLHeadingElement>(null), errorRef=useRef<HTMLParagraphElement>(null), confirmedHeading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{if(review)reviewHeading.current?.focus();},[review]);
  useEffect(()=>{if(error)errorRef.current?.focus();},[error]);
  useEffect(()=>{if(confirmed)confirmedHeading.current?.focus();},[confirmed]);
  const options=listAssessmentPreparationOptions(p.document,p.scope,p.activityId);
  const changed=original.current!==contextKey(p);
  const dirty=!!(title||date||period||purpose||Object.keys(choices).length||review);
  const invalidate=()=>{setReview(null);setError('');};
  const change=(setter:(v:string)=>void,v:string)=>{setter(v);invalidate();};
  const toggle=(id:string,checked:boolean)=>{setChoices(old=>{const next={...old};if(checked)next[id]=emptyChoice();else delete next[id];return next;});invalidate();};
  const edit=(id:string,patch:Partial<Choice>)=>{setChoices(old=>({...old,[id]:{...old[id],...patch}}));invalidate();};
  const exit=()=>{if(dirty&&!confirmed)setCancel(true);else p.onExit();};
  const request=()=>({activityId:p.activityId,assessmentId:p.assessmentId,revisionId:p.revisionId,date,period,title,purpose,
    criteria:Object.entries(choices).map(([criterionRevisionId,c])=>({criterionRevisionId,...(c.rubric?{rubricRevisionId:c.rubric}:{}),expected:{kind:c.kind,description:c.description,method:c.method}}))});
  function preview(e:React.FormEvent){e.preventDefault();const result=previewAssessmentDefinition(p.document,p.scope,request());if(!result.valid){setError(issueText[result.issue]);setReview(null);return;}setReview(result.preview);setError('');}
  function confirm(){if(!review||changed||confirmed)return;const result=confirmAssessmentDefinition(p.document,p.scope,review,{confirmedByTeacher:true,confirmedAt:p.confirmationTime()});if(!result.valid){setError(issueText[result.issue]);setReview(null);return;}setConfirmed(result.definition);setReview(null);setError('');p.onConfirmed(result.definition);}
  return <section aria-labelledby={prefix+'title'} className="mx-auto w-full max-w-xl min-w-0 space-y-4 [overflow-wrap:anywhere] p-[8px] text-[var(--text-main)]">
    <header className="space-y-2">
      <button type="button" className={button} onClick={exit}>Indietro</button>
      <p className="text-sm text-[var(--text-muted)]">{p.classLabel} · {p.activityLabel}</p>
      <h1 id={prefix+'title'} className="text-xl font-semibold">Obiettivi e criteri</h1>
      <p className="text-sm text-[var(--text-muted)]">Dimostrazione: nessun dato viene salvato.</p>
    </header>
    {cancel?<div role="alert" className="neon-card min-w-0 max-w-full space-y-2 p-[8px]"><p>Abbandonare la configurazione non confermata?</p><button type="button" className={button} onClick={p.onExit}>Abbandona bozza</button><button type="button" className={button} onClick={()=>setCancel(false)}>Continua configurazione</button></div>:
    changed?<div role="alert" className="space-y-2"><p>Il contesto è cambiato. La bozza non può essere confermata.</p><button type="button" className={button} onClick={()=>setCancel(true)}>Abbandona bozza</button></div>:
    confirmed?<div role="status" className="neon-card min-w-0 max-w-full space-y-2 p-[8px]"><h2 ref={confirmedHeading} tabIndex={-1} className="font-semibold">Configurazione confermata nella dimostrazione</h2><p>{confirmed.title}</p><p>Attività pianificata · {confirmed.criteria.length} criteri</p><p>Nessun dato salvato.</p></div>:
    !options.valid?<p role="alert">{issueText[options.issue]||'Contesto non disponibile.'}</p>:
    options.existing?<p role="alert">Questa attività è già configurata. Nessun duplicato verrà creato.</p>:
    <form onSubmit={preview} className="min-w-0 max-w-full space-y-4" noValidate>
      <div className="neon-card min-w-0 max-w-full space-y-3 p-[8px]">
        <label className="block">Titolo<input className={field} value={title} onChange={e=>change(setTitle,e.target.value)}/></label>
        <label className="block">Data<input type="date" className={field+' [&::-webkit-datetime-edit]:min-w-0 [&::-webkit-datetime-edit]:p-0 [&::-webkit-calendar-picker-indicator]:m-0 [&::-webkit-calendar-picker-indicator]:p-0'} value={date} onChange={e=>change(setDate,e.target.value)}/></label>
        <div><label htmlFor={prefix+'period'} className="block">Periodo</label><select id={prefix+'period'} className={field} value={period} onChange={e=>change(setPeriod,e.target.value)}><option value="">Seleziona</option><option value="Q1">Primo periodo</option><option value="Q2">Secondo periodo</option></select></div>
        <div><label htmlFor={prefix+'purpose'} className="block">Finalità</label><select id={prefix+'purpose'} className={field} value={purpose} onChange={e=>change(setPurpose,e.target.value)}><option value="">Seleziona</option>{purposes.map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></div>
      </div>
      <fieldset className="w-full min-w-0 max-w-full space-y-3"><legend className="mb-2 max-w-full whitespace-normal [overflow-wrap:anywhere] font-semibold">Criteri della prova</legend>
        {!options.criteria.length&&<p>Nessun criterio disponibile.</p>}
        {options.criteria.map(c=>{const id=c.criterionRevisionId,choice=Object.prototype.hasOwnProperty.call(choices,id)?choices[id]:undefined;return <div key={id} className="neon-card min-w-0 max-w-full space-y-3 p-[8px]">
          <label className="flex min-h-[48px] items-center gap-[8px]"><input type="checkbox" className="h-5 w-5 shrink-0" checked={!!choice} onChange={e=>toggle(id,e.target.checked)}/><span className="min-w-0 [overflow-wrap:anywhere]">{c.description}</span></label>
          <div className="text-sm text-[var(--text-muted)]">{c.targets.map(t=><p key={t.revisionId}>{t.text} · Fonte locale {t.sourceVersion}</p>)}</div>
          {choice&&<div className="space-y-3">
            <div><label htmlFor={prefix+id+'-rubric'} className="block">Rubrica (facoltativa)</label><select id={prefix+id+'-rubric'} className={field} value={choice.rubric} onChange={e=>edit(id,{rubric:e.target.value})}><option value="">Nessuna</option>{c.rubrics.map(r=><option key={r.rubricRevisionId} value={r.rubricRevisionId}>{r.levels.map(l=>l.label).join(' / ')}</option>)}</select></div>
            <div><label htmlFor={prefix+id+'-kind'} className="block">Tipo di evidenza</label><select id={prefix+id+'-kind'} className={field} value={choice.kind} onChange={e=>edit(id,{kind:e.target.value as Choice['kind']})}><option value="">Seleziona</option>{kinds.map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></div>
            <label className="block">Evidenza attesa<textarea className={field} value={choice.description} onChange={e=>edit(id,{description:e.target.value})}/></label>
            <label className="block">Metodo<input className={field} value={choice.method} onChange={e=>edit(id,{method:e.target.value})}/></label>
          </div>}
        </div>;})}
      </fieldset>
      {Object.keys(choices).some(id=>!options.criteria.some(c=>c.criterionRevisionId===id))&&<div role="alert" className="space-y-2"><p>Alcuni criteri selezionati non sono più disponibili.</p><button type="button" className={button} onClick={()=>{setChoices(old=>Object.fromEntries(Object.entries(old).filter(([id])=>options.criteria.some(c=>c.criterionRevisionId===id))));invalidate();}}>Rimuovi i criteri non disponibili</button></div>}
      {error&&<p ref={errorRef} tabIndex={-1} role="alert" className="text-[var(--warning)]">{error}</p>}
      <button type="submit" className={button+' neon-btn-primary'}>Rivedi configurazione</button>
      {review&&<section aria-label="Riepilogo prima della conferma" className="neon-card min-w-0 max-w-full space-y-3 p-[8px]"><h2 ref={reviewHeading} tabIndex={-1} className="font-semibold">Riepilogo prima della conferma</h2><p>{review.request.title} · {review.request.date}</p><p>{review.request.period==='Q1'?'Primo periodo':'Secondo periodo'} · {purposes.find(([v])=>v===review.request.purpose)?.[1]}</p>
        {review.selected.map((c,i)=><div key={c.criterionRevisionId} className="space-y-1"><p className="font-semibold">{c.description}</p>{c.targets.map(t=><p key={t.revisionId}>{t.text}</p>)}<p>{kinds.find(([v])=>v===review.request.criteria[i].expected.kind)?.[1]}: {review.request.criteria[i].expected.description} · {review.request.criteria[i].expected.method}</p>{!c.rubric&&<p>Nessuna rubrica</p>}{c.rubric?.levels.map(l=><p key={l.levelId}>{l.label}: {l.description}</p>)}</div>)}
        <button type="button" className={button+' neon-btn-primary'} onClick={confirm}>Conferma configurazione</button>
      </section>}
    </form>}
  </section>;
}
