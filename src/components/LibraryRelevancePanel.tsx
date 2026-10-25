import React, { useEffect, useMemo, useState } from 'react';
import type { PlanningStateV1 } from '../planning/types';
import type { UdaRecord } from '../types';
import { dispatchLibraryContextAction } from '../library/contextualCoreAdapter';
import {
  describeLibraryRelevanceCandidate,
  resolvePlanningContextForLibraryRelevance,
  type LibraryRelevancePresentation
} from '../library/relevancePresentation';
import {
  resolveLibraryRelevance,
  type LibraryRelevanceResolution
} from '../library/relevanceResolver';
import {
  resolveLibraryTeachingContext,
  type LibraryTeachingContext,
  type ResolvedLibraryTeachingContext
} from '../library/teachingContext';
import type { LibrarySource, LibrarySourceLink } from '../library/types';

interface LibraryRelevancePanelProps {
  source: LibrarySource;
  udas: UdaRecord[];
  planning?: PlanningStateV1 | null;
  teachingContext: ResolvedLibraryTeachingContext | null;
  isPending: boolean;
  onLink: (sourceId: string, link: LibrarySourceLink) => Promise<void>;
  onSelectTeachingContext: (context: LibraryTeachingContext) => void;
}

interface PresentedCandidate {
  key: string;
  presentation: LibraryRelevancePresentation;
}

function candidateKey(targetType: 'uda' | 'lesson', targetId: string): string {
  return `${targetType}:${targetId}`;
}

function teachingContextForCandidate(
  presentation: LibraryRelevancePresentation,
  udas: UdaRecord[]
): ResolvedLibraryTeachingContext | null {
  return resolveLibraryTeachingContext(
    udas,
    presentation.targetType === 'lesson'
      ? { udaId: presentation.udaId, lessonId: presentation.targetId }
      : { udaId: presentation.udaId }
  );
}

function resolveCurrentRelevance(
  source: LibrarySource,
  udas: UdaRecord[],
  teachingContext: ResolvedLibraryTeachingContext | null,
  planning?: PlanningStateV1 | null
): LibraryRelevanceResolution {
  const planningContext = planning
    ? resolvePlanningContextForLibraryRelevance(teachingContext, planning)
    : null;

  return resolveLibraryRelevance({
    source,
    udas,
    teachingContext,
    planningContext
  });
}

