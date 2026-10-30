import React, { useEffect, useRef, useState } from 'react';
import type { ResolvedAction } from '@trama/contextual-copilot-core';
import type { RemoteProfessionalMemoryProjectionV1 } from '../memory/types';
import type { LibrarySource } from '../library/types';
import type { LibrarySourcePatch } from '../library/libraryState';
import type { ResolvedLibraryTeachingContext } from '../library/teachingContext';
import {
  buildLibraryProposalRequest,
  createInternalSourceFromTeachingProposal,
  measureLibraryProposalBudget,
  type TeachingProposalContent,
  type TeachingProposalUdaContext,
  type TeachingProposalV1
} from '../library/teachingProposal';
import { resolveLibraryRemoteProposalActions } from '../library/contextualCoreAdapter';
import {
  buildAiBudgetActivityKey,
  createAiBudgetAuthorization,
  resolvePrepareBudget,
  type AiBudgetAuthorizationV1,
  type AiBudgetEscalationReason,
  type AiBudgetProfile
} from '../copilot/aiBudgetGovernor';
import { LibraryProposalServiceError } from '../services/libraryProposalErrors';
import type { CopilotMissionV1 } from '../copilot/mission';
import { assertMissionRuntimeExecutionAuthorized } from './CopilotMissionBridge';
import { classifyTeachingProposalOutcome } from '../copilot/missionOutcome';
import type { CopilotPreferenceSignalKind } from '../copilot/preferenceLearning';
import {
  getLibraryProposalProviderMetadata,
  notifyMissionProposalReady,
  requestLibraryTeachingProposal,
  type LibraryProposalProviderMetadata,
  type MissionProposalReadyCallback
} from '../services/libraryProposalService';
import { uid } from '../utils';
import type {
  TeachingProposalOutcomeCandidate,
  TeachingProposalOutcomeMutationInput
} from '../persistence/teachingProposalOutcomeMutation';

interface LibraryProposalPanelProps {
  source: LibrarySource;
  uda: TeachingProposalUdaContext;
  writableByRegistro: boolean;
  teachingContext: ResolvedLibraryTeachingContext;
  professionalMemory: RemoteProfessionalMemoryProjectionV1;
  aiBudgetProfile?: AiBudgetProfile;
  isPending: boolean;
  onUpdate: (sourceId: string, patch: LibrarySourcePatch) => Promise<void>;
  onAddSource: (source: LibrarySource) => Promise<void>;
  onAdoptProposalToUda: (
    input: TeachingProposalOutcomeMutationInput
  ) => Promise<TeachingProposalOutcomeCandidate['receipt']>;
  initialResult?: CopilotMissionV1['result'] | null;
  missionId?: string;
  generationMissionId?: string;
  generationContextFingerprint?: string;
  onMissionProposalReady?: MissionProposalReadyCallback;
  onMissionOutcome?: (input: { missionId: string; signal: CopilotPreferenceSignalKind }) => Promise<void> | void;
}

type ProviderMetadataStatus = 'idle' | 'loading' | 'ready' | 'error';
type BudgetEscalationState = {
  reason?: AiBudgetEscalationReason;
  explanation: string;
};

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function contentFromProposal(proposal: TeachingProposalV1): TeachingProposalContent {
  return {
    title: proposal.title,
    objective: proposal.objective,
    teacherSetup: proposal.teacherSetup,
    studentTask: proposal.studentTask,
    steps: [...proposal.steps],
    questions: [...proposal.questions],
    adaptationHint: proposal.adaptationHint
  };
}

