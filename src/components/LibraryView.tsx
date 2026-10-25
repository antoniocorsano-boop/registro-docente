import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FilePlus2, Link2, Search, X } from 'lucide-react';
import type { PlanningStateV1 } from '../planning/types';
import type { LocalEmbeddingConfig, UdaRecord } from '../types';
import type { LibrarySource, LibrarySourceKind, LibrarySourceLink, LibraryStateV1 } from '../library/types';
import type { LibrarySourcePatch } from '../library/libraryState';
import type { LibraryTeachingContext } from '../library/teachingContext';
import { searchLibrarySources } from '../library/libraryState';
import { createFileSource, createTextSource, createWebSource } from '../library/intake';
import { retrieveLibrarySourcesByMeaning } from '../library/semanticRetrieval';
import type { SemanticLibraryResolution } from '../library/semanticRetrieval';
import { uid } from '../utils';
import { LibrarySourceCard } from './LibrarySourceCard';

interface LibraryViewProps {
  library: LibraryStateV1;
  udas: UdaRecord[];
  planning: PlanningStateV1;
  currentClassName?: string | null;
  embeddingConfig?: LocalEmbeddingConfig;
  isPending: boolean;
  errorMessage: string | null;
  onAddSource: (source: LibrarySource) => Promise<void>;
  onUpdateSource: (sourceId: string, patch: LibrarySourcePatch) => Promise<void>;
  onLinkSource: (sourceId: string, link: LibrarySourceLink) => Promise<void>;
  onUnlinkSource: (sourceId: string, link: LibrarySourceLink) => Promise<void>;
  onDeleteSource: (sourceId: string) => Promise<void>;
}

type LibraryFilter = 'recent' | 'linked' | 'review';
type CaptureMode = 'file' | 'web' | 'text' | null;
type TextCaptureKind = Extract<LibrarySourceKind, 'text' | 'note' | 'concept'>;

