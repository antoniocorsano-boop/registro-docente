import React from 'react';
import type { ReviewSessionContext, ReviewSurface } from '../review/reviewSession';

interface ReviewMissionBannerProps {
  session: ReviewSessionContext;
  onReturn: () => void;
  onDismiss: () => void;
}

const REVIEW_SURFACE_LABELS: Record<ReviewSurface, string> = {
  tabellone: 'Tabellone',
  analytics: 'Analisi',
  storico: 'Storico',
  report: 'Scheda alunno',
  'uda-gantt': 'UDA e diario',
  comportamenti: 'Comportamento'
};

export const ReviewMissionBanner: React.FC<ReviewMissionBannerProps> = ({
  session,
  onReturn,
  onDismiss
}) => {
  const currentSurfaceLabel = session.currentSurface
    ? REVIEW_SURFACE_LABELS[session.currentSurface]
    : null;

  return (
    <aside
      className="neon-card mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
      aria-label={`Sessione Rivedi per la classe ${session.className}`}
    >
      <div className="min-w-0">
        <p className="text-xs font-bold text-[var(--primary)]">Rivedi · {session.className}</p>
        {currentSurfaceLabel && (
          <p className="mt-1 text-xs text-slate-400">Superficie corrente: {currentSurfaceLabel}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onReturn}
          className="min-h-[44px] rounded-lg border border-[var(--primary)]/50 px-3 py-2 text-xs font-semibold text-[var(--primary)] hover:border-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          Torna a Rivedi
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-[44px] rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-slate-300 hover:border-[var(--primary)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          Chiudi
        </button>
      </div>
    </aside>
  );
};
