import React, { useLayoutEffect, useRef, useState } from 'react';
import { ExternalLink, Image as ImageIcon, Link2, MoreHorizontal, Trash2 } from 'lucide-react';
import type { PlanningState } from '../planning/types';
import type { UdaActivityType, UdaRecord } from '../types';
import type { TeachingUdaCandidate } from '../teaching/teachingUdaCatalog';
import type { CopilotLaunchContext, LibraryLaunchIntent } from '../library/copilotLaunchContext';
import type { LibrarySource, LibrarySourceLink } from '../library/types';
import type { LibrarySourcePatch } from '../library/libraryState';
import { buildCapturedWebTextPatch } from '../library/intake';
import {
  resolveLibraryTeachingContextFromCatalog,
  suggestLibraryTeachingContext,
  type LibraryTeachingContext,
  type TeachingContextSuggestion,
  type TeachingContextSuggestionReason
} from '../library/teachingContext';
import { LibraryRelevancePanel } from './LibraryRelevancePanel';

interface LibrarySourceCardProps {
  source: LibrarySource;
  udas: UdaRecord[];
  teachingUdaCatalog: readonly TeachingUdaCandidate[];
  planning?: PlanningState | null;
  currentClassName?: string | null;
  lastExplicitTeachingContext?: LibraryTeachingContext | null;
  onExplicitTeachingContextChange: (context: LibraryTeachingContext) => void;
  isPending: boolean;
  isSelected: boolean;
  onUse: (sourceId: string) => void;
  onUpdate: (sourceId: string, patch: LibrarySourcePatch) => Promise<void>;
  onLink: (sourceId: string, link: LibrarySourceLink) => Promise<void>;
  onUnlink: (sourceId: string, link: LibrarySourceLink) => Promise<void>;
  onDelete: (sourceId: string) => Promise<void>;
  onOpenCopilot: (context: CopilotLaunchContext) => void;
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

type ProfessionalClassificationLabel = 'Da classificare' | 'Professionale' | 'Da rivedere';

function professionalClassificationLabel(source: LibrarySource): ProfessionalClassificationLabel {
  if (
    source.privacy === 'student-personal' ||
    source.status === 'needs-review' ||
    source.status === 'restricted' ||
    source.status === 'failed'
  ) {
    return 'Da rivedere';
  }
  if (source.privacy === 'teacher-professional') return 'Professionale';
  return 'Da classificare';
}

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

const LIBRARY_USE_ACTIONS: readonly { intent: LibraryLaunchIntent; label: string }[] = [
  { intent: 'prepare', label: 'Prepara un’attività' },
  { intent: 'review', label: 'Rivedi nel contesto' },
  { intent: 'link', label: 'Collega alla UDA' }
];

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function trapDialogFocus(event: React.KeyboardEvent<HTMLElement>, container: HTMLElement | null): void {
  if (event.key !== 'Tab' || !container) return;
  const focusable = Array.from(container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter(element => !element.hasAttribute('hidden') && element.getClientRects().length > 0);

  if (focusable.length === 0) {
    event.preventDefault();
    container.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export const LibrarySourceCard: React.FC<LibrarySourceCardProps> = ({
  source,
  udas,
  teachingUdaCatalog,
  planning = null,
  currentClassName = null,
  lastExplicitTeachingContext = null,
  onExplicitTeachingContextChange,
  isPending,
  isSelected,
  onUse,
  onUpdate,
  onLink,
  onUnlink,
  onDelete,
  onOpenCopilot
}) => {
  const [targetUdaId, setTargetUdaId] = useState('');
  const [contextUdaId, setContextUdaId] = useState('');
  const [contextLessonId, setContextLessonId] = useState('');
  const [contextSuggestion, setContextSuggestion] = useState<TeachingContextSuggestion | null>(null);
  const [contextChooserOpen, setContextChooserOpen] = useState(false);
  const initializedSourceIdRef = useRef<string | null>(null);
  const [webCaptureOpen, setWebCaptureOpen] = useState(false);
  const [webCapturedText, setWebCapturedText] = useState('');
  const [webCaptureError, setWebCaptureError] = useState<string | null>(null);
  const [isUseSurfaceOpen, setIsUseSurfaceOpen] = useState(false);
  const [isMobileDialog, setIsMobileDialog] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  );
  const useSurfaceRef = useRef<HTMLDivElement | null>(null);
  const useSurfaceCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const useButtonRef = useRef<HTMLButtonElement | null>(null);
  const useSurfacePreviousFocusRef = useRef<HTMLElement | null>(null);
  const excerpt = source.extractedText || source.payload.text;
  const webNeedsContent = source.kind === 'web' && !excerpt;
  const professionalClassification = professionalClassificationLabel(source);

  const selectedContextUda = teachingUdaCatalog.find(candidate => candidate.id === contextUdaId);
  const contextLessons = selectedContextUda?.lessons ?? [];
  const selectedContextLesson = contextLessons.find(lesson => lesson.id === contextLessonId);
  const resolvedTeachingContext = resolveLibraryTeachingContextFromCatalog(
    teachingUdaCatalog,
    contextUdaId
      ? {
          udaId: contextUdaId,
          ...(contextLessonId ? { lessonId: contextLessonId } : {})
        }
      : null
  );
  const selectableLocalUdas = udas.filter(uda =>
    teachingUdaCatalog.some(candidate => candidate.origin === 'registro' && candidate.id === uda.id)
  );

  useLayoutEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const syncMobileDialog = () => setIsMobileDialog(query.matches);
    syncMobileDialog();
    query.addEventListener('change', syncMobileDialog);
    return () => query.removeEventListener('change', syncMobileDialog);
  }, []);

  useLayoutEffect(() => {
    if (!isSelected || !isUseSurfaceOpen || !isMobileDialog) return;
    useSurfacePreviousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : useButtonRef.current;
    useSurfaceCloseButtonRef.current?.focus();

    return () => {
      const previous = useSurfacePreviousFocusRef.current ?? useButtonRef.current;
      useSurfacePreviousFocusRef.current = null;
      requestAnimationFrame(() => {
        if (previous?.isConnected) previous.focus();
      });
    };
  }, [isSelected, isUseSurfaceOpen, isMobileDialog]);

  useLayoutEffect(() => {
    if (!isSelected) {
      initializedSourceIdRef.current = null;
      setContextSuggestion(null);
      setContextChooserOpen(false);
      setIsUseSurfaceOpen(false);
      setWebCaptureOpen(false);
      setWebCapturedText('');
      setWebCaptureError(null);
      return;
    }
    if (initializedSourceIdRef.current === source.id) return;

    const suggestion = suggestLibraryTeachingContext({
      udas: selectableLocalUdas,
      currentClassName,
      lastExplicitChoice: lastExplicitTeachingContext,
      today: localDateKey()
    });
    initializedSourceIdRef.current = source.id;
    setContextSuggestion(suggestion);
    setContextChooserOpen(!suggestion);
    setContextUdaId(suggestion?.context.udaId ?? '');
    setContextLessonId(suggestion?.context.lessonId ?? '');
    setWebCaptureOpen(false);
    setWebCapturedText('');
    setWebCaptureError(null);
  }, [isSelected, source.id, udas, teachingUdaCatalog, currentClassName, lastExplicitTeachingContext]);

  const handleProfessionalClassification = async () => {
    if (professionalClassification !== 'Da classificare') return;
    if (!confirm('Confermo che è materiale professionale del docente e non contiene dati personali degli studenti.')) return;
    try {
      await onUpdate(source.id, { privacy: 'teacher-professional' });
    } catch {
      // The parent keeps the committed source and exposes the durable error state.
    }
  };

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

  const contextSelectionValue = contextUdaId
    ? (contextLessonId ? `${contextUdaId}::${contextLessonId}` : contextUdaId)
    : '';

  const selectTeachingTarget = (value: string) => {
    const [udaId = '', lessonId = ''] = value.split('::');
    setContextUdaId(udaId);
    setContextLessonId(lessonId);
    setContextSuggestion(null);
    setContextChooserOpen(true);
    if (udaId) {
      onExplicitTeachingContextChange({
        udaId,
        ...(lessonId ? { lessonId } : {})
      });
    }
  };

  const openCopilotForIntent = (intent: LibraryLaunchIntent) => {
    if (!resolvedTeachingContext) return;
    onOpenCopilot({
      surface: 'library',
      sourceId: source.id,
      className: resolvedTeachingContext.className,
      udaId: resolvedTeachingContext.udaId,
      lessonId: resolvedTeachingContext.lessonId,
      teachingContextMode: contextSuggestion ? 'proposed' : 'explicit',
      intent
    });
  };

  const selectRelevanceTeachingContext = (context: LibraryTeachingContext) => {
    setContextUdaId(context.udaId);
    setContextLessonId(context.lessonId ?? '');
    setContextSuggestion(null);
    setContextChooserOpen(true);
    onExplicitTeachingContextChange(context);
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
            <span aria-hidden="true">·</span>
            <span>{professionalClassification}</span>
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
          ref={useButtonRef}
          type="button"
          onClick={() => {
            onUse(source.id);
            setIsUseSurfaceOpen(true);
          }}
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
            {professionalClassification === 'Da classificare' && (
              <div className="rounded-md border border-amber-700/60 bg-amber-950/20 p-3 space-y-2">
                <p className="text-xs text-amber-100">
                  Prima di usare questa fonte nei flussi professionali, conferma che il materiale è del docente e non contiene dati personali degli studenti.
                </p>
                <button
                  type="button"
                  onClick={() => void handleProfessionalClassification()}
                  disabled={isPending}
                  className="min-h-[44px] w-full px-3 rounded-md border border-amber-600 text-sm font-semibold text-amber-100 disabled:opacity-50"
                >
                  Classifica come materiale professionale
                </button>
              </div>
            )}

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
                  disabled={isPending || teachingUdaCatalog.length === 0}
                  className="min-h-[44px] flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100"
                >
                  <option value="">Seleziona UDA</option>
                  {teachingUdaCatalog.map(candidate => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.title}{candidate.origin === 'docente-os' ? ' · Da Docente OS · sola lettura' : ''}
                    </option>
                  ))}
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
                    ? teachingUdaCatalog.flatMap(candidate => candidate.lessons).find(lesson => lesson.id === link.targetId)
                    : undefined;
                  const linkedUda = link.targetType === 'uda'
                    ? teachingUdaCatalog.find(candidate => candidate.id === link.targetId)
                    : undefined;
                  const label = link.targetType === 'uda'
                    ? `${linkedUda?.title || link.targetId}${linkedUda?.origin === 'docente-os' ? ' · Da Docente OS' : ''}`
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

