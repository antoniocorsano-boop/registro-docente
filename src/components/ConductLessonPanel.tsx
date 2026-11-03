import React, { useState } from 'react';
import type { ConductContextResolution } from '../conduct/conductSession';

interface ConductLessonPanelProps {
  context: ConductContextResolution;
  privacyShieldActive: boolean;
  onTogglePrivacyShield: () => void;
  onNavigateUda: () => void;
  onNavigateLibrary: () => void;
  onNavigateAssessment: () => void;
  onOpenCopilot: () => void;
  onGoToRecord: (stagedNote?: string) => void;
  onDismiss: () => void;
}

const actionClass = 'min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800';

export const ConductLessonPanel: React.FC<ConductLessonPanelProps> = ({
  context,
  privacyShieldActive,
  onTogglePrivacyShield,
  onNavigateUda,
  onNavigateLibrary,
  onNavigateAssessment,
  onOpenCopilot,
  onGoToRecord,
  onDismiss
}) => {
  const [rapidNote, setRapidNote] = useState('');

  const contextCopy = context.status === 'resolved'
    ? {
        title: context.activityLabel,
        detail: context.udaTitle,
        objective: context.objective
      }
    : context.status === 'ambiguous'
      ? {
          title: 'Scegli la UDA da usare',
          detail: 'Ci sono più percorsi possibili per questa classe.',
          objective: undefined
        }
      : context.status === 'class-only'
        ? {
            title: 'Nessuna attività univoca già disponibile',
            detail: 'Apri la UDA per scegliere il riferimento della lezione.',
            objective: undefined
          }
        : {
            title: 'Nessuna attività univoca già disponibile',
            detail: 'Apri la UDA per scegliere il riferimento della lezione.',
            objective: undefined
          };

  return (
    <section
      aria-label={`Conduci per ${context.className}`}
      className="mb-5 rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4 shadow-sm dark:border-cyan-900/70 dark:bg-cyan-950/20 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Oggi · Conduci</p>
          <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">Stai conducendo con {context.className}</h2>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Chiudi Conduci"
          className="min-h-[44px] shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          Chiudi
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-cyan-100 bg-white p-4 dark:border-cyan-950 dark:bg-slate-950">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Adesso</p>
        <p className="mt-1 text-base font-bold text-slate-900 dark:text-white">{contextCopy.title}</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{contextCopy.detail}</p>
        {context.status === 'resolved' && context.objective && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200">
            {context.objective}
          </p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button type="button" onClick={onNavigateLibrary} className={actionClass}>Materiali</button>
        <button type="button" onClick={onNavigateAssessment} className={actionClass}>Verifica / attività</button>
        <button type="button" onClick={onNavigateUda} className={actionClass}>Apri UDA</button>
      </div>

      <div className="mt-4">
        <label htmlFor="flow02-rapid-note" className="text-sm font-bold text-slate-900 dark:text-white">Nota rapida</label>
        <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">Temporanea — non ancora registrata</p>
        <textarea
          id="flow02-rapid-note"
          value={rapidNote}
          onChange={(event) => setRapidNote(event.target.value)}
          rows={3}
          placeholder="Annota ciò che serve ricordare durante la lezione…"
          className="mt-2 min-h-[96px] w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        />
      </div>

      <div className="pr-24 sm:pr-0">
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <button
            type="button"
            onClick={onTogglePrivacyShield}
            aria-pressed={privacyShieldActive}
            className={`${actionClass} flex flex-1 items-center justify-between gap-3`}
          >
            <span>Privacy Shield</span>
            <span className="text-xs font-bold uppercase tracking-wide">
              {privacyShieldActive ? 'Attivo' : 'Disattivo'}
            </span>
          </button>
          <button type="button" onClick={onOpenCopilot} className={`${actionClass} flex-1`}>Chiedi supporto</button>
        </div>

        <button
          type="button"
          onClick={() => onGoToRecord(rapidNote.trim() || undefined)}
          className="mt-4 min-h-[44px] w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
        >
          Vai a Registra
        </button>
      </div>
    </section>
  );
};
