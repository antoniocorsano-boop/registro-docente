import React from 'react';
import type { PlanningFrameResolution } from '../planning/planningFrameResolver';
import type { ResolvedLibraryTeachingContext } from '../library/teachingContext';

export interface DidacticContinuityBarProps {
  className: string;
  planningFrame: PlanningFrameResolution | null;
  teachingContext: ResolvedLibraryTeachingContext | null;
  udaTitle?: string | null;
  lessonTitle?: string | null;
  destination: 'programmazione' | 'uda-gantt';
  onNavigate: () => void;
}

export const DidacticContinuityBar: React.FC<DidacticContinuityBarProps> = ({
  className,
  planningFrame,
  teachingContext,
  udaTitle,
  lessonTitle,
  destination,
  onNavigate
}) => {
  const validFrame = planningFrame?.status === 'resolved' ? planningFrame : null;
  const actionLabel = destination === 'uda-gantt' ? 'Apri UDA' : 'Apri Programmazione';

  return (
    <section
      aria-label="Continuità didattica"
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900/70 p-3 sm:p-4"
    >
      <div className="min-w-0 flex flex-col gap-1 text-sm text-slate-300">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold text-white">Classe {className}</span>
          {validFrame ? (
            <span>
              Cornice: {validFrame.profile.subjectCode.trim()} · classe {validFrame.profile.gradeLevel} · {validFrame.profile.schoolYear}
            </span>
          ) : (
            <span className="text-amber-200">
              {planningFrame?.status === 'ambiguous'
                ? 'Cornice: più profili possibili; scelta necessaria'
                : 'Cornice: profilo non disponibile per questa classe'}
            </span>
          )}
          {validFrame?.arenaContext && (
            <span className="text-emerald-200">Curricolo Arena approvato e vigente</span>
          )}
        </div>
        {teachingContext && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>UDA: {udaTitle?.trim() || 'selezionata'}</span>
            {teachingContext.lessonId && <span>Lezione: {lessonTitle?.trim() || 'selezionata'}</span>}
            {teachingContext.writableByRegistro === false && (
              <span className="text-amber-200">Proiezione Docente OS · sola lettura</span>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onNavigate}
        className="min-h-[44px] w-full sm:w-auto shrink-0 rounded-lg border border-cyan-500/50 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-900/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
      >
        {actionLabel}
      </button>
    </section>
  );
};
