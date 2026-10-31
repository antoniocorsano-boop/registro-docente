import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, FilePlus2, Link2, MessageCircle, Send, Upload, X } from 'lucide-react';
import type { CopilotRequestResolution } from '@trama/contextual-copilot-core';
import type { ClassData, UdaRecord } from '../types';
import type { AiBudgetProfile } from '../copilot/aiBudgetGovernor';
import type { PlanningState } from '../planning/types';
import type { ProfessionalMemoryCategory, ProfessionalMemoryStateV1 } from '../memory/types';
import {
  selectProfessionalMemoryWorkingSet,
  toRemoteProfessionalMemoryProjection,
  type RememberProfessionalItemInput
} from '../memory/professionalMemory';
import {
  resolveLaunchTeachingContext,
  resolveLaunchTeachingContextFromCatalog,
  type CopilotLaunchContext,
  type LibraryCopilotLaunchRequest
} from '../library/copilotLaunchContext';
import type { LibrarySource, LibrarySourceLink, LibraryStateV1 } from '../library/types';
import type { LibrarySourcePatch } from '../library/libraryState';
import { uid } from '../utils';
import type {
  TeachingProposalOutcomeCandidate,
  TeachingProposalOutcomeMutationInput
} from '../persistence/teachingProposalOutcomeMutation';
import { createCopilotLibrarySource } from '../library/copilotSourceBridge';
import { AgentIntentClientError, interpretCopilotIntent } from '../services/agentIntentService';
import { buildCopilotContextProjection, resolveCopilotProjectionSurface } from '../copilot/contextProjection';
import { buildAgentRoutingRequestFromProjection } from '../library/agentIntent';
import { routeAgentIntent } from '../library/agentIntentRouting';
import {
  buildLibraryCopilotRequest,
  discoverLibraryCopilotIntent,
  dispatchLibraryContextAction,
  resolveLibraryCopilotRequest
} from '../library/contextualCoreAdapter';
import { resolvePlanningContextForLibraryRelevance } from '../library/relevancePresentation';
import {
  resolveContextualDidacticReview,
  type ContextualDidacticReviewResolution,
  type ContextualReviewConfidenceLevel,
  type ContextualReviewRelevanceLevel
} from '../library/contextualDidacticReview';
import { resolveCopilotLinkTarget } from '../library/copilotLinkTarget';
import { LibraryProposalPanel } from './LibraryProposalPanel';
import { assertMissionRuntimeExecutionAuthorized, CopilotMissionBridge } from './CopilotMissionBridge';
import { buildMissionContextFingerprint } from '../copilot/mission';
import { resolveTeacherFirstRequest, type TeacherFirstRequestResolution, type TeacherFirstGoalKind } from '../copilot/teacherFirstRequest';
import {
  buildTeacherFirstTeachingCatalog,
  udasForCanonicalClass
} from '../copilot/teacherFirstTeachingCatalog';
import {
  buildTeachingUdaCatalog,
  buildTeachingUdaClassReconciliationIndex,
  resolveTeachingUdaCandidate
} from '../teaching/teachingUdaCatalog';
import type { CopilotProactivityProfile } from '../copilot/proactivity';
import {
  consumeStagedMissionReview,
  type MissionReviewHandoffV1
} from '../copilot/missionReviewHandoff';
import type { CopilotPreferenceSignalKind } from '../copilot/preferenceLearning';
import type { MissionProposalReadyNotification } from '../services/libraryProposalService';
import {
  ProfessionalMemoryPanel,
  type ProfessionalMemoryRememberCandidate
} from './ProfessionalMemoryPanel';
import {
  resolveLibraryTeachingContext,
  resolveLibraryTeachingContextFromCatalog,
  suggestLibraryTeachingContext,
  type LibraryTeachingContext
} from '../library/teachingContext';

type CopilotSurfaceMode = 'closed' | 'home' | 'compose';

interface LibraryCopilotComposerProps {
  library: LibraryStateV1;
  udas: UdaRecord[];
  planning: PlanningState;
  professionalMemory: ProfessionalMemoryStateV1;
  aiBudgetProfile?: AiBudgetProfile;
  copilotProactivity?: CopilotProactivityProfile;
  memoryError?: string | null;
  currentClassName?: string | null;
  classes?: ClassData[];
  launchRequest?: LibraryCopilotLaunchRequest | null;
  openRequestNonce?: number;
  ambientContext?: CopilotLaunchContext;
  onAddSource: (source: LibrarySource) => Promise<void>;
  onAdoptProposalToUda: (
    input: TeachingProposalOutcomeMutationInput
  ) => Promise<TeachingProposalOutcomeCandidate['receipt']>;
  onUpdateSource: (sourceId: string, patch: LibrarySourcePatch) => Promise<void>;
  onLink: (sourceId: string, link: LibrarySourceLink) => Promise<void>;
  onRemember: (input: RememberProfessionalItemInput) => Promise<void>;
  onCorrectMemoryEntry: (entryId: string, summary: string) => Promise<void>;
  onRemoveMemoryEntry: (entryId: string) => Promise<void>;
  onSetMemoryCategory: (category: ProfessionalMemoryCategory, enabled: boolean) => Promise<void>;
  onRemoveMemoryCategory: (category: ProfessionalMemoryCategory) => Promise<void>;
  onMissionProposalReady?: (input: MissionProposalReadyNotification) => Promise<void> | void;
  onMissionInterrupted?: (input: { missionId: string }) => Promise<void> | void;
  onMissionOutcome?: (input: { missionId: string; signal: CopilotPreferenceSignalKind }) => Promise<void> | void;
  isPending?: boolean;
  showStandaloneTrigger?: boolean;
  surfaceMode: CopilotSurfaceMode;
  onSurfaceModeChange: (mode: CopilotSurfaceMode) => void;
}

type CaptureMode = 'text' | 'web' | 'file';

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

const ACTION_HELP: Record<string, string> = {
  'review-source': 'Rivedi la fonte nel contesto didattico corrente.',
  'link-source-to-uda': 'Collega la fonte a una UDA con conferma del docente.',
  'prepare-from-source': 'Prepara una proposta didattica senza modificarne automaticamente i dati.'
};

type UnavailableContextualReview = Extract<
  ContextualDidacticReviewResolution,
  { status: 'unavailable' }
>;

function reviewRelevanceLabel(level: ContextualReviewRelevanceLevel): string {
  switch (level) {
    case 'strong': return 'Pertinenza forte';
    case 'plausible': return 'Pertinenza plausibile';
    case 'weak': return 'Pertinenza debole';
  }
}

function reviewAlignmentLabel(status: 'supported' | 'partial' | 'unverified'): string {
  switch (status) {
    case 'supported': return 'Allineamento supportato';
    case 'partial': return 'Allineamento parziale';
    case 'unverified': return 'Allineamento non verificato';
  }
}

function reviewConfidenceLabel(level: ContextualReviewConfidenceLevel): string {
  switch (level) {
    case 'high': return 'Affidabilità alta';
    case 'medium': return 'Affidabilità media';
    case 'low': return 'Affidabilità bassa';
  }
}

function reviewUnavailableCopy(reason: UnavailableContextualReview['reason']): string {
  switch (reason) {
    case 'SOURCE_NOT_PROFESSIONAL':
      return 'La fonte deve essere classificata come materiale professionale del docente prima della revisione contestuale.';
    case 'SOURCE_NOT_USABLE':
      return 'La fonte non è ancora in uno stato utilizzabile per questa revisione contestuale.';
    case 'TEACHING_CONTEXT_MISSING':
      return 'Seleziona un contesto didattico valido con UDA o lezione prima della revisione contestuale.';
  }
}

