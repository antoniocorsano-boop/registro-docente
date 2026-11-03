import React from 'react';
import type { RecordEvidenceKind, RecordSessionDraft } from '../recording/recordSession';

interface RecordLessonPanelProps {
  session: RecordSessionDraft;
  onChangeStagedNote: (note: string) => void;
  onChooseEvidence: (kind: RecordEvidenceKind) => void;
  onOpenCopilot: () => void;
  onReview: () => void;
  onRecordAnother: () => void;
  onDismiss: () => void;
}

const actionClass = 'min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800';

export const RecordLessonPanel: React.FC<RecordLessonPanelProps> = ({
  session,
  onChangeStagedNote,
  onChooseEvidence,
  onOpenCopilot,
  onReview,
  onRecordAnother,
  onDismiss
}) => {
  const udaTitle = session.context.udaTitle?.trim();
  const activityLabel = session.context.activityLabel?.trim();
  const secondaryActivityLabel = activityLabel && activityLabel !== udaTitle ? activityLabel : undefined;

  return (
    <section
      aria-label={`Registra per ${session.context.className}`}
      className="mb-5 rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4 shadow-sm dark:border-cyan-900/70 dark:bg-cyan-950/20 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Oggi · Registra</p>
          <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">Registra per {session.context.className}</h2>
          {(udaTitle || secondaryActivityLabel) && (
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {udaTitle && <p className="font-semibold">{udaTitle}</p>}
              {secondaryActivityLabel && <p className="mt-0.5">{secondaryActivityLabel}</p>}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {session.status !== 'saved' && (
            <button
              type="button"
              onClick={onOpenCopilot}
              className="min-h-[44px] rounded-xl border border-cyan-300 bg-white px-3 text-sm font-semibold text-cyan-800 dark:border-cyan-800 dark:bg-slate-900 dark:text-cyan-200"
            >
              Copilota
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Chiudi Registra"
            className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            Chiudi
          </button>
        </div>
      </div>

      {session.status === 'saved' ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-white p-4 dark:border-emerald-900 dark:bg-slate-950">
          <p className="text-sm font-black text-emerald-700 dark:text-emerald-300">Registrazione completata</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            La registrazione autorevole è stata salvata. Puoi rivedere la classe oppure registrare un altro elemento.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={onReview}
              className="min-h-[44px] rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white dark:bg-white dark:text-slate-950"
            >
              Rivedi
            </button>
            <button
              type="button"
              onClick={onRecordAnother}
              className={actionClass}
            >
              Registra altro
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4 rounded-xl border border-amber-200 bg-white p-4 dark:border-amber-900/70 dark:bg-slate-950">
            <label htmlFor="flow03-staged-note" className="text-sm font-bold text-slate-900 dark:text-white">Nota di sessione</label>
            <p className="mt-1 text-xs font-bold text-amber-700 dark:text-amber-300">Bozza temporanea — non ancora registrata</p>
            <textarea
              id="flow03-staged-note"
              value={session.stagedNote || ''}
              onChange={(event) => onChangeStagedNote(event.target.value)}
              rows={3}
              placeholder="Puoi integrare o correggere la nota prima di scegliere dove registrarla…"
              className="mt-2 min-h-[96px] w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div className="mt-4">
            <p className="text-sm font-black text-slate-950 dark:text-white">Che cosa vuoi registrare?</p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              Aprirai il modulo autorevole già esistente. Nulla viene salvato finché non confermi lì.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => onChooseEvidence('evaluation')} className={actionClass}>Valutazione</button>
              <button type="button" onClick={() => onChooseEvidence('behaviour')} className={actionClass}>Comportamento</button>
              <button type="button" onClick={() => onChooseEvidence('online-outcomes')} className={actionClass}>Esiti verifica online</button>
              <button type="button" onClick={() => onChooseEvidence('lesson-log')} className={actionClass}>Attività / nota UDA</button>
            </div>
          </div>
        </>
      )}
    </section>
  );
};
