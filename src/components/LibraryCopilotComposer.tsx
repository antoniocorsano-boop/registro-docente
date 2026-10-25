import React, { useMemo, useRef, useState } from 'react';
import { BookOpen, FilePlus2, Link2, MessageCircle, Send, Upload, X } from 'lucide-react';
import type { CopilotRequestResolution } from '@trama/contextual-copilot-core';
import type { UdaRecord } from '../types';
import type { PlanningStateV1 } from '../planning/types';
import type { LibrarySource, LibrarySourceLink, LibraryStateV1 } from '../library/types';
import { uid } from '../utils';
import { createCopilotLibrarySource } from '../library/copilotSourceBridge';
import { dispatchLibraryContextAction, resolveLibraryCopilotRequest } from '../library/contextualCoreAdapter';
import { resolvePlanningContextForLibraryRelevance } from '../library/relevancePresentation';
import { resolveCopilotLinkTarget } from '../library/copilotLinkTarget';
import {
  resolveLibraryTeachingContext,
  suggestLibraryTeachingContext
} from '../library/teachingContext';

interface LibraryCopilotComposerProps {
  library: LibraryStateV1;
  udas: UdaRecord[];
  planning: PlanningStateV1;
  currentClassName?: string | null;
  onAddSource: (source: LibrarySource) => Promise<void>;
  onLink: (sourceId: string, link: LibrarySourceLink) => Promise<void>;
  isPending?: boolean;
}

type CaptureMode = 'text' | 'web' | 'file';

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const ACTION_HELP: Record<string, string> = {
  'review-source': 'Rivedi la fonte nel contesto didattico corrente.',
  'link-source-to-uda': 'Collega la fonte a una UDA con conferma del docente.',
  'prepare-from-source': 'Prepara una proposta didattica senza modificarne automaticamente i dati.',
  'summarize-source': 'Produci una sintesi quando un provider autorizzato sarà disponibile.'
};