export const LibraryCopilotComposer: React.FC<LibraryCopilotComposerProps> = ({
  library,
  udas,
  planning,
  professionalMemory,
  aiBudgetProfile,
  copilotProactivity,
  memoryError = null,
  currentClassName = null,
  classes = [],
  launchRequest = null,
  openRequestNonce = 0,
  ambientContext,
  onAddSource,
  onAdoptProposalToUda,
  onUpdateSource,
  onLink,
  onRemember,
  onCorrectMemoryEntry,
  onRemoveMemoryEntry,
  onSetMemoryCategory,
  onRemoveMemoryCategory,
  onMissionProposalReady,
  onMissionInterrupted,
  onMissionOutcome,
  isPending = false,
  showStandaloneTrigger = true,
  surfaceMode,
  onSurfaceModeChange
}) => {
  const isOpen = surfaceMode === 'compose';
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [message, setMessage] = useState('');
  const [teacherFirstResolution, setTeacherFirstResolution] = useState<TeacherFirstRequestResolution | null>(null);
  const [teacherFirstClassId, setTeacherFirstClassId] = useState<string | null>(null);
  const [captureMode, setCaptureMode] = useState<CaptureMode | null>(null);
  const [captureTitle, setCaptureTitle] = useState('');
  const [captureText, setCaptureText] = useState('');
  const [captureUrl, setCaptureUrl] = useState('');
  const [captureFile, setCaptureFile] = useState<File | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [guidanceMessage, setGuidanceMessage] = useState<string | null>(null);
  const [resolution, setResolution] = useState<CopilotRequestResolution | null>(null);
  const [isReviewUnavailableOpen, setIsReviewUnavailableOpen] = useState(false);
  const [isLinkConfirmationOpen, setIsLinkConfirmationOpen] = useState(false);
  const [isLinkPending, setIsLinkPending] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null);
  const [isPrepareOpen, setIsPrepareOpen] = useState(false);
  const [contextOverride, setContextOverride] = useState<LibraryTeachingContext | 'auto' | null>('auto');
  const [missionLaunchSettledNonce, setMissionLaunchSettledNonce] = useState<number | null>(null);
  const [readyMissionReview, setReadyMissionReview] = useState<MissionReviewHandoffV1 | null>(null);
  const [isMobileDialog, setIsMobileDialog] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  );
  const resolutionEpochRef = useRef(0);
  const agentFallbackCodeRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const preserveGovernedContinuationOnReopenRef = useRef(false);
  const directLaunchResolutionKeyRef = useRef<string | null>(null);
  const composerDialogRef = useRef<HTMLElement | null>(null);
  const composerCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const composerPreviousFocusRef = useRef<HTMLElement | null>(null);

  const hasLaunchTeachingTarget = Boolean(
    launchRequest?.context.udaId || launchRequest?.context.lessonId
  );
  const launchTeachingContextIsProposed = hasLaunchTeachingTarget
    && launchRequest?.context.teachingContextMode === 'proposed';
  const hasExplicitLaunchTarget = hasLaunchTeachingTarget && !launchTeachingContextIsProposed;
  const effectiveClassName = launchRequest?.context.className
    ?? ambientContext?.className
    ?? currentClassName;

  const teacherFirstCatalog = useMemo(
    () => buildTeacherFirstTeachingCatalog({ classes, udas }),
    [classes, udas]
  );
  const docenteOsClassReconciliation = useMemo(
    () => buildTeachingUdaClassReconciliationIndex(planning.docenteOsProjections),
    [planning.docenteOsProjections]
  );
  const teachingUdaCatalog = useMemo(() => buildTeachingUdaCatalog({
    localUdas: udas,
    acceptedProjections: planning.docenteOsProjections,
    classReconciliation: docenteOsClassReconciliation,
    classes
  }), [udas, planning.docenteOsProjections, docenteOsClassReconciliation, classes]);
  const selectableLocalUdas = useMemo(() => teachingUdaCatalog.flatMap(candidate =>
    candidate.origin === 'registro' && candidate.localUda ? [candidate.localUda] : []
  ), [teachingUdaCatalog]);
  const knownTeacherClasses = useMemo(() => Array.from(new Set([
    ...teacherFirstCatalog.classes.map(entry => entry.label),
    ...teacherFirstCatalog.classes.flatMap(entry => entry.aliases),
    ...teacherFirstCatalog.ambiguities.flatMap(ambiguity => ambiguity.candidates.map(candidate => candidate.label))
  ])), [teacherFirstCatalog]);
  const teacherFirstClassChoices = useMemo(() => {
    const requestedLabels = new Set(teacherFirstResolution?.classCandidates ?? []);
    const requestedCanonicalClassIds = new Set(
      teacherFirstCatalog.classes
        .filter(entry => entry.aliases.some(alias => requestedLabels.has(alias)))
        .map(entry => entry.classId)
    );
    const requestedAmbiguousKeys = new Set(
      teacherFirstCatalog.ambiguities
        .filter(ambiguity => ambiguity.candidates.some(candidate => requestedLabels.has(candidate.label)))
        .map(ambiguity => ambiguity.semanticKey)
    );
    const choices = [
      ...teacherFirstCatalog.classes.map(entry => ({
        classId: entry.classId,
        label: entry.label,
        semanticKey: entry.semanticKey,
        ambiguous: false
      })),
      ...teacherFirstCatalog.ambiguities.flatMap(ambiguity => ambiguity.candidates.map(candidate => ({
        classId: candidate.classId,
        label: candidate.label,
        semanticKey: ambiguity.semanticKey,
        ambiguous: true
      })))
    ];
    if (requestedLabels.size === 0) return choices.sort((left, right) => left.label.localeCompare(right.label, 'it'));
    return choices
      .filter(choice => requestedLabels.has(choice.label)
        || requestedCanonicalClassIds.has(choice.classId)
        || Boolean(choice.semanticKey && requestedAmbiguousKeys.has(choice.semanticKey)))
      .sort((left, right) => left.label.localeCompare(right.label, 'it'));
  }, [teacherFirstCatalog, teacherFirstResolution]);
  const selectedTeacherFirstClass = useMemo(
    () => teacherFirstClassId ? classes.find(classItem => classItem.id === teacherFirstClassId) ?? null : null,
    [classes, teacherFirstClassId]
  );
  const teacherFirstClassName = selectedTeacherFirstClass?.name ?? null;
  const teacherFirstClassIsAmbiguous = useMemo(
    () => Boolean(teacherFirstClassId && teacherFirstCatalog.ambiguities.some(ambiguity => ambiguity.classIds.includes(teacherFirstClassId))),
    [teacherFirstCatalog, teacherFirstClassId]
  );

  const isBoundMissionFlow = Boolean(launchRequest?.mission || readyMissionReview);
  const hasBoundLaunchContext = Boolean(
    launchRequest && (launchRequest.context.sourceId || hasLaunchTeachingTarget)
  );

  const explicitLaunchTeachingContext = useMemo(
    () => launchRequest?.mission
      ? resolveLaunchTeachingContext(launchRequest, udas)
      : resolveLaunchTeachingContextFromCatalog(launchRequest, teachingUdaCatalog),
    [launchRequest?.nonce, launchRequest?.mission, udas, teachingUdaCatalog]
  );
  const directLaunchIntent = launchRequest?.context.intent ?? null;
  const hasCompleteDirectLaunch = Boolean(
    launchRequest
    && !launchRequest.mission
    && directLaunchIntent
    && launchRequest.context.sourceId
    && hasLaunchTeachingTarget
    && explicitLaunchTeachingContext
  );

  const teachingSuggestion = useMemo(() => {
    if (contextOverride !== 'auto' || hasLaunchTeachingTarget) return null;
    return suggestLibraryTeachingContext({
      udas: selectableLocalUdas,
      currentClassName: effectiveClassName ?? null,
      today: localDateKey()
    });
  }, [selectableLocalUdas, effectiveClassName, hasLaunchTeachingTarget, contextOverride]);

  const resolvedTeachingContext = contextOverride === 'auto'
    ? (hasLaunchTeachingTarget
      ? explicitLaunchTeachingContext
      : resolveLibraryTeachingContextFromCatalog(teachingUdaCatalog, teachingSuggestion?.context ?? null))
    : resolveLibraryTeachingContextFromCatalog(teachingUdaCatalog, contextOverride);

  const localTeacherFirstClassUdas = useMemo(() => teacherFirstClassId
    ? udasForCanonicalClass(teacherFirstCatalog, teacherFirstClassId)
    : [], [teacherFirstCatalog, teacherFirstClassId]);
  const teacherFirstClassUdas = useMemo(() => {
    if (!teacherFirstClassId) return [];
    const localIds = new Set(localTeacherFirstClassUdas.map(uda => uda.id));
    return teachingUdaCatalog.filter(candidate =>
      candidate.classId === teacherFirstClassId
      && (candidate.origin === 'docente-os' || localIds.has(candidate.id))
    );
  }, [teachingUdaCatalog, teacherFirstClassId, localTeacherFirstClassUdas]);
  const teacherFirstGoalKind: TeacherFirstGoalKind | null = teacherFirstResolution?.goalKind ?? null;
  const showTeachingContextControls = isBoundMissionFlow || Boolean(teacherFirstClassId && !teacherFirstClassIsAmbiguous);
  const showMaterialControls = isBoundMissionFlow || teacherFirstGoalKind === 'material' || Boolean(selectedSourceId && !hasBoundLaunchContext) || Boolean(teacherFirstClassId && !teacherFirstClassIsAmbiguous && resolvedTeachingContext);

  const teachingContextFingerprint = [
    resolvedTeachingContext?.udaId ?? '',
    resolvedTeachingContext?.lessonId ?? '',
    resolvedTeachingContext?.className ?? '',
    resolvedTeachingContext?.period ?? '',
    resolvedTeachingContext?.activityType ?? ''
  ].join('|');

  const resolvedPlanningContext = useMemo(() => resolvePlanningContextForLibraryRelevance(
    resolvedTeachingContext,
    planning
  ), [resolvedTeachingContext, planning]);

  const selectedSource = useMemo(
    () => library.sources.find(source => source.id === selectedSourceId) ?? null,
    [library.sources, selectedSourceId]
  );
  const hasResolvedConversationContext = Boolean(selectedSource);

  const contextualReview = useMemo(() => {
    if (!selectedSource) return null;
    return resolveContextualDidacticReview({
      source: selectedSource,
      udas: selectableLocalUdas,
      teachingUdaCatalog,
      teachingContext: resolvedTeachingContext,
      planningContext: resolvedPlanningContext
    });
  }, [selectedSource, selectableLocalUdas, teachingUdaCatalog, teachingContextFingerprint, resolvedPlanningContext]);

  const copilotProjectionSurface = resolveCopilotProjectionSurface({
    ambientSurface: ambientContext?.surface,
    launchSurface: launchRequest?.context.surface,
    hasExplicitTeachingTarget: hasExplicitLaunchTarget
  });

  const copilotContextProjection = useMemo(() => buildCopilotContextProjection({
    surface: copilotProjectionSurface,
    className: resolvedTeachingContext?.className ?? effectiveClassName ?? null,
    udaId: resolvedTeachingContext?.udaId ?? null,
    lessonId: resolvedTeachingContext?.lessonId ?? null,
    sourceId: selectedSource?.id ?? null,
    planningProfileId: resolvedPlanningContext?.status === 'resolved'
      ? resolvedPlanningContext.profile.id
      : null
  }), [
    copilotProjectionSurface,
    effectiveClassName,
    teachingContextFingerprint,
    selectedSource?.id,
    resolvedPlanningContext
  ]);
  const copilotContextFingerprint = JSON.stringify(copilotContextProjection);

  const professionalMemoryWorkingSet = useMemo(() => selectProfessionalMemoryWorkingSet({
    state: professionalMemory,
    context: {
      ...(copilotContextProjection.className ? { className: copilotContextProjection.className } : {}),
      ...(copilotContextProjection.udaId ? { udaId: copilotContextProjection.udaId } : {}),
      ...(copilotContextProjection.lessonId ? { lessonId: copilotContextProjection.lessonId } : {}),
      ...(copilotContextProjection.sourceId ? { sourceId: copilotContextProjection.sourceId } : {}),
      ...(copilotContextProjection.planningProfileId
        ? { planningProfileId: copilotContextProjection.planningProfileId }
        : {})
    },
    activeCanonicalRefs: [
      ...library.sources.map(source => `source:${source.id}`),
      ...teachingUdaCatalog.map(uda => `uda:${uda.id}`),
      ...teachingUdaCatalog.flatMap(uda => uda.lessons.map(lesson => `lesson:${lesson.id}`)),
      ...planning.profiles.map(profile => `planning:${profile.id}`)
    ]
  }), [professionalMemory, copilotContextProjection, library.sources, teachingUdaCatalog, planning.profiles]);

  const remoteProfessionalMemory = useMemo(
    () => toRemoteProfessionalMemoryProjection(professionalMemoryWorkingSet),
    [professionalMemoryWorkingSet]
  );

  const rememberCandidate = useMemo<ProfessionalMemoryRememberCandidate | null>(() => {
    if (!(selectedSource?.privacy === 'teacher-professional')) return null;
    return {
      summary: `Riusa “${selectedSource.title}” quando è pertinente al contesto didattico corrente.`,
      context: {
        ...(copilotContextProjection.className ? { className: copilotContextProjection.className } : {}),
        ...(copilotContextProjection.udaId ? { udaId: copilotContextProjection.udaId } : {}),
        ...(copilotContextProjection.lessonId ? { lessonId: copilotContextProjection.lessonId } : {}),
        sourceId: selectedSource.id,
        ...(copilotContextProjection.planningProfileId
          ? { planningProfileId: copilotContextProjection.planningProfileId }
          : {})
      },
      canonicalRef: `source:${selectedSource.id}`,
      privacyClassification: 'TEACHER_PROFESSIONAL'
    };
  }, [selectedSource?.id, selectedSource?.title, selectedSource?.privacy, copilotContextProjection]);

  const proposalUda = useMemo(() => {
    if (!resolvedTeachingContext) return null;
    return resolveTeachingUdaCandidate(resolvedTeachingContext.udaId, teachingUdaCatalog);
  }, [resolvedTeachingContext, teachingUdaCatalog]);

  const currentResolutionSnapshot = JSON.stringify({
    sourceRequest: selectedSource
      ? buildLibraryCopilotRequest({
          source: selectedSource,
          teachingContext: resolvedTeachingContext,
          planningContext: resolvedPlanningContext,
          message: message.trim()
        })
      : null,
    message: message.trim(),
    contextProjection: copilotContextProjection
  });
  const resolutionSnapshotRef = useRef(currentResolutionSnapshot);

  useLayoutEffect(() => {
    resolutionSnapshotRef.current = currentResolutionSnapshot;
  }, [currentResolutionSnapshot]);

  const requestedLaunchSourceId = launchRequest?.context.sourceId ?? null;
  const directLaunchBindingsReady = Boolean(
    hasCompleteDirectLaunch
    && requestedLaunchSourceId
    && selectedSource?.id === requestedLaunchSourceId
    && explicitLaunchTeachingContext
    && resolvedTeachingContext?.udaId === explicitLaunchTeachingContext.udaId
    && (resolvedTeachingContext?.lessonId ?? '') === (explicitLaunchTeachingContext.lessonId ?? '')
  );
  const directPrepareLaunchIsBound = Boolean(
    directLaunchIntent === 'prepare'
    && directLaunchBindingsReady
  );
  const missionLaunchBindingsReady = !launchRequest?.mission || Boolean(
    (!requestedLaunchSourceId || selectedSourceId === requestedLaunchSourceId)
    && (!launchRequest.context.className || resolvedTeachingContext?.className === launchRequest.context.className)
    && (!launchRequest.context.udaId || resolvedTeachingContext?.udaId === launchRequest.context.udaId)
    && (!launchRequest.context.lessonId || resolvedTeachingContext?.lessonId === launchRequest.context.lessonId)
  );
  const boundLaunchMissionId = launchRequest?.mission && missionLaunchBindingsReady
    ? launchRequest.mission.missionId
    : undefined;
  const currentPlanningProfileId = resolvedPlanningContext?.status === 'resolved'
    ? resolvedPlanningContext.profile.id
    : null;
  const generationContextFingerprint = useMemo(() => {
    if (
      !boundLaunchMissionId
      || !selectedSource
      || !resolvedTeachingContext
      || !proposalUda
      || proposalUda.origin !== 'registro'
      || !proposalUda.localUda
    ) return null;
    const missionProjection = buildCopilotContextProjection({
      surface: 'library',
      className: resolvedTeachingContext.className,
      udaId: resolvedTeachingContext.udaId,
      lessonId: resolvedTeachingContext.lessonId,
      sourceId: selectedSource.id,
      planningProfileId: currentPlanningProfileId
    });
    return buildMissionContextFingerprint({
      context: missionProjection,
      uda: proposalUda.localUda,
      sources: [selectedSource],
      planningProfileId: currentPlanningProfileId,
      missionSettings: {
        aiBudgetProfile: aiBudgetProfile ?? 'balanced',
        copilotProactivity: copilotProactivity ?? 'balanced'
      }
    });
  }, [
    boundLaunchMissionId,
    selectedSource,
    resolvedTeachingContext,
    proposalUda,
    currentPlanningProfileId,
    aiBudgetProfile,
    copilotProactivity
  ]);
  const assertBoundMissionPrepareAuthorized = () => {
    if (!boundLaunchMissionId) return;
    if (!selectedSource || !resolvedTeachingContext || !generationContextFingerprint) {
      throw new Error('Il contesto materiale dell’incarico non è più disponibile: riprendi esplicitamente la missione.');
    }
    assertMissionRuntimeExecutionAuthorized(boundLaunchMissionId, {
      capability: 'prepare',
      className: resolvedTeachingContext.className,
      udaId: resolvedTeachingContext.udaId,
      ...(resolvedTeachingContext.lessonId ? { lessonId: resolvedTeachingContext.lessonId } : {}),
      sourceIds: [selectedSource.id]
    }, generationContextFingerprint);
  };
  const interruptBoundMission = () => {
    if (!boundLaunchMissionId) return;
    void onMissionInterrupted?.({ missionId: boundLaunchMissionId });
  };
  const missionLaunchReady = !launchRequest?.mission || Boolean(
    missionLaunchBindingsReady
    && missionLaunchSettledNonce === launchRequest.nonce
  );

  useLayoutEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const syncMobileDialog = () => setIsMobileDialog(query.matches);
    syncMobileDialog();
    query.addEventListener('change', syncMobileDialog);
    return () => query.removeEventListener('change', syncMobileDialog);
  }, []);

  useLayoutEffect(() => {
    if (!isOpen || !isMobileDialog) return;
    composerPreviousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    composerCloseButtonRef.current?.focus();

    return () => {
      const previous = composerPreviousFocusRef.current;
      composerPreviousFocusRef.current = null;
      requestAnimationFrame(() => {
        if (previous?.isConnected) previous.focus();
      });
    };
  }, [isOpen, isMobileDialog]);

  useEffect(() => {
    if (!openRequestNonce) return;
    const stagedReview = consumeStagedMissionReview();
    const preserveGovernedContinuation = preserveGovernedContinuationOnReopenRef.current;
    preserveGovernedContinuationOnReopenRef.current = false;
    if (stagedReview) {
      const reviewSourceId = stagedReview.contextRef.sourceId ?? stagedReview.sourceRefs[0] ?? '';
      const reviewSource = library.sources.find(source => source.id === reviewSourceId) ?? null;
      const reviewTeachingContext = resolveLibraryTeachingContext(udas, {
        udaId: stagedReview.contextRef.udaId,
        ...(stagedReview.contextRef.lessonId ? { lessonId: stagedReview.contextRef.lessonId } : {})
      });

      resolutionEpochRef.current += 1;
      setResolution(null);
      setIsReviewUnavailableOpen(false);
      setGuidanceMessage(null);
      setIsPrepareOpen(false);
      setIsLinkConfirmationOpen(false);
      setLinkError(null);
      setLinkSuccess(null);
      setReadyMissionReview(null);

      if (
        reviewSource
        && reviewSource.status === 'ready'
        && reviewSource.privacy === 'teacher-professional'
        && reviewTeachingContext
        && reviewTeachingContext.className === stagedReview.contextRef.className
      ) {
        setSelectedSourceId(reviewSourceId);
        setContextOverride({
          udaId: stagedReview.contextRef.udaId,
          ...(stagedReview.contextRef.lessonId ? { lessonId: stagedReview.contextRef.lessonId } : {})
        });
        setMessage(stagedReview.goal);
        setReadyMissionReview(stagedReview);
        setErrorMessage(null);
      } else {
        setErrorMessage('Il risultato pronto non è più compatibile con il contesto professionale corrente.');
      }
    } else if (!preserveGovernedContinuation) {
      resolutionEpochRef.current += 1;
      setSelectedSourceId('');
      setMessage('');
      resetTeacherFirst();
      setContextOverride('auto');
      setResolution(null);
      setIsReviewUnavailableOpen(false);
      setGuidanceMessage(null);
      setIsPrepareOpen(false);
      setIsLinkConfirmationOpen(false);
      setLinkError(null);
      setLinkSuccess(null);
      setErrorMessage(null);
      setReadyMissionReview(null);
    }
    onSurfaceModeChange('compose');
  }, [openRequestNonce]);

  useEffect(() => {
    if (!readyMissionReview) return;
    const expectedSourceId = readyMissionReview.contextRef.sourceId ?? readyMissionReview.sourceRefs[0] ?? '';
    const stillBound = Boolean(
      selectedSource
      && selectedSource.id === expectedSourceId
      && selectedSource.status === 'ready'
      && selectedSource.privacy === 'teacher-professional'
      && resolvedTeachingContext
      && resolvedTeachingContext.udaId === readyMissionReview.contextRef.udaId
      && resolvedTeachingContext.className === readyMissionReview.contextRef.className
      && (resolvedTeachingContext.lessonId ?? '') === (readyMissionReview.contextRef.lessonId ?? '')
    );
    if (!stillBound) setReadyMissionReview(null);
  }, [
    readyMissionReview,
    selectedSourceId,
    selectedSource?.status,
    selectedSource?.privacy,
    teachingContextFingerprint
  ]);

  useEffect(() => {
    if (!launchRequest) return;

    preserveGovernedContinuationOnReopenRef.current = false;
    setMissionLaunchSettledNonce(null);
    setReadyMissionReview(null);
    resetTeacherFirst();
    resolutionEpochRef.current += 1;
    setContextOverride('auto');
    onSurfaceModeChange('compose');
    setResolution(null);
    setIsReviewUnavailableOpen(false);
    setGuidanceMessage(null);
    setIsPrepareOpen(false);
    setIsLinkConfirmationOpen(false);
    setLinkError(null);
    setLinkSuccess(null);
    if (launchRequest.mission) {
      setMessage(launchRequest.mission.objective);
    } else if (hasCompleteDirectLaunch) {
      setMessage(
        directLaunchIntent === 'prepare'
          ? 'Prepara una attività da questa fonte nel contesto didattico corrente.'
          : directLaunchIntent === 'review'
            ? 'Rivedi questa fonte nel contesto didattico corrente.'
            : 'Collega questa fonte al lavoro didattico corrente.'
      );
    }

    if (requestedLaunchSourceId) {
      const sourceExists = library.sources.some(source => source.id === requestedLaunchSourceId);
      if (!sourceExists) {
        setSelectedSourceId('');
        setErrorMessage('La fonte richiesta non è più disponibile.');
        return;
      }
      setSelectedSourceId(requestedLaunchSourceId);
    }

    if (hasLaunchTeachingTarget && !explicitLaunchTeachingContext) {
      setErrorMessage('Il contesto richiesto non è più disponibile.');
      return;
    }

    setErrorMessage(null);
    // A launch is an event identified by nonce. Library/source mutations must not replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launchRequest?.nonce]);

  useEffect(() => {
    if (!directPrepareLaunchIsBound) return;
    setIsPrepareOpen(true);
  }, [launchRequest?.nonce, directPrepareLaunchIsBound]);

  useEffect(() => {
    if (!launchRequest || !requestedLaunchSourceId) return;
    const sourceExists = library.sources.some(source => source.id === requestedLaunchSourceId);
    if (sourceExists) return;

    resolutionEpochRef.current += 1;
    setSelectedSourceId('');
    setResolution(null);
    setIsReviewUnavailableOpen(false);
    setGuidanceMessage(null);
    setIsPrepareOpen(false);
    setIsLinkConfirmationOpen(false);
    setLinkError(null);
    setLinkSuccess(null);
    setErrorMessage('La fonte richiesta non è più disponibile.');
  }, [launchRequest?.nonce, requestedLaunchSourceId, library.sources]);

  useEffect(() => {
    if (contextOverride !== 'auto') return;
    if (!launchRequest || !hasLaunchTeachingTarget || explicitLaunchTeachingContext) return;

    resolutionEpochRef.current += 1;
    setResolution(null);
    setIsReviewUnavailableOpen(false);
    setGuidanceMessage(null);
    setIsPrepareOpen(false);
    setIsLinkConfirmationOpen(false);
    setLinkError(null);
    setLinkSuccess(null);
    setErrorMessage('Il contesto richiesto non è più disponibile.');
  }, [launchRequest?.nonce, hasLaunchTeachingTarget, explicitLaunchTeachingContext, contextOverride]);

  useEffect(() => {
    resolutionEpochRef.current += 1;
    if (!directPrepareLaunchIsBound) setIsPrepareOpen(false);
    setResolution(null);
    setIsReviewUnavailableOpen(false);
    setGuidanceMessage(null);
    setIsLinkConfirmationOpen(false);
    setLinkError(null);
    setLinkSuccess(null);
  }, [selectedSourceId, teachingContextFingerprint, directPrepareLaunchIsBound]);

  useEffect(() => {
    resolutionEpochRef.current += 1;
    setResolution(null);
    setIsReviewUnavailableOpen(false);
    setGuidanceMessage(null);
    setIsLinkConfirmationOpen(false);
    setLinkError(null);
    setLinkSuccess(null);
  }, [selectedSource?.privacy, selectedSource?.status]);

  useEffect(() => {
    if (
      !hasCompleteDirectLaunch
      || !launchRequest
      || !selectedSource
      || !resolvedTeachingContext
      || !directLaunchBindingsReady
      || directLaunchIntent === 'prepare'
    ) return;

    const actionId = directLaunchIntent === 'review'
      ? 'review-source'
      : directLaunchIntent === 'link'
        ? 'link-source-to-uda'
        : null;
    if (!actionId) return;

    const resolutionKey = [
      launchRequest.nonce,
      directLaunchIntent,
      selectedSource.id,
      selectedSource.privacy,
      selectedSource.status,
      teachingContextFingerprint
    ].join('|');
    if (directLaunchResolutionKeyRef.current === resolutionKey) {
      return;
    }
    directLaunchResolutionKeyRef.current = resolutionKey;

    const canonicalMessage = directLaunchIntent === 'review'
      ? 'Rivedi questa fonte nel contesto didattico corrente.'
      : 'Collega questa fonte al lavoro didattico corrente.';
    const input = {
      source: selectedSource,
      teachingContext: resolvedTeachingContext,
      planningContext: resolvedPlanningContext,
      message: canonicalMessage
    };
    let cancelled = false;
    let resolutionCompleted = false;

    setIsResolving(true);
    setGuidanceMessage(null);
    setErrorMessage(null);
    setResolution(null);
    setIsReviewUnavailableOpen(false);
    setIsLinkConfirmationOpen(false);
    setLinkError(null);
    setLinkSuccess(null);

    void resolveLibraryCopilotRequest(input)
      .then(nextResolution => {
        if (cancelled) return;
        resolutionCompleted = true;
        const requestedAction = nextResolution.actions.find(action => action.id === actionId) ?? null;
        if (
          directLaunchIntent === 'review'
          && contextualReview?.status === 'unavailable'
          && !requestedAction
        ) {
          setIsReviewUnavailableOpen(true);
        }
        setResolution({
          ...nextResolution,
          actions: requestedAction ? [requestedAction] : []
        });
        if (!requestedAction && directLaunchIntent === 'link') {
          setGuidanceMessage('Questo collegamento non è disponibile nel contesto corrente.');
        }
      })
      .catch(error => {
        if (cancelled) return;
        if (directLaunchResolutionKeyRef.current === resolutionKey) {
          directLaunchResolutionKeyRef.current = null;
        }
        setErrorMessage(error instanceof Error ? error.message : 'Il Copilota non può completare questo passaggio nel contesto corrente.');
      })
      .finally(() => {
        if (!cancelled) setIsResolving(false);
      });

    return () => {
      cancelled = true;
      if (!resolutionCompleted && directLaunchResolutionKeyRef.current === resolutionKey) {
        directLaunchResolutionKeyRef.current = null;
      }
      setIsResolving(false);
    };
  }, [
    launchRequest?.nonce,
    hasCompleteDirectLaunch,
    directLaunchBindingsReady,
    directLaunchIntent,
    selectedSource?.id,
    selectedSource?.privacy,
    selectedSource?.status,
    teachingContextFingerprint,
    resolvedPlanningContext,
    contextualReview
  ]);


  useEffect(() => {
    if (!launchRequest?.mission || !missionLaunchBindingsReady) {
      setMissionLaunchSettledNonce(null);
      return;
    }
    setMissionLaunchSettledNonce(launchRequest.nonce);
  }, [
    launchRequest?.nonce,
    launchRequest?.mission,
    missionLaunchBindingsReady,
    selectedSource?.privacy,
    selectedSource?.status,
    teachingContextFingerprint
  ]);

  const contextIsProposed = contextOverride === 'auto' && (
    launchTeachingContextIsProposed
    || (!hasLaunchTeachingTarget && Boolean(teachingSuggestion))
  );
  const contextSelectValue = resolvedTeachingContext
    ? `${resolvedTeachingContext.udaId}${resolvedTeachingContext.lessonId ? `::${resolvedTeachingContext.lessonId}` : ''}`
    : '';

  const contextLabel = resolvedTeachingContext
    ? `${contextIsProposed ? 'Contesto proposto · ' : ''}${resolvedTeachingContext.className} · UDA corrente${resolvedTeachingContext.lessonId ? ' · lezione di oggi' : ''}${resolvedPlanningContext?.status === 'resolved' ? ' · programmazione' : ''}`
    : effectiveClassName
      ? `${effectiveClassName} · contesto UDA non univoco`
      : 'Dimmi cosa vuoi ottenere';

  const linkTargetLabel = useMemo(() => {
    if (!resolvedTeachingContext) return null;
    const uda = resolveTeachingUdaCandidate(resolvedTeachingContext.udaId, teachingUdaCatalog);
    if (!uda) return null;
    if (!resolvedTeachingContext.lessonId) return `UDA · ${uda.title}`;
    const lesson = uda.lessons.find(candidate => candidate.id === resolvedTeachingContext.lessonId);
    return lesson ? `Lezione · ${lesson.topic}` : null;
  }, [resolvedTeachingContext, teachingUdaCatalog]);

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
      setIsReviewUnavailableOpen(false);
      setGuidanceMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Acquisizione della fonte non riuscita.');
    } finally {
      setIsCapturing(false);
    }
  };

  const resolveObjective = async (objective: string) => {
    const normalizedObjective = objective.trim();
    if (!normalizedObjective || isResolving) return;

    const resolutionEpoch = ++resolutionEpochRef.current;
    const resolutionSnapshot = currentResolutionSnapshot;
    const requestIsCurrent = () => (
      resolutionEpoch === resolutionEpochRef.current
      && resolutionSnapshot === resolutionSnapshotRef.current
    );

    agentFallbackCodeRef.current = null;
    setIsResolving(true);
    setErrorMessage(null);
    setGuidanceMessage(null);
    setResolution(null);
    setIsReviewUnavailableOpen(false);
    setIsPrepareOpen(false);
    setIsLinkConfirmationOpen(false);
    setLinkError(null);
    setLinkSuccess(null);

    const runLocalFallback = async () => {
      if (!selectedSource) {
        setGuidanceMessage('Dimmi cosa vuoi ottenere e, quando serve, ti chiederò il materiale da usare.');
        return;
      }

      const input = {
        source: selectedSource,
        teachingContext: resolvedTeachingContext,
        planningContext: resolvedPlanningContext,
        message: normalizedObjective
      };
      const discovery = await discoverLibraryCopilotIntent(input);
      if (!requestIsCurrent()) return;

      if (discovery.reason === 'NO_INTENT_MATCH') {
        setResolution({
          status: 'UNRESOLVED',
          reason: 'NO_INTENT_MATCH',
          actions: []
        });
        return;
      }

      if (discovery.status !== 'DISCOVERED') {
        throw new Error('Non posso interpretare questa richiesta nel contesto corrente.');
      }

      const intent = discovery.intents[0] ?? null;
      if (!intent) {
        throw new Error('Non posso interpretare questa richiesta nel contesto corrente.');
      }

      if (intent.actionId === 'prepare-from-source') {
        if (!resolvedTeachingContext || !proposalUda) {
          setErrorMessage('Per preparare una proposta serve un contesto didattico univoco con una UDA corrente.');
          return;
        }
        assertBoundMissionPrepareAuthorized();
        setIsPrepareOpen(true);
        return;
      }

      if (boundLaunchMissionId) {
        setGuidanceMessage('L’incarico autorizzato consente solo la preparazione prevista. Per un’altra azione avvia una nuova richiesta esplicita.');
        return;
      }

      const nextResolution = await resolveLibraryCopilotRequest(input);
      if (!requestIsCurrent()) return;
      if (
        intent.actionId === 'review-source'
        && contextualReview?.status === 'unavailable'
        && !nextResolution.actions.some(action => action.id === 'review-source')
      ) {
        setIsReviewUnavailableOpen(true);
      }
      setResolution(nextResolution);
    };

    try {
      try {
        const agentRequest = buildAgentRoutingRequestFromProjection(normalizedObjective, copilotContextProjection);
        const envelope = await interpretCopilotIntent(agentRequest);
        if (!requestIsCurrent()) return;

        const routed = await routeAgentIntent({
          envelope,
          source: selectedSource ?? null,
          teachingContext: resolvedTeachingContext
        });
        if (!requestIsCurrent()) return;

        if (routed.kind === 'CLARIFY') {
          setGuidanceMessage(routed.question);
          return;
        }
        if (routed.kind === 'SOURCE_REQUIRED') {
          setGuidanceMessage('Per questa richiesta serve una fonte professionale: seleziona o aggiungi una fonte qui nel Copilota, poi invia di nuovo l’obiettivo.');
          return;
        }
        if (routed.kind === 'UNSUPPORTED') {
          setGuidanceMessage('Ho compreso la richiesta, ma questa capacità non è ancora disponibile nel Copilota corrente.');
          return;
        }
        if (routed.kind === 'DENIED') {
          if (envelope.intent === 'REVIEW' && contextualReview?.status === 'unavailable') {
            setIsReviewUnavailableOpen(true);
            return;
          }
          setGuidanceMessage('Ho compreso la richiesta, ma questa azione non è disponibile nel contesto corrente.');
          return;
        }
        if (routed.kind === 'PREPARE') {
          if (!resolvedTeachingContext || !proposalUda) {
            setErrorMessage('Per preparare una proposta serve un contesto didattico univoco con una UDA corrente.');
            return;
          }
          assertBoundMissionPrepareAuthorized();
          setIsPrepareOpen(true);
          return;
        }

        if (boundLaunchMissionId) {
          setGuidanceMessage('L’incarico autorizzato consente solo la preparazione prevista. Per un’altra azione avvia una nuova richiesta esplicita.');
          return;
        }

        setResolution({
          status: 'RESOLVED',
          reason: 'INTENT_RESOLVED',
          actions: [routed.action]
        });
      } catch (error) {
        if (!requestIsCurrent()) return;
        agentFallbackCodeRef.current = error instanceof AgentIntentClientError
          ? (error.routeCode ?? error.code)
          : null;
        await runLocalFallback();
      }
    } catch (error) {
      if (!requestIsCurrent()) return;
      setErrorMessage(error instanceof Error ? error.message : 'Il copilota contestuale non è disponibile in questo momento.');
    } finally {
      setIsResolving(false);
    }
  };


  const resetTeacherFirst = () => {
    setTeacherFirstResolution(null);
    setTeacherFirstClassId(null);
  };

  const frameTeacherFirstObjective = (objective: string) => {
    const framed = resolveTeacherFirstRequest(objective, knownTeacherClasses);
    setTeacherFirstResolution(framed);
    setResolution(null);
    setIsReviewUnavailableOpen(false);
    setGuidanceMessage(null);
    setIsPrepareOpen(false);
    setIsLinkConfirmationOpen(false);
    setLinkError(null);
    setLinkSuccess(null);

    if (framed.goalKind === 'unknown') {
      setTeacherFirstClassId(null);
      setContextOverride(null);
      setGuidanceMessage('Dimmi cosa vuoi ottenere: posso aiutarti a preparare un’attività, lavorare su un materiale, collegarlo a una UDA o rivederlo nel contesto didattico.');
      return;
    }

    if (framed.classCandidates.length === 1) {
      const automaticClass = teacherFirstCatalog.classes.find(entry => entry.label === framed.classCandidates[0] || entry.aliases.includes(framed.classCandidates[0]));
      if (automaticClass) {
        setTeacherFirstClassId(automaticClass.classId);
        setContextOverride(null);
        return;
      }
    }

    setTeacherFirstClassId(null);
    setContextOverride(null);
  };

  const chooseTeacherFirstGoal = (goal: TeacherFirstGoalKind, copy: string) => {
    setMessage(copy);
    setResolution(null);
    setGuidanceMessage(null);
    setIsPrepareOpen(false);

    const framed = resolveTeacherFirstRequest(copy, knownTeacherClasses);
    if (hasBoundLaunchContext && (goal === 'material' || goal === 'prepare')) {
      setTeacherFirstResolution({ ...framed, goalKind: goal });
      setTeacherFirstClassId(null);
      return;
    }
    if (hasBoundLaunchContext) {
      setTeacherFirstResolution(null);
      setTeacherFirstClassId(null);
      return;
    }

    setTeacherFirstResolution({ ...framed, goalKind: goal });
    setTeacherFirstClassId(null);
    if (goal !== 'material') setContextOverride(null);
  };

  const handleTeacherFirstProceed = async () => {
    if (!teacherFirstResolution || teacherFirstResolution.goalKind === 'unknown' || isResolving) return;
    if (!selectedSource) {
      setGuidanceMessage('Scegli un materiale della Biblioteca oppure aggiungine uno per continuare.');
      return;
    }
    if (teacherFirstResolution.goalKind !== 'material' && (!resolvedTeachingContext || !proposalUda)) {
      setGuidanceMessage('Scegli prima la classe e il lavoro didattico su cui vuoi operare.');
      return;
    }

    if (teacherFirstResolution.goalKind === 'material') {
      setGuidanceMessage('Che cosa vuoi farne? Puoi scegliere di rivederlo, collegarlo a una UDA oppure usarlo per preparare un’attività.');
      return;
    }

    const canonicalMessage = teacherFirstResolution.goalKind === 'prepare'
      ? 'Prepara una attività da questa fonte nel contesto didattico corrente.'
      : teacherFirstResolution.goalKind === 'review'
        ? 'Rivedi questa fonte nel contesto didattico corrente.'
        : 'Collega questa fonte al lavoro didattico corrente.';
    const input = {
      source: selectedSource,
      teachingContext: resolvedTeachingContext,
      planningContext: resolvedPlanningContext,
      message: canonicalMessage
    };

    setIsResolving(true);
    setGuidanceMessage(null);
    setErrorMessage(null);
    try {
      if (teacherFirstResolution.goalKind === 'prepare') {
        setIsPrepareOpen(true);
        return;
      }

      const nextResolution = await resolveLibraryCopilotRequest(input);
      if (
        teacherFirstResolution.goalKind === 'review'
        && contextualReview?.status === 'unavailable'
        && !nextResolution.actions.some(action => action.id === 'review-source')
      ) {
        setIsReviewUnavailableOpen(true);
      }
      setResolution(nextResolution);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Il Copilota non può completare questo passaggio nel contesto corrente.');
    } finally {
      setIsResolving(false);
    }
  };

  const handleResolve = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isBoundMissionFlow && !hasBoundLaunchContext && !hasResolvedConversationContext) {
      frameTeacherFirstObjective(message);
      return;
    }
    void resolveObjective(message);
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
    setLinkError('Questo collegamento non è disponibile nel contesto corrente.');
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

  if (!isOpen && !showStandaloneTrigger) return null;

  if (!isOpen) {
    return (
      <button
        type="button"
        data-testid="library-copilot-trigger"
        onClick={() => onSurfaceModeChange('compose')}
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
      ref={composerDialogRef}
      data-testid="library-copilot-composer"
      data-source-id={selectedSource?.id ?? ''}
      data-teaching-target={resolvedTeachingContext
        ? `${resolvedTeachingContext.udaId}${resolvedTeachingContext.lessonId ? `::${resolvedTeachingContext.lessonId}` : ''}`
        : ''}
      data-agent-intent-fallback-code={agentFallbackCodeRef.current ?? undefined}
      role={isMobileDialog ? 'dialog' : undefined}
      aria-modal={isMobileDialog ? true : undefined}
      aria-labelledby={isMobileDialog ? 'library-copilot-dialog-title' : undefined}
      aria-label={isMobileDialog ? undefined : 'Copilota contestuale'}
      tabIndex={isMobileDialog ? -1 : undefined}
      onKeyDown={event => {
        if (isMobileDialog) trapDialogFocus(event, composerDialogRef.current);
      }}
      className="fixed inset-0 z-[100] flex h-[100dvh] flex-col overflow-hidden rounded-none border border-slate-700 bg-slate-950/98 shadow-2xl backdrop-blur md:inset-x-auto md:inset-y-auto md:right-6 md:bottom-20 md:h-auto md:max-h-[calc(100dvh-10rem)] md:w-[430px] md:rounded-2xl"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <div id="library-copilot-dialog-title" className="flex items-center gap-2 text-sm font-bold text-slate-100">
            <MessageCircle size={18} className="text-cyan-300" aria-hidden="true" />
            Copilota
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-400">{contextLabel}</p>
        </div>
        <button
          ref={composerCloseButtonRef}
          type="button"
          onClick={() => {
            interruptBoundMission();
            const preserveGovernedContinuation =
              !isBoundMissionFlow && (isPrepareOpen || isLinkConfirmationOpen);
            preserveGovernedContinuationOnReopenRef.current = preserveGovernedContinuation;
            if (preserveGovernedContinuation && resolvedTeachingContext) {
              setContextOverride({
                udaId: resolvedTeachingContext.udaId,
                ...(resolvedTeachingContext.lessonId
                  ? { lessonId: resolvedTeachingContext.lessonId }
                  : {})
              });
            }
            setIsPrepareOpen(false);
            resetTeacherFirst();
            if (!preserveGovernedContinuation) setContextOverride('auto');
            onSurfaceModeChange('closed');
          }}
          className="min-h-[44px] min-w-[44px] rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          aria-label="Chiudi Copilota"
        >
          <X size={20} className="mx-auto" aria-hidden="true" />
        </button>
      </div>

      <div data-testid="library-copilot-scroll" className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {!hasCompleteDirectLaunch && !isBoundMissionFlow && (
          <section className="space-y-3" data-testid="teacher-first-copilot-entry">
            <div>
              <h3 className="text-sm font-bold text-slate-100">Cosa vuoi fare?</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">Partiamo dal risultato che ti serve. Ti chiederò classe, contesto e materiale solo quando servono.</p>
            </div>
            {hasBoundLaunchContext && (selectedSource || resolvedTeachingContext) && (
              <div data-testid="teacher-first-existing-bindings" className="space-y-1 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-300">
                {selectedSource && <div><span className="font-semibold text-slate-200">Materiale già disponibile:</span> {selectedSource.title}</div>}
                {resolvedTeachingContext && <div><span className="font-semibold text-slate-200">Contesto già disponibile:</span> {contextLabel}</div>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => chooseTeacherFirstGoal('prepare', 'Preparare un’attività')} className="min-h-[44px] rounded-lg border border-cyan-800 px-3 py-2 text-xs font-semibold text-cyan-100">Preparare un’attività</button>
              <button type="button" onClick={() => chooseTeacherFirstGoal('material', 'Lavorare su un materiale')} className="min-h-[44px] rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200">Lavorare su un materiale</button>
              <button type="button" onClick={() => chooseTeacherFirstGoal('link', 'Collegare un materiale a una UDA')} className="min-h-[44px] rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200">Collegare a una UDA</button>
              <button type="button" onClick={() => chooseTeacherFirstGoal('review', 'Rivedere un materiale nel contesto didattico')} className="min-h-[44px] rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200">Rivedere qualcosa</button>
            </div>
            <form onSubmit={handleResolve} className="space-y-3">
          <div>
            <label htmlFor="copilot-message" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Descrivi ciò che vuoi ottenere
            </label>
            <textarea
              id="copilot-message"
              value={message}
              onChange={event => {
                resolutionEpochRef.current += 1;
                setMessage(event.target.value);
                resetTeacherFirst();
                setResolution(null);
                setIsReviewUnavailableOpen(false);
                setGuidanceMessage(null);
                setIsPrepareOpen(false);
                setIsLinkConfirmationOpen(false);
                setLinkError(null);
                setLinkSuccess(null);
              }}
              placeholder="Per esempio: attività per le classi prime" aria-label="Che cosa vuoi farne?"
              className="min-h-24 w-full resize-y rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            aria-label="Mostra le possibilità"
            disabled={!message.trim() || isResolving}
            className="min-h-[44px] w-full rounded-xl bg-cyan-600 px-4 text-sm font-bold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="flex items-center justify-center gap-2">
              <Send size={17} aria-hidden="true" />
              {isResolving ? 'Controllo il contesto…' : 'Continua'}
            </span>
          </button>
            </form>

            {teacherFirstResolution && teacherFirstResolution.goalKind !== 'unknown' && !teacherFirstClassId && teacherFirstResolution.goalKind !== 'material' && (
              <div className="space-y-2" data-testid="teacher-first-class-choice">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Per quale classe?</div>
                <div className="flex flex-wrap gap-2">
                  {teacherFirstClassChoices.map(classChoice => (
                    <button
                      key={classChoice.classId}
                      type="button"
                      onClick={() => {
                        setTeacherFirstClassId(classChoice.classId);
                        setContextOverride(null);
                        setGuidanceMessage(classChoice.ambiguous
                          ? 'Nel Registro esiste un’altra voce che rappresenta la stessa classe. Mantengo la scelta, ma non collegherò automaticamente una UDA finché le identità non saranno riconciliate.'
                          : null);
                        setResolution(null);
                      }}
                      className="min-h-[44px] rounded-lg border border-cyan-800 px-4 py-2 text-sm font-semibold text-cyan-100"
                    >
                      {classChoice.label}
                    </button>
                  ))}
                </div>
                {knownTeacherClasses.length === 0 && (
                  <p className="text-xs text-amber-300">Non ci sono ancora classi disponibili nel Registro.</p>
                )}
              </div>
            )}

            {teacherFirstClassName && teacherFirstClassIsAmbiguous && teacherFirstGoalKind !== 'material' && (
              <p className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-3 text-xs text-amber-200">La voce {teacherFirstClassName} coincide con un’altra identità di classe nel Registro. Scegli la voce corretta, ma nessuna UDA viene collegata automaticamente finché la duplicazione non è riconciliata.</p>
            )}
            {teacherFirstClassName && !teacherFirstClassIsAmbiguous && teacherFirstClassUdas.length === 0 && teacherFirstGoalKind !== 'material' && (
              <p className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-3 text-xs text-amber-200">Per {teacherFirstClassName} non c’è ancora una UDA disponibile: scegli o crea prima il contesto didattico.</p>
            )}
          </section>
        )}
        {showTeachingContextControls && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Su quale lavoro?</div>
            <div>
          <label htmlFor="library-copilot-context" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Contesto didattico
          </label>
          <select
            id="library-copilot-context"
            data-testid="library-copilot-context-select"
            value={contextSelectValue}
            onChange={event => {
              resolutionEpochRef.current += 1;
              const value = event.target.value;
              if (!value) {
                setContextOverride(null);
              } else {
                const [udaId, lessonId] = value.split('::');
                setContextOverride({ udaId, ...(lessonId ? { lessonId } : {}) });
              }
              setResolution(null);
              setIsReviewUnavailableOpen(false);
              setGuidanceMessage(null);
              setIsPrepareOpen(false);
              setIsLinkConfirmationOpen(false);
              setLinkError(null);
              setLinkSuccess(null);
              setErrorMessage(null);
            }}
            className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
          >
            <option value="">Nessun contesto</option>
            {(isBoundMissionFlow
              ? teachingUdaCatalog.filter(uda => uda.origin === 'registro')
              : teacherFirstClassUdas
            ).map(uda => (
              <React.Fragment key={uda.id}>
                <option value={uda.id}>
                  {uda.className} · UDA · {uda.title}{uda.origin === 'docente-os' ? ' · Docente OS · sola lettura' : ''}
                </option>
                {uda.lessons.map(lesson => (
                  <option key={lesson.id} value={`${uda.id}::${lesson.id}`}>
                    {uda.className} · Lezione · {lesson.topic}
                  </option>
                ))}
              </React.Fragment>
            ))}
          </select>
          {contextIsProposed && resolvedTeachingContext && (
            <p className="mt-1.5 text-xs leading-relaxed text-amber-300/90">
              Contesto proposto: puoi cambiarlo o scegliere Nessun contesto prima di continuare.
            </p>
          )}
          {proposalUda?.origin === 'docente-os' && proposalUda.provenance && (
            <p data-testid="docente-os-uda-provenance" className="mt-1.5 text-xs leading-relaxed text-sky-200">
              Docente OS · sola lettura · riferimento {proposalUda.sourceRef} · revisione sorgente {proposalUda.provenance.sourceCommit.slice(0, 7)}
            </p>
          )}
            </div>
          </div>
        )}

        {showMaterialControls && (
          <div className="space-y-3" data-testid="teacher-first-material-step">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Da quale materiale vuoi partire?</div>
            <div>
          <label htmlFor="copilot-source" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Fonte della Biblioteca
          </label>
          <select
            id="copilot-source"
            value={selectedSourceId}
            onChange={event => {
              resolutionEpochRef.current += 1;
              setSelectedSourceId(event.target.value);
              setIsPrepareOpen(false);
              setResolution(null);
              setIsReviewUnavailableOpen(false);
              setGuidanceMessage(null);
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
          </div>
        )}
        <CopilotMissionBridge launchRequest={launchRequest} message={message} ready={missionLaunchReady} />

        {isBoundMissionFlow && (
          <div className="space-y-3">
            <form onSubmit={handleResolve} className="space-y-3">
          <div>
            <label htmlFor="copilot-message" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Descrivi ciò che vuoi ottenere
            </label>
            <textarea
              id="copilot-message"
              value={message}
              onChange={event => {
                resolutionEpochRef.current += 1;
                setMessage(event.target.value);
                resetTeacherFirst();
                setResolution(null);
                setIsReviewUnavailableOpen(false);
                setGuidanceMessage(null);
                setIsPrepareOpen(false);
                setIsLinkConfirmationOpen(false);
                setLinkError(null);
                setLinkSuccess(null);
              }}
              placeholder="Per esempio: attività per le classi prime" aria-label="Che cosa vuoi farne?"
              className="min-h-24 w-full resize-y rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            aria-label="Mostra le possibilità"
            disabled={!message.trim() || isResolving}
            className="min-h-[44px] w-full rounded-xl bg-cyan-600 px-4 text-sm font-bold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="flex items-center justify-center gap-2">
              <Send size={17} aria-hidden="true" />
              {isResolving ? 'Controllo il contesto…' : 'Continua'}
            </span>
          </button>
            </form>
          </div>
        )}




        {!isBoundMissionFlow && teacherFirstResolution && teacherFirstResolution.goalKind !== 'unknown' && selectedSource && (teacherFirstGoalKind === 'material' || resolvedTeachingContext) && (
          <section data-testid="teacher-first-preview" className="space-y-3 rounded-xl border border-cyan-900/60 bg-slate-900/60 p-3">
            <div className="text-xs font-bold uppercase tracking-wide text-cyan-300">Prima di continuare</div>
            <div className="text-sm text-slate-100"><span className="font-semibold">Obiettivo:</span> {message.trim()}</div>
            {teacherFirstClassName && <div className="text-xs text-slate-300"><span className="font-semibold">Classe:</span> {teacherFirstClassName}</div>}
            {resolvedTeachingContext && <div className="text-xs text-slate-300"><span className="font-semibold">Contesto:</span> {contextLabel}</div>}
            <div className="text-xs text-slate-300"><span className="font-semibold">Materiale:</span> {selectedSource.title}</div>
            <p className="text-[11px] leading-relaxed text-slate-500">Nessuna modifica professionale viene registrata da questo passaggio. Le conferme e il consenso previsti dal flusso governato restano separati.</p>
            <button type="button" onClick={() => void handleTeacherFirstProceed()} disabled={isResolving} className="min-h-[44px] w-full rounded-lg bg-cyan-500 px-3 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">▶ Continua</button>
          </section>
        )}

        {showMaterialControls && (
        <ProfessionalMemoryPanel
          state={professionalMemory}
          relevantMemory={professionalMemoryWorkingSet}
          rememberCandidate={rememberCandidate}
          errorMessage={memoryError}
          onRemember={onRemember}
          onCorrectEntry={onCorrectMemoryEntry}
          onRemoveEntry={onRemoveMemoryEntry}
          onSetCategory={onSetMemoryCategory}
          onRemoveCategory={onRemoveMemoryCategory}
        />
        )}

        {errorMessage && (
          <p role="alert" className="rounded-xl border border-rose-900/60 bg-rose-950/40 p-3 text-sm text-rose-200">
            {errorMessage}
          </p>
        )}

        {guidanceMessage && (
          <p data-testid="library-copilot-agent-guidance" role="status" className="rounded-xl border border-cyan-900/50 bg-cyan-950/20 p-3 text-sm leading-relaxed text-cyan-100">
            {guidanceMessage}
          </p>
        )}

        {isReviewUnavailableOpen && selectedSource && contextualReview?.status === 'unavailable' && (
          <section
            data-testid="library-copilot-review-panel"
            className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/60 p-3"
          >
            <div className="text-sm font-semibold text-slate-100">Revisione nel contesto</div>
            <p className="text-sm leading-relaxed text-slate-200">
              {reviewUnavailableCopy(contextualReview.reason)}
            </p>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Affidabilità e limiti</div>
              <ul className="mt-1 space-y-1 text-xs leading-relaxed text-slate-400">
                {contextualReview.limitations.map(item => <li key={item}>• {item}</li>)}
              </ul>
            </div>
          </section>
        )}

        {resolution && (
          <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Possibilità autorizzate</div>
            {resolution.reason === 'NO_INTENT_MATCH' && (
              <p className="text-xs leading-relaxed text-slate-400">
                Dimmi cosa vuoi ottenere: per esempio preparare un’attività, rivedere un materiale o collegarlo a una UDA.
              </p>
            )}
            {resolution.reason === 'INTENT_PORT_UNAVAILABLE' && (
              <p className="text-xs leading-relaxed text-slate-400">
                In questo momento posso proporti solo i passaggi già disponibili per il materiale e il contesto scelti.
              </p>
            )}
            {resolution.actions.some(action => action.id === 'review-source') && selectedSource && contextualReview && (
              <section
                data-testid="library-copilot-review-panel"
                className="space-y-4 rounded-lg border border-slate-700 bg-slate-950/70 p-3"
              >
                <div className="text-sm font-semibold text-slate-100">Revisione nel contesto</div>
                {contextualReview.status === 'unavailable' ? (
                  <>
                    <p className="text-sm leading-relaxed text-slate-200">
                      {reviewUnavailableCopy(contextualReview.reason)}
                    </p>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Affidabilità e limiti</div>
                      <ul className="mt-1 space-y-1 text-xs leading-relaxed text-slate-400">
                        {contextualReview.limitations.map(item => <li key={item}>• {item}</li>)}
                      </ul>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Quanto è pertinente</div>
                      <div className="mt-1 text-sm font-semibold text-cyan-100">
                        {reviewRelevanceLabel(contextualReview.review.relevance.level)}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-300">
                        {contextualReview.review.relevance.statement}
                      </p>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Perché</div>
                      <ul className="mt-1 space-y-1 text-xs leading-relaxed text-slate-300">
                        {contextualReview.review.rationale.map(item => <li key={item}>• {item}</li>)}
                      </ul>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Allineamento alla programmazione</div>
                      <div className="mt-1 text-sm font-semibold text-slate-200">
                        {reviewAlignmentLabel(contextualReview.review.alignment.status)}
                      </div>
                      {contextualReview.review.alignment.planningMatches.length > 0 ? (
                        <ul className="mt-1 space-y-2 text-xs leading-relaxed text-slate-300">
                          {contextualReview.review.alignment.planningMatches.map(match => (
                            <li key={match.itemId} className="rounded-md border border-slate-800 bg-slate-900/70 p-2">
                              <div className="font-semibold text-slate-200">{match.sourceSection}</div>
                              <div className="mt-0.5 text-slate-400">
                                Termini condivisi: {match.matchedTerms.join(', ')}
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-xs leading-relaxed text-slate-400">
                          Nessuna corrispondenza curricolare specifica è dimostrata dai dati disponibili.
                        </p>
                      )}
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cosa manca o va verificato</div>
                      {contextualReview.review.gaps.length > 0 ? (
                        <ul className="mt-1 space-y-1 text-xs leading-relaxed text-slate-300">
                          {contextualReview.review.gaps.map(item => <li key={item}>• {item}</li>)}
                        </ul>
                      ) : (
                        <p className="mt-1 text-xs leading-relaxed text-slate-400">
                          Nessuna lacuna specifica è emersa dalle evidenze locali disponibili.
                        </p>
                      )}
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Possibili riusi</div>
                      {contextualReview.review.reuseSuggestions.length > 0 ? (
                        <ul className="mt-1 space-y-2 text-xs leading-relaxed text-slate-300">
                          {contextualReview.review.reuseSuggestions.map(suggestion => (
                            <li key={`${suggestion.targetType}:${suggestion.targetId}`} className="rounded-md border border-slate-800 bg-slate-900/70 p-2">
                              <div className="font-semibold text-slate-200">{suggestion.title}</div>
                              <div className="text-slate-400">{suggestion.subtitle}</div>
                              {suggestion.reasons.length > 0 && (
                                <div className="mt-1 text-slate-400">{suggestion.reasons.join(' · ')}</div>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-xs leading-relaxed text-slate-400">
                          Nessun riuso aggiuntivo è suggerito dalle evidenze locali disponibili.
                        </p>
                      )}
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Affidabilità e limiti</div>
                      <div className="mt-1 text-sm font-semibold text-slate-200">
                        {reviewConfidenceLabel(contextualReview.review.confidence.level)}
                      </div>
                      <ul className="mt-1 space-y-1 text-xs leading-relaxed text-slate-300">
                        {contextualReview.review.confidence.reasons.map(item => <li key={`confidence:${item}`}>• {item}</li>)}
                        {contextualReview.review.limitations.map(item => <li key={`limit:${item}`}>• {item}</li>)}
                      </ul>
                    </div>
                  </>
                )}
              </section>
            )}
            {resolution.actions.filter(action => action.id !== 'review-source').slice(0, 4).map(action => (
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
              Il collegamento resta l’unica azione eseguita direttamente dal Copilota. La preparazione assistita usa il flusso governato esistente e richiede un consenso separato prima di inviare la fonte a un servizio remoto.
            </p>
          </div>
        )}

        {(isPrepareOpen || readyMissionReview) && selectedSource && resolvedTeachingContext && proposalUda && (
          <div
            data-testid="library-copilot-prepare-disclosure"
            className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-slate-100">
                  {readyMissionReview ? 'Risultato dell’incarico' : 'Preparazione assistita'}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  {readyMissionReview
                    ? 'Risultato già preparato e salvato: puoi controllarlo, modificarlo o adottarlo senza avviare una nuova generazione.'
                    : 'La preparazione compare solo dopo una richiesta esplicita. L’invio remoto resta bloccato fino al consenso previsto dal flusso governato.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  interruptBoundMission();
                  setIsPrepareOpen(false);
                  setReadyMissionReview(null);
                }}
                className="min-h-[44px] rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-300 hover:border-slate-500"
              >
                Chiudi
              </button>
            </div>
            <LibraryProposalPanel
              source={selectedSource}
              uda={proposalUda}
              writableByRegistro={proposalUda.writableByRegistro}
              teachingContext={resolvedTeachingContext}
              professionalMemory={remoteProfessionalMemory}
              aiBudgetProfile={aiBudgetProfile}
              isPending={isPending}
              onUpdate={onUpdateSource}
              onAddSource={onAddSource}
              onAdoptProposalToUda={onAdoptProposalToUda}
              initialResult={readyMissionReview?.result ?? null}
              missionId={readyMissionReview?.missionId ?? boundLaunchMissionId}
              generationMissionId={boundLaunchMissionId}
              {...(boundLaunchMissionId && generationContextFingerprint ? { generationContextFingerprint } : {})}
              onMissionProposalReady={onMissionProposalReady}
              onMissionOutcome={onMissionOutcome}
            />
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