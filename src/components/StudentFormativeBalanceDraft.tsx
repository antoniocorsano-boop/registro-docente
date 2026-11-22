import React,{useEffect,useRef,useState} from 'react';
import type {AppSettings,ClassData} from '../types';
import type {FormativeSourceRow} from '../assessment/studentFormativeSourceReadModel';
import {loadStudentFormativeReviewSource} from '../assessment/studentFormativeReviewSource';
import {prepareFormativeBalance,confirmFormativeBalance,type FormativeBalancePreview,
  type FormativeBalanceRequest,type FormativeBalanceContext} from '../assessment/formativeBalance';
import {projectFormativeRestitution} from '../assessment/formativeRestitutionProjection';

/** S7a/S7b in the real dossier, session-only. No persistence, export, grade,
 * competence inference, automatic selection or institutional confirmation.
 * The educator authors and approves every text; confirmation is explicitly
 * transient until a separate durable encrypted-record contract is qualified.
 */
const blank=()=>({learning:'',progress:'',nextStep:''});
const states={observed:'Osservato',not_observed:'Non osservato',not_applicable:'Non pertinente'};
const field='neon-input w-full min-h-[44px] p-2 min-w-0 max-w-full';
const btn='min-h-[44px] rounded-lg border border-[var(--border)] px-3 py-2 font-medium text-sm max-w-full break-words';
interface Props {
 currentClass:ClassData;settings?:AppSettings;studentId:string;
 period:'Q1'|'Q2';from:string;to:string;rows:readonly FormativeSourceRow[];
}
type Reviewed={preview:FormativeBalancePreview;classRef:ClassData;contextKey:string};
export function StudentFormativeBalanceDraft({currentClass,settings,studentId,period,from,to,rows}:Props){
 const [selected,setSelected]=useState<string[]>([]);
 const [earlier,setEarlier]=useState(''),[later,setLater]=useState('');
 const [teacherText,setTeacherText]=useState(blank);
 const [review,setReview]=useState<Reviewed|null>(null);
 const [confirmed,setConfirmed]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const seq=useRef(0),running=useRef(false),alive=useRef(true);
 const current=useRef({currentClass,studentId,period,from,to,year:settings?.year,subject:settings?.subject});
 current.current={currentClass,studentId,period,from,to,year:settings?.year,subject:settings?.subject};
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;seq.current++;};},[]);
 useEffect(()=>{seq.current++;setSelected([]);setEarlier('');setLater('');
   setReview(null);setConfirmed(false);setError('');},[currentClass,studentId,period,from,to,settings?.year,settings?.subject]);
 const contextKey=JSON.stringify([currentClass.id,settings?.year,settings?.subject,studentId,period,from,to]);
 const visible=review&&review.classRef===currentClass&&review.contextKey===contextKey?
   projectFormativeRestitution(review.preview):null;
 const selectedObserved=rows.filter(r=>r.state==='observed'&&selected.includes(r.evidenceRevisionId));
 const context:FormativeBalanceContext={classId:currentClass.id,schoolYear:settings?.year??'',
   subjectCode:reviewSubject(settings),studentId,period,from,to};
 function invalidate(){seq.current++;setReview(null);setConfirmed(false);setError('');}
 function reset(){if(running.current)return;invalidate();setSelected([]);setEarlier('');setLater('');setTeacherText(blank);}
 function unchanged(epoch:number,owner:ClassData){const now=current.current;
   return alive.current&&seq.current===epoch&&now.currentClass===owner&&now.studentId===studentId&&
      now.period===period&&now.from===from&&now.to===to&&now.year===settings?.year&&now.subject===settings?.subject;}
 function request():FormativeBalanceRequest{return {evidenceRevisionIds:[...selected],
   comparisons:earlier&&later?[{earlierRevisionId:earlier,laterRevisionId:later}]:[],
   teacherText:{...teacherText}};}
 async function prepare(){
   if(running.current)return;
   if(!selected.length){setError('Seleziona almeno una evidenza.');return;}
   if(Boolean(earlier)!==Boolean(later)){setError('Indica entrambe le osservazioni per il confronto.');return;}
   const epoch=++seq.current,owner=currentClass,ctx=context,req=request();
   running.current=true;setBusy(true);setReview(null);setConfirmed(false);setError('');
   try{
     const input=loadStudentFormativeReviewSource(owner,settings,studentId,period,from,to);
     if(input.status!=='ready'){if(unchanged(epoch,owner))setError('Fonti o contesto non verificabili.');return;}
     const result=await prepareFormativeBalance(input.document,input.scope,ctx,req);
     if(!unchanged(epoch,owner))return;
     if(!result.valid){setError(result.issue==='NO_SOURCES'?'Il testo richiede evidenze osservate.':
       result.issue==='INVALID_COMPARISON'?'Il progresso richiede due osservazioni confrontabili.':
       'Rivedi la scelta delle fonti e il periodo.');return;}
     setReview({preview:result.preview,classRef:owner,contextKey});
   }catch{if(unchanged(epoch,owner))setError('Riesame non disponibile.');}
   finally{running.current=false;if(alive.current)setBusy(false);}
 }
 async function confirm(){
   if(running.current||!review||!visible||confirmed)return;
   const epoch=++seq.current,owner=currentClass;
   running.current=true;setBusy(true);setError('');
   try{
     const input=loadStudentFormativeReviewSource(owner,settings,studentId,period,from,to);
     if(input.status!=='ready'){if(unchanged(epoch,owner)){setReview(null);setError('Fonti non più verificabili.');}return;}
     const result=await confirmFormativeBalance(input.document,input.scope,context,review.preview,
       {confirmedByTeacher:true,confirmedAt:new Date().toISOString()});
     if(!unchanged(epoch,owner))return;
     if(!result.valid){setReview(null);setConfirmed(false);setError('Evidenze cambiate o conferma non valida: ripeti il riesame.');return;}
     // The confirmed result is deliberately NOT stored, transferred or exported.
     setConfirmed(true);
   }catch{if(unchanged(epoch,owner)){setReview(null);setError('Conferma locale non disponibile.');}}
   finally{running.current=false;if(alive.current)setBusy(false);}
 }
 return <section data-testid="student-formative-review" aria-label="Bozza del bilancio formativo"
   className="min-w-0 rounded-lg border border-[var(--border)] p-3 space-y-3 [overflow-wrap:anywhere]">
   <h4 className="font-semibold text-slate-100">Prepara il bilancio formativo</h4>
   <p className="text-xs text-slate-400">Solo sessione. Le parole sono del docente. Nessun voto, salvataggio, invio, esportazione o certificazione.</p>
   {visible?<section aria-label="Anteprima del bilancio per il destinatario" className="space-y-2 border rounded-lg p-3 min-w-0">
     <h5 className="font-semibold">Anteprima per il destinatario</h5>
     <p>{visible.period==='Q1'?'Primo periodo':'Secondo periodo'} · {visible.from} — {visible.to}</p>
     {visible.sources.map((s,i)=><div className="border-t pt-2 space-y-1" key={i}>
       <p>{s.date} · {s.activity}</p><p>{s.criterion} · {states[s.state]}</p>
       {s.objectives.map((o,j)=><p key={j}>Obiettivo: {o}</p>)}
     </div>)}
     {([['learning','Apprendimenti'],['progress','Progresso documentato'],['nextStep','Prossimo passo']] as const)
       .map(([k,label])=>visible.teacherText[k].trim()?
         <div key={k}><h6 className="font-semibold">{label}</h6><p className="whitespace-pre-wrap">{visible.teacherText[k]}</p></div>:null)}
     <p className="text-xs text-slate-400">Verifica che il testo non contenga dati riservati o di altri studenti.</p>
     {confirmed?<p role="status">Riesame confermato soltanto in questa sessione. Non salvato né inviato.</p>:
       <button type="button" className={btn} disabled={busy} onClick={()=>void confirm()}>Conferma riesame locale</button>}
     <button type="button" className={btn} disabled={busy} onClick={invalidate}>Modifica bozza</button>
   </section>:<fieldset disabled={busy} className="space-y-3 min-w-0">
     <legend className="text-sm font-semibold">Seleziona le fonti e scrivi il testo</legend>
     <div className="space-y-1 max-h-80 overflow-y-auto" role="group" aria-label="Evidenze selezionabili">
       {rows.map(row=><label key={row.evidenceRevisionId} className="flex gap-2 items-start border-b border-[var(--border)] py-2 min-w-0">
         <input type="checkbox" className="mt-1 shrink-0" checked={selected.includes(row.evidenceRevisionId)}
           onChange={e=>{invalidate();setSelected(ids=>e.target.checked?[...ids,row.evidenceRevisionId]:
             ids.filter(id=>id!==row.evidenceRevisionId));setEarlier('');setLater('');}}/>
         <span className="text-xs min-w-0 break-words">{row.observedOn} · {row.assessmentTitle} · {row.criterionDescription} · {states[row.state]}</span>
       </label>)}
     </div>
     <p className="text-xs text-slate-400">{selected.length} fonti scelte esplicitamente. Le fonti non osservate non dimostrano apprendimenti.</p>
     <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
       {([['Prima osservazione',earlier,setEarlier],['Seconda osservazione',later,setLater]] as const)
         .map(([label,value,set])=><label key={label} className="block space-y-1"><span>{label}</span>
           <select aria-label={label} className={field} value={value} onChange={e=>{invalidate();set(e.target.value);}}>
             <option value="">Nessun confronto</option>
             {selectedObserved.map(r=><option value={r.evidenceRevisionId} key={r.evidenceRevisionId}>{r.observedOn} · {r.criterionDescription}</option>)}
           </select></label>)}
     </div>
     <p className="text-xs text-slate-400">Il confronto è facoltativo: due osservazioni tecnicamente confrontabili non implicano automaticamente un miglioramento.</p>
     {([['learning','Apprendimenti'],['progress','Progresso documentato'],['nextStep','Prossimo passo']] as const)
       .map(([key,label])=><label key={key} className="block space-y-1"><span>{label}</span>
         <textarea aria-label={label} value={teacherText[key]} maxLength={2000} rows={3}
           className={field} onChange={e=>{invalidate();setTeacherText(t=>({...t,[key]:e.target.value}));}}/>
       </label>)}
     <button className={btn} type="button" onClick={()=>void prepare()}>Rivedi bilancio</button>
   </fieldset>}
   {error&&<p role="alert" className="text-amber-300">{error}</p>}
   <button className={btn} type="button" disabled={busy} onClick={reset}>Abbandona bozza</button>
 </section>;
}
// Derive the discipline from the same teacher-approved mapping as the source reader.
import {resolveAssessmentSubjectCode} from '../assessment/assessmentSubjectScope';
function reviewSubject(settings?:AppSettings){return resolveAssessmentSubjectCode(settings?.subject)??'';}
