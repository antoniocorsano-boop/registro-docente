import React from 'react';
import { getRecordReviewOptions } from '../recording/reviewRouting';
import { isReviewSurface, type ReviewSessionContext, type ReviewSurface } from '../review/reviewSession';

interface ReviewRouterPanelProps {
  session: ReviewSessionContext;
  onNavigateSurface: (surface: ReviewSurface) => void;
  onDismiss: () => void;
}

const REVIEW_SURFACE_DESCRIPTIONS: Record<ReviewSurface, string> = {
  tabellone: 'Sintesi matematica delle valutazioni registrate.',
  analytics: "Indicatori e trend per leggere l'andamento.",
  storico: 'Traccia delle registrazioni e delle correzioni.',
  report: 'Dossier individuale delle evidenze disponibili.',
  'uda-gantt': 'Progressione didattica e diario della classe.',
  comportamenti: 'Evidenze comportamentali registrate.'
};

export const ReviewRouterPanel: React.FC<ReviewRouterPanelProps> = ({
  session,
  onNavigateSurface,
  onDismiss
}) => {
  const reviewOptions = getRecordReviewOptions(session.evidenceKind);
  const hasPostRecordContext = session.origin === 'post-record' && session.evidenceKind;

  return (
    <section className="neon-card p-4" aria-label={`Rivedi la classe ${session.className}`}>
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Oggi · Rivedi</p>
            <h3 className="mt-1 text-sm font-bold text-white">Stai rivedendo la classe {session.className}</h3>
            <p className="mt-1 text-sm text-slate-200">Che cosa vuoi controllare o approfondire?</p>
            {hasPostRecordContext && (
              <p className="mt-1 text-xs text-slate-400">
                L'ordine delle superfici riflette il tipo di evidenza appena registrata; scegli tu dove approfondire.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-[44px] shrink-0 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-slate-300 hover:border-[var(--primary)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            aria-label="Chiudi la sessione Rivedi"
          >
            Chiudi
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2" aria-label="Superfici di revisione disponibili">
          {reviewOptions.map(option => {
            if (!isReviewSurface(option.tab)) return null;
            return (
              <button
                key={option.tab}
                type="button"
                onClick={() => onNavigateSurface(option.tab)}
                className="min-h-[44px] rounded-lg border border-[var(--primary)]/40 bg-[var(--surface-variant)] px-3 py-3 text-left transition-colors hover:border-[var(--primary)] hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <span className="block text-sm font-semibold text-[var(--primary)]">{option.label}</span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-400">
                  {REVIEW_SURFACE_DESCRIPTIONS[option.tab]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