export const LibraryProposalPanel: React.FC<LibraryProposalPanelProps> = ({
  source,
  uda,
  writableByRegistro,
  teachingContext,
  professionalMemory,
  aiBudgetProfile,
  isPending,
  onUpdate,
  onAddSource,
  onAdoptProposalToUda,
  initialResult = null,
  missionId,
  generationMissionId,
  generationContextFingerprint,
  onMissionProposalReady,
  onMissionOutcome
}) => {
  const [remoteConsent, setRemoteConsent] = useState(false);
  const [remoteActions, setRemoteActions] = useState<readonly ResolvedAction[]>([]);
  const [providerMetadata, setProviderMetadata] = useState<LibraryProposalProviderMetadata | null>(null);
  const [providerMetadataStatus, setProviderMetadataStatus] = useState<ProviderMetadataStatus>('idle');
  const [providerMetadataAttempt, setProviderMetadataAttempt] = useState(0);
  const [isRemoteLoading, setIsRemoteLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [proposal, setProposal] = useState<TeachingProposalV1 | null>(initialResult?.proposal ?? null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState<TeachingProposalContent | null>(null);
  const [isAdopting, setIsAdopting] = useState(false);
  const [adoptionError, setAdoptionError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [budgetEscalation, setBudgetEscalation] = useState<BudgetEscalationState | null>(null);
  const [activityBudgetAuthorization, setActivityBudgetAuthorization] = useState<AiBudgetAuthorizationV1 | null>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const adoptionSourceIdRef = useRef<string | null>(null);
  const adoptionLessonIdRef = useRef<string | null>(null);

  useEffect(() => {
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    adoptionSourceIdRef.current = null;
    adoptionLessonIdRef.current = null;
    setRemoteConsent(false);
    setRemoteActions([]);
    setIsRemoteLoading(false);
    setIsGenerating(false);
    setProposal(initialResult?.proposal ?? null);
    setIsEditing(false);
    setEditedContent(null);
    setIsAdopting(false);
    setAdoptionError(null);
    setBudgetEscalation(null);
    setActivityBudgetAuthorization(null);
    setError(null);
  }, [source.id, source.privacy, source.status, teachingContext.udaId, teachingContext.lessonId, initialResult, generationContextFingerprint]);

  useEffect(() => {
    let cancelled = false;
    if (source.privacy !== 'teacher-professional') {
      setProviderMetadata(null);
      setProviderMetadataStatus('idle');
      return () => {
        cancelled = true;
      };
    }

    setProviderMetadata(null);
    setProviderMetadataStatus('loading');
    void getLibraryProposalProviderMetadata()
      .then(metadata => {
        if (!cancelled) {
          setProviderMetadata(metadata);
          setProviderMetadataStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProviderMetadata(null);
          setProviderMetadataStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [source.id, source.privacy, providerMetadataAttempt]);

  useEffect(() => {
    let cancelled = false;
    if (!remoteConsent || source.privacy !== 'teacher-professional') {
      setRemoteActions([]);
      setIsRemoteLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setIsRemoteLoading(true);
    setError(null);
    void resolveLibraryRemoteProposalActions(source, teachingContext, true)
      .then(actions => {
        if (!cancelled) setRemoteActions(actions);
      })
      .catch(() => {
        if (!cancelled) {
          setRemoteActions([]);
          setError('La preparazione assistita non è disponibile in questo momento.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsRemoteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [remoteConsent, source, teachingContext]);

  useEffect(() => () => {
    requestControllerRef.current?.abort();
  }, []);

  const prepareAction = remoteActions.find(action => action.id === 'prepare-from-source');

  const classifyAsProfessional = async () => {
    setError(null);
    try {
      await onUpdate(source.id, { privacy: 'teacher-professional' });
    } catch {
      setError('La classificazione non è stata salvata. La fonte resta invariata.');
    }
  };

  const persistMissionOutcome = async (signal: CopilotPreferenceSignalKind): Promise<void> => {
    if (!missionId || !onMissionOutcome) return;
    await onMissionOutcome({ missionId, signal });
  };

  const emitMissionOutcome = (signal: CopilotPreferenceSignalKind) => {
    void persistMissionOutcome(signal).catch(error => {
      console.error('Copilot mission outcome learning failed', error);
    });
  };

  const generateProposal = async (explicitAuthorization?: AiBudgetAuthorizationV1) => {
    if (!prepareAction || isGenerating || !remoteConsent) return;

    setError(null);
    setAdoptionError(null);
    setProposal(null);
    setIsEditing(false);
    setEditedContent(null);
    adoptionSourceIdRef.current = null;
    adoptionLessonIdRef.current = null;

    if (generationMissionId) {
      if (!generationContextFingerprint) {
        setError('Il contesto materiale dell’incarico non è più disponibile: riprendi esplicitamente la missione.');
        return;
      }
      try {
        assertMissionRuntimeExecutionAuthorized(generationMissionId, {
          capability: 'prepare',
          className: teachingContext.className,
          udaId: teachingContext.udaId,
          ...(teachingContext.lessonId ? { lessonId: teachingContext.lessonId } : {}),
          sourceIds: [source.id]
        }, generationContextFingerprint);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Autorizzazione dell’incarico non più valida.');
        return;
      }
    }

    let request;
    try {
      const budgetAuthorization = explicitAuthorization ?? activityBudgetAuthorization ?? undefined;
      request = buildLibraryProposalRequest({
        source,
        teachingContext,
        uda,
        explicitTeacherOptIn: true,
        professionalMemory,
        aiBudgetProfile,
        ...(budgetAuthorization ? { budgetAuthorization } : {})
      });
      const budgetDecision = resolvePrepareBudget({
        profile: request.budget.profile,
        ...measureLibraryProposalBudget(request),
        activityKey: request.budget.activityKey,
        ...(request.budget.authorization ? { authorization: request.budget.authorization } : {}),
        now: new Date().toISOString()
      });
      if (budgetDecision.kind === 'escalation-required') {
        setBudgetEscalation({
          reason: budgetDecision.reason,
          explanation: budgetDecision.explanation
        });
        return;
      }
    } catch (reason) {
      setError(
        reason instanceof Error && reason.message
          ? reason.message
          : 'La proposta didattica non è disponibile in questo momento.'
      );
      return;
    }

    setBudgetEscalation(null);
    setIsGenerating(true);
    const controller = new AbortController();
    requestControllerRef.current = controller;
    let keepConsentOpen = false;

    try {
      const result = await requestLibraryTeachingProposal(request, controller.signal);
      adoptionSourceIdRef.current = uid();
      adoptionLessonIdRef.current = uid();
      if (generationMissionId) {
        await notifyMissionProposalReady(onMissionProposalReady, {
          missionId: generationMissionId,
          proposal: result.proposal,
          receipt: result.receipt
        });
      }
      setProposal(result.proposal);
    } catch (reason) {
      if (!controller.signal.aborted) {
        if (reason instanceof LibraryProposalServiceError && reason.code === 'AI_BUDGET_ESCALATION_REQUIRED') {
          keepConsentOpen = true;
          setBudgetEscalation({
            ...(reason.budgetReason ? { reason: reason.budgetReason } : {}),
            explanation: reason.message
          });
          setError(null);
        } else {
          setError(
            reason instanceof Error && reason.message
              ? reason.message
              : 'La proposta didattica non è disponibile in questo momento.'
          );
        }
      }
    } finally {
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
      setIsGenerating(false);
      if (!keepConsentOpen) {
        setRemoteConsent(false);
        setRemoteActions([]);
      }
    }
  };

  const authorizeBudgetEscalation = async (scope: AiBudgetAuthorizationV1['scope']) => {
    if (isGenerating || !remoteConsent) return;
    const authorization = createAiBudgetAuthorization({
      scope,
      activityKey: buildAiBudgetActivityKey(uda.id, teachingContext.lessonId),
      issuedAt: new Date().toISOString()
    });
    if (scope === 'activity') setActivityBudgetAuthorization(authorization);
    setBudgetEscalation(null);
    await generateProposal(authorization);
  };

  const leaveProposal = async () => {
    setAdoptionError(null);
    try {
      await persistMissionOutcome('discarded');
    } catch (reason) {
      console.error('Copilot mission discard persistence failed', reason);
      setAdoptionError('Non sono riuscito ad archiviare il risultato. La proposta resta disponibile per riprovare.');
      return;
    }
    adoptionSourceIdRef.current = null;
    adoptionLessonIdRef.current = null;
    setProposal(null);
    setIsEditing(false);
    setEditedContent(null);
    setBudgetEscalation(null);
    setRemoteConsent(false);
    setRemoteActions([]);
  };

  const startEditing = () => {
    if (!proposal) return;
    setAdoptionError(null);
    setEditedContent(contentFromProposal(proposal));
    setIsEditing(true);
  };

  const clearAdoptedProposal = () => {
    adoptionSourceIdRef.current = null;
    adoptionLessonIdRef.current = null;
    setProposal(null);
    setIsEditing(false);
    setEditedContent(null);
    setAdoptionError(null);
  };

  const adoptLibraryContent = async (content: TeachingProposalContent) => {
    if (!proposal || isAdopting) return;
    const adoptionId = adoptionSourceIdRef.current ?? uid();
    adoptionSourceIdRef.current = adoptionId;
    setIsAdopting(true);
    setAdoptionError(null);

    try {
      const adopted = createInternalSourceFromTeachingProposal({
        id: adoptionId,
        proposal,
        content,
        capturedAt: new Date().toISOString()
      });
      await onAddSource(adopted);
      emitMissionOutcome(classifyTeachingProposalOutcome(proposal, content));
      emitMissionOutcome('saved-to-library');
      clearAdoptedProposal();
    } catch (reason) {
      setAdoptionError(
        reason instanceof Error && reason.message
          ? reason.message
          : 'Salvataggio della proposta non riuscito. Puoi riprovare senza rigenerarla.'
      );
    } finally {
      setIsAdopting(false);
    }
  };

  const adoptUdaContent = async (content: TeachingProposalContent) => {
    if (!proposal || isAdopting || !writableByRegistro) return;
    const sourceId = adoptionSourceIdRef.current ?? uid();
    const lessonId = adoptionLessonIdRef.current ?? uid();
    adoptionSourceIdRef.current = sourceId;
    adoptionLessonIdRef.current = lessonId;
    setIsAdopting(true);
    setAdoptionError(null);

    try {
      await onAdoptProposalToUda({
        proposal,
        content,
        teachingContext,
        sourceId,
        lessonId,
        targetWritableByRegistro: writableByRegistro,
        capturedAt: new Date().toISOString(),
        lessonDate: localDateKey()
      });
      emitMissionOutcome(classifyTeachingProposalOutcome(proposal, content));
      emitMissionOutcome('linked-to-uda');
      clearAdoptedProposal();
    } catch (reason) {
      setAdoptionError(
        reason instanceof Error && reason.message
          ? reason.message
          : 'Salvataggio della proposta nell’UDA non riuscito. Puoi riprovare senza rigenerarla.'
      );
    } finally {
      setIsAdopting(false);
    }
  };

  if (source.privacy === 'unknown') {
    return (
      <div className="rounded-lg border border-amber-800/60 bg-amber-950/20 p-3 space-y-2">
        <strong className="block text-sm text-amber-100">Prima verifica la natura della fonte</strong>
        <p className="text-xs text-amber-200/90">
          Per usare un servizio remoto devi confermare che questa fonte è materiale professionale del docente e non contiene dati personali degli studenti.
        </p>
        <button
          type="button"
          onClick={() => void classifyAsProfessional()}
          disabled={isPending}
          className="min-h-[44px] px-3 rounded-md border border-amber-700 text-sm text-amber-100 disabled:opacity-50"
        >
          Classifica come materiale professionale
        </button>
        {error && <p role="alert" className="text-xs text-amber-200">{error}</p>}
      </div>
    );
  }

  if (source.privacy === 'student-personal') {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-3">
        <strong className="block text-sm text-slate-200">Preparazione assistita non disponibile</strong>
        <p className="mt-1 text-xs text-slate-400">
          La generazione remota non è disponibile per fonti che possono contenere dati personali di studenti.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-violet-800/60 bg-violet-950/20 p-3 space-y-3">
      <div>
        <strong className="block text-sm text-violet-100">Prepara una proposta didattica</strong>
        <p className="mt-1 text-xs text-violet-200/80">
          L’IA può usare questa fonte professionale, il contesto didattico selezionato e, quando pertinenti, una selezione limitata di sintesi dalla memoria professionale. La proposta non viene salvata automaticamente.
        </p>
      </div>

      {!proposal && (
        <div className="rounded-md border border-slate-800 bg-slate-950/35 p-3 space-y-2">
          <p className="text-xs text-slate-300">
            Questa richiesta invia la fonte professionale, il contesto didattico e, quando presenti, una selezione limitata di sintesi dalla memoria professionale al servizio remoto configurato
            {providerMetadataStatus === 'ready' && providerMetadata
              ? <>: <strong>{providerMetadata.provider}</strong> ({providerMetadata.model})</>
              : '.'}
            {' '}Non includere dati personali degli studenti.
          </p>
          {providerMetadataStatus === 'loading' && (
            <p role="status" className="text-xs text-violet-200">Verifico il servizio remoto configurato…</p>
          )}
          {providerMetadataStatus === 'error' && (
            <div className="space-y-2">
              <p className="text-xs text-amber-200">Non è stato possibile verificare il servizio remoto configurato.</p>
              <button
                type="button"
                onClick={() => setProviderMetadataAttempt(current => current + 1)}
                disabled={isPending || isGenerating}
                className="min-h-[44px] px-3 rounded-md border border-amber-700 text-sm text-amber-100 disabled:opacity-50"
              >
                Riprova verifica servizio
              </button>
            </div>
          )}
          {providerMetadataStatus === 'ready' && providerMetadata?.available === false && (
            <p className="text-xs text-amber-200">Il servizio remoto configurato non è disponibile in questo ambiente.</p>
          )}
        </div>
      )}

      {!remoteConsent && !proposal && (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setRemoteConsent(true);
          }}
          disabled={
            isPending ||
            isGenerating ||
            providerMetadataStatus !== 'ready' ||
            providerMetadata?.available !== true
          }
          className="min-h-[44px] px-3 rounded-md border border-violet-700 text-sm text-violet-100 disabled:opacity-50"
        >
          Consenti per questa richiesta
        </button>
      )}

      {remoteConsent && (
        <div className="rounded-md border border-violet-900/70 bg-slate-950/40 p-3 space-y-2">
          <p className="text-xs text-slate-300">
            Consenso valido solo per questa richiesta. Non verrà ricordato.
          </p>
          {isRemoteLoading && <p role="status" className="text-xs text-violet-200">Verifico l’azione disponibile…</p>}
          {!isRemoteLoading && prepareAction && !budgetEscalation && (
            <button
              type="button"
              onClick={() => void generateProposal()}
              disabled={isPending || isGenerating}
              className="min-h-[44px] px-3 rounded-md bg-violet-200 text-violet-950 font-semibold text-sm disabled:opacity-50"
            >
              {isGenerating ? 'Preparo la proposta…' : prepareAction.label}
            </button>
          )}
          {budgetEscalation && (
            <div className="rounded-md border border-amber-700/70 bg-amber-950/20 p-3 space-y-3">
              <div>
                <strong className="block text-sm text-amber-100">Serve una tua autorizzazione aggiuntiva</strong>
                <p className="mt-1 text-xs text-amber-200/90">{budgetEscalation.explanation}</p>
              </div>
              <p className="text-xs text-slate-300">
                L’autorizzazione è temporanea e non modifica le regole sulla privacy né il consenso già espresso per questa richiesta.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void authorizeBudgetEscalation('operation')}
                  disabled={isPending || isGenerating}
                  className="min-h-[44px] rounded-md bg-amber-200 px-3 text-sm font-semibold text-amber-950 disabled:opacity-50"
                >
                  Autorizza solo questa operazione
                </button>
                <button
                  type="button"
                  onClick={() => void authorizeBudgetEscalation('activity')}
                  disabled={isPending || isGenerating}
                  className="min-h-[44px] rounded-md border border-amber-600 px-3 text-sm font-semibold text-amber-100 disabled:opacity-50"
                >
                  Autorizza per questa attività
                </button>
              </div>
            </div>
          )}
          {!isRemoteLoading && !prepareAction && !error && (
            <p className="text-xs text-amber-200">La preparazione assistita non è autorizzata nel contesto corrente.</p>
          )}
        </div>
      )}

      {error && <p role="alert" className="text-xs text-amber-200">{error}</p>}
      {adoptionError && <p role="alert" className="text-xs text-amber-200">{adoptionError}</p>}

      {!writableByRegistro && proposal && (
        <p data-testid="projected-uda-read-only-notice" className="rounded-md border border-sky-800/60 bg-sky-950/20 p-2 text-xs text-sky-100">
          UDA proveniente da Docente OS: puoi usare il contesto per preparare e salvare materiali in Biblioteca, ma il Registro non può modificare questa UDA.
        </p>
      )}

      {proposal && !isEditing && (
        <section className="rounded-lg border border-violet-700/60 bg-slate-950/55 p-3 space-y-3" aria-label="Proposta didattica">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-violet-300">Proposta</p>
            <h4 className="mt-1 font-semibold text-white">{proposal.title}</h4>
          </div>
          <div>
            <strong className="text-xs text-slate-200">Obiettivo</strong>
            <p className="mt-1 text-sm text-slate-300">{proposal.objective}</p>
          </div>
          <div>
            <strong className="text-xs text-slate-200">Preparazione docente</strong>
            <p className="mt-1 text-sm text-slate-300">{proposal.teacherSetup}</p>
          </div>
          <div>
            <strong className="text-xs text-slate-200">Consegna agli studenti</strong>
            <p className="mt-1 text-sm text-slate-300">{proposal.studentTask}</p>
          </div>
          <div>
            <strong className="text-xs text-slate-200">Passaggi</strong>
            <ol className="mt-1 list-decimal pl-5 space-y-1 text-sm text-slate-300">
              {proposal.steps.map((step, index) => <li key={`${index}:${step}`}>{step}</li>)}
            </ol>
          </div>
          <div>
            <strong className="text-xs text-slate-200">Domande guida</strong>
            <ul className="mt-1 list-disc pl-5 space-y-1 text-sm text-slate-300">
              {proposal.questions.map((question, index) => <li key={`${index}:${question}`}>{question}</li>)}
            </ul>
          </div>
          <div>
            <strong className="text-xs text-slate-200">Adattamento</strong>
            <p className="mt-1 text-sm text-slate-300">{proposal.adaptationHint}</p>
          </div>
          <p className="text-[11px] text-slate-500">
            Proposta generata · resta effimera finché non scegli esplicitamente cosa farne.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void adoptLibraryContent(contentFromProposal(proposal))}
              disabled={isPending || isAdopting}
              className="min-h-[44px] px-3 rounded-md bg-violet-200 text-violet-950 font-semibold text-sm disabled:opacity-50"
            >
              {isAdopting ? 'Salvo…' : 'Adotta in Biblioteca'}
            </button>
            {writableByRegistro && (
              <button
                type="button"
                onClick={() => void adoptUdaContent(contentFromProposal(proposal))}
                disabled={isPending || isAdopting}
                className="min-h-[44px] px-3 rounded-md border border-violet-600 text-violet-100 font-semibold text-sm disabled:opacity-50"
              >
                {isAdopting ? 'Salvo…' : "Adotta e aggiungi all'UDA"}
              </button>
            )}
            <button
              type="button"
              onClick={startEditing}
              disabled={isPending || isAdopting}
              className="min-h-[44px] px-3 rounded-md border border-violet-700 text-violet-100 text-sm disabled:opacity-50"
            >
              Adatta
            </button>
            <button
              type="button"
              onClick={leaveProposal}
              disabled={isPending || isAdopting}
              className="min-h-[44px] px-3 rounded-md border border-slate-700 text-slate-200 text-sm disabled:opacity-50"
            >
              Lascia
            </button>
          </div>
        </section>
      )}

      {proposal && isEditing && editedContent && (
        <section className="rounded-lg border border-violet-700/60 bg-slate-950/55 p-3 space-y-3" aria-label="Adatta proposta didattica">
          <p className="text-[11px] uppercase tracking-wider text-violet-300">Adatta prima di salvare</p>
          <label className="block text-xs text-slate-300">Titolo
            <input
              value={editedContent.title}
              onChange={event => setEditedContent(current => current ? { ...current, title: event.target.value } : current)}
              disabled={isPending || isAdopting}
              className="mt-1 min-h-[44px] w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100"
            />
          </label>
          <label className="block text-xs text-slate-300">Obiettivo
            <textarea
              value={editedContent.objective}
              onChange={event => setEditedContent(current => current ? { ...current, objective: event.target.value } : current)}
              disabled={isPending || isAdopting}
              rows={2}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="block text-xs text-slate-300">Preparazione docente
            <textarea
              value={editedContent.teacherSetup}
              onChange={event => setEditedContent(current => current ? { ...current, teacherSetup: event.target.value } : current)}
              disabled={isPending || isAdopting}
              rows={2}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="block text-xs text-slate-300">Consegna agli studenti
            <textarea
              value={editedContent.studentTask}
              onChange={event => setEditedContent(current => current ? { ...current, studentTask: event.target.value } : current)}
              disabled={isPending || isAdopting}
              rows={3}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="block text-xs text-slate-300">Passaggi · uno per riga
            <textarea
              value={editedContent.steps.join('\n')}
              onChange={event => setEditedContent(current => current ? {
                ...current,
                steps: event.target.value.split('\n').map(item => item.trim()).filter(Boolean)
              } : current)}
              disabled={isPending || isAdopting}
              rows={4}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="block text-xs text-slate-300">Domande guida · una per riga
            <textarea
              value={editedContent.questions.join('\n')}
              onChange={event => setEditedContent(current => current ? {
                ...current,
                questions: event.target.value.split('\n').map(item => item.trim()).filter(Boolean)
              } : current)}
              disabled={isPending || isAdopting}
              rows={3}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="block text-xs text-slate-300">Suggerimento di adattamento
            <textarea
              value={editedContent.adaptationHint}
              onChange={event => setEditedContent(current => current ? { ...current, adaptationHint: event.target.value } : current)}
              disabled={isPending || isAdopting}
              rows={2}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void adoptLibraryContent(editedContent)}
              disabled={isPending || isAdopting}
              className="min-h-[44px] px-3 rounded-md bg-violet-200 text-violet-950 font-semibold text-sm disabled:opacity-50"
            >
              {isAdopting ? 'Salvo…' : 'Adotta in Biblioteca'}
            </button>
            {writableByRegistro && (
              <button
                type="button"
                onClick={() => void adoptUdaContent(editedContent)}
                disabled={isPending || isAdopting}
                className="min-h-[44px] px-3 rounded-md border border-violet-600 text-violet-100 font-semibold text-sm disabled:opacity-50"
              >
                {isAdopting ? 'Salvo…' : "Adotta e aggiungi all'UDA"}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setEditedContent(null);
                setAdoptionError(null);
              }}
              disabled={isPending || isAdopting}
              className="min-h-[44px] px-3 rounded-md border border-slate-700 text-slate-200 text-sm disabled:opacity-50"
            >
              Annulla modifica
            </button>
            <button
              type="button"
              onClick={leaveProposal}
              disabled={isPending || isAdopting}
              className="min-h-[44px] px-3 rounded-md border border-slate-700 text-slate-200 text-sm disabled:opacity-50"
            >
              Lascia
            </button>
          </div>
        </section>
      )}
    </div>
  );
};