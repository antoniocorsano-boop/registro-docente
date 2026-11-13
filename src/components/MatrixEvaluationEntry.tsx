import React,{useLayoutEffect,useRef,useState} from 'react';
import {Check,Clock,LoaderCircle,AlertCircle,CornerDownLeft} from 'lucide-react';
import type {ClassData,EvaluationType,Grade,UdaRecord} from '../types';
import {formatStudentNameWithPrivacy,normalizeGrade,today,TYPES_LABEL} from '../utils';
import {isMatrixDate,type MatrixCellWrite,type MatrixProof} from '../persistence/matrixCellMutation';

export interface EvaluationDraftGuard {hasUnsavedChanges:()=>boolean;discardChanges:()=>void;}
interface Props {currentClass:ClassData;udas:UdaRecord[];isPrivacyShieldActive:boolean;onRegisterDraftGuard:(guard:EvaluationDraftGuard|null)=>void;onSaveCell:(request:MatrixCellWrite)=>Promise<Grade>;onClose:()=>void;}
type Cell={value:string;delayed:boolean};
const empty:Cell={value:'',delayed:false};
const same=(cell:Cell,grade?:Grade)=>grade?cell.value===grade.value&&cell.delayed===!!grade.delayed:!cell.value.trim()&&!cell.delayed;
export function MatrixEvaluationEntry({currentClass,udas,isPrivacyShieldActive,onRegisterDraftGuard,onSaveCell,onClose}:Props){
  const [batchId]=useState(()=>crypto.randomUUID());
  const [proof,setProof]=useState<MatrixProof>(()=>({batchId,date:today(),period:'Q1',type:'test',title:''}));
  const proofRef=useRef(proof);
  const [expanded,setExpanded]=useState(true);
  const [draft,setDraft]=useState<Record<string,Cell>>({});
  const draftRef=useRef<Record<string,Cell>>({});
  const [saved,setSaved]=useState<Record<string,Grade>>({});
  const savedRef=useRef<Record<string,Grade>>({});
  const [pending,setPending]=useState<string|null>(null);
  const pendingRef=useRef(false);
  const [error,setError]=useState<{studentId?:string;message:string}|null>(null);
  const proofChanged=useRef(false);
  const inputs=useRef(new Map<string,HTMLInputElement>());
  const mounted=useRef(true);
  const proofSection=useRef<HTMLDivElement>(null);
  const locked=Object.keys(saved).length>0;
  const patchProof=(patch:Partial<MatrixProof>)=>{
    if(pendingRef.current||Object.keys(savedRef.current).length)return;
    const next={...proofRef.current,...patch};proofRef.current=next;setProof(next);proofChanged.current=true;setError(null);
  };
  const change=(studentId:string,cell:Cell)=>{
    if(pendingRef.current)return;
    const next={...draftRef.current,[studentId]:cell};draftRef.current=next;setDraft(next);setError(null);
  };
  useLayoutEffect(()=>{
    mounted.current=true;
    onRegisterDraftGuard({
      hasUnsavedChanges:()=>pendingRef.current||(!Object.keys(savedRef.current).length&&proofChanged.current)||Object.entries(draftRef.current).some(([id,cell])=>!same(cell,savedRef.current[id])),
      discardChanges:()=>{
        if(pendingRef.current)return;
        const next=Object.fromEntries(Object.entries(savedRef.current).map(([id,g])=>[id,{value:g.value,delayed:!!g.delayed}]));
        draftRef.current=next;setDraft(next);setError(null);proofChanged.current=false;
        if(!Object.keys(savedRef.current).length){const initial:MatrixProof={batchId,date:today(),period:'Q1',type:'test',title:''};proofRef.current=initial;setProof(initial);setExpanded(true);}
      }
    });
    return()=>{mounted.current=false;onRegisterDraftGuard(null);};
  },[batchId,onRegisterDraftGuard]);
  const proofError=()=>{
    const p=proofRef.current;
    if(!p.title.trim()||!isMatrixDate(p.date))return 'Indica data e argomento della prova.';
    if(p.udaId&&(udas.filter(u=>u.id===p.udaId).length!==1||!udas.some(u=>u.id===p.udaId&&u.className===currentClass.name)))return 'L’UDA non è più disponibile.';
    return null;
  };
  const revealProof=(message:string)=>{setExpanded(true);setError({message});requestAnimationFrame(()=>proofSection.current?.scrollIntoView({block:'center'}));};
  const advance=(id:string)=>{
    const index=currentClass.students.findIndex(st=>st.id===id);
    const next=currentClass.students[index+1];
    if(next&&document.activeElement===inputs.current.get(id)&&!document.querySelector('[aria-modal="true"]'))inputs.current.get(next.id)?.focus();
  };
  const commit=async(studentId:string)=>{
    if(pendingRef.current||!mounted.current)return;
    const cell=draftRef.current[studentId]||empty;
    const parsed=normalizeGrade(cell.value);
    if(!parsed){setError({studentId,message:cell.value.trim()?'Voto non valido.':'Inserisci un voto. Il campo vuoto non elimina un voto registrato.'});return;}
    const issue=proofError();if(issue){revealProof(issue);return;}
    const expected=savedRef.current[studentId]||null;
    if(expected&&parsed.value===expected.value&&(cell.delayed||parsed.delayed)===!!expected.delayed){change(studentId,{value:expected.value,delayed:!!expected.delayed});advance(studentId);return;}
    const context={...proofRef.current,title:proofRef.current.title.trim()};
    pendingRef.current=true;setPending(studentId);setError(null);
    try{
      const grade=await onSaveCell({proof:context,studentId,value:parsed.value,delayed:cell.delayed||parsed.delayed,expected,existingBatch:Object.keys(savedRef.current).length>0});
      if(!mounted.current)return;
      const nextSaved={...savedRef.current,[studentId]:grade};savedRef.current=nextSaved;setSaved(nextSaved);
      const nextDraft={...draftRef.current,[studentId]:{value:grade.value,delayed:!!grade.delayed}};draftRef.current=nextDraft;setDraft(nextDraft);
      proofRef.current=context;setProof(context);proofChanged.current=false;setExpanded(false);
      advance(studentId);
    }catch{if(mounted.current)setError({studentId,message:'Voto non salvato. Riprova con Invio.'});}
    finally{pendingRef.current=false;if(mounted.current)setPending(null);}
  };
  return <section data-testid="matrix-evaluation-editor" className="matrix-evaluation-workspace min-w-0 space-y-3">
    <div className="matrix-evaluation-heading border-b border-[var(--border)] pb-2"><div><h3 className="text-lg font-semibold">Inserisci valutazione</h3></div><button type="button" onClick={onClose} disabled={pending!==null} className="matrix-evaluation-cancel min-h-[48px] rounded-lg border border-[var(--border)] px-3 text-sm">Torna al Tabellone</button></div>
    <form onSubmit={ev=>{ev.preventDefault();const input=document.activeElement;const match=[...inputs.current.entries()].find(([,el])=>el===input);if(match)void commit(match[0]);}} className="space-y-3">
      {expanded&&!locked?<div ref={proofSection} className="matrix-evaluation-proof space-y-3">
        <fieldset disabled={pending!==null} className="matrix-evaluation-fields gap-2 min-w-0">
          <div><label className="block text-sm">Periodo<select aria-label="Periodo didattico" value={proof.period} onChange={ev=>patchProof({period:ev.target.value as MatrixProof['period']})} className="block w-full p-2 neon-input"><option value="Q1">Primo periodo</option><option value="Q2">Secondo periodo</option></select></label></div>
          <div><label className="block text-sm">Tipologia<select aria-label="Tipologia prova" value={proof.type} onChange={ev=>patchProof({type:ev.target.value as EvaluationType})} className="block w-full p-2 neon-input"><option value="test">Test / Quiz</option><option value="verifica">Verifica scritta</option><option value="orale">Orale</option><option value="disegno">Disegno</option><option value="osserv">Osservazione</option></select></label></div>
          <div className="matrix-evaluation-uda"><label className="block text-sm">UDA (facoltativa)<select aria-label="Collega a UDA Curricolare" value={proof.udaId||''} onChange={ev=>patchProof({udaId:ev.target.value||undefined})} className="block w-full p-2 neon-input"><option value="">Nessuna UDA</option>{udas.filter(u=>u.className===currentClass.name).map(u=><option key={u.id} value={u.id}>{u.title}</option>)}</select></label></div>
          <div><label className="block text-sm">Data<input aria-label="Data svolgimento" type="date" value={proof.date} onChange={ev=>patchProof({date:ev.target.value})} className="block w-full p-2 neon-input"/></label></div>
          <div><label className="block text-sm">Argomento<input aria-label="Titolo / Argomento prova" value={proof.title} onChange={ev=>patchProof({title:ev.target.value})} className="block w-full p-2 neon-input"/></label></div>
        </fieldset>
        {error&&!error.studentId&&<p role="alert" className="text-sm text-amber-200">{error.message}</p>}
        <button type="button" disabled={pending!==null} onClick={()=>{const issue=proofError();if(issue){revealProof(issue);return;}setExpanded(false);setError(null);}} className="w-full min-h-[48px] rounded-lg border border-[var(--border)] font-semibold">Vai ai voti</button>
      </div>:<div className="matrix-evaluation-proof-summary"><div className="min-w-0"><strong className="block break-words">{proof.title}</strong><p className="text-xs text-slate-400 break-words">{TYPES_LABEL[proof.type]} · {proof.date} · {proof.period==='Q1'?'Primo periodo':'Secondo periodo'}</p>{proof.udaId&&<p className="text-xs text-slate-400 break-words">{udas.find(u=>u.id===proof.udaId)?.title||'UDA da verificare'}</p>}</div>{!locked&&<button type="button" disabled={pending!==null} onClick={()=>setExpanded(true)} className="min-h-[48px] rounded border border-[var(--border)] px-3">Modifica dati</button>}</div>}
      {error&&!error.studentId&&(!expanded||locked)&&<p role="alert" className="text-sm text-amber-200">{error.message}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><strong>Alunni</strong><span role="status">{Object.keys(saved).length} / {currentClass.students.length} registrati</span></div>
      <p className="text-xs text-slate-400">Scrivi il voto e premi Invio. A, NC e G sono ammessi.</p>
      <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {currentClass.students.map((student,idx)=>{
          const cell=draft[student.id]||empty;const grade=saved[student.id];const isPending=pending===student.id;const changed=!same(cell,grade);const rowError=error?.studentId===student.id?error.message:null;
          const status=isPending?'Salvataggio in corso':rowError?'Non salvato':grade&&!changed?'Registrato':changed?'Da confermare':'Non registrato';
          return <div key={student.id} data-testid="matrix-evaluation-row" className="matrix-evaluation-row min-h-[48px] py-1 gap-2 min-w-0">
            <div className="matrix-evaluation-name"><span className="text-slate-400 text-xs shrink-0">{idx+1}.</span><span className="min-w-0 text-sm font-medium">{formatStudentNameWithPrivacy(student.name,isPrivacyShieldActive)}</span></div>
            <div className="matrix-evaluation-actions">
              <button type="button" aria-label={'Recupero alunno '+(idx+1)} aria-pressed={cell.delayed} disabled={pending!==null} onClick={()=>change(student.id,{...cell,delayed:!cell.delayed})} className={'matrix-evaluation-recovery rounded border flex items-center '+(cell.delayed?'border-amber-400 text-amber-200':'border-slate-700 text-slate-400')}><Clock size={18} aria-hidden="true"/></button>
              <input ref={el=>{if(el)inputs.current.set(student.id,el);else inputs.current.delete(student.id);}} aria-label={'Voto alunno '+(idx+1)} aria-invalid={Boolean(rowError)} aria-describedby={'matrix-cell-status-'+idx} type="text" enterKeyHint="next" autoComplete="off" spellCheck={false} readOnly={pending!==null} value={cell.value} onChange={ev=>change(student.id,{...cell,value:ev.target.value})} onKeyDown={ev=>{if(ev.key==='Enter'&&!ev.nativeEvent.isComposing){ev.preventDefault();void commit(student.id);}}} placeholder="—" className="matrix-evaluation-vote min-h-[48px] p-1 text-center font-semibold text-base neon-input uppercase"/>
              <span id={'matrix-cell-status-'+idx} data-testid="matrix-cell-status" role="status" aria-label={status} title={status} className="matrix-cell-status shrink-0">
                {isPending?<LoaderCircle size={18} className="animate-spin" aria-hidden="true"/>:rowError?<AlertCircle size={18} className="text-amber-300" aria-hidden="true"/>:grade&&!changed?<Check size={18} className="text-emerald-300" aria-hidden="true"/>:changed?<CornerDownLeft size={18} className="text-slate-400" aria-hidden="true"/>:<span aria-hidden="true">·</span>}
                <span className="sr-only">{status}</span>
              </span>
            </div>
            {rowError&&<p role="alert" className="matrix-cell-error text-xs text-amber-200 break-words">{rowError}</p>}
          </div>;
        })}
      </div>
      <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">Conferma voto corrente</button>
    </form>
  </section>;
}