      {isSelected && isUseSurfaceOpen && (
        <div
          ref={useSurfaceRef}
          data-testid="library-source-use-surface"
          role={isMobileDialog ? 'dialog' : undefined}
          aria-modal={isMobileDialog ? true : undefined}
          aria-labelledby={isMobileDialog ? `library-source-use-title-${source.id}` : undefined}
          tabIndex={isMobileDialog ? -1 : undefined}
          onKeyDown={event => {
            if (isMobileDialog) trapDialogFocus(event, useSurfaceRef.current);
          }}
          className="fixed inset-0 z-[90] h-[100dvh] overflow-y-auto bg-slate-950 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] text-sm text-cyan-100 space-y-3 md:static md:z-auto md:h-auto md:overflow-visible md:rounded-lg md:border md:border-cyan-800/60 md:bg-cyan-950/30 md:px-3 md:py-3"
        >
          <div className="sticky top-0 z-10 -mx-4 -mt-[max(1rem,env(safe-area-inset-top))] flex items-start justify-between gap-3 border-b border-slate-800 bg-slate-950/95 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur md:static md:mx-0 md:mt-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
            <div>
              <strong id={`library-source-use-title-${source.id}`} className="block">Che cosa vuoi farne?</strong>
              <span className="text-cyan-200/80">Apri il Copilota per rivedere, collegare o preparare questa fonte nel contesto scelto.</span>
            </div>
            <button
              ref={useSurfaceCloseButtonRef}
              type="button"
              onClick={() => setIsUseSurfaceOpen(false)}
              className="min-h-[44px] min-w-[44px] shrink-0 rounded-lg border border-slate-700 px-3 text-sm font-semibold text-slate-200 md:hidden"
              aria-label="Chiudi uso materiale"
            >
              Chiudi
            </button>
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
            ) : contextUdaId ? (
              <div>
                <strong className="block text-sm text-slate-100">Contesto scelto</strong>
                <p className="mt-1 text-sm text-cyan-100">
                  {selectedContextLesson
                    ? `Lezione · ${selectedContextLesson.topic}`
                    : `UDA · ${selectedContextUda?.title ?? contextUdaId}`}
                </p>
              </div>
            ) : (
              <strong className="block text-sm text-slate-100">Scegli dove usarla</strong>
            )}

