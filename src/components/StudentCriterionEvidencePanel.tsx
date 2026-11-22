import React, {useMemo} from 'react';
import type {AppSettings,ClassData} from '../types';
import {readStudentCriterionEvidence} from '../assessment/studentCriterionReadModel';
import type {ApprovedAssessmentScope} from '../assessment/assessmentArchive';

/** Teacher-only local consultation. No grade conversions, editing or export. */
export function StudentCriterionEvidencePanel({currentClass,studentId,settings,isPrivacyShieldActive,approvedScopes}:{
  currentClass:ClassData;
  studentId:string;
  settings?:AppSettings;
  approvedScopes?:readonly ApprovedAssessmentScope[];
  isPrivacyShieldActive:boolean;
}){
  const model=useMemo(()=>
    isPrivacyShieldActive?readStudentCriterionEvidence(currentClass,settings,studentId,approvedScopes):null,
    [isPrivacyShieldActive,currentClass,settings?.year,settings?.subject,studentId,approvedScopes]);
  const label=(state:'observed'|'not_observed'|'not_applicable')=>
    state==='observed'?'Osservato':state==='not_observed'?'Non osservato':'Non pertinente';
  return (
    <details className="group min-w-0" data-testid="student-criterion-evidence">
      <summary className="neon-card student-report-disclosure min-h-[56px] cursor-pointer list-none py-3 md:p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-white break-words">Evidenze confermate per criterio</h3>
          <p className="text-xs text-slate-400 mt-1 break-words">Consultazione locale · distinta da voti, medie e competenze</p>
        </div>
        <span aria-hidden="true" className="text-slate-400 group-open:rotate-180">⌄</span>
      </summary>
      <div className="neon-card mt-2 p-3 min-w-0 text-sm space-y-2">
        {!isPrivacyShieldActive ? (
          <p role="status" className="text-slate-300">Attiva la protezione dei nominativi per consultare queste evidenze.</p>
        ) : model?.status==='absent' ? (
          <p className="text-slate-300">Nessuna evidenza per criterio registrata in questo archivio. I voti non generano automaticamente rilevazioni.</p>
        ) : model?.status==='unverified' ? (
          <p role="status" className="text-amber-300">Contesto o archivio delle evidenze non verificabile. Nessuna rilevazione mostrata.</p>
        ) : model?.status==='ready' ? (
          <>
            <p className="text-xs text-slate-400" data-testid="student-criterion-evidence-counts">
              {model.counts.observed} osservate · {model.counts.notObserved} non osservate · {model.counts.notApplicable} non pertinenti
            </p>
            {model.rows.length===0 ? (
              <p className="text-slate-300">Nessuna rilevazione individuale confermata. L’assenza di una rilevazione non è un esito negativo.</p>
            ) : (
              <ul className="space-y-2" aria-label="Rilevazioni individuali confermate">
                {model.rows.slice(0,8).map(row=>
                  <li key={row.revisionId} className="border border-[var(--border)] rounded-lg p-2 min-w-0 break-words">
                    <p className="text-xs text-slate-400">{row.observedOn} · {label(row.state)}</p>
                    <p className="text-sm font-semibold text-slate-100">{row.assessmentTitle}</p>
                    <p className="text-xs text-slate-300">Criterio: {row.criterionDescription}</p>
                  </li>)}
              </ul>
            )}
            {model.rows.length>8&&<p className="text-xs text-slate-400">Mostrate le 8 rilevazioni più recenti su {model.rows.length}.</p>}
            <p className="text-xs text-slate-400">Sono riportati solo fatti già confermati dal docente. Nessun livello di competenza è dedotto automaticamente.</p>
          </>
        ) : null}
      </div>
    </details>
  );
}
