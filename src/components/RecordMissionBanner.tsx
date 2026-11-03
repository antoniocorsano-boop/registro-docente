import React from 'react';
import type { RecordEvidenceKind } from '../recording/recordSession';

interface RecordMissionBannerProps {
  className: string;
  evidenceKind: RecordEvidenceKind;
  udaTitle?: string;
  activityLabel?: string;
  onReturn: () => void;
}

const evidenceLabels: Record<RecordEvidenceKind, string> = {
  evaluation: 'Valutazione',
  behaviour: 'Comportamento',
  'online-outcomes': 'Esiti verifica online',
  'lesson-log': 'Attività / nota UDA'
};

export const RecordMissionBanner: React.FC<RecordMissionBannerProps> = ({
  className,
  evidenceKind,
  udaTitle,
  activityLabel,
  onReturn
}) => {
  const contextLabel = activityLabel?.trim() || udaTitle?.trim();

  return (
    <section
      aria-label={`Missione Registra per ${className}`}
      className="mb-4 flex flex-col gap-3 rounded-2xl border border-cyan-800/70 bg-cyan-950/30 p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-4"
    >
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-wide text-cyan-300">Stai registrando · {className}</p>
        <p className="mt-1 text-sm font-bold text-white">{evidenceLabels[evidenceKind]}</p>
        {contextLabel && (
          <p className="mt-1 truncate text-xs text-slate-400">{contextLabel}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onReturn}
        className="min-h-[44px] shrink-0 rounded-xl border border-cyan-700 bg-slate-950 px-4 py-2 text-sm font-bold text-cyan-200 transition-colors hover:border-cyan-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
      >
        Torna a Registra
      </button>
    </section>
  );
};
