import React, { useEffect, useState } from 'react';
import type {
  ProfessionalMemoryCandidateClassification,
  ProfessionalMemoryCategory,
  ProfessionalMemoryContextRefsV1,
  ProfessionalMemoryStateV1,
  ProfessionalMemoryWorkingSetV1
} from '../memory/types';
import type { RememberProfessionalItemInput } from '../memory/professionalMemory';
import { uid } from '../utils';

export interface ProfessionalMemoryRememberCandidate {
  summary: string;
  context: ProfessionalMemoryContextRefsV1;
  canonicalRef?: string;
  privacyClassification: ProfessionalMemoryCandidateClassification;
}

interface ProfessionalMemoryPanelProps {
  state: ProfessionalMemoryStateV1;
  relevantMemory: ProfessionalMemoryWorkingSetV1;
  rememberCandidate: ProfessionalMemoryRememberCandidate | null;
  errorMessage?: string | null;
  onRemember: (input: RememberProfessionalItemInput) => Promise<void>;
  onCorrectEntry: (entryId: string, summary: string) => Promise<void>;
  onRemoveEntry: (entryId: string) => Promise<void>;
  onSetCategory: (category: ProfessionalMemoryCategory, enabled: boolean) => Promise<void>;
  onRemoveCategory: (category: ProfessionalMemoryCategory) => Promise<void>;
}

const CATEGORY_LABELS: Record<ProfessionalMemoryCategory, string> = {
  'format-preference': 'Preferenze di formato',
  'didactic-pattern': 'Scelte didattiche ricorrenti',
  'material-reuse': 'Riutilizzo di materiali',
  'planning-continuity': 'Continuità di programmazione',
  'workflow-preference': 'Preferenze di lavoro'
};

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ProfessionalMemoryCategory[];

function provenanceLabel(kind: 'teacher-explicit' | 'product-event' | 'consolidated-inference'): string {
  switch (kind) {
    case 'teacher-explicit': return 'Ricordo confermato dal docente';
    case 'product-event': return 'Evento professionale';
    case 'consolidated-inference': return 'Sintesi da attività professionali';
  }
}

