import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Image as ImageIcon, Link2, MoreHorizontal, Trash2 } from 'lucide-react';
import type { ResolvedAction } from '@trama/contextual-copilot-core';
import type { UdaActivityType, UdaRecord } from '../types';
import type { LibrarySource, LibrarySourceLink } from '../library/types';
import type { LibrarySourcePatch } from '../library/libraryState';
import { buildCapturedWebTextPatch } from '../library/intake';
import {
  dispatchLibraryContextAction,
  resolveLibraryContextActions
} from '../library/contextualCoreAdapter';
import {
  resolveLibraryTeachingContext,
  suggestLibraryTeachingContext,
  type LibraryTeachingContext,
  type TeachingContextSuggestion,
  type TeachingContextSuggestionReason
} from '../library/teachingContext';
import { LibraryProposalPanel } from './LibraryProposalPanel';

interface LibrarySourceCardProps {
  source: LibrarySource;
  udas: UdaRecord[];
  currentClassName?: string | null;
  lastExplicitTeachingContext?: LibraryTeachingContext | null;
  onExplicitTeachingContextChange: (context: LibraryTeachingContext) => void;
  isPending: boolean;
  isSelected: boolean;
  onUse: (sourceId: string) => void;
  onAddSource: (source: LibrarySource) => Promise<void>;
  onUpdate: (sourceId: string, patch: LibrarySourcePatch) => Promise<void>;
  onLink: (sourceId: string, link: LibrarySourceLink) => Promise<void>;
  onUnlink: (sourceId: string, link: LibrarySourceLink) => Promise<void>;
  onDelete: (sourceId: string) => Promise<void>;
}

const KIND_LABELS: Record<LibrarySource['kind'], string> = {
  image: 'Immagine',
  file: 'File',
  web: 'Web',
  text: 'Testo',
  note: 'Appunto',
  concept: 'Idea',
  internal: 'Materiale interno'
};

const STATUS_LABELS: Record<LibrarySource['status'], string> = {
  captured: 'Acquisita',
  ready: 'Pronta',
  'needs-review': 'Da rivedere',
  restricted: 'Uso limitato',
  failed: 'Da riprovare'
};

const PRIVACY_LABELS: Record<LibrarySource['privacy'], string> = {
  unknown: 'Privacy da verificare',
  'teacher-professional': 'Materiale professionale del docente',
  'student-personal': 'Può contenere dati personali di studenti'
};

const ACTIVITY_LABELS: Record<UdaActivityType, string> = {
  teoria: 'Teoria',
  laboratorio: 'Laboratorio',
  compito_realta: 'Compito di realtà',
  digitale: 'Attività digitale',
  civica: 'Educazione civica'
};