export const LibraryCopilotComposer: React.FC<LibraryCopilotComposerProps> = ({
  library,
  udas,
  planning,
  currentClassName = null,
  onAddSource,
  onLink,
  isPending = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [message, setMessage] = useState('');
  const [captureMode, setCaptureMode] = useState<CaptureMode | null>(null);
  const [captureTitle, setCaptureTitle] = useState('');
  const [captureText, setCaptureText] = useState('');
  const [captureUrl, setCaptureUrl] = useState('');
  const [captureFile, setCaptureFile] = useState<File | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resolution, setResolution] = useState<CopilotRequestResolution | null>(null);
  const [isLinkConfirmationOpen, setIsLinkConfirmationOpen] = useState(false);
  const [isLinkPending, setIsLinkPending] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const teachingSuggestion = useMemo(() => suggestLibraryTeachingContext({
    udas,
    currentClassName,
    today: localDateKey()
  }), [udas, currentClassName]);

  const resolvedTeachingContext = useMemo(() => resolveLibraryTeachingContext(
    udas,
    teachingSuggestion?.context ?? null
  ), [udas, teachingSuggestion]);

  const resolvedPlanningContext = useMemo(() => resolvePlanningContextForLibraryRelevance(
    resolvedTeachingContext,
    planning
  ), [resolvedTeachingContext, planning]);

  const selectedSource = useMemo(
    () => library.sources.find(source => source.id === selectedSourceId) ?? null,
    [library.sources, selectedSourceId]
  );

  const contextLabel = resolvedTeachingContext
    ? `${resolvedTeachingContext.className} · UDA corrente${resolvedTeachingContext.lessonId ? ' · lezione di oggi' : ''}${resolvedPlanningContext?.status === 'resolved' ? ' · programmazione' : ''}`
    : currentClassName
      ? `${currentClassName} · contesto UDA non univoco`
      : 'Nessuna classe selezionata';

  const linkTargetLabel = useMemo(() => {
    if (!resolvedTeachingContext) return null;
    const uda = udas.find(candidate => candidate.id === resolvedTeachingContext.udaId);
    if (!uda) return null;
    if (!resolvedTeachingContext.lessonId) return `UDA · ${uda.title}`;
    const lesson = (uda.lessons ?? []).find(candidate => candidate.id === resolvedTeachingContext.lessonId);
    return lesson ? `Lezione · ${lesson.topic}` : null;
  }, [resolvedTeachingContext, udas]);

  const clearCapture = () => {
    setCaptureMode(null);
    setCaptureTitle('');
    setCaptureText('');
    setCaptureUrl('');
    setCaptureFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCapture = async () => {
    if (!captureMode || isCapturing || isPending) return;
    setErrorMessage(null);
    setIsCapturing(true);

    try {
      const capturedAt = new Date().toISOString();
      let createdSource: LibrarySource;

      if (captureMode === 'text') {
        if (!captureTitle.trim() || !captureText.trim()) {
          throw new Error('Inserisci un titolo e il testo o l’idea da conservare.');
        }
        createdSource = await createCopilotLibrarySource({
          mode: 'text',
          id: uid(),
          title: captureTitle.trim(),
          text: captureText.trim(),
          kind: 'note',
          capturedAt
        });
      } else if (captureMode === 'web') {
        if (!captureTitle.trim() || !captureUrl.trim()) {
          throw new Error('Inserisci un titolo e l’indirizzo della pagina web.');
        }
        createdSource = await createCopilotLibrarySource({
          mode: 'web',
          id: uid(),
          title: captureTitle.trim(),
          url: captureUrl.trim(),
          capturedAt
        });
      } else {
        if (!captureFile) {
          throw new Error('Scegli un file o un’immagine dal dispositivo.');
        }
        createdSource = await createCopilotLibrarySource({
          mode: 'file',
          id: uid(),
          file: captureFile,
          capturedAt
        });
      }

      await onAddSource(createdSource);
      setSelectedSourceId(createdSource.id);
      clearCapture();
      setResolution(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Acquisizione della fonte non riuscita.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleResolve = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedSource || !message.trim() || isResolving) return;

    setIsResolving(true);
    setErrorMessage(null);
    setResolution(null);
    try {
      const nextResolution = await resolveLibraryCopilotRequest({
        source: selectedSource,
        teachingContext: resolvedTeachingContext,
        planningContext: resolvedPlanningContext,
        message: message.trim()
      });
      setResolution(nextResolution);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Il copilota contestuale non è disponibile in questo momento.');
    } finally {
      setIsResolving(false);
    }
  };

  const handleBeginLink = async () => {
    if (!selectedSource || isLinkPending || isPending) return;
    if (!resolution?.actions.some(action => action.id === 'link-source-to-uda')) return;

    const target = resolveCopilotLinkTarget(resolvedTeachingContext);
    if (!target || !linkTargetLabel) {
      setLinkError('Il contesto didattico non è più valido. Ricalcola le possibilità prima di collegare la fonte.');
      setIsLinkConfirmationOpen(false);
      return;
    }

    setLinkError(null);
    setLinkSuccess(null);
    const result = await dispatchLibraryContextAction({
      source: selectedSource,
      teachingContext: resolvedTeachingContext,
      actionId: 'link-source-to-uda',
      humanConfirmed: false,
      executor: async () => undefined
    });

    if (result.status === 'HUMAN_CONFIRMATION_REQUIRED') {
      setIsLinkConfirmationOpen(true);
      return;
    }

    setIsLinkConfirmationOpen(false);
    setLinkError('Il Core non autorizza questo collegamento nel contesto corrente.');
  };

  const handleConfirmLink = async () => {
    if (!selectedSource || isLinkPending || isPending) return;
    if (!resolution?.actions.some(action => action.id === 'link-source-to-uda')) {
      setIsLinkConfirmationOpen(false);
      setLinkError('L’azione di collegamento non è più autorizzata. Ricalcola le possibilità.');
      return;
    }

    const target = resolveCopilotLinkTarget(resolvedTeachingContext);
    if (!target || !linkTargetLabel) {
      setIsLinkConfirmationOpen(false);
      setLinkError('Il contesto didattico non è più valido. Ricalcola le possibilità prima di collegare la fonte.');
      return;
    }

    setIsLinkPending(true);
    setLinkError(null);
    setLinkSuccess(null);
    try {
      const result = await dispatchLibraryContextAction({
        source: selectedSource,
        teachingContext: resolvedTeachingContext,
        actionId: 'link-source-to-uda',
        humanConfirmed: true,
        executor: () => onLink(selectedSource.id, target)
      });

      if (result.status !== 'EXECUTED') {
        throw new Error('Il Core non ha eseguito il collegamento autorizzato.');
      }

      setIsLinkConfirmationOpen(false);
      setLinkSuccess('Il collegamento è stato salvato nella Biblioteca.');
    } catch {
      setLinkError('Salvataggio non riuscito. Puoi riprovare senza perdere la proposta.');
    } finally {
      setIsLinkPending(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        data-testid="library-copilot-trigger"
        onClick={() => setIsOpen(true)}
        className="fixed right-4 bottom-36 md:bottom-20 z-[70] min-h-[44px] rounded-full border border-cyan-400/40 bg-slate-950/95 px-4 py-2.5 text-sm font-semibold text-cyan-100 shadow-2xl backdrop-blur hover:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-400"
        aria-label="Apri Copilota contestuale"
      >
        <span className="flex items-center gap-2">
          <MessageCircle size={18} aria-hidden="true" />
          Copilota
        </span>
      </button>
    );
  }

  return (
    <section
      data-testid="library-copilot-composer"
      aria-label="Copilota contestuale"
      className="fixed inset-x-3 bottom-36 md:inset-x-auto md:right-6 md:bottom-20 z-[70] max-h-[calc(100dvh-10rem)] md:w-[430px] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950/98 shadow-2xl backdrop-blur"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
            <MessageCircle size={18} className="text-cyan-300" aria-hidden="true" />
            Copilota
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-400">{contextLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="min-h-[44px] min-w-[44px] rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          aria-label="Chiudi Copilota"
        >
          <X size={20} className="mx-auto" aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <label htmlFor="copilot-source" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Fonte della Biblioteca
          </label>
          <select
            id="copilot-source"
            value={selectedSourceId}
            onChange={event => {
              setSelectedSourceId(event.target.value);
              setResolution(null);
              setIsLinkConfirmationOpen(false);
              setLinkError(null);
              setLinkSuccess(null);
            }}
            className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
          >
            <option value="">Scegli una fonte…</option>
            {library.sources.map(source => (
              <option key={source.id} value={source.id}>{source.title}</option>
            ))}
          </select>
        </div>

        <details className="rounded-xl border border-slate-800 bg-slate-900/50">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-200">
            <FilePlus2 size={17} className="text-cyan-300" aria-hidden="true" />
            Aggiungi una nuova fonte
          </summary>
          <div className="space-y-3 border-t border-slate-800 p-3">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setCaptureMode('text')}
                className="min-h-[44px] rounded-lg border border-slate-700 px-2 text-xs text-slate-200 hover:border-cyan-400"
              >
                <BookOpen size={16} className="mx-auto mb-1" aria-hidden="true" />
                Testo/idea
              </button>
              <button
                type="button"
                onClick={() => setCaptureMode('web')}
                className="min-h-[44px] rounded-lg border border-slate-700 px-2 text-xs text-slate-200 hover:border-cyan-400"
              >
                <Link2 size={16} className="mx-auto mb-1" aria-hidden="true" />
                Pagina web
              </button>
              <button
                type="button"
                onClick={() => setCaptureMode('file')}
                className="min-h-[44px] rounded-lg border border-slate-700 px-2 text-xs text-slate-200 hover:border-cyan-400"
              >
                <Upload size={16} className="mx-auto mb-1" aria-hidden="true" />
                File/foto
              </button>
            </div>

            {captureMode && captureMode !== 'file' && (
              <input
                type="text"
                value={captureTitle}
                onChange={event => setCaptureTitle(event.target.value)}
                placeholder="Titolo della fonte"
                className="min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
              />
            )}

            {captureMode === 'text' && (
              <textarea
                value={captureText}
                onChange={event => setCaptureText(event.target.value)}
                placeholder="Incolla un testo, un appunto o descrivi un’idea…"
                className="min-h-24 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
              />
            )}

            {captureMode === 'web' && (
              <input
                type="url"
                value={captureUrl}
                onChange={event => setCaptureUrl(event.target.value)}
                placeholder="https://…"
                className="min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
              />
            )}

            {captureMode === 'file' && (
              <input
                ref={fileInputRef}
                type="file"
                onChange={event => setCaptureFile(event.target.files?.[0] ?? null)}
                className="min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200 file:mr-3 file:rounded-md file:border-0 file:bg-cyan-950 file:px-3 file:py-2 file:text-cyan-100"
              />
            )}

            {captureMode && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleCapture()}
                  disabled={isCapturing || isPending}
                  className="min-h-[44px] flex-1 rounded-lg bg-cyan-600 px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCapturing || isPending ? 'Salvataggio…' : 'Salva nella Biblioteca'}
                </button>
                <button
                  type="button"
                  onClick={clearCapture}
                  disabled={isCapturing || isPending}
                  className="min-h-[44px] rounded-lg border border-slate-700 px-3 text-sm text-slate-300 disabled:opacity-50"
                >
                  Annulla
                </button>
              </div>
            )}
          </div>
        </details>

        <form onSubmit={handleResolve} className="space-y-3">
          <div>
            <label htmlFor="copilot-message" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Che cosa vuoi farne?
            </label>
            <textarea
              id="copilot-message"
              value={message}
              onChange={event => {
                setMessage(event.target.value);
                setResolution(null);
                setIsLinkConfirmationOpen(false);
                setLinkError(null);
                setLinkSuccess(null);
              }}
              placeholder="Per esempio: aiutami a usare questa fonte nella lezione di oggi"
              className="min-h-24 w-full resize-y rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={!selectedSource || !message.trim() || isResolving}
            className="min-h-[44px] w-full rounded-xl bg-cyan-600 px-4 text-sm font-bold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="flex items-center justify-center gap-2">
              <Send size={17} aria-hidden="true" />
              {isResolving ? 'Valuto le possibilità…' : 'Mostra le possibilità'}
            </span>
          </button>
        </form>

        {errorMessage && (
          <p role="alert" className="rounded-xl border border-rose-900/60 bg-rose-950/40 p-3 text-sm text-rose-200">
            {errorMessage}
          </p>
        )}

        {resolution && (
          <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Possibilità autorizzate</div>
            {resolution.reason === 'INTENT_PORT_UNAVAILABLE' && (
              <p className="text-xs leading-relaxed text-slate-400">
                L’interpretazione automatica dell’intento non è attiva. Sono mostrate soltanto le azioni che il Core condiviso autorizza già per questa fonte e questo contesto.
              </p>
            )}
            {resolution.actions.slice(0, 4).map(action => (
              <div key={action.id} className="rounded-lg border border-slate-700 bg-slate-950/70 p-3">
                {action.id === 'link-source-to-uda' ? (
                  <button
                    type="button"
                    data-testid="library-copilot-link-action"
                    onClick={() => void handleBeginLink()}
                    disabled={isLinkPending || isPending}
                    className="min-h-[44px] w-full rounded-lg border border-cyan-500/50 bg-cyan-950/40 px-3 text-left text-sm font-semibold text-cyan-100 hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {action.label}
                  </button>
                ) : (
                  <div className="text-sm font-semibold text-slate-100">{action.label}</div>
                )}
                {ACTION_HELP[action.id] && (
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">{ACTION_HELP[action.id]}</p>
                )}
              </div>
            ))}
            {resolution.actions.length === 0 && (
              <p className="text-sm text-slate-400">Nessuna azione è autorizzata per questa fonte nel contesto corrente.</p>
            )}
            <p className="pt-1 text-[11px] leading-relaxed text-slate-500">
              Solo il collegamento è operativo in questo blocco e richiede sempre una conferma esplicita. Nessun contenuto viene inviato automaticamente a servizi esterni.
            </p>
          </div>
        )}

        {isLinkConfirmationOpen && selectedSource && linkTargetLabel && (
          <div
            data-testid="library-copilot-link-confirmation"
            className="space-y-3 rounded-xl border border-cyan-700/50 bg-cyan-950/20 p-3"
          >
            <div className="text-sm font-bold text-cyan-100">Conferma collegamento</div>
            <p className="text-sm text-slate-200">{selectedSource.title}</p>
            <p className="text-sm text-slate-300">Destinazione: {linkTargetLabel}</p>
            <p className="text-xs leading-relaxed text-slate-400">
              Il collegamento sarà salvato nella Biblioteca e potrà essere rimosso successivamente.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => void handleConfirmLink()}
                disabled={isLinkPending || isPending}
                className="min-h-[44px] flex-1 rounded-lg bg-cyan-600 px-3 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLinkPending || isPending ? 'Salvataggio…' : 'Conferma collegamento'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLinkConfirmationOpen(false);
                  setLinkError(null);
                }}
                disabled={isLinkPending || isPending}
                className="min-h-[44px] rounded-lg border border-slate-700 px-3 text-sm text-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Annulla
              </button>
            </div>
          </div>
        )}

        {linkSuccess && (
          <p role="status" className="rounded-xl border border-emerald-900/60 bg-emerald-950/30 p-3 text-sm text-emerald-200">
            {linkSuccess}
          </p>
        )}
        {linkError && (
          <p role="alert" className="rounded-xl border border-rose-900/60 bg-rose-950/40 p-3 text-sm text-rose-200">
            {linkError}
          </p>
        )}
      </div>
    </section>
  );
};