export const ProfessionalMemoryPanel: React.FC<ProfessionalMemoryPanelProps> = ({
  state,
  relevantMemory,
  rememberCandidate,
  errorMessage = null,
  onRemember,
  onCorrectEntry,
  onRemoveEntry,
  onSetCategory,
  onRemoveCategory
}) => {
  const [rememberDraft, setRememberDraft] = useState('');
  const [rememberCategory, setRememberCategory] = useState<ProfessionalMemoryCategory>('material-reuse');
  const [isRememberConfirmationOpen, setIsRememberConfirmationOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingSummary, setEditingSummary] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const rememberCandidateIdentity = rememberCandidate
    ? JSON.stringify([
        rememberCandidate.privacyClassification,
        rememberCandidate.canonicalRef ?? null,
        rememberCandidate.summary,
        rememberCandidate.context.className ?? null,
        rememberCandidate.context.udaId ?? null,
        rememberCandidate.context.lessonId ?? null,
        rememberCandidate.context.sourceId ?? null,
        rememberCandidate.context.planningProfileId ?? null,
        rememberCandidate.context.assessmentId ?? null
      ])
    : null;

  useEffect(() => {
    if (!rememberCandidate) {
      setRememberDraft('');
      setIsRememberConfirmationOpen(false);
      return;
    }
    setRememberDraft(rememberCandidate.summary);
    setRememberCategory('material-reuse');
    setIsRememberConfirmationOpen(false);
    setLocalError(null);
    setSuccessMessage(null);
  }, [rememberCandidateIdentity]);

  const runAction = async (key: string, action: () => Promise<void>, success: string) => {
    if (pendingAction) return;
    setPendingAction(key);
    setLocalError(null);
    setSuccessMessage(null);
    try {
      await action();
      setSuccessMessage(success);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Salvataggio della memoria professionale non riuscito.');
      throw error;
    } finally {
      setPendingAction(null);
    }
  };

  const handleRemember = async () => {
    if (!rememberCandidate || !rememberDraft.trim()) return;
    const occurredAt = new Date().toISOString();
    try {
      await runAction(
        'remember',
        () => onRemember({
          eventId: `memory-event-${uid()}`,
          entryId: `memory-entry-${uid()}`,
          category: rememberCategory,
          summary: rememberDraft.trim(),
          occurredAt,
          context: { ...rememberCandidate.context },
          ...(rememberCandidate.canonicalRef ? { canonicalRef: rememberCandidate.canonicalRef } : {}),
          privacyClassification: rememberCandidate.privacyClassification
        }),
        'Ricordo salvato nella memoria professionale.'
      );
      setIsRememberConfirmationOpen(false);
    } catch {
      // Keep the teacher-edited draft available for a truthful retry.
    }
  };

  const handleCorrect = async (entryId: string) => {
    if (!editingSummary.trim()) return;
    try {
      await runAction(
        `edit:${entryId}`,
        () => onCorrectEntry(entryId, editingSummary.trim()),
        'Ricordo aggiornato.'
      );
      setEditingEntryId(null);
      setEditingSummary('');
    } catch {
      // Keep the draft for retry.
    }
  };

  const handleRemoveEntry = async (entryId: string) => {
    if (!window.confirm('Rimuovere questo ricordo dalla memoria professionale? I dati originali non saranno eliminati.')) return;
    try {
      await runAction(
        `remove:${entryId}`,
        () => onRemoveEntry(entryId),
        'Ricordo rimosso dalla memoria professionale.'
      );
    } catch {
      // Error is rendered in the same panel.
    }
  };

  const handleToggleCategory = async (category: ProfessionalMemoryCategory, enabled: boolean) => {
    try {
      await runAction(
        `category:${category}`,
        () => onSetCategory(category, enabled),
        enabled ? 'Memoria automatica attivata per questa categoria.' : 'Memoria automatica disattivata per questa categoria.'
      );
    } catch {
      // Existing entries remain untouched on failure or disable.
    }
  };

  const handleRemoveCategory = async (category: ProfessionalMemoryCategory) => {
    const entryCount = state.entries.filter(entry => entry.category === category).length;
    const eventCount = state.events.filter(event => event.category === category).length;
    const categoryDataCount = entryCount + eventCount;
    if (categoryDataCount === 0) return;
    if (!window.confirm(`Eliminare tutti i dati di memoria della categoria “${CATEGORY_LABELS[category]}”? Verranno rimossi ricordi salvati ed eventi professionali; l’attivazione automatica non verrà modificata.`)) return;
    try {
      await runAction(
        `clear:${category}`,
        () => onRemoveCategory(category),
        'Ricordi della categoria eliminati.'
      );
    } catch {
      // Keep the current state visible for retry.
    }
  };

  return (
    <details
      data-testid="copilot-memory-panel"
      className="rounded-xl border border-slate-800 bg-slate-900/50"
    >
      <summary
        data-testid="copilot-memory-trigger"
        className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-slate-200"
      >
        <span>Memoria professionale</span>
        <span className="text-xs font-normal text-slate-500">Facoltativa e sotto il tuo controllo</span>
      </summary>

      <div className="space-y-4 border-t border-slate-800 p-3">
        <p className="text-xs leading-relaxed text-slate-400">
          Conserva solo preferenze e continuità professionali. Non autorizza azioni del Copilota e non sostituisce Biblioteca, UDA o Programmazione. Quando confermi una richiesta PREPARE remota, una selezione limitata di sintesi pertinenti può essere inviata al servizio remoto insieme alla fonte e al contesto.
        </p>

        {rememberCandidate && (
          <section className="rounded-lg border border-cyan-900/50 bg-cyan-950/20 p-3">
            {!isRememberConfirmationOpen ? (
              <button
                type="button"
                data-testid="copilot-memory-remember-this"
                onClick={() => {
                  setRememberDraft(rememberCandidate.summary);
                  setRememberCategory('material-reuse');
                  setIsRememberConfirmationOpen(true);
                  setLocalError(null);
                  setSuccessMessage(null);
                }}
                disabled={Boolean(pendingAction)}
                className="min-h-[44px] w-full rounded-lg border border-cyan-500/50 px-3 text-left text-sm font-semibold text-cyan-100 hover:border-cyan-300 disabled:opacity-50"
              >
                Ricorda questo
              </button>
            ) : (
              <div className="space-y-3">
                <div className="text-sm font-semibold text-cyan-100">Conferma il ricordo</div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Categoria
                  <select
                    value={rememberCategory}
                    onChange={event => setRememberCategory(event.target.value as ProfessionalMemoryCategory)}
                    disabled={Boolean(pendingAction)}
                    className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm font-normal normal-case tracking-normal text-slate-100"
                  >
                    {CATEGORIES.map(category => (
                      <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Testo da ricordare
                  <textarea
                    value={rememberDraft}
                    onChange={event => setRememberDraft(event.target.value)}
                    disabled={Boolean(pendingAction)}
                    className="mt-1 min-h-20 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm font-normal normal-case tracking-normal text-slate-100"
                  />
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    data-testid="copilot-memory-confirm"
                    onClick={() => void handleRemember()}
                    disabled={!rememberDraft.trim() || Boolean(pendingAction)}
                    className="min-h-[44px] flex-1 rounded-lg bg-cyan-600 px-3 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {pendingAction === 'remember' ? 'Salvataggio…' : 'Conferma'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRememberConfirmationOpen(false)}
                    disabled={Boolean(pendingAction)}
                    className="min-h-[44px] rounded-lg border border-slate-700 px-3 text-sm text-slate-300 disabled:opacity-50"
                  >
                    Annulla
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {relevantMemory.items.length > 0 && (
          <details data-testid="copilot-memory-relevant" className="rounded-lg border border-slate-800 bg-slate-950/50">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-semibold text-slate-200">
              Ricordi pertinenti
              <span className="text-xs font-normal text-slate-500">{relevantMemory.items.length}</span>
            </summary>
            <ul className="space-y-2 border-t border-slate-800 p-3">
              {relevantMemory.items.map(item => (
                <li key={item.entryId} className="text-xs leading-relaxed text-slate-300">
                  <span className="font-semibold text-slate-200">{CATEGORY_LABELS[item.category]}:</span> {item.summary}
                </li>
              ))}
            </ul>
          </details>
        )}

        <section>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Categorie automatiche</div>
          <div className="space-y-2">
            {CATEGORIES.map(category => {
              const enabled = state.settings.autoRemember[category];
              const entryCount = state.entries.filter(entry => entry.category === category).length;
              const eventCount = state.events.filter(event => event.category === category).length;
              const categoryDataCount = entryCount + eventCount;
              return (
                <div
                  key={category}
                  data-testid={`copilot-memory-category-${category}`}
                  className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-200">{CATEGORY_LABELS[category]}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {entryCount} ricord{entryCount === 1 ? 'o' : 'i'} conservat{entryCount === 1 ? 'o' : 'i'}
                        {eventCount > 0 ? ` · ${eventCount} event${eventCount === 1 ? 'o' : 'i'} registrat${eventCount === 1 ? 'o' : 'i'}` : ''}
                      </div>
                    </div>
                    <label className="flex min-h-[44px] items-center gap-2 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={event => void handleToggleCategory(category, event.target.checked)}
                        disabled={Boolean(pendingAction)}
                        className="h-5 w-5 accent-cyan-500"
                      />
                      Memorizza automaticamente
                    </label>
                  </div>
                  {categoryDataCount > 0 && (
                    <button
                      type="button"
                      onClick={() => void handleRemoveCategory(category)}
                      disabled={Boolean(pendingAction)}
                      className="mt-2 min-h-[44px] rounded-lg border border-rose-900/60 px-3 text-xs font-semibold text-rose-200 disabled:opacity-50"
                    >
                      Elimina i dati della categoria
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Ricordi salvati</div>
          {state.entries.length === 0 ? (
            <p className="text-xs leading-relaxed text-slate-500">Nessun ricordo professionale salvato.</p>
          ) : (
            <div className="space-y-2">
              {state.entries.map(entry => (
                <article
                  key={entry.id}
                  data-testid={`copilot-memory-entry-${entry.id}`}
                  className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
                >
                  <div className="text-xs font-semibold text-cyan-200">{CATEGORY_LABELS[entry.category]}</div>
                  {editingEntryId === entry.id ? (
                    <div className="mt-2 space-y-2">
                      <textarea
                        value={editingSummary}
                        onChange={event => setEditingSummary(event.target.value)}
                        disabled={Boolean(pendingAction)}
                        className="min-h-20 w-full resize-y rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-slate-100"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleCorrect(entry.id)}
                          disabled={!editingSummary.trim() || Boolean(pendingAction)}
                          className="min-h-[44px] flex-1 rounded-lg bg-cyan-700 px-3 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          Salva modifica
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingEntryId(null);
                            setEditingSummary('');
                          }}
                          disabled={Boolean(pendingAction)}
                          className="min-h-[44px] rounded-lg border border-slate-700 px-3 text-xs text-slate-300 disabled:opacity-50"
                        >
                          Annulla
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="mt-1 text-sm leading-relaxed text-slate-200">{entry.summary}</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                        {provenanceLabel(entry.provenance.kind)}{entry.status === 'stale' ? ' · riferimento non più attivo' : ''}
                      </p>
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingEntryId(entry.id);
                            setEditingSummary(entry.summary);
                            setLocalError(null);
                            setSuccessMessage(null);
                          }}
                          disabled={Boolean(pendingAction)}
                          className="min-h-[44px] flex-1 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-200 disabled:opacity-50"
                        >
                          Modifica
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRemoveEntry(entry.id)}
                          disabled={Boolean(pendingAction)}
                          className="min-h-[44px] flex-1 rounded-lg border border-rose-900/60 px-3 text-xs font-semibold text-rose-200 disabled:opacity-50"
                        >
                          Rimuovi
                        </button>
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        {(localError || errorMessage) && (
          <p role="alert" className="rounded-lg border border-rose-900/60 bg-rose-950/30 p-3 text-xs leading-relaxed text-rose-200">
            {localError || errorMessage}
          </p>
        )}
        {successMessage && (
          <p role="status" className="rounded-lg border border-emerald-900/60 bg-emerald-950/30 p-3 text-xs leading-relaxed text-emerald-200">
            {successMessage}
          </p>
        )}
      </div>
    </details>
  );
};
