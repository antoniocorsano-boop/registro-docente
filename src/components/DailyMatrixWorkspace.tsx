import React,{useLayoutEffect,useMemo,useRef,useState} from 'react';
import {AlertCircle,Check,ChevronDown,CircleDashed,CircleX,LoaderCircle,Star,ThumbsUp,TriangleAlert} from 'lucide-react';
import type {AppData,BehaviorRecord,ClassData,EvaluationType,Grade,UdaRecord} from '../types';
import {BEHAVIOR_OPTIONS,formatStudentNameWithPrivacy,normalizeGrade,today,TYPES_LABEL} from '../utils';
import {createDailyBatchId,resolveDailyWorkspace,type DailyGradeWrite,type DailyObservationWrite} from '../persistence/dailyMatrixWorkspace';
import {isMatrixDate,type MatrixProof} from '../persistence/matrixCellMutation';
import type {EvaluationDraftGuard} from './MatrixEvaluationEntry';

const icons={'Ottimale 🌟':Star,'Costruttivo 👍':ThumbsUp,'Distratto ⚠️':TriangleAlert,'Disattento ❌':CircleX} as const;
type Status=BehaviorRecord['status'];
type Selection={kind:'auto'}|{kind:'existing';batchId:string}|{kind:'new';batchId:string;explicit:boolean};
type Draft={raw:string;expected:Grade|null};
interface Props {
  data:AppData; currentClass:ClassData; udas:UdaRecord[]; isPrivacyShieldActive:boolean;
  onRegisterDraftGuard:(guard:EvaluationDraftGuard|null)=>void;
  requestChange:(action:()=>void)=>void;
  onSaveGrade:(request:DailyGradeWrite)=>Promise<Grade>;
  onSaveObservation:(request:DailyObservationWrite)=>Promise<BehaviorRecord>;
}
function StatusIcon({status}:{status?:Status}){const Icon=status?icons[status]:CircleDashed;return <Icon size={20} strokeWidth={1.8} aria-hidden="true"/>;}
const label=(status?:Status)=>status?BEHAVIOR_OPTIONS.find(o=>o.label===status)?.label.split(' ').slice(0,-1).join(' ')||'Osservazione':'Non rilevato';
export function DailyMatrixWorkspace({data,currentClass,udas,isPrivacyShieldActive,onRegisterDraftGuard,requestChange,onSaveGrade,onSaveObservation}:Props){
  const [date,setDate]=useState(today);
  const [selection,setSelection]=useState<Selection>({kind:'auto'});
  const [drafts,setDrafts]=useState<Record<string,Draft>>({});
  const draftsRef=useRef<Record<string,Draft>>({});
  const [first,setFirst]=useState<string|null>(null);
  const proofDirtyRef=useRef(false);
  const [type,setType]=useState<EvaluationType|''>('');
  const [title,setTitle]=useState('');
  const [period,setPeriod]=useState<'Q1'|'Q2'>('Q1');
  const [udaId,setUdaId]=useState('');
  const [openBehavior,setOpenBehavior]=useState<string|null>(null);
  const [pending,setPending]=useState<{studentId:string;kind:'grade'|'behavior'}|null>(null);
  const pendingRef=useRef(false);
  const [error,setError]=useState<{studentId?:string;message:string}|null>(null);
  const mounted=useRef(true);
  const inputs=useRef(new Map<string,HTMLInputElement>());
  const proofPanel=useRef<HTMLDivElement>(null);
  const context=useMemo(()=>resolveDailyWorkspace(data,currentClass.id,date),[data,currentClass.id,date]);
  const selectedId=selection.kind==='existing'?selection.batchId:selection.kind==='auto'?context.automaticBatchId:null;
  const candidate=context.candidates.find(c=>c.proof.batchId===selectedId);
  const grades=new Map(candidate?.grades.map(g=>[g.studentId,g])||[]);
  const hasConflict=selection.kind==='existing'&&!candidate;
  const needsChoice=selection.kind==='auto'&&!candidate&&(context.selectionRequired||context.historicalOnlyCount>0);
  const replaceDrafts=(next:Record<string,Draft>)=>{draftsRef.current=next;setDrafts(next);};
  const setFirstCell=(id:string|null)=>setFirst(id);
  const clearDrafts=()=>{replaceDrafts({});setFirstCell(null);setOpenBehavior(null);setError(null);resetProof();};
  const resetProof=()=>{proofDirtyRef.current=false;setType('');setTitle('');setPeriod('Q1');setUdaId('');};
  const fresh=(explicit:boolean):Selection=>({kind:'new',batchId:createDailyBatchId(crypto.randomUUID()),explicit});
  useLayoutEffect(()=>{
    mounted.current=true;
    onRegisterDraftGuard({hasUnsavedChanges:()=>pendingRef.current||proofDirtyRef.current||Object.keys(draftsRef.current).length>0,discardChanges:()=>{if(!pendingRef.current)clearDrafts();}});
    return()=>{mounted.current=false;onRegisterDraftGuard(null);};
  },[onRegisterDraftGuard]);
  const changeContext=(action:()=>void)=>{if(!pendingRef.current)requestChange(()=>{clearDrafts();action();});};
  const changeDate=(next:string)=>{if(next!==date&&isMatrixDate(next))changeContext(()=>{setDate(next);setSelection({kind:'auto'});});};
  const changeValue=(studentId:string,raw:string)=>{
    if(pendingRef.current||needsChoice||hasConflict)return;
    const next={...draftsRef.current};
    const expected=next[studentId]?next[studentId].expected:(grades.get(studentId)??null);
    if(raw===(expected?.value||''))delete next[studentId];else next[studentId]={raw,expected};
    replaceDrafts(next);setError(null);
  };
  const advance=(id:string)=>{const next=currentClass.students[currentClass.students.findIndex(s=>s.id===id)+1];if(next&&!document.querySelector('[aria-modal="true"]'))inputs.current.get(next.id)?.focus();};
  const saveGrade=async(id:string,proof:MatrixProof,existing:boolean,explicitNew:boolean,advanceOnCommit=false)=>{
    if(pendingRef.current||!mounted.current)return;
    const draft=draftsRef.current[id];
    if(!draft){advance(id);return;}
    const parsed=normalizeGrade(draft.raw);
    if(!parsed){setError({studentId:id,message:draft.raw.trim()?'Voto non valido.':'Il campo vuoto non cancella un voto registrato.'});return;}
    pendingRef.current=true;setPending({studentId:id,kind:'grade'});setError(null);
    try{
      const receipt=await onSaveGrade({proof,studentId:id,value:parsed.value,delayed:parsed.delayed||!!draft.expected?.delayed,expected:draft.expected,existingBatch:existing,explicitNew});
      if(!mounted.current)return;
      const next={...draftsRef.current};delete next[id];replaceDrafts(next);
      setSelection({kind:'existing',batchId:receipt.batchId!});setFirstCell(null);resetProof();
      if(advanceOnCommit||document.activeElement===inputs.current.get(id)||document.activeElement?.closest('[data-testid="daily-proof-panel"]'))advance(id);
    }catch{if(mounted.current)setError({studentId:id,message:'Voto non salvato. Riprova con il comando di conferma.'});}
    finally{pendingRef.current=false;if(mounted.current)setPending(null);}
  };
  const confirmGrade=(id:string,advanceOnCommit=false)=>{
    if(pendingRef.current||needsChoice||hasConflict)return;
    const draft=draftsRef.current[id];
    if(!draft){advance(id);return;}
    if(!normalizeGrade(draft.raw)){setError({studentId:id,message:draft.raw.trim()?'Voto non valido.':'Il campo vuoto non cancella un voto registrato.'});return;}
    if(candidate){void saveGrade(id,candidate.proof,true,false,advanceOnCommit);return;}
    if(selection.kind!=='new')setSelection(fresh(false));
    setFirstCell(id);setError(null);requestAnimationFrame(()=>{proofPanel.current?.scrollIntoView({block:'center'});proofPanel.current?.querySelector('select')?.focus();});
  };
  const firstSave=()=>{
    if(!first||selection.kind!=='new'||!type||!title.trim()){setError({message:'Scegli la tipologia e indica l’argomento.'});return;}
    if(!draftsRef.current[first]||!normalizeGrade(draftsRef.current[first].raw)){setError({message:'Inserisci un voto valido nella riga da registrare.'});return;}
    void saveGrade(first,{batchId:selection.batchId,date,type,period,title:title.trim(),...(udaId?{udaId}:{})},false,selection.explicit,true);
  };
  const saveBehavior=async(id:string,status:Status)=>{
    if(pendingRef.current)return;
    const expected=context.observations.get(id)||null;
    if(expected?.status===status){setOpenBehavior(null);return;}
    pendingRef.current=true;setPending({studentId:id,kind:'behavior'});setError(null);
    try{await onSaveObservation({date,studentId:id,status,expected});if(mounted.current)setOpenBehavior(null);}
    catch{if(mounted.current)setError({studentId:id,message:'Osservazione non salvata. Riprova.'});}
    finally{pendingRef.current=false;if(mounted.current)setPending(null);}
  };
  return <section data-testid="daily-matrix" className="daily-matrix min-w-0 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><label className="daily-date-label text-sm font-semibold">Giornata<input data-testid="daily-date" aria-label="Giornata" type="date" value={date} disabled={pending!==null} onChange={e=>changeDate(e.target.value)} className="ml-2 min-h-[48px] max-w-full neon-input px-2"/></label><span className="text-xs text-slate-400">{currentClass.students.filter(st=>context.observations.has(st.id)).length} {currentClass.students.filter(st=>context.observations.has(st.id)).length===1?'osservazione':'osservazioni'} · {grades.size} {grades.size===1?'voto':'voti'}</span></div>
    {context.candidates.length>0&&<div className="daily-proof-selector flex flex-wrap items-end gap-2">
      <label className="daily-proof-select flex-1 min-w-0 text-sm">Prova<select aria-label="Prova della giornata" value={candidate?.proof.batchId||''} disabled={pending!==null} onChange={e=>{const id=e.target.value;if(id)changeContext(()=>setSelection({kind:'existing',batchId:id}));}} className="block w-full min-h-[48px] neon-input px-2"><option value="">Scegli la prova</option>{context.candidates.map(c=><option key={c.proof.batchId} value={c.proof.batchId}>{TYPES_LABEL[c.proof.type]} · {c.proof.title}</option>)}</select></label>
      <button type="button" disabled={pending!==null} onClick={()=>changeContext(()=>setSelection(fresh(true)))} className="min-h-[48px] px-3 rounded border border-[var(--border)]">Nuova prova</button>
    </div>}
    {context.historicalOnlyCount>0&&<p className="text-xs text-slate-400">{context.historicalOnlyCount} valutazioni consultabili nello Storico, non modificabili in questa prova.</p>}
    {(needsChoice||hasConflict)&&<div className="space-y-2"><p role="status" className="text-sm">Scegli la prova da continuare oppure avvia una nuova prova.</p>{context.candidates.length===0&&<button type="button" onClick={()=>changeContext(()=>setSelection(fresh(true)))} disabled={pending!==null} className="min-h-[48px] px-3 rounded border border-[var(--border)]">Nuova prova</button>}</div>}
    {candidate&&<p className="text-xs text-slate-400 break-words">{candidate.proof.period==="Q1"?"Primo periodo":"Secondo periodo"}{candidate.proof.udaId?` · ${udas.find(u=>u.id===candidate.proof.udaId&&u.className===currentClass.name)?.title||"UDA da verificare"}`:""}</p>}
    {first&&selection.kind==='new'&&<div data-testid="daily-proof-panel" ref={proofPanel} className="space-y-2 border-y border-[var(--border)] py-3">
      <strong>Definisci la prova</strong><p className="text-xs text-slate-400">Voto da registrare: {drafts[first]?.raw||"—"}. Una sola tipologia per tutti i voti della prova.</p>
      <fieldset disabled={pending!==null} onChangeCapture={()=>{proofDirtyRef.current=true;}} className="daily-proof-fields gap-2">
        <label>Tipologia<select aria-label="Tipologia prova" value={type} onChange={e=>setType(e.target.value as EvaluationType|'')} className="block w-full min-h-[48px] neon-input px-2"><option value="">Scegli</option>{(['test','verifica','orale','disegno','osserv'] as EvaluationType[]).map(k=><option key={k} value={k}>{TYPES_LABEL[k]}</option>)}</select></label>
        <label>Argomento<input aria-label="Argomento prova" value={title} onChange={e=>setTitle(e.target.value)} className="block w-full min-h-[48px] neon-input px-2"/></label>
        <label>Periodo<select aria-label="Periodo prova" value={period} onChange={e=>setPeriod(e.target.value as 'Q1'|'Q2')} className="block w-full min-h-[48px] neon-input px-2"><option value="Q1">Primo periodo</option><option value="Q2">Secondo periodo</option></select></label>
        <label>UDA (facoltativa)<select aria-label="UDA prova" value={udaId} onChange={e=>setUdaId(e.target.value)} className="block w-full min-h-[48px] neon-input px-2"><option value="">Nessuna UDA</option>{udas.filter(u=>u.className===currentClass.name).map(u=><option key={u.id} value={u.id}>{u.title}</option>)}</select></label>
      </fieldset>
      <button type="button" disabled={pending!==null} onClick={firstSave} className="min-h-[48px] w-full rounded-lg neon-btn-primary">Conferma e registra</button>
      {error&&!error.studentId&&<p role="alert" className="text-sm text-amber-200">{error.message}</p>}
    </div>}
    <div className="daily-matrix-row border-b border-[var(--border)] pb-2 text-xs font-semibold text-slate-400"><span>Alunno</span><span className="text-center"><span aria-hidden="true">Comport.</span><span className="sr-only">Comportamento</span></span><span className="text-center">Voto</span></div>
    <div className="divide-y divide-[var(--border)]">
      {currentClass.students.map((st,i)=>{
        const observation=context.observations.get(st.id);const grade=grades.get(st.id);const draft=drafts[st.id];const rowError=error?.studentId===st.id?error.message:null;
        return <div key={st.id} data-testid="daily-row" className="daily-matrix-row py-1 min-h-[48px]">
          <span data-testid="daily-student-name" className="daily-student-name min-w-0 text-sm font-medium break-words"><span aria-hidden="true" className="text-xs text-slate-400 shrink-0">{i+1}.</span><span className="min-w-0">{formatStudentNameWithPrivacy(st.name,isPrivacyShieldActive)}</span></span>
          <button type="button" aria-label={'Comportamento alunno '+(i+1)+': '+label(observation?.status)} aria-expanded={openBehavior===st.id} disabled={pending!==null} onClick={()=>{setOpenBehavior(openBehavior===st.id?null:st.id);setError(null);}} className="min-h-[48px] min-w-[48px] flex items-center justify-center gap-1 rounded border border-[var(--border)]">{pending?.studentId===st.id&&pending.kind==='behavior'?<LoaderCircle size={20} className="animate-spin"/>:<StatusIcon status={observation?.status}/>}<ChevronDown size={12} aria-hidden="true"/></button>
          <div className="flex items-center gap-1 min-w-0">
            <input ref={el=>{if(el)inputs.current.set(st.id,el);else inputs.current.delete(st.id);}} aria-label={'Voto alunno '+(i+1)} value={draft?.raw??grade?.value??''} aria-invalid={Boolean(rowError)} readOnly={pending!==null||needsChoice||hasConflict} onChange={e=>changeValue(st.id,e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();confirmGrade(st.id);}}} enterKeyHint="done" autoComplete="off" spellCheck={false} placeholder="—" className="min-w-0 w-full min-h-[48px] neon-input text-center font-semibold"/>
            <div className="w-[44px] shrink-0 flex items-center justify-center">
              {pending?.studentId===st.id&&pending.kind==='grade'?
                <span role="status" aria-label="Salvataggio in corso"><LoaderCircle size={18} className="animate-spin"/></span>:
                draft?<><button type="button" aria-label={'Conferma voto alunno '+(i+1)} title="Conferma voto" disabled={pending!==null||needsChoice||hasConflict} onClick={()=>confirmGrade(st.id,true)} className="w-[44px] min-h-[48px] flex items-center justify-center rounded border border-[var(--primary)] text-[var(--primary)] focus-visible:outline focus-visible:outline-2"><Check size={20} aria-hidden="true"/></button><span role="status" aria-label="Da confermare" className="sr-only">Da confermare</span></>:
                <span role="status" aria-label={grade?'Registrato':'Non registrato'}>{grade?<Check size={18} className="text-emerald-300" aria-hidden="true"/>:null}</span>}
            </div>
          </div>
          {openBehavior===st.id&&<div className="daily-row-detail grid grid-cols-2 gap-2 py-2">{BEHAVIOR_OPTIONS.map(option=><button type="button" key={option.label} aria-pressed={observation?.status===option.label} disabled={pending!==null} onClick={()=>void saveBehavior(st.id,option.label)} className="min-h-[48px] flex items-center gap-2 justify-center rounded border border-[var(--border)] text-sm"><StatusIcon status={option.label}/>{label(option.label)}</button>)}</div>}
          {rowError&&<p role="alert" className="daily-row-detail text-xs text-amber-200 flex gap-1"><AlertCircle size={16} className="shrink-0"/>{rowError}</p>}
        </div>;
      })}
    </div>
    <p className="text-xs text-slate-400">A: assente · NC: non classificato · G: giustificato. Conferma il voto con la spunta accanto alla cella o con Invio.</p>
  </section>;
}
