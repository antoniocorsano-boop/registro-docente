import React, { useId, useState } from 'react';
import { createUnifiedDocumentReview } from '../../documents/unifiedDocumentReview';

type Result=ReturnType<typeof createUnifiedDocumentReview>;
type Review=Extract<Result,{valid:true}>['review'];
type Presentation=Review['presentation'];
const numberFormat=new Intl.NumberFormat('it-IT',{maximumFractionDigits:2});
const dateLabel=(value:string)=>value.split('-').reverse().join('/');
const stateLabels={available:'Disponibile',missing:'Non selezionata','review-required':'Da verificare'} as const;
const fields:Record<string,string>={objectives:'Obiettivi disciplinari',transversalObjectives:'Obiettivi trasversali',assessmentMethods:'Modalità di verifica',strategies:'Strategie didattiche'};
const primary='min-h-11 w-full rounded-xl bg-slate-100 px-4 py-3 font-semibold text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed';
const secondary='min-h-11 w-full rounded-xl border border-slate-600 px-3 py-2 font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-400';

function SourceRow({label,source,kind,origin}:{label:string;source:Presentation['curriculum'];kind:'curriculum'|'planning'|'recorded';origin:string}){
 const available=source.status==='available';
 const quantity=source.count===null?'':numberFormat.format(source.count);
 const unit=kind==='curriculum'?(source.count===1?'riferimento':'riferimenti'):kind==='planning'?'UDA':source.count===1?'registrazione':'registrazioni';
 const hours=source.hours===null?'':numberFormat.format(source.hours);
 return <li className="min-w-0 space-y-1 px-3 py-3">
  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
   <h2 className="font-semibold text-base break-words">{label}</h2>
   <span className="text-sm font-medium text-slate-300">{stateLabels[source.status]}</span>
  </div>
  {available&&<p className="text-lg font-semibold tabular-nums break-words">{quantity} {unit}{source.hours!==null?' · '+hours+' ore':''}</p>}
  {available&&kind==='planning'&&<p className="text-sm text-slate-300">UDA selezionate · ore programmate</p>}
  {available&&kind==='recorded'&&<p className="text-sm text-slate-300">Solo registrazioni selezionate</p>}
  {available&&kind==='curriculum'&&<p className="text-sm text-slate-300">Riferimenti annuali selezionati</p>}
  {source.status==='review-required'&&<p className="text-sm">Verifica la selezione prima di confermare.</p>}
  {source.status==='missing'&&<p className="text-sm text-slate-300">Nessuna informazione acquisita.</p>}
  {available&&<details className="text-sm text-slate-300">
   <summary className="cursor-pointer min-h-11 flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-cyan-400"><span aria-hidden="true">▸</span> Provenienza</summary>
   <p className="break-words pb-1">{origin}</p>
  </details>}
 </li>;
}

/** Laboratory view only; the input is a synthetic prepared selection, not a live archive. */
export function UnifiedDocumentPreview({input}:{input:unknown}){
 const titleId=useId();
 // A fresh input object signals replacement of the selection or context.
 // A keyed child in the fixture also remounts on explicit source changes.
 const [snapshot,setSnapshot]=useState<{input:unknown;review:Review}|null>(null);
 const [confirmed,setConfirmed]=useState(false);
 const [notice,setNotice]=useState('');
 // isCurrent intentionally returns false for blocked reviews. Keep those
 // inspectable until the caller replaces the input, but never confirm them.
 const replaced=!!snapshot&&snapshot.input!==input;
 const stale=!!snapshot&&(replaced||(snapshot.review.presentation.canConfirm&&!snapshot.review.isCurrent(input)));
 const p=!stale?snapshot?.review.presentation:undefined;
 const prepare=()=>{
  const result=createUnifiedDocumentReview(input);setConfirmed(false);
  if(!result.valid){setSnapshot(null);setNotice('Anteprima non disponibile. Verifica classe e periodo.');return;}
  setSnapshot({input,review:result.review});setNotice('');
 };
 const confirm=()=>{
  if(!snapshot||stale||!snapshot.review.confirm(input).valid){
   setConfirmed(false);setSnapshot(null);setNotice('Le informazioni sono cambiate. Prepara una nuova anteprima.');return;
  }
  setConfirmed(true);setNotice('Revisione confermata. Nessun documento salvato o approvato.');
 };
 const restart=()=>{setSnapshot(null);setConfirmed(false);setNotice('');};
 return <section aria-labelledby={titleId} className="mx-auto max-w-xl min-w-0 space-y-3 p-3 sm:p-5 break-words">
  <header className="space-y-1">
   <p className="text-sm text-slate-300">Dimostrazione con dati fittizi</p>
   <h1 id={titleId} className="text-xl font-semibold">Documentazione didattica</h1>
   {p&&<p className="text-sm text-slate-300">Anno scolastico {p.schoolYear}</p>}
   {p&&<p className="text-sm text-slate-300">Consuntivo: {dateLabel(p.periodStart)} – {dateLabel(p.periodEnd)}</p>}
  </header>
  {(stale||notice)&&<p role="status" className="rounded-xl border border-slate-600 p-3 text-sm">{stale?'Le informazioni sono cambiate. Prepara una nuova anteprima.':notice}</p>}
  {!p?<button type="button" className={primary} onClick={prepare}>Prepara anteprima</button>:<>
   <ul aria-label="Fonti documentali" className="divide-y divide-slate-700 rounded-xl border border-slate-700 bg-slate-900/40">
    <SourceRow label="Curricolo" kind="curriculum" source={p.curriculum} origin="Arena · annualità disciplinari selezionate"/>
    <SourceRow label="Programmazione" kind="planning" source={p.planning} origin="Docente OS · UDA confermate e selezionate"/>
    <SourceRow label="Consuntivo" kind="recorded" source={p.recorded} origin="Registro Docente · diario delle attività selezionate"/>
   </ul>
   <details className="rounded-xl border border-slate-700 px-3 py-2">
    <summary className="cursor-pointer min-h-11 flex flex-wrap items-center gap-x-2 font-semibold focus-visible:outline-2 focus-visible:outline-cyan-400"><span aria-hidden="true">▸</span> Informazioni da completare ({p.unfilled.length})</summary>
    <ul className="list-disc pl-6 pb-2 space-y-1 text-sm">{p.unfilled.map(key=><li key={key}>{fields[key]}</li>)}</ul>
   </details>
   <p className="text-sm text-slate-300">Documento incompleto. La conferma riguarda solo le informazioni disponibili.</p>
   {!p.canConfirm?<p className="text-sm font-medium">Seleziona o verifica le fonti prima di confermare.</p>:null}
   {!confirmed&&<button type="button" className={primary} disabled={!p.canConfirm} onClick={confirm}>Conferma la revisione</button>}
   <button type="button" className={secondary} onClick={restart}>Ricomincia</button>
  </>}
 </section>;
}