export const LibraryRelevancePanel: React.FC<LibraryRelevancePanelProps> = ({
  source,
  udas,
  planning = null,
  teachingContext,
  isPending,
  onLink,
  onSelectTeachingContext
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [ignored, setIgnored] = useState<Set<string>>(() => new Set());
  const [resolution, setResolution] = useState<LibraryRelevanceResolution | null>(null);
  const [pendingLinkKey, setPendingLinkKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const contextIdentity = teachingContext
    ? `${teachingContext.udaId}:${teachingContext.lessonId ?? ''}:${teachingContext.className}:${teachingContext.period}`
    : '';
  const linkIdentity = source.links
    .map(link => `${link.targetType}:${link.targetId}`)
    .sort()
    .join('|');

  const refresh = () => {
    setError(null);
    setPendingLinkKey(null);
    setResolution(resolveCurrentRelevance(source, udas, teachingContext, planning));
  };

  useEffect(() => {
    setIsOpen(false);
    setExpanded(false);
    setIgnored(new Set());
    setResolution(null);
    setPendingLinkKey(null);
    setError(null);
  }, [source.id, contextIdentity]);

  useEffect(() => {
    if (!isOpen) return;
    setResolution(resolveCurrentRelevance(source, udas, teachingContext, planning));
    setPendingLinkKey(null);
  }, [isOpen, linkIdentity, source.title, source.extractedText, source.payload.text, source.notes, udas, planning, contextIdentity]);

  const presented = useMemo<PresentedCandidate[]>(() => {
    if (resolution?.status !== 'ranked') return [];

    return resolution.candidates.flatMap(candidate => {
      const key = candidateKey(candidate.targetType, candidate.targetId);
      if (ignored.has(key)) return [];
      const presentation = describeLibraryRelevanceCandidate(candidate, udas);
      return presentation ? [{ key, presentation }] : [];
    });
  }, [resolution, ignored, udas]);

  const visible = expanded ? presented : presented.slice(0, 3);

  const startLink = async (candidate: PresentedCandidate) => {
    const resolvedCandidateContext = teachingContextForCandidate(candidate.presentation, udas);
    if (!resolvedCandidateContext) {
      setError('La destinazione non è più disponibile. Aggiorna i suggerimenti.');
      return;
    }

    setError(null);
    const result = await dispatchLibraryContextAction({
      source,
      teachingContext: resolvedCandidateContext,
      actionId: 'link-source-to-uda',
      executor: async () => undefined
    });

    if (result.status === 'HUMAN_CONFIRMATION_REQUIRED') {
      setPendingLinkKey(candidate.key);
      return;
    }

    setError('Il collegamento non è autorizzato nel contesto corrente.');
  };

  const confirmLink = async (candidate: PresentedCandidate) => {
    setError(null);

    const current = resolveCurrentRelevance(source, udas, teachingContext, planning);
    const stillValid = current.status === 'ranked'
      ? current.candidates.find(item => candidateKey(item.targetType, item.targetId) === candidate.key)
      : undefined;

    if (!stillValid) {
      setPendingLinkKey(null);
      setResolution(current);
      setError('La destinazione è cambiata o è già collegata. Ho aggiornato i suggerimenti.');
      return;
    }

    const currentPresentation = describeLibraryRelevanceCandidate(stillValid, udas);
    const resolvedCandidateContext = currentPresentation
      ? teachingContextForCandidate(currentPresentation, udas)
      : null;
    if (!currentPresentation || !resolvedCandidateContext) {
      setPendingLinkKey(null);
      setResolution(current);
      setError('La destinazione non è più disponibile. Ho aggiornato i suggerimenti.');
      return;
    }

    const link: LibrarySourceLink = currentPresentation.targetType === 'lesson'
      ? { targetType: 'lesson', targetId: currentPresentation.targetId }
      : { targetType: 'uda', targetId: currentPresentation.targetId };

    try {
      const result = await dispatchLibraryContextAction({
        source,
        teachingContext: resolvedCandidateContext,
        actionId: 'link-source-to-uda',
        humanConfirmed: true,
        executor: () => onLink(source.id, link)
      });

      if (result.status !== 'EXECUTED') {
        setError('Il collegamento non è stato applicato.');
        return;
      }

      setPendingLinkKey(null);
    } catch {
      setError('Salvataggio del collegamento non riuscito. Puoi riprovare.');
    }
  };

  const selectForPreparation = (candidate: PresentedCandidate) => {
    const nextContext: LibraryTeachingContext = candidate.presentation.targetType === 'lesson'
      ? { udaId: candidate.presentation.udaId, lessonId: candidate.presentation.targetId }
      : { udaId: candidate.presentation.udaId };
    setPendingLinkKey(null);
    setError(null);
    onSelectTeachingContext(nextContext);
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          setExpanded(false);
          setResolution(resolveCurrentRelevance(source, udas, teachingContext, planning));
        }}
        disabled={isPending}
        className="min-h-[44px] px-3 rounded-lg border border-cyan-700/70 bg-cyan-950/50 text-cyan-100 text-sm font-medium disabled:opacity-50"
      >
        Trova dove può servire
      </button>
    );
  }

  return (
    <section
      role="region"
      aria-label="Dove può servire questa fonte"
      className="rounded-lg border border-cyan-900/70 bg-slate-950/45 p-3 space-y-3"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <strong className="block text-sm text-slate-100">Dove può servire questa fonte</strong>
          <p className="mt-1 text-xs text-slate-400">Sono suggerimenti locali: scegli tu se usarli.</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={isPending}
          className="min-h-[44px] px-3 rounded-md border border-slate-700 text-sm text-slate-200 disabled:opacity-50"
        >
          Aggiorna suggerimenti
        </button>
      </div>

      {resolution?.status === 'unavailable' && (
        <p className="text-xs text-slate-300">
          {resolution.reason === 'SOURCE_AND_CONTEXT_UNAVAILABLE'
            ? 'Completa il contenuto della fonte o scegli un contesto didattico per cercare collegamenti.'
            : 'Non ho trovato collegamenti utili con i dati disponibili.'}
        </p>
      )}

      {visible.length > 0 && (
        <div className="space-y-2">
          {visible.map(candidate => (
            <article
              key={candidate.key}
              data-relevance-candidate="true"
              className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 space-y-2"
            >
              <div>
                <strong className="block text-sm text-slate-100">{candidate.presentation.title}</strong>
                <p className="mt-0.5 text-xs text-slate-400">{candidate.presentation.subtitle}</p>
              </div>

              {candidate.presentation.reasons.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {candidate.presentation.reasons.map(reason => (
                    <span key={reason} className="rounded-full border border-slate-700 px-2 py-1 text-[11px] text-slate-300">
                      {reason}
                    </span>
                  ))}
                </div>
              )}

              {pendingLinkKey === candidate.key ? (
                <div className="rounded-md border border-amber-700/60 bg-amber-950/20 p-3 space-y-2">
                  <p className="text-xs text-amber-100">Confermi il collegamento a questa destinazione?</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void confirmLink(candidate)}
                      disabled={isPending}
                      className="min-h-[44px] px-3 rounded-md bg-[var(--primary)] text-slate-950 font-semibold text-sm disabled:opacity-50"
                    >
                      Conferma collegamento
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingLinkKey(null)}
                      disabled={isPending}
                      className="min-h-[44px] px-3 rounded-md border border-slate-700 text-slate-200 text-sm disabled:opacity-50"
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void startLink(candidate)}
                    disabled={isPending}
                    className="min-h-[44px] px-3 rounded-md border border-cyan-700 text-sm text-cyan-100 disabled:opacity-50"
                  >
                    Collega
                  </button>
                  <button
                    type="button"
                    onClick={() => selectForPreparation(candidate)}
                    disabled={isPending}
                    className="min-h-[44px] px-3 rounded-md border border-slate-700 text-sm text-slate-200 disabled:opacity-50"
                  >
                    Usa per preparare
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIgnored(current => new Set([...current, candidate.key]));
                      if (pendingLinkKey === candidate.key) setPendingLinkKey(null);
                    }}
                    disabled={isPending}
                    className="min-h-[44px] px-3 rounded-md border border-slate-800 text-sm text-slate-400 disabled:opacity-50"
                  >
                    Ignora
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {!expanded && presented.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="min-h-[44px] px-3 rounded-md border border-slate-700 text-sm text-slate-200"
        >
          Mostra altri risultati
        </button>
      )}

      {error && <p role="alert" className="text-xs text-amber-200">{error}</p>}
    </section>
  );
};