function semanticUnavailableCopy(resolution: SemanticLibraryResolution | null): string | null {
  if (!resolution || resolution.status !== 'unavailable') return null;
  switch (resolution.reason) {
    case 'QUERY_EMPTY':
      return 'Scrivi cosa stai cercando prima di avviare la ricerca per significato.';
    case 'LOCAL_EMBEDDING_DISABLED':
      return 'Il motore locale per la ricerca per significato non è attivo.';
    case 'LOCAL_EMBEDDING_REQUIRED':
      return 'Questa funzione usa solo il motore locale. Non viene attivato automaticamente un servizio remoto.';
    case 'NO_ELIGIBLE_SOURCE':
      return 'Non ci sono ancora fonti professionali con testo utilizzabile per questa ricerca.';
    case 'NO_SEMANTIC_MATCH':
      return 'Nessuna fonte sufficientemente pertinente trovata per significato.';
  }
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  library,
  udas,
  planning,
  currentClassName = null,
  embeddingConfig,
  isPending,
  errorMessage,
  onAddSource,
  onUpdateSource,
  onLinkSource,
  onUnlinkSource,
  onDeleteSource
}) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<LibraryFilter>('recent');
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureMode, setCaptureMode] = useState<CaptureMode>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [webTitle, setWebTitle] = useState('');
  const [webUrl, setWebUrl] = useState('');
  const [webCapturedText, setWebCapturedText] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [textValue, setTextValue] = useState('');
  const [textKind, setTextKind] = useState<TextCaptureKind>('text');
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [lastExplicitTeachingContext, setLastExplicitTeachingContext] = useState<LibraryTeachingContext | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [semanticResolution, setSemanticResolution] = useState<SemanticLibraryResolution | null>(null);
  const [semanticError, setSemanticError] = useState<string | null>(null);
  const [isSemanticPending, setIsSemanticPending] = useState(false);
  const semanticRequestRef = useRef(0);

  const sources = useMemo(() => {
    const searched = searchLibrarySources(library, query);
    if (filter === 'linked') return searched.filter(source => source.links.length > 0);
    if (filter === 'review') {
      return searched.filter(source => ['captured', 'needs-review', 'restricted', 'failed'].includes(source.status));
    }
    return searched;
  }, [library, query, filter]);

  const semanticSources = useMemo(() => {
    if (!semanticResolution || semanticResolution.status !== 'ranked') return [];
    const byId = new Map(library.sources.map(source => [source.id, source]));
    return semanticResolution.candidates
      .map(candidate => byId.get(candidate.sourceId))
      .filter((source): source is LibrarySource => Boolean(source));
  }, [library.sources, semanticResolution]);

  useEffect(() => {
    semanticRequestRef.current += 1;
    setSemanticResolution(null);
    setSemanticError(null);
    setIsSemanticPending(false);
  }, [query, library, embeddingConfig]);

  useEffect(() => () => {
    semanticRequestRef.current += 1;
  }, []);

  const closeCapture = () => {
    setCaptureOpen(false);
    setCaptureMode(null);
    setSelectedFile(null);
    setWebTitle('');
    setWebUrl('');
    setWebCapturedText('');
    setTextTitle('');
    setTextValue('');
    setTextKind('text');
    setCaptureError(null);
  };

  const saveSource = async (source: LibrarySource) => {
    setCaptureError(null);
    try {
      await onAddSource(source);
      setSelectedSourceId(source.id);
      closeCapture();
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : 'Salvataggio non riuscito. Puoi riprovare senza reinserire la fonte.');
    }
  };

  const handleSaveFile = async () => {
    if (!selectedFile) return;
    try {
      const source = await createFileSource({
        id: uid(),
        file: selectedFile,
        capturedAt: new Date().toISOString()
      });
      await saveSource(source);
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : 'Acquisizione del file non riuscita.');
    }
  };

  const handleSaveWeb = async () => {
    try {
      const source = createWebSource({
        id: uid(),
        title: webTitle,
        url: webUrl,
        capturedAt: new Date().toISOString(),
        ...(webCapturedText.trim() ? { capturedText: webCapturedText } : {})
      });
      await saveSource(source);
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : 'Indirizzo non valido.');
    }
  };

  const handleSaveText = async () => {
    try {
      const source = createTextSource({
        id: uid(),
        title: textTitle,
        text: textValue,
        kind: textKind,
        capturedAt: new Date().toISOString()
      });
      await saveSource(source);
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : 'Testo non valido.');
    }
  };

  const handleRunSemanticSearch = async () => {
    if (!embeddingConfig || !query.trim() || isSemanticPending) return;
    const requestId = semanticRequestRef.current + 1;
    semanticRequestRef.current = requestId;
    setIsSemanticPending(true);
    setSemanticResolution(null);
    setSemanticError(null);

    try {
      const result = await retrieveLibrarySourcesByMeaning({
        query,
        sources: library.sources,
        config: embeddingConfig
      });
      if (semanticRequestRef.current !== requestId) return;
      setSemanticResolution(result);
    } catch {
      if (semanticRequestRef.current !== requestId) return;
      setSemanticError('Il motore locale non risponde. Puoi riprovare; la ricerca normale resta disponibile.');
    } finally {
      if (semanticRequestRef.current === requestId) setIsSemanticPending(false);
    }
  };

  const semanticUnavailableMessage = semanticUnavailableCopy(semanticResolution);

  return (
    <section className="space-y-5" aria-labelledby="private-library-title">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-[var(--primary)] font-semibold">Didattica e strumenti</p>
          <h1 id="private-library-title" className="text-2xl font-bold text-white mt-1">Biblioteca privata</h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Conserva fonti, idee e materiali nel vault locale. Collegarli o selezionarli non modifica automaticamente il lavoro didattico.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCaptureOpen(open => !open);
            setCaptureMode(null);
            setCaptureError(null);
          }}
          disabled={isPending}
          className="min-h-[44px] px-4 rounded-lg bg-[var(--primary)] text-slate-950 font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <FilePlus2 className="w-4 h-4" aria-hidden="true" />
          Aggiungi fonte
        </button>
      </header>

      {(errorMessage || captureError) && (
        <div role="alert" className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {captureError || errorMessage}
        </div>
      )}

      {captureOpen && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">Aggiungi fonte</h2>
              <p className="text-xs text-slate-400 mt-1">Scegli solo come portare dentro il materiale. Potrai decidere dopo come usarlo.</p>
            </div>
            <button
              type="button"
              onClick={closeCapture}
              className="min-h-[44px] min-w-[44px] rounded-lg border border-[var(--border)] inline-flex items-center justify-center text-slate-300"
              aria-label="Chiudi acquisizione fonte"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {!captureMode && (
            <div className="grid sm:grid-cols-3 gap-2">
              <button type="button" onClick={() => setCaptureMode('file')} className="min-h-[52px] rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 text-left">Foto o file</button>
              <button type="button" onClick={() => setCaptureMode('web')} className="min-h-[52px] rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 text-left">URL</button>
              <button type="button" onClick={() => setCaptureMode('text')} className="min-h-[52px] rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 text-left">Testo o idea</button>
            </div>
          )}

          {captureMode === 'file' && (
            <div className="space-y-3">
              <label className="block text-sm text-slate-300" htmlFor="library-file-input">Foto o file dal dispositivo</label>
              <input
                id="library-file-input"
                type="file"
                onChange={event => setSelectedFile(event.target.files?.[0] ?? null)}
                disabled={isPending}
                className="block w-full text-sm text-slate-300 file:min-h-[44px] file:px-3 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:text-slate-100"
              />
              {selectedFile && <p className="text-xs text-slate-400">Selezionato: {selectedFile.name}</p>}
              <button type="button" onClick={() => void handleSaveFile()} disabled={isPending || !selectedFile} className="min-h-[44px] px-4 rounded-lg bg-[var(--primary)] text-slate-950 font-semibold text-sm disabled:opacity-50">Salva in biblioteca</button>
            </div>
          )}

          {captureMode === 'web' && (
            <div className="space-y-3">
              <label className="block text-sm text-slate-300">Titolo
                <input value={webTitle} onChange={event => setWebTitle(event.target.value)} disabled={isPending} className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100" />
              </label>
              <label className="block text-sm text-slate-300">URL
                <input type="url" value={webUrl} onChange={event => setWebUrl(event.target.value)} disabled={isPending} placeholder="https://…" className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100" />
              </label>
              <label className="block text-sm text-slate-300">Testo o estratto della pagina
                <textarea
                  value={webCapturedText}
                  onChange={event => setWebCapturedText(event.target.value)}
                  disabled={isPending}
                  rows={5}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                />
              </label>
              <p className="text-xs text-slate-400">Se non lo aggiungi ora, conserveremo l'URL come fonte da completare.</p>
              <button type="button" onClick={() => void handleSaveWeb()} disabled={isPending || !webTitle.trim() || !webUrl.trim()} className="min-h-[44px] px-4 rounded-lg bg-[var(--primary)] text-slate-950 font-semibold text-sm disabled:opacity-50">Salva URL</button>
            </div>
          )}

          {captureMode === 'text' && (
            <div className="space-y-3">
              <label className="block text-sm text-slate-300">Tipo
                <select value={textKind} onChange={event => setTextKind(event.target.value as TextCaptureKind)} disabled={isPending} className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100">
                  <option value="text">Testo</option>
                  <option value="note">Appunto</option>
                  <option value="concept">Idea</option>
                </select>
              </label>
              <label className="block text-sm text-slate-300">Titolo
                <input value={textTitle} onChange={event => setTextTitle(event.target.value)} disabled={isPending} className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100" />
              </label>
              <label className="block text-sm text-slate-300">Contenuto
                <textarea value={textValue} onChange={event => setTextValue(event.target.value)} disabled={isPending} rows={5} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" />
              </label>
              <button type="button" onClick={() => void handleSaveText()} disabled={isPending || !textTitle.trim() || !textValue.trim()} className="min-h-[44px] px-4 rounded-lg bg-[var(--primary)] text-slate-950 font-semibold text-sm disabled:opacity-50">Salva in biblioteca</button>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 space-y-3">
        <label className="relative block" htmlFor="library-search">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
          <input
            id="library-search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Cerca nella biblioteca"
            className="min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500"
          />
        </label>

        <details data-testid="library-semantic-search-disclosure" className="rounded-lg border border-slate-800 bg-slate-950/40">
          <summary className="min-h-[44px] cursor-pointer px-3 py-3 text-sm font-medium text-slate-200">
            Ricerca per significato
          </summary>
          <div className="border-t border-slate-800 px-3 py-3 space-y-3">
            <p className="text-xs leading-relaxed text-slate-400">
              Usa il motore locale configurato e non invia automaticamente i materiali a servizi remoti. Sono considerate solo fonti classificate come professionali.
            </p>
            <button
              type="button"
              data-testid="library-semantic-search-run"
              onClick={() => void handleRunSemanticSearch()}
              disabled={!embeddingConfig || !query.trim() || isSemanticPending}
              className="min-h-[44px] px-4 rounded-lg border border-[var(--primary)] text-[var(--primary)] font-semibold text-sm disabled:opacity-50"
            >
              {isSemanticPending ? 'Ricerca in corso…' : 'Cerca per significato'}
            </button>

            {isSemanticPending && <p role="status" className="text-xs text-slate-400">Confronto locale dei significati in corso…</p>}
            {semanticError && <p role="alert" className="text-xs text-red-300">{semanticError}</p>}
            {semanticUnavailableMessage && <p className="text-xs text-slate-400">{semanticUnavailableMessage}</p>}

            {semanticSources.length > 0 && (
              <div data-testid="library-semantic-results" className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Risultati per significato</p>
                <div className="grid lg:grid-cols-2 gap-3">
                  {semanticSources.map(source => (
                    <div key={`semantic-${source.id}`} className="space-y-1" data-semantic-source-id={source.id}>
                      <p className="text-[11px] font-semibold text-[var(--primary)]">Pertinenza semantica</p>
                      <LibrarySourceCard
                        source={source}
                        udas={udas}
                        planning={planning}
                        currentClassName={currentClassName}
                        lastExplicitTeachingContext={lastExplicitTeachingContext}
                        onExplicitTeachingContextChange={setLastExplicitTeachingContext}
                        isPending={isPending}
                        isSelected={selectedSourceId === source.id}
                        onUse={setSelectedSourceId}
                        onAddSource={onAddSource}
                        onUpdate={onUpdateSource}
                        onLink={onLinkSource}
                        onUnlink={onUnlinkSource}
                        onDelete={onDeleteSource}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </details>

        <div className="flex flex-wrap gap-2" aria-label="Filtra fonti">
          {([
            ['recent', 'Recenti'],
            ['linked', 'Collegate'],
            ['review', 'Da rivedere']
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={`min-h-[44px] px-3 rounded-lg border text-sm ${filter === value ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]' : 'border-slate-700 text-slate-300'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isPending && <p className="text-xs text-slate-400" role="status">Salvataggio della biblioteca in corso…</p>}

      {sources.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
          <Link2 className="w-6 h-6 mx-auto text-slate-500" aria-hidden="true" />
          <p className="mt-2 text-sm text-slate-300">Nessuna fonte in questa vista.</p>
          <p className="text-xs text-slate-500 mt-1">Puoi conservare un materiale anche senza collegarlo subito a una UDA.</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-3">
          {sources.map(source => (
            <LibrarySourceCard
              key={source.id}
              source={source}
              udas={udas}
              planning={planning}
              currentClassName={currentClassName}
              lastExplicitTeachingContext={lastExplicitTeachingContext}
              onExplicitTeachingContextChange={setLastExplicitTeachingContext}
              isPending={isPending}
              isSelected={selectedSourceId === source.id}
              onUse={setSelectedSourceId}
              onAddSource={onAddSource}
              onUpdate={onUpdateSource}
              onLink={onLinkSource}
              onUnlink={onUnlinkSource}
              onDelete={onDeleteSource}
            />
          ))}
        </div>
      )}
    </section>
  );
};