            {selectedContextUda?.origin === 'docente-os' && (
              <p className="text-xs text-sky-200">
                Da Docente OS · sola lettura · riferimento {selectedContextUda.sourceRef}
              </p>
            )}

            <label className="block text-xs font-semibold text-slate-200" htmlFor={`context-target-${source.id}`}>
              Dove vuoi usarlo?
            </label>

            {(contextChooserOpen || !contextSuggestion) && (
              <select
                id={`context-target-${source.id}`}
                value={contextSelectionValue}
                onChange={event => selectTeachingTarget(event.target.value)}
                disabled={isPending || teachingUdaCatalog.length === 0}
                className="min-h-[44px] w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100"
              >
                <option value="">Seleziona UDA o lezione</option>
                {teachingUdaCatalog.flatMap(candidate => [
                  <option key={`${candidate.id}::uda`} value={candidate.id}>
                    {candidate.className} · {candidate.title} · Intera UDA{candidate.origin === 'docente-os' ? ' · Da Docente OS · sola lettura' : ''}
                  </option>,
                  ...candidate.lessons.map(lesson => (
                    <option key={`${candidate.id}::${lesson.id}`} value={`${candidate.id}::${lesson.id}`}>
                      {candidate.className} · {candidate.title} · {lesson.topic}{candidate.origin === 'docente-os' ? ' · Da Docente OS · sola lettura' : ''}
                    </option>
                  ))
                ])}
              </select>
            )}

            {!resolvedTeachingContext && (
              <p className="text-xs text-slate-400">Seleziona un’UDA o una lezione per continuare.</p>
            )}

            {selectedContextLesson?.activityType && (
              <p className="text-xs text-slate-300">
                Tipo di attività: <strong className="text-slate-100">{ACTIVITY_LABELS[selectedContextLesson.activityType]}</strong>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <strong className="block text-sm text-cyan-100">Cosa vuoi fare?</strong>
            <div className="grid gap-2">
              {LIBRARY_USE_ACTIONS.map(action => (
                <button
                  key={action.intent}
                  type="button"
                  onClick={() => openCopilotForIntent(action.intent)}
                  disabled={isPending || !resolvedTeachingContext}
                  className="min-h-[44px] w-full rounded-lg border border-cyan-500/50 bg-cyan-950/50 px-3 text-sm font-semibold text-cyan-100 hover:border-cyan-300 disabled:opacity-50"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          <LibraryRelevancePanel
            source={source}
            udas={selectableLocalUdas}
            planning={planning}
            teachingContext={resolvedTeachingContext}
            isPending={isPending}
            onLink={onLink}
            onSelectTeachingContext={selectRelevanceTeachingContext}
          />

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

        </div>
      )}
    </article>
  );
};