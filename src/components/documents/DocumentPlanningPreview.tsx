import React, { useEffect, useState } from 'react';
import { createDocumentReview, type DocumentReview } from '../../documents/documentPresentation';

/** Synthetic-only: no production route, storage, network, export or school approval. */
export function DocumentPlanningPreview({context,template,sources}:{
  context:unknown;template:unknown;sources:unknown;
}) {
  const [review,setReview]=useState<DocumentReview|null>(null);
  const [confirmed,setConfirmed]=useState(false);
  const [notice,setNotice]=useState('');
  const current=!!review&&review.isCurrent(context,template,sources);
  useEffect(()=>{
    if(review&&!current){
      setReview(null);setConfirmed(false);
      setNotice('Le informazioni sono cambiate. Prepara una nuova anteprima.');
    }
  },[review,current]);
  const prepare=()=>{
    const result=createDocumentReview(context,template,sources);
    setConfirmed(false);
    if(!result.valid){setReview(null);setNotice('Anteprima non disponibile. Verifica le informazioni di partenza.');return;}
    setReview(result.review);setNotice('');
  };
  const confirm=()=>{
    if(!review||!review.isCurrent(context,template,sources)){
      setReview(null);setConfirmed(false);setNotice('Le informazioni sono cambiate. Prepara una nuova anteprima.');return;
    }
    setConfirmed(true);setNotice('Informazioni confermate nella dimostrazione. Nessun documento salvato o approvato.');
  };
  const presentation=current?review?.presentation:null;
  return <section aria-label="Anteprima documentale" className="mx-auto max-w-2xl min-w-0 space-y-4 p-3 sm:p-5">
    <header className="space-y-1">
      <p className="text-sm font-medium">Dimostrazione con dati fittizi</p>
      <h1 className="text-xl font-semibold break-words">Contributo alla progettazione del Consiglio di classe</h1>
      <p className="text-sm">Classe seconda · Tecnologia{presentation?' · '+presentation.schoolYear:''}</p>
    </header>
    {notice&&<p role="status" className="rounded-lg border p-3 break-words">{notice}</p>}
    {!presentation?<button type="button" onClick={prepare} className="w-full rounded-lg bg-slate-800 text-white px-4 py-3 font-medium">Prepara anteprima</button>:<>
      <p className="rounded-lg border p-3">{presentation.complete?'Campi obbligatori disponibili.':'Informazioni incomplete. I campi mancanti o da verificare non sono compilati.'}</p>
      <ul aria-label="Sezioni del contributo" className="divide-y rounded-lg border">
        {presentation.fields.map(row=><li key={row.label} className="min-w-0 p-3 space-y-1">
          <div className="flex flex-wrap items-baseline justify-between gap-1">
            <h2 className="font-semibold break-words">{row.label}</h2>
            <span className="text-sm font-medium">{row.status}</span>
          </div>
          {row.value!==null?<p className="break-words">{row.value}</p>:<p className="text-sm">Informazione non disponibile.</p>}
          {row.required&&row.status!=='Disponibile'&&<p className="text-sm">Campo necessario per completare il contributo.</p>}
          {row.source&&<details className="text-sm"><summary className="cursor-pointer py-1">Provenienza</summary><p>{row.source}</p></details>}
        </li>)}
      </ul>
      {!confirmed?<button type="button" onClick={confirm} className="w-full rounded-lg bg-slate-800 text-white px-4 py-3 font-medium">Conferma le informazioni</button>:
      <p className="rounded-lg border p-3 font-medium">Conferma della revisione, non del documento ufficiale.</p>}
      <button type="button" onClick={()=>{setReview(null);setConfirmed(false);setNotice('');}} className="w-full rounded-lg border px-4 py-3">Ricomincia</button>
    </>}
  </section>;
}
