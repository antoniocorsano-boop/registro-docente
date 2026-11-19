import React, { useEffect, useId, useState } from 'react';
import { createUnifiedDocumentReview } from '../../documents/unifiedDocumentReview';
import './unifiedDocumentPreview.css';

type Result=ReturnType<typeof createUnifiedDocumentReview>;
type Review=Extract<Result,{valid:true}>['review'];
type Presentation=Review['presentation'];
const numberFormat=new Intl.NumberFormat('it-IT',{maximumFractionDigits:2});
const dateLabel=(value:string)=>value.split('-').reverse().join('/');
const stateLabels={available:'Disponibile',missing:'Non selezionata','review-required':'Da verificare'} as const;
const fields:Record<string,string>={objectives:'Obiettivi disciplinari',transversalObjectives:'Obiettivi trasversali',assessmentMethods:'Modalità di verifica',strategies:'Strategie didattiche'};
const primary='doc-preview-action doc-preview-primary';
const secondary='doc-preview-action doc-preview-secondary';

function SourceRow({label,source,kind}:{label:string;source:Presentation['curriculum'];kind:'curriculum'|'planning'|'recorded'}){
 const available=source.status==='available';
 const quantity=source.count===null?'':numberFormat.format(source.count);
 const unit=kind==='curriculum'?(source.count===1?'riferimento':'riferimenti'):kind==='planning'?'UDA':source.count===1?'registrazione':'registrazioni';
 const hours=source.hours===null?'':numberFormat.format(source.hours);
 return <li className="doc-preview-source">
  <div className="doc-preview-source-heading">
   <h2 className="doc-preview-source-title">{label}</h2>
   <span className="doc-preview-state">{stateLabels[source.status]}</span>
  </div>
  {available&&<p className="doc-preview-value">{quantity} {unit}{source.hours!==null?' · '+hours+' ore':''}</p>}
  {available&&kind==='planning'&&<p className="doc-preview-muted">UDA selezionate · ore programmate</p>}
  {available&&kind==='recorded'&&<p className="doc-preview-muted">Solo registrazioni selezionate</p>}
  {available&&kind==='curriculum'&&<p className="doc-preview-muted">Riferimenti annuali selezionati</p>}
  {source.status==='review-required'&&<p className="doc-preview-muted">Verifica la selezione prima di confermare.</p>}
  {source.status==='missing'&&<p className="doc-preview-muted">Nessuna informazione acquisita.</p>}

 </li>;
}

/** Laboratory view only; the input is a synthetic prepared selection, not a live archive. */
export function UnifiedDocumentPreview({input}:{input:unknown}){
 const titleId=useId();
 // A fresh input object signals replacement of the selection or context.
 const [snapshot,setSnapshot]=useState<{input:unknown;review:Review}|null>(null);
 const [confirmed,setConfirmed]=useState(false);
 const [notice,setNotice]=useState('');
 // isCurrent intentionally returns false for blocked reviews. Keep those
 // inspectable until the caller replaces the input, but never confirm them.
 const replaced=!!snapshot&&snapshot.input!==input;
 const stale=!!snapshot&&(replaced||(snapshot.review.presentation.canConfirm&&!snapshot.review.isCurrent(input)));
 const p=!stale?snapshot?.review.presentation:undefined;
 useEffect(()=>{
  if(stale){setSnapshot(null);setConfirmed(false);setNotice('Le informazioni sono cambiate. Prepara una nuova anteprima.');}
 },[stale]);
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
 return <section aria-labelledby={titleId} className="doc-preview">
  <header className="doc-preview-header">
   <p className="doc-preview-muted">Dimostrazione con dati fittizi</p>
   <h1 id={titleId} className="doc-preview-title">Documenti didattici</h1>
   {p&&<p className="doc-preview-muted">Anno scolastico {p.schoolYear}</p>}
   {p&&<p className="doc-preview-muted">Consuntivo: {dateLabel(p.periodStart)} – {dateLabel(p.periodEnd)}</p>}
  </header>
  {(stale||notice)&&<p role="status" className="doc-preview-notice">{stale?'Le informazioni sono cambiate. Prepara una nuova anteprima.':notice}</p>}
  {!p?<button type="button" className={primary} onClick={prepare}>Prepara anteprima</button>:<>
   <ul aria-label="Fonti documentali" className="doc-preview-sources">
    <SourceRow label="Curricolo" kind="curriculum" source={p.curriculum}/>
    <SourceRow label="Piano didattico" kind="planning" source={p.planning}/>
    <SourceRow label="Consuntivo" kind="recorded" source={p.recorded}/>
   </ul>
   <div className="doc-preview-disclosures">
    {[p.curriculum,p.planning,p.recorded].some(source=>source.status==='available')&&<details>
     <summary>Provenienza delle informazioni</summary>
     <ul aria-label="Provenienza delle fonti">
      {p.curriculum.status==='available'&&<li>Arena · annualità disciplinari selezionate</li>}
      {p.planning.status==='available'&&<li>Docente OS · UDA confermate e selezionate</li>}
      {p.recorded.status==='available'&&<li>Registro Docente · diario delle attività selezionate</li>}
     </ul>
    </details>}
    <details>
     <summary>Informazioni da completare ({p.unfilled.length})</summary>
     <ul>{p.unfilled.map(key=><li key={key}>{fields[key]}</li>)}</ul>
    </details>
   </div>
   <p className="doc-preview-muted">Documento incompleto. La conferma riguarda solo le informazioni disponibili.</p>
   {!p.canConfirm?<p className="doc-preview-muted">Seleziona o verifica le fonti prima di confermare.</p>:null}
   {!confirmed&&<button type="button" className={primary} disabled={!p.canConfirm} onClick={confirm}>Conferma la revisione</button>}
   <button type="button" className={secondary} onClick={restart}>Ricomincia</button>
  </>}
 </section>;
}