const SUGGESTION_COPY: Record<TeachingContextSuggestionReason, string> = {
  'explicit-origin': 'Ti propongo questo contesto perché è quello da cui sei arrivato.',
  'current-class-today-lesson': 'Ti propongo questa lezione perché appartiene alla classe corrente ed è prevista oggi.',
  'current-class-active-uda': "Ti propongo questa UDA perché è l'unica attiva per la classe corrente in questo periodo.",
  'session-last-choice': "Ti propongo l'ultimo contesto che hai scelto in questa sessione."
};

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const LibrarySourceCard: React.FC<LibrarySourceCardProps> = ({
  source,
  udas,
  currentClassName = null,
  lastExplicitTeachingContext = null,
  onExplicitTeachingContextChange,
  isPending,
  isSelected,
  onUse,
  onAddSource,
  onUpdate,
  onLink,
  onUnlink,
  onDelete
}) => {
  const [targetUdaId, setTargetUdaId] = useState('');
  const [contextUdaId, setContextUdaId] = useState('');
  const [contextLessonId, setContextLessonId] = useState('');
  const [contextSuggestion, setContextSuggestion] = useState<TeachingContextSuggestion | null>(null);
  const [contextChooserOpen, setContextChooserOpen] = useState(false);
  const initializedSourceIdRef = useRef<string | null>(null);
  const [contextActions, setContextActions] = useState<readonly ResolvedAction[]>([]);
  const [isContextLoading, setIsContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [contextLinkOpen, setContextLinkOpen] = useState(false);
  const [contextLinkConfirmationPending, setContextLinkConfirmationPending] = useState(false);
  const [webCaptureOpen, setWebCaptureOpen] = useState(false);
  const [webCapturedText, setWebCapturedText] = useState('');
  const [webCaptureError, setWebCaptureError] = useState<string | null>(null);
  const excerpt = source.extractedText || source.payload.text;
  const webNeedsContent = source.kind === 'web' && !excerpt;

  const selectedContextUda = udas.find(uda => uda.id === contextUdaId);
  const contextLessons = selectedContextUda?.lessons ?? [];
  const selectedContextLesson = contextLessons.find(lesson => lesson.id === contextLessonId);
  const resolvedTeachingContext = resolveLibraryTeachingContext(
    udas,
    contextUdaId
      ? {
          udaId: contextUdaId,
          ...(contextLessonId ? { lessonId: contextLessonId } : {})
        }
      : null
  );

  useEffect(() => {
    if (!isSelected) {
      initializedSourceIdRef.current = null;
      setContextSuggestion(null);
      setContextChooserOpen(false);
      setWebCaptureOpen(false);
      setWebCapturedText('');
      setWebCaptureError(null);
      return;
    }
    if (initializedSourceIdRef.current === source.id) return;

    const suggestion = suggestLibraryTeachingContext({
      udas,
      currentClassName,
      lastExplicitChoice: lastExplicitTeachingContext,
      today: localDateKey()
    });
    initializedSourceIdRef.current = source.id;
    setContextSuggestion(suggestion);
    setContextChooserOpen(!suggestion);
    setContextUdaId(suggestion?.context.udaId ?? '');
    setContextLessonId(suggestion?.context.lessonId ?? '');
    setContextLinkOpen(false);
    setContextLinkConfirmationPending(false);
    setReviewOpen(false);
    setWebCaptureOpen(false);
    setWebCapturedText('');
    setWebCaptureError(null);
  }, [isSelected, source.id, udas, currentClassName, lastExplicitTeachingContext]);

  useEffect(() => {
    let cancelled = false;

    if (!isSelected) {
      setContextUdaId('');
      setContextLessonId('');
      setContextActions([]);
      setIsContextLoading(false);
      setContextError(null);
      setReviewOpen(false);
      setContextLinkOpen(false);
      setContextLinkConfirmationPending(false);
      return () => {
        cancelled = true;
      };
    }

    setIsContextLoading(true);
    setContextError(null);
    void resolveLibraryContextActions(source, resolvedTeachingContext)
      .then(actions => {
        if (!cancelled) setContextActions(actions);
      })
      .catch(() => {
        if (!cancelled) {
          setContextActions([]);
          setContextError('Le azioni contestuali non sono disponibili in questo momento. La fonte resta invariata.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsContextLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    isSelected,
    source.id,
    source.kind,
    source.status,
    source.privacy,
    source.links.length,
    contextUdaId,
    contextLessonId
  ]);

  const handleRename = async () => {
    const title = prompt('Nuovo titolo della fonte:', source.title)?.trim();
    if (!title || title === source.title) return;
    try {
      await onUpdate(source.id, { title });
    } catch {
      // The parent keeps the committed source and exposes the durable error state.
    }
  };

  const handleLink = async () => {
    if (!targetUdaId) return;
    try {
      await onLink(source.id, { targetType: 'uda', targetId: targetUdaId });
      setTargetUdaId('');
    } catch {
      // Keep the selected target available for retry.
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Eliminare dalla biblioteca “${source.title}”?`)) return;
    try {
      await onDelete(source.id);
    } catch {
      // The source remains visible because publication happens only after persistence.
    }
  };

  const selectExplicitUda = (udaId: string) => {
    setContextUdaId(udaId);
    setContextLessonId('');
    setContextSuggestion(null);
    setContextChooserOpen(true);
    setContextLinkOpen(false);
    setContextLinkConfirmationPending(false);
    setReviewOpen(false);
    if (udaId) onExplicitTeachingContextChange({ udaId });
  };

  const selectExplicitLesson = (lessonId: string) => {
    setContextLessonId(lessonId);
    setContextSuggestion(null);
    setContextChooserOpen(true);
    setContextLinkOpen(false);
    setContextLinkConfirmationPending(false);
    setReviewOpen(false);
    if (contextUdaId) {
      onExplicitTeachingContextChange({
        udaId: contextUdaId,
        ...(lessonId ? { lessonId } : {})
      });
    }
  };

  const handleContextAction = (actionId: string) => {
    setContextError(null);
    if (actionId === 'review-source') {
      setReviewOpen(true);
      setContextLinkOpen(false);
      setContextLinkConfirmationPending(false);
      return;
    }
    if (actionId === 'link-source-to-uda') {
      if (!resolvedTeachingContext) {
        setContextError('Seleziona prima l’UDA del contesto di lavoro.');
        return;
      }
      setContextLinkOpen(true);
      setReviewOpen(false);
      setContextLinkConfirmationPending(false);
    }
  };

  const saveCapturedWebText = async () => {
    setWebCaptureError(null);
    try {
      const patch = buildCapturedWebTextPatch(source, webCapturedText);
      await onUpdate(source.id, patch);
      setWebCaptureOpen(false);
      setWebCapturedText('');
    } catch (reason) {
      setWebCaptureError(
        reason instanceof Error && reason.message
          ? reason.message
          : 'Salvataggio del contenuto non riuscito. Puoi riprovare senza perdere il testo.'
      );
    }
  };

  const requestContextualLinkConfirmation = async () => {
    if (!resolvedTeachingContext) {
      setContextError('Il contesto di lavoro non è più valido. Riseleziona l’UDA.');
      return;
    }
    setContextError(null);
    const result = await dispatchLibraryContextAction({
      source,
      teachingContext: resolvedTeachingContext,
      actionId: 'link-source-to-uda',
      executor: async () => undefined
    });

    if (result.status === 'HUMAN_CONFIRMATION_REQUIRED') {
      setContextLinkConfirmationPending(true);
      return;
    }
    setContextError('Il collegamento non è autorizzato nel contesto corrente.');
  };

  const confirmContextualLink = async () => {
    if (!resolvedTeachingContext) {
      setContextError('Il contesto di lavoro non è più valido. Riseleziona l’UDA.');
      return;
    }

    const contextualLink: LibrarySourceLink = resolvedTeachingContext.lessonId
      ? { targetType: 'lesson', targetId: resolvedTeachingContext.lessonId }
      : { targetType: 'uda', targetId: resolvedTeachingContext.udaId };

    setContextError(null);
    try {
      const result = await dispatchLibraryContextAction({
        source,
        teachingContext: resolvedTeachingContext,
        actionId: 'link-source-to-uda',
        humanConfirmed: true,
        executor: () => onLink(source.id, contextualLink)
      });
      if (result.status !== 'EXECUTED') {
        setContextError('Il collegamento non è stato applicato.');
        return;
      }
      setContextLinkConfirmationPending(false);
      setContextLinkOpen(false);
    } catch {
      setContextError('Salvataggio del collegamento non riuscito. Puoi riprovare senza riselezionare la fonte.');
    }
  };

  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm space-y-3">
      <div className="flex gap-3 items-start">
        {source.kind === 'image' && source.payload.dataUrl ? (
          <img
            src={source.payload.dataUrl}
            alt=""
            className="w-16 h-16 rounded-lg object-cover border border-[var(--border)] bg-slate-950 shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] flex items-center justify-center shrink-0 text-[var(--primary)]">
            <ImageIcon className="w-5 h-5" aria-hidden="true" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mb-1">
            <span>{KIND_LABELS[source.kind]}</span>
            <span aria-hidden="true">·</span>
            <span>{STATUS_LABELS[source.status]}</span>
          </div>
          <h3 className="font-semibold text-white leading-snug break-words">{source.title}</h3>
          {source.origin && <p className="text-xs text-slate-400 mt-1 break-words">{source.origin}</p>}
        </div>
      </div>

      {excerpt && (
        <p className="text-sm text-slate-300 leading-relaxed line-clamp-3">{excerpt}</p>
      )}

      {source.sourceUrl && (
        <a
          href={source.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--primary)] hover:underline break-all"
        >
          <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          Apri origine
        </a>
      )}

      <div className="flex gap-2 items-center">
        <button
          type="button"
          onClick={() => onUse(source.id)}
          disabled={isPending}
          className="min-h-[44px] px-4 rounded-lg bg-[var(--primary)] text-slate-950 font-semibold text-sm disabled:opacity-50"
        >
          Usa
        </button>

        <details className="relative flex-1 group">
          <summary className="list-none min-h-[44px] px-3 rounded-lg border border-[var(--border)] bg-[var(--surface-variant)] text-slate-200 text-sm inline-flex items-center gap-2 cursor-pointer select-none">
            <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
            Gestisci
          </summary>
          <div className="mt-2 p-3 rounded-lg border border-[var(--border)] bg-slate-950/70 space-y-3">
            <button
              type="button"
              onClick={() => void handleRename()}
              disabled={isPending}
              className="min-h-[44px] px-3 rounded-md border border-slate-700 text-sm text-slate-200 disabled:opacity-50"
            >
              Rinomina
            </button>

            <div className="space-y-2">
              <label className="text-xs text-slate-400 block" htmlFor={`link-${source.id}`}>
                Collega a UDA
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  id={`link-${source.id}`}
                  value={targetUdaId}
                  onChange={event => setTargetUdaId(event.target.value)}
                  disabled={isPending || udas.length === 0}
                  className="min-h-[44px] flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100"
                >
                  <option value="">Seleziona UDA</option>
                  {udas.map(uda => <option key={uda.id} value={uda.id}>{uda.title}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => void handleLink()}
                  disabled={isPending || !targetUdaId}
                  className="min-h-[44px] px-3 rounded-md border border-slate-700 text-sm text-slate-200 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                >
                  <Link2 className="w-4 h-4" aria-hidden="true" />
                  Collega
                </button>
              </div>
            </div>

            {source.links.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-400">Collegamenti</p>
                {source.links.map(link => {
                  const linkedLesson = link.targetType === 'lesson'
                    ? udas.flatMap(uda => uda.lessons ?? []).find(lesson => lesson.id === link.targetId)
                    : undefined;
                  const label = link.targetType === 'uda'
                    ? udas.find(uda => uda.id === link.targetId)?.title || link.targetId
                    : linkedLesson?.topic || link.targetId;
                  return (
                    <div key={`${link.targetType}:${link.targetId}`} className="flex items-center justify-between gap-2 text-xs bg-slate-900 rounded-md px-2 py-1.5">
                      <span className="truncate text-slate-300">{label}</span>
                      <button
                        type="button"
                        onClick={() => void onUnlink(source.id, link).catch(() => undefined)}
                        disabled={isPending}
                        className="min-h-[44px] px-2 text-slate-300 hover:text-white disabled:opacity-50"
                      >
                        Scollega
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={isPending}
              className="min-h-[44px] px-3 rounded-md border border-red-900/60 text-red-300 text-sm disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              Elimina
            </button>
          </div>
        </details>
      </div>

      {isSelected && (
        <div className="rounded-lg border border-cyan-800/60 bg-cyan-950/30 px-3 py-3 text-sm text-cyan-100 space-y-3">
          <div>
            <strong className="block">Che cosa vuoi farne?</strong>
            <span className="text-cyan-200/80">Vedi solo le azioni ammesse per questa fonte. La selezione non modifica UDA o lezioni.</span>
          </div>

          <div className="rounded-lg border border-cyan-900/70 bg-slate-950/40 p-3 space-y-2">
            {contextSuggestion ? (
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                  <strong className="block text-sm text-slate-100">Contesto proposto</strong>
                  <p className="mt-1 text-sm text-cyan-100">
                    {selectedContextLesson
                      ? `Lezione · ${selectedContextLesson.topic}`
                      : `UDA · ${selectedContextUda?.title ?? contextSuggestion.context.udaId}`}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{SUGGESTION_COPY[contextSuggestion.reason]}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setContextChooserOpen(true)}
                  disabled={isPending}
                  className="min-h-[44px] px-3 rounded-md border border-cyan-700 text-sm text-cyan-100 disabled:opacity-50"
                >
                  Cambia
                </button>
              </div>
            ) : (
              <strong className="block text-sm text-slate-100">Scegli dove usarla</strong>
            )}

            {(contextChooserOpen || !contextSuggestion) && (
              <>
                <label className="block text-xs text-slate-300" htmlFor={`context-uda-${source.id}`}>
                  UDA corrente
                </label>
                <select
                  id={`context-uda-${source.id}`}
                  value={contextUdaId}
                  onChange={event => selectExplicitUda(event.target.value)}
                  disabled={isPending || udas.length === 0}
                  className="min-h-[44px] w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100"
                >
                  <option value="">Seleziona UDA</option>
                  {udas.map(uda => <option key={uda.id} value={uda.id}>{uda.title}</option>)}
                </select>

                {selectedContextUda && contextLessons.length > 0 && (
                  <>
                    <label className="block text-xs text-slate-300" htmlFor={`context-lesson-${source.id}`}>
                      Lezione corrente
                    </label>
                    <select
                      id={`context-lesson-${source.id}`}
                      value={contextLessonId}
                      onChange={event => selectExplicitLesson(event.target.value)}
                      disabled={isPending}
                      className="min-h-[44px] w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100"
                    >
                      <option value="">Intera UDA</option>
                      {contextLessons.map(lesson => (
                        <option key={lesson.id} value={lesson.id}>{lesson.topic}</option>
                      ))}
                    </select>
                  </>
                )}

                {!contextUdaId && (
                  <p className="text-xs text-slate-400">Seleziona un’UDA per usare la fonte nel contesto didattico.</p>
                )}
              </>
            )}

            {selectedContextLesson?.activityType && (
              <p className="text-xs text-slate-300">
                Tipo di attività: <strong className="text-slate-100">{ACTIVITY_LABELS[selectedContextLesson.activityType]}</strong>
              </p>
            )}
          </div>

          {webNeedsContent && (
            <div className="rounded-lg border border-cyan-800/60 bg-cyan-950/20 p-3 space-y-3">
              <div>
                <strong className="block text-sm text-cyan-100">Contenuto web non ancora acquisito</strong>
                <p className="mt-1 text-xs text-cyan-200/80">
                  L’indirizzo è salvato, ma il Registro non scarica automaticamente la pagina. Aggiungi il testo o un estratto quando vuoi usarlo per una proposta didattica.
                </p>
              </div>

              {!webCaptureOpen ? (
                <button
                  type="button"
                  onClick={() => {
                    setWebCaptureError(null);
                    setWebCaptureOpen(true);
                  }}
                  disabled={isPending}
                  className="min-h-[44px] px-3 rounded-md border border-cyan-700 text-sm text-cyan-100 disabled:opacity-50"
                >
                  Aggiungi testo della pagina
                </button>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs text-cyan-100" htmlFor={`web-captured-text-${source.id}`}>
                    Testo della pagina
                  </label>
                  <textarea
                    id={`web-captured-text-${source.id}`}
                    value={webCapturedText}
                    onChange={event => setWebCapturedText(event.target.value)}
                    disabled={isPending}
                    rows={5}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void saveCapturedWebText()}
                      disabled={isPending || !webCapturedText.trim()}
                      className="min-h-[44px] px-3 rounded-md bg-cyan-200 text-cyan-950 font-semibold text-sm disabled:opacity-50"
                    >
                      Salva contenuto
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setWebCaptureOpen(false);
                        setWebCaptureError(null);
                      }}
                      disabled={isPending}
                      className="min-h-[44px] px-3 rounded-md border border-slate-700 text-slate-200 text-sm disabled:opacity-50"
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              )}

              {webCaptureError && <p role="alert" className="text-xs text-amber-200">{webCaptureError}</p>}
            </div>
          )}

          {!webNeedsContent && resolvedTeachingContext && selectedContextUda && (
            <LibraryProposalPanel
              source={source}
              uda={selectedContextUda}
              teachingContext={resolvedTeachingContext}
              isPending={isPending}
              onAddSource={onAddSource}
              onUpdate={onUpdate}
            />
          )}

          {isContextLoading && <p role="status" className="text-xs text-cyan-200/80">Valuto le azioni disponibili…</p>}
          {contextError && <p role="alert" className="text-xs text-amber-200">{contextError}</p>}

          {!isContextLoading && contextActions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {contextActions.map(action => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => handleContextAction(action.id)}
                  disabled={isPending}
                  className="min-h-[44px] px-3 rounded-lg border border-cyan-700/70 bg-cyan-950/50 text-cyan-100 text-sm font-medium disabled:opacity-50"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}

          {reviewOpen && (
            <div className="rounded-lg border border-cyan-900/70 bg-slate-950/40 px-3 py-2 text-xs text-slate-300 space-y-1">
              <p><strong className="text-slate-100">Contesto locale</strong></p>
              <p>{KIND_LABELS[source.kind]} · {STATUS_LABELS[source.status]}</p>
              <p>{PRIVACY_LABELS[source.privacy]}</p>
              {selectedContextUda && <p>UDA: {selectedContextUda.title}</p>}
              {selectedContextLesson && <p>Lezione: {selectedContextLesson.topic}</p>}
              <p>{source.links.length === 0 ? 'Nessun collegamento didattico.' : `${source.links.length} collegamento/i didattico/i.`}</p>
            </div>
          )}

          {contextLinkOpen && resolvedTeachingContext && (
            <div className="rounded-lg border border-cyan-900/70 bg-slate-950/40 p-3 space-y-2">
              <p className="text-xs text-slate-300">
                Destinazione: <strong className="text-slate-100">
                  {selectedContextLesson ? `Lezione · ${selectedContextLesson.topic}` : `UDA · ${selectedContextUda?.title ?? resolvedTeachingContext.udaId}`}
                </strong>
              </p>

              {!contextLinkConfirmationPending ? (
                <button
                  type="button"
                  onClick={() => void requestContextualLinkConfirmation()}
                  disabled={isPending}
                  className="min-h-[44px] px-3 rounded-md border border-cyan-700 text-sm text-cyan-100 disabled:opacity-50"
                >
                  Continua
                </button>
              ) : (
                <div className="rounded-md border border-amber-700/60 bg-amber-950/20 p-3 space-y-2">
                  <p className="text-xs text-amber-100">
                    {selectedContextLesson
                      ? 'Confermi il collegamento della fonte alla lezione selezionata?'
                      : 'Confermi il collegamento della fonte alla UDA selezionata?'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void confirmContextualLink()}
                      disabled={isPending}
                      className="min-h-[44px] px-3 rounded-md bg-[var(--primary)] text-slate-950 font-semibold text-sm disabled:opacity-50"
                    >
                      Conferma collegamento
                    </button>
                    <button
                      type="button"
                      onClick={() => setContextLinkConfirmationPending(false)}
                      disabled={isPending}
                      className="min-h-[44px] px-3 rounded-md border border-slate-700 text-slate-200 text-sm disabled:opacity-50"
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
};