import React,{useEffect,useRef,useState} from 'react';
import {createDocumentRecoveryDecision,type DocumentRecoveryDecision,type DocumentRecoveryDriver,
 type DocumentRecoveryPhase,type DocumentRecoveryReview as Review} from '../../security/documentRecoveryDecision';

/** DOC-01/D4c3e1: a human-readable, optional review surface.
 * The privileged DB2 owner must supply the workflow. This component neither
 * opens native files nor decrypts, authorizes or writes a user archive.
 */
export function DocumentRecoveryReview({workflow}:{workflow:DocumentRecoveryDriver}){
 const controllerRef=useRef<DocumentRecoveryDecision|null>(null);
 if(controllerRef.current===null)controllerRef.current=createDocumentRecoveryDecision(workflow);
 const [phase,setPhase]=useState<DocumentRecoveryPhase>('idle');
 const [summary,setSummary]=useState<Review|null>(null);
 const [acknowledged,setAcknowledged]=useState(false);
 const [phrase,setPhrase]=useState('');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const busyRef=useRef(false);
 const mounted=useRef(true);
 useEffect(()=>{
  mounted.current=true;
  return ()=>{
   mounted.current=false;
   const controller=controllerRef.current;
   if(controller&&['idle','preparing','prepared'].includes(controller.phase())){
    try{controller.cancel();}catch{/* a completed commit is not undone */}
   }
  };
 },[]);
 const update=(next:DocumentRecoveryPhase,msg='')=>{
  if(!mounted.current)return;
  setPhase(next);setMessage(msg);
 };
 async function prepare(){
  if(busyRef.current)return;
  busyRef.current=true;setBusy(true);setMessage('');
  try{
   const safe=await controllerRef.current!.prepare();
   if(mounted.current){setSummary(safe);setAcknowledged(false);setPhrase('');update('prepared');}
  }catch{
   update(controllerRef.current!.phase(),'La copia non è verificabile. Nessun recupero è stato autorizzato.');
  }finally{busyRef.current=false;if(mounted.current)setBusy(false);}
 }
 function cancel(){
  if(busyRef.current)return;
  try{
   controllerRef.current!.cancel();
   setSummary(null);setPhrase('');setAcknowledged(false);
   update('cancelled','Operazione annullata. Nessun recupero è stato eseguito.');
  }catch{update(controllerRef.current!.phase(),'Non ripetere il ripristino automaticamente.');}
 }
 async function confirm(){
  if(busyRef.current||!acknowledged||phrase!=='RIPRISTINA')return;
  busyRef.current=true;setBusy(true);setMessage('');
  try{
   await controllerRef.current!.confirm({accepted:acknowledged,phrase});
   setSummary(null);setPhrase('');setAcknowledged(false);
   update('verification-required','La sostituzione è stata richiesta. Non è ancora una conferma di recupero riuscito.');
  }catch{
   update(controllerRef.current!.phase(),
    'Esito del recupero non verificato. Non ripetere il ripristino automaticamente. Blocca il Registro e verifica i dati.');
  }finally{busyRef.current=false;if(mounted.current)setBusy(false);}
 }
 async function verify(){
  if(busyRef.current)return;
  busyRef.current=true;setBusy(true);
  try{
   const success=await controllerRef.current!.verifyAfterReopen();
   update(controllerRef.current!.phase(),success?
    'Recupero confermato dopo una nuova apertura autenticata e verifica dei dati.':
    'Esito del recupero non verificato. Non ripetere il ripristino automaticamente.');
  }catch{
   update(controllerRef.current!.phase(),'Esito incerto. Non ripetere il ripristino automaticamente.');
  }finally{busyRef.current=false;if(mounted.current)setBusy(false);}
 }
 return <section aria-label="Recupero documentale protetto" className="rounded-xl border border-slate-600 bg-slate-900/80 p-4 text-slate-100 space-y-3">
  <h3 className="text-base font-semibold">Recupero della documentazione</h3>
  <p className="text-sm leading-6 text-slate-300">
   Il recupero richiede una copia cifrata verificata e una conferma specifica. Le revisioni precedenti, le valutazioni e i voti devono restare conservati.
  </p>
  {phase==='idle'&&
   <button type="button" disabled={busy} onClick={()=>void prepare()}
    className="min-h-11 rounded-lg bg-cyan-700 px-4 font-semibold disabled:opacity-50">Esamina il recupero</button>}
  {(phase==='preparing'||busy)&&<p role="status" className="text-sm text-slate-300">Verifica locale in corso…</p>}
  {phase==='prepared'&&summary&&<div className="space-y-3">
   <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2" aria-label="Riepilogo del recupero">
    <div className="rounded-lg border border-slate-700 p-3"><dt className="text-slate-400">Revisioni già presenti</dt><dd className="text-lg font-semibold">{summary.eventsBefore}</dd></div>
    <div className="rounded-lg border border-slate-700 p-3"><dt className="text-slate-400">Revisioni nella copia proposta</dt><dd className="text-lg font-semibold">{summary.eventsAfter}</dd></div>
    <div className="rounded-lg border border-slate-700 p-3"><dt className="text-slate-400">Valutazioni e voti</dt><dd className="font-semibold">Conservati</dd></div>
    <div className="rounded-lg border border-slate-700 p-3"><dt className="text-slate-400">Copia di recupero corrente</dt><dd className="font-semibold">Verificata</dd></div>
   </dl>
   <p className="text-xs text-slate-300">Questa anteprima non modifica i dati. Confermando, l’archivio locale verrà sostituito. Dopo il recupero sarà necessaria una nuova apertura del Registro.</p>
   <label className="flex items-start gap-2 text-sm">
    <input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)}
     className="mt-1 h-4 w-4 accent-cyan-600"/>
    <span>Ho compreso che l’archivio sarà sostituito soltanto dopo la mia conferma.</span>
   </label>
   <label className="block text-sm font-semibold" htmlFor="doc01-v8-consent">Per confermare, scrivi RIPRISTINA</label>
   <input id="doc01-v8-consent" type="text" autoComplete="off" value={phrase}
    onChange={e=>setPhrase(e.target.value)} className="min-h-11 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 text-white"/>
   <div className="flex flex-wrap gap-2">
    <button type="button" onClick={cancel} disabled={busy} className="min-h-11 rounded-lg border border-slate-500 px-4">Annulla</button>
    <button type="button" disabled={busy||!acknowledged||phrase!=='RIPRISTINA'} onClick={()=>void confirm()}
     className="min-h-11 rounded-lg bg-cyan-700 px-4 font-semibold disabled:cursor-not-allowed disabled:opacity-40">Conferma recupero</button>
   </div>
  </div>}
  {phase==='verification-required'&&
   <div className="space-y-3">
    <p className="text-sm text-amber-200">Non è ancora una conferma di recupero riuscito: serve la verifica dopo la riapertura autenticata del Registro.</p>
    <button type="button" disabled={busy} onClick={()=>void verify()} className="min-h-11 rounded-lg bg-cyan-700 px-4 font-semibold">Verifica dopo il nuovo accesso</button>
   </div>}
  {phase==='completed'&&<p className="text-sm text-emerald-200">Archivio riaperto e verificato.</p>}
  {(phase==='cancelled'||phase==='uncertain')&&
   <p className="text-sm text-slate-300">{phase==='uncertain'?
     'Non ripetere il ripristino automaticamente. Verifica la situazione dopo un nuovo accesso.':
     'Nessuna modifica autorizzata.'}</p>}
  {message&&<p aria-live="polite" role="status" className="text-sm leading-6 text-slate-200">{message}</p>}
 </section>;
}
