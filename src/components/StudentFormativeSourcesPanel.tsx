import React,{useMemo,useState} from 'react';
import type {AppSettings,ClassData} from '../types';
import {readStudentFormativeSources} from '../assessment/studentFormativeSourceReadModel';
import {StudentFormativeBalanceDraft} from './StudentFormativeBalanceDraft';

/** Read-only S7 source inventory. No balance is created, confirmed or saved. */
export function StudentFormativeSourcesPanel({currentClass,studentId,settings,isPrivacyShieldActive}:{
  currentClass:ClassData;studentId:string;settings?:AppSettings;isPrivacyShieldActive:boolean;
}){
  const [period,setPeriod]=useState<'Q1'|'Q2'>('Q1');
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  const [editing,setEditing]=useState(false);
  const model=useMemo(()=>isPrivacyShieldActive&&from&&to?
    readStudentFormativeSources(currentClass,settings,studentId,period,from,to):null,
    [currentClass,settings?.year,settings?.subject,studentId,period,from,to,isPrivacyShieldActive]);
  const stateLabel=(state:'observed'|'not_observed'|'not_applicable')=>
    state==='observed'?'Osservato':state==='not_observed'?'Non osservato':'Non pertinente';
  return <details className="group min-w-0" data-testid="student-formative-sources">
    <summary className="neon-card student-report-disclosure min-h-[56px] cursor-pointer list-none py-3 md:p-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-white break-words">Fonti per il bilancio formativo</h3>
        <p className="text-xs text-slate-400 mt-1 break-words">Ricognizione delle evidenze · nessun giudizio automatico</p>
      </div>
      <span aria-hidden="true" className="text-slate-400 group-open:rotate-180">⌄</span>
    </summary>
    <div className="neon-card mt-2 p-3 min-w-0 text-sm space-y-3">
      {!isPrivacyShieldActive?<p role="status" className="text-slate-300">Attiva la protezione dei nominativi per consultare le fonti del bilancio.</p>:<>
        <p className="text-slate-300">Indica le date effettive del periodo. Le evidenze elencate sono solo fonti disponibili: nessuna è selezionata, interpretata o approvata automaticamente.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <label className="block space-y-1"><span>Periodo</span>
            <select aria-label="Periodo del bilancio" className="neon-input w-full min-h-[44px] p-2" value={period}
              onChange={event=>setPeriod(event.target.value as 'Q1'|'Q2')}>
              <option value="Q1">Primo periodo</option><option value="Q2">Secondo periodo</option>
            </select>
          </label>
          <label className="block space-y-1"><span>Dal</span>
            <input aria-label="Data iniziale del bilancio" className="neon-input w-full min-h-[44px] p-2"
              type="date" value={from} onChange={event=>setFrom(event.target.value)}/>
          </label>
          <label className="block space-y-1"><span>Al</span>
            <input aria-label="Data finale del bilancio" className="neon-input w-full min-h-[44px] p-2"
              type="date" value={to} onChange={event=>setTo(event.target.value)}/>
          </label>
        </div>
        {!from||!to?<p role="status" className="text-slate-400">Seleziona entrambe le date per consultare le fonti.</p>:
          model?.status==='absent'?<p role="status">Archivio delle evidenze assente. I voti non costituiscono fonti per criterio.</p>:
          model?.status==='unverified'?<p role="alert" className="text-amber-300">Periodo, contesto o archivio non verificabile. Nessuna fonte mostrata.</p>:
          model?.status==='ready'?<>
            <p className="text-xs text-slate-400" data-testid="student-formative-source-count">
              {model.counts.observed} osservate · {model.counts.notObserved} non osservate · {model.counts.notApplicable} non pertinenti
            </p>
            {model.rows.length===0?<p role="status">Nessuna rilevazione confermata nel periodo selezionato. L'assenza non indica un esito negativo.</p>:
              <ul aria-label="Fonti individuali per bilancio" className="space-y-2">
                {model.rows.slice(0,10).map(row=><li key={row.evidenceRevisionId}
                  className="border border-[var(--border)] rounded-lg p-2 min-w-0 break-words">
                  <p className="text-xs text-slate-400">{row.observedOn} · {stateLabel(row.state)}</p>
                  <p className="font-semibold">{row.assessmentTitle}</p>
                  <p className="text-xs text-slate-300">Criterio: {row.criterionDescription}</p>
                </li>)}
              </ul>}
            {model.rows.length>10&&<p className="text-xs text-slate-400">Mostrate le prime 10 fonti su {model.rows.length}.</p>}
            <p className="text-xs text-slate-400">Copertura da determinare. Solo il docente sceglie le evidenze e scrive il bilancio; il riesame locale non salva, certifica o invia nulla.</p>
            {model.rows.length>0&&<div className="space-y-2 min-w-0">
              <button data-testid="student-formative-start" type="button" className="min-h-[44px] max-w-full break-words rounded-lg border border-[var(--border)] px-3 py-2 font-medium"
                onClick={()=>setEditing(value=>!value)}>{editing?'Chiudi bozza':'Prepara bilancio'}</button>
              {editing&&<StudentFormativeBalanceDraft key={JSON.stringify([studentId,period,from,to])}
                currentClass={currentClass} settings={settings} studentId={studentId} period={period} from={from} to={to} rows={model.rows}/>}
            </div>}
          </>:null}
      </>}
    </div>
  </details>;
}
