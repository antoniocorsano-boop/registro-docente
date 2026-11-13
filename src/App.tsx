import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ActiveTab,
  AppData,
  AppSettings,
  BehaviorRecord,
  ClassData,
  EvaluationType,
  Grade,
  OnlineSubmission,
  OnlineTest,
  Student,
  UdaRecord
} from './types';
import type { ArenaPlanningContextPreview, PlanningState, TeachingProfile } from './planning/types';
import type { PlanningDraftGuard } from './components/planning/PlanningProfileEditor';
import { bindAcceptedArenaPlanningContext } from './planning/arenaPlanningContext';
import { validateTeachingProfile } from './planning/validation';
import { createEmptyPlanningState } from './planning/emptyPlanningState';
import { previewDocenteOsTeachingProjection } from './planning/docenteOsTeachingProjection';
import {
  bindAcceptedDocenteOsTeachingProjection,
  findAcceptedDocenteOsTeachingProjectionForSlot,
  reconcileDocenteOsTeachingProjectionClasses
} from './planning/docenteOsProjectionReconciliation';
import type { LibrarySource, LibrarySourceLink, LibraryStateV1 } from './library/types';
import { createEmptyLibraryState } from './library/emptyLibraryState';
import { resolveAssessmentHandoff, type AssessmentHandoffRequest } from './library/assessmentHandoff';
import {
  prepareAssessmentEditorTransfer,
  checkAssessmentEditorTransferContext,
  canAcceptAssessmentEditorTransfer,
  type AssessmentEditorTransferV1
} from './library/assessmentEditorTransfer';
import type { AssessmentGenerationSessionV1 } from './library/assessmentGeneration';
import type { AssessmentDraftV1 } from './library/assessmentDraft';

import { prepareAssessmentTestForCommit, projectAssessmentsForStudent, resolveSavedAssessmentOrigin } from './library/assessmentProvenance';
import { isAssessmentUdaSelectionAllowed } from './library/assessmentUdaScope';
import { resolvePlanningContextForLibraryRelevance } from './library/relevancePresentation';
import { resolveLibraryTeachingContext } from './library/teachingContext';
import {
  addLibrarySource,
  linkLibrarySource,
  removeLibrarySource,
  unlinkLibrarySource,
  updateLibrarySource,
  type LibrarySourcePatch
} from './library/libraryState';
import { createEmptyProfessionalMemoryState } from './memory/emptyProfessionalMemoryState';
import type { ProfessionalMemoryCategory, ProfessionalMemoryStateV1 } from './memory/types';
import {
  correctProfessionalMemoryEntry,
  rememberProfessionalItem,
  removeProfessionalMemoryCategory,
  removeProfessionalMemoryEntry,
  setAutoRememberCategory,
  type RecordProfessionalMemoryEventInput,
  type RememberProfessionalItemInput
} from './memory/professionalMemory';
import { createEmptyCopilotState } from './copilot/emptyCopilotState';
import { buildCopilotContextProjection } from './copilot/contextProjection';
import { resolveProfessionalContext, toCopilotContextProjection } from './context/professionalContext';
import { resolvePlanningFrame } from './planning/planningFrameResolver';
import { resolveCurricularSubjectCode } from './planning/curricularSubjectCode';
import { keepTeachingFocusForClass, resolveTeachingFocusForClass, transitionTeachingFocusForTab } from './context/teachingFocus';
import type { LibraryTeachingContext } from './library/teachingContext';
import { buildTeachingUdaCatalog, buildTeachingUdaClassReconciliationIndex } from './teaching/teachingUdaCatalog';
import { resolveTodayRoute, type TodayAction } from './today/todayRouter';
import { buildPreparationCopilotLaunchContext } from './preparation/preparationRouter';
import { createStudentReportHistoryState, restoreStudentReportFromHistory } from './navigation/studentReportHistory';
import { isMobileMatrixDisclosureState } from './navigation/mobileMatrixDisclosureHistory';
import { resolveStudentReportReturnContext, type StudentReportReturnContext } from './navigation/studentReportReturnContext';
import { resolveConductContext } from './conduct/conductSession';
import {
  buildRecordSession,
  markRecordSessionSaved,
  routeForRecordEvidence,
  setRecordEvidenceKind,
  updateRecordStagedNote,
  type RecordEvidenceKind,
  type RecordSessionDraft
} from './recording/recordSession';
import {
  buildReviewSession,
  enterReviewSurface,
  isReviewSurface,
  keepReviewSessionForClass,
  returnToReviewRouter,
  transitionReviewSessionForTab,
  type ReviewSessionContext
} from './review/reviewSession';
import {
  authorizeCopilotMission,
  authorizeCopilotMissionResume,
  buildMissionContextFingerprint,
  canAcceptMissionProposalResult,
  resolveMissionResume,
  suspendCopilotMission,
  type CopilotMissionExecutionGrantV1,
  type CopilotMissionPreviewV1,
  type CopilotMissionV1,
  type MissionResumeDecision
} from './copilot/mission';
import type { MissionProposalReadyNotification } from './services/libraryProposalService';
import type { CopilotPreferenceSignalKind } from './copilot/preferenceLearning';
import { bindMissionRuntime, clearMissionRuntime } from './components/CopilotMissionBridge';
import type { CopilotStateV1 } from './copilot/state';
import {
  type CopilotOpportunityV1
} from './copilot/opportunityResolver';
import {
  appendCopilotMission,
  deferCopilotOpportunity,
  dismissCopilotOpportunity,
  recordCopilotMissionOutcome,
  recordCopilotOutcomeSignal,
  resetCopilotStatePreferences,
  updateCopilotMission
} from './persistence/copilotStateMutation';
import {
  calcAvg,
  CUSTOM_TESTS_KEY,
  DEFAULT_SETTINGS,
  INITIAL_CLASSES,
  INITIAL_TESTS,
  INITIAL_UDAS,
  META_KEY,
  sanitizeName,
  SETTINGS_KEY,
  sortStudents,
  STORAGE_KEY,
  SUBMISSIONS_KEY,
  today,
  UDA_KEY,
  uid
} from './utils';
import type {
  CompleteSecureAppSnapshot,
  SecureAppSnapshot,
  SecureAppStorage,
  SecureMeta
} from './security/secureAppStorage';
import { normalizeBackupPayloadVerified } from './security/backupPayload';
import { appendCouncilSession, assignCouncilValues, wouldLoseCouncilEntries } from './council/councilModel';
import {
  appendConfirmedCouncilSnapshot,
  createCaptureClock,
  prepareCouncilSnapshot,
  type CouncilSnapshotContextV1,
  type CouncilSnapshotPreviewV1
} from './council/councilEvidenceSnapshots';
import { createDurableMutationCoordinator } from './persistence/durableMutationCoordinator';
import { createUdaSnapshotMutation } from './persistence/udaSnapshotMutation';
import { applyPlanningMutation } from './persistence/planningMutation';
import { persistLibraryMutation } from './persistence/libraryMutation';
import {
  persistDerivedProfessionalMemoryAfterCanonicalCommit
} from './persistence/professionalMemoryOutcome';
import {
  deriveTeachingProposalOutcomeCandidate,
  type TeachingProposalOutcomeCandidate,
  type TeachingProposalOutcomeMutationInput
} from './persistence/teachingProposalOutcomeMutation';
import {
  applyBackupReceipt,
  incrementBackupChanges,
  prepareBackupCheckpoint,
  type PreparedBackupCheckpoint
} from './persistence/backupCheckpoint';
import { shouldSuggestBackupReminder } from './persistence/backupReminderPolicy';
import { applySettingsPatch } from './persistence/settingsMutation';
import { reconcileSubmissionGrades, type SubmissionImportSelection, type SubmissionImportPreview } from './persistence/submissionGradeImport';
import type { LocalSemanticMemoryPort } from '../vendor/contextual-copilot-semantic-memory/index';
import {
  createSemanticMemoryHttpClient,
  SemanticMemoryHttpError
} from './semanticMemory/httpClient';
import {
  activateSemanticMemorySession,
  SemanticMemorySessionBootstrapError
} from './semanticMemory/sessionBootstrap';
import { buildRegistroSemanticMemorySnapshot } from './semanticMemory/projections';
import { syncRegistroSemanticMemory } from './semanticMemory/sync';

import {
  SPECIALIST_TARGET_HISTORY_KEY,
  recallSpecialistTarget,
  forgetSpecialistTarget,
  rememberSpecialistTarget,
  type SpecialistTargetMemory
} from './navigation/specialistTargetMemory';
import { Navbar, type Header01SecurityBindings } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { DashboardView } from './components/DashboardView';
import { RecordMissionBanner } from './components/RecordMissionBanner';
import { ReviewMissionBanner } from './components/ReviewMissionBanner';
import { EvaluationsView } from './components/EvaluationsView';
import { MatrixEvaluationEntry, type EvaluationDraftGuard } from './components/MatrixEvaluationEntry';
import { DailyMatrixWorkspace } from './components/DailyMatrixWorkspace';
import { applyDailyGrade, applyDailyObservation, type DailyGradeWrite, type DailyObservationWrite } from './persistence/dailyMatrixWorkspace';
import { applyMatrixCell, type MatrixCellWrite } from './persistence/matrixCellMutation';
import { BehaviorsView, type BehaviorDraftGuard } from './components/BehaviorsView';
import { applyObservationChanges } from './behavior/observationChanges';
import { AnalyticsView } from './components/AnalyticsView';
import { MatrixView } from './components/MatrixView';
import { CouncilView } from './components/CouncilView';
import type { CouncilSessionKind } from './types';
import { HistoryView } from './components/HistoryView';
import { StudentReportView } from './components/StudentReportView';
import { StudentsManagementView } from './components/StudentsManagementView';
import { VerificheOnlineView, type AssessmentDraftGuard } from './components/VerificheOnlineView';
import { UdaGanttView } from './components/UdaGanttView';
import { SettingsView } from './components/SettingsView';
import { CopilotProactivitySettings } from './components/CopilotProactivitySettings';
import { BackupReminderModal } from './components/BackupReminderModal';
import { StudentPortal } from './components/StudentPortal';
import { PrivacyView } from './components/PrivacyView';
import { PlanningProfileView } from './components/planning/PlanningProfileView';
import { LibraryView } from './components/LibraryView';
import { LibraryCopilotComposer } from './components/LibraryCopilotComposer';
import { CopilotExperience } from './components/CopilotExperience';
import {
  SemanticMemorySettings,
  type SemanticMemoryConnectInput,
  type SemanticMemorySessionView
} from './components/SemanticMemorySettings';
import type {
  CopilotLaunchContext,
  CopilotMissionLaunchV1,
  LibraryCopilotLaunchRequest
} from './library/copilotLaunchContext';

interface PendingCopilotAssessmentTransfer {
  nonce: string;
  session: AssessmentGenerationSessionV1;
  draft: AssessmentDraftV1;
  transfer: AssessmentEditorTransferV1;
}

const DURABLE_SAVE_FAILURE_MESSAGE = 'Salvataggio non riuscito. La modifica non è stata applicata.';

export type CopilotSurfaceMode = 'closed' | 'home' | 'compose';

export interface AppProps {
  initialSnapshot: SecureAppSnapshot;
  secureStorage: SecureAppStorage;
  onFactoryReset: () => Promise<void>;
  onCopilotSurfaceOpenChange?: (isOpen: boolean) => void;
  headerSecurity?: Header01SecurityBindings;
}

export default function App({ initialSnapshot, secureStorage, onFactoryReset, onCopilotSurfaceOpenChange, headerSecurity }: AppProps) {
  // Explicitly initialized archives are authoritative, including empty collections.
  const explicitArchive = initialSnapshot.settings?.archiveMode === 'professional'
    || initialSnapshot.settings?.archiveMode === 'demo';
  // 1. Settings & Theme
  const [settings, setSettings] = useState<AppSettings>(() => {
    const persisted = initialSnapshot.settings;
    return persisted
      ? {
          ...DEFAULT_SETTINGS,
          ...persisted,
          embeddingConfig: persisted.embeddingConfig || DEFAULT_SETTINGS.embeddingConfig
        }
      : DEFAULT_SETTINGS;
  });

  // Apply theme to document.body
  useEffect(() => {
    document.body.className = '';
    if (settings.theme && settings.theme !== 'cyan') {
      document.body.classList.add(`theme-${settings.theme}`);
    }
  }, [settings.theme]);

  // 2. Main App Data (Classes, Students, Grades, Behaviors)
  const [appData, setAppData] = useState<AppData>(() => {
    const persisted = initialSnapshot.appData;
    if (persisted && Array.isArray(persisted.classes)) {
      return {
        classes: persisted.classes.map((c: any) => ({
          ...c,
          students: sortStudents(c.students || []),
          grades: c.grades || [],
          behaviors: c.behaviors || []
        })),
        // Navigation context is session-only: never reactivate a persisted class on entry.
        currentClassId: null
      };
    }
    return {
      classes: (explicitArchive ? [] : INITIAL_CLASSES).map(c => ({
        ...c,
        students: sortStudents(c.students),
        grades: c.grades,
        behaviors: c.behaviors
      })),
      currentClassId: null
    };
  });

  // 3. Online Tests & Flashcards
  const [tests, setTests] = useState<Record<string, OnlineTest>>(() =>
    explicitArchive
      ? initialSnapshot.customTests ?? {}
      : initialSnapshot.customTests
        ? { ...INITIAL_TESTS, ...initialSnapshot.customTests }
        : INITIAL_TESTS
  );

  // 4. Online Submissions
  const [submissions, setSubmissions] = useState<OnlineSubmission[]>(() =>
    initialSnapshot.submissions || []
  );

  // 5. UDA Records
  const [udas, setUdas] = useState<UdaRecord[]>(() =>
    initialSnapshot.udas ?? (explicitArchive ? [] : INITIAL_UDAS)
  );

  // 5b. Annual planning domain (separate from legacy UDA/Gantt until migration is qualified)
  const [planning, setPlanning] = useState<PlanningState>(() =>
    initialSnapshot.planning || createEmptyPlanningState()
  );

  // 5c. Private teacher library (local-first, no provider side effects)
  const [library, setLibrary] = useState<LibraryStateV1>(() =>
    initialSnapshot.library || createEmptyLibraryState()
  );

  // 5d. Professional memory is derived, local-first state and never canonical domain authority.
  const [professionalMemory, setProfessionalMemory] = useState<ProfessionalMemoryStateV1>(() =>
    initialSnapshot.professionalMemory || createEmptyProfessionalMemoryState()
  );

  // 5e. Supervised Copilot state is durable, while execution grants remain session-only outside this state.
  const [copilotState, setCopilotState] = useState<CopilotStateV1>(() =>
    initialSnapshot.copilotState ?? createEmptyCopilotState()
  );

  // 5f. Local semantic memory connection is explicitly session-only and never enters AppSettings or the vault.
  const [semanticMemorySession, setSemanticMemorySession] = useState<SemanticMemorySessionView>({
    status: 'disconnected',
    endpoint: null,
    health: null,
    expiresAt: null,
    sync: null
  });
  const [isSemanticMemorySyncing, setIsSemanticMemorySyncing] = useState(false);

  // INT-01: catalog is a derived read model; UDA authority remains with its source.
  const teachingUdaCatalog = React.useMemo(() => buildTeachingUdaCatalog({
    localUdas: udas,
    acceptedProjections: planning.docenteOsProjections,
    classReconciliation: buildTeachingUdaClassReconciliationIndex(planning.docenteOsProjections),
    classes: appData.classes
  }), [udas, planning.docenteOsProjections, appData.classes]);

  // 6. Navigation and UI state
  const [activeTab, setActiveTabState] = useState<ActiveTab>('home');
  const activeTabRef = useRef<ActiveTab>('home');
  // Popstate may outlive a render. Always validate restored UDA focus against the
  // *live* catalog, including UDA created or projected after initial unlock.
  const teachingUdaCatalogRef = useRef(teachingUdaCatalog);
  teachingUdaCatalogRef.current = teachingUdaCatalog;
  // Opt-in, preview-only. No class IDs, URLs, form values, credentials or vault data.
  const [hprTraceEnabled] = useState(() =>
    import.meta.env.VITE_INT01_HPR_TRACE === '1' && typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).get('int01Trace') === '1'
  );
  const [hprTrace, setHprTrace] = useState<string[]>([]);
  const traceHpr = useCallback((event: string, destination: ActiveTab | null = null) => {
    if (!hprTraceEnabled) return;
    setHprTrace(prev => [
      ...prev.slice(-13),
      `${event} | attuale: ${activeTabRef.current} | destinazione: ${destination ?? 'nessuna'}`
    ]);
  }, [hprTraceEnabled]);
  // A reload or browser restoration must be distinguishable from an SPA tab switch.
  // The event list remains memory-only; no data or identifiers are persisted.
  const [hprLoadKind] = useState(() => {
    if (!hprTraceEnabled) return 'disabled';
    const navigation = window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    return navigation?.type ?? 'unknown';
  });
  const withHprTraceQuery = useCallback((target: string): string => {
    if (!hprTraceEnabled) return target;
    const resolved = new URL(target, window.location.href);
    if (resolved.origin !== window.location.origin) return target;
    resolved.searchParams.set('int01Trace', '1');
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  }, [hprTraceEnabled]);
  useEffect(() => {
    if (!hprTraceEnabled) return;
    traceHpr(`avvio-app:${hprLoadKind}`);
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) traceHpr('ripristino-cache-browser');
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [hprTraceEnabled, hprLoadKind, traceHpr]);
  const planningGuardRef = useRef<PlanningDraftGuard | null>(null);
  const councilGuardRef = useRef<PlanningDraftGuard | null>(null);
  const registerCouncilDraftGuard = useCallback((guard: PlanningDraftGuard | null) => {
    councilGuardRef.current = guard;
  }, []);
  const behaviorDraftGuardRef = useRef<BehaviorDraftGuard | null>(null);
  const [behaviorSavePending, setBehaviorSavePending] = useState(false);
  const behaviorSavePendingRef = useRef(false);
  const registerBehaviorDraftGuard = useCallback((guard: BehaviorDraftGuard | null) => {
    behaviorDraftGuardRef.current = guard;
  }, []);
  const evaluationDraftGuardRef=useRef<EvaluationDraftGuard|null>(null);
  const [dailyMatrixMode,setDailyMatrixMode]=useState(false);
  const dailyMatrixModeRef=useRef(false);
  const acceptDailyMatrixMode=(value:boolean)=>{dailyMatrixModeRef.current=value;setDailyMatrixMode(value);};
  const evaluationSavePendingRef=useRef(false);
  const [evaluationSavePending,setEvaluationSavePending]=useState(false);
  const registerEvaluationDraftGuard=useCallback((guard:EvaluationDraftGuard|null)=>{evaluationDraftGuardRef.current=guard;},[]);
  const assessmentDraftGuardRef = useRef<AssessmentDraftGuard | null>(null);
  const registerAssessmentDraftGuard = useCallback((guard: AssessmentDraftGuard | null) => {
    assessmentDraftGuardRef.current = guard;
  }, []);
  const hasUnsavedActiveDraft = useCallback((): boolean =>
    (activeTabRef.current === 'programmazione'
      && Boolean(planningGuardRef.current?.hasUnsavedChanges()))
    || (activeTabRef.current === 'verifiche-online'
      && (Boolean(assessmentDraftGuardRef.current?.hasUnsavedChanges())
        || Boolean(assessmentDraftGuardRef.current?.isSaving())))
    || (activeTabRef.current === 'consigli'
      && Boolean(councilGuardRef.current?.hasUnsavedChanges()))
    || (activeTabRef.current === 'comportamenti'
      && (behaviorSavePendingRef.current || Boolean(behaviorDraftGuardRef.current?.hasUnsavedChanges())))
    || ((activeTabRef.current === 'voti' || (activeTabRef.current==='tabellone'&&dailyMatrixModeRef.current)) && (evaluationSavePendingRef.current || Boolean(evaluationDraftGuardRef.current?.hasUnsavedChanges()))), []);
  const planningExitBypassRef = useRef(false);
  const historyPositionRef = useRef<number | null>(null);
  // Positions have meaning only inside the same, continuous app-owned epoch.
  const historyEpochRef = useRef<string | null>(null);
  const historyEntryIdRef = useRef<string | null>(null);
  const historyFallbackRef = useRef<{
    originUrl: string;
    classId: string | null;
  } | null>(null);
  const browserHistoryIndexRef = useRef<number | null>(null);
  const historyUrlRef = useRef('');
  const historyRestorePendingRef = useRef<{
    delta: number;
    originPosition: number | null;
    originEntryId: string;
    originBrowserIndex: number | null;
    originUrl: string;
    destinationTab: ActiveTab;
  } | null>(null);
  const readBrowserHistoryIndex = (): number | null => {
    const index = (window as Window & {
      navigation?: { currentEntry?: { index?: number } };
    }).navigation?.currentEntry?.index;
    return typeof index === 'number' && Number.isSafeInteger(index) ? index : null;
  };
  const historyApprovedTraversalRef = useRef<number | null>(null);
  const markHistoryPush = useCallback(() => {
    const state = history.state && typeof history.state === 'object' ? history.state : {};
    // Never manufacture position 1 after entering an unmarked legacy entry.
    const nextPosition = historyPositionRef.current !== null && historyEpochRef.current !== null
      ? historyPositionRef.current + 1 : null;
    const entryId = crypto.randomUUID();
    const nextState: Record<string, unknown> = { ...state, __tramaHistoryEntryId: entryId };
    if (nextPosition !== null) {
      nextState.__tramaHistoryPosition = nextPosition;
      nextState.__tramaHistoryEpoch = historyEpochRef.current;
    } else {
      delete nextState.__tramaHistoryPosition;
      delete nextState.__tramaHistoryEpoch;
    }
    history.replaceState(nextState, '', window.location.href);
    historyPositionRef.current = nextPosition;
    historyEntryIdRef.current = entryId;
    historyUrlRef.current = window.location.href;
    browserHistoryIndexRef.current = readBrowserHistoryIndex();
  }, []);

  useEffect(() => {
    const state = history.state && typeof history.state === 'object' ? history.state : {};
    const recordedPosition = Number.isSafeInteger(state.__tramaHistoryPosition)
      ? state.__tramaHistoryPosition as number : 0;
    // Bootstrap can adopt an old number, but not pretend its old neighbours
    // share the same coordinate system after reload or vault unlock.
    const epoch = typeof state.__tramaHistoryEpoch === 'string'
      && state.__tramaHistoryEpoch.length > 0
      ? state.__tramaHistoryEpoch : crypto.randomUUID();
    const entryId = typeof state.__tramaHistoryEntryId === 'string'
      && state.__tramaHistoryEntryId.length > 0
      ? state.__tramaHistoryEntryId : crypto.randomUUID();
    historyPositionRef.current = recordedPosition;
    historyEpochRef.current = epoch;
    historyEntryIdRef.current = entryId;
    historyUrlRef.current = window.location.href;
    browserHistoryIndexRef.current = readBrowserHistoryIndex();
    if (!Number.isSafeInteger(state.__tramaHistoryPosition)
      || state.__tramaHistoryEpoch !== epoch || state.__tramaHistoryEntryId !== entryId) {
      history.replaceState({
        ...state,
        __tramaHistoryPosition: recordedPosition,
        __tramaHistoryEpoch: epoch,
        __tramaHistoryEntryId: entryId
      }, '', window.location.href);
    }
  }, []);
  const pendingExitRef = useRef<(() => void) | null>(null);
  const planningExitDialogRef = useRef<HTMLDivElement | null>(null);
  const planningExitOriginFocusRef = useRef<HTMLElement | null>(null);
  const planningExitRestoreFocusRef = useRef(false);
  const [planningExitOpen, setPlanningExitOpen] = useState(false);
  const [planningExitSaving, setPlanningExitSaving] = useState(false);
  const [planningExitError, setPlanningExitError] = useState('');
  const [planningExitDestination, setPlanningExitDestination] = useState<ActiveTab | null>(null);
  const [planningExitFromBrowser, setPlanningExitFromBrowser] = useState(false);
  const [historyFallbackWarning, setHistoryFallbackWarning] = useState(false);
  // UI feedback only; the ref is the synchronous safety gate during async history restoration.
  const [historyRestoringOrigin, setHistoryRestoringOrigin] = useState(false);
  const registerPlanningDraftGuard = useCallback((guard: PlanningDraftGuard | null) => {
    planningGuardRef.current = guard;
  }, []);
  const requestPlanningDeparture = useCallback((
    commit: () => void, destination: ActiveTab | null = null
  ): boolean => {
    traceHpr('richiesta-navigazione', destination);
    if (!planningExitBypassRef.current && hasUnsavedActiveDraft()) {
      if (pendingExitRef.current) return false; // Never replace an unconfirmed navigation.
      planningExitOriginFocusRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement : null;
      pendingExitRef.current = commit;
      setPlanningExitDestination(destination);
      setPlanningExitFromBrowser(false);
      traceHpr('conferma-aperta', destination);
      setPlanningExitError('');
      setPlanningExitOpen(true);
      return false;
    }
    commit();
    return true;
  }, [hasUnsavedActiveDraft, traceHpr]);
  const cancelPlanningExit = () => {
    if (planningExitSaving || historyRestorePendingRef.current !== null) return;
    const fallback = historyFallbackRef.current;
    if (fallback) {
      // A browser without a verifiable entry index cannot traverse back to an
      // unknown origin safely. Explicitly re-enter the original URL instead;
      // this replaces the forward branch, disclosed in the recovery dialog.
      try {
        const entryId = crypto.randomUUID();
        history.pushState({
          classId: fallback.classId,
          tab: activeTabRef.current,
          __tramaHistoryEntryId: entryId
        }, '', withHprTraceQuery(fallback.originUrl));
        historyPositionRef.current = null;
        historyEpochRef.current = null;
        historyEntryIdRef.current = entryId;
        browserHistoryIndexRef.current = readBrowserHistoryIndex();
        historyUrlRef.current = window.location.href;
      } catch {
        setPlanningExitError('Non è stato possibile ritornare alla Programmazione. Salva o continua senza salvare.');
        return;
      }
    }
    historyFallbackRef.current = null;
    setHistoryFallbackWarning(false);
    planningExitRestoreFocusRef.current = true;
    pendingExitRef.current = null;
    setPlanningExitDestination(null);
    setPlanningExitFromBrowser(false);
    traceHpr('uscita-annullata');
    setPlanningExitOpen(false);
    setPlanningExitError('');
  };
  const performPlanningExit = (discardUnsavedDraft = false) => {
    // A confirmation must never execute a stale UDA callback while history.go
    // is still traversing to the verified Programmazione origin.
    if (historyRestorePendingRef.current !== null || behaviorSavePendingRef.current || evaluationSavePendingRef.current) return;
    // A Back to an older history entry may show the *same* Programmazione
    // component, so unmounting is not sufficient to discard its dirty draft.
    if (discardUnsavedDraft) {
      if (activeTabRef.current === 'programmazione') planningGuardRef.current?.discardChanges();
      if (activeTabRef.current === 'verifiche-online') assessmentDraftGuardRef.current?.discardChanges();
      if (activeTabRef.current === 'consigli') councilGuardRef.current?.discardChanges();
      if (activeTabRef.current === 'comportamenti') behaviorDraftGuardRef.current?.discardChanges();
      if (activeTabRef.current === 'voti' || (activeTabRef.current==='tabellone'&&dailyMatrixModeRef.current)) evaluationDraftGuardRef.current?.discardChanges();
    }
    traceHpr(discardUnsavedDraft ? 'conferma-scarto' : 'conferma-salvataggio', planningExitDestination);
    planningExitRestoreFocusRef.current = false;
    const commit = pendingExitRef.current;
    pendingExitRef.current = null;
    setPlanningExitDestination(null);
    setPlanningExitFromBrowser(false);
    historyFallbackRef.current = null;
    setHistoryFallbackWarning(false);
    setPlanningExitOpen(false);
    setPlanningExitError('');
    planningExitBypassRef.current = true;
    try {
      commit?.();
      traceHpr(commit ? 'azione-eseguita' : 'azione-assente', planningExitDestination);
    } finally {
      planningExitBypassRef.current = false;
    }
  };
  const saveAndLeavePlanning = async () => {
    const guard = activeTabRef.current === 'consigli'
      ? councilGuardRef.current : planningGuardRef.current;
    if (!guard || planningExitSaving || historyRestorePendingRef.current !== null) return;
    setPlanningExitSaving(true);
    setPlanningExitError('');
    try {
      if (await guard.saveChanges()) {
        performPlanningExit();
      } else {
        setPlanningExitError(activeTabRef.current === 'consigli'
          ? 'Voti non salvati: correggi eventuali valori e riprova.'
          : 'Il profilo non è stato salvato. Correggi i dati o riprova.');
      }
    } catch {
      setPlanningExitError(activeTabRef.current === 'consigli'
          ? 'Salvataggio non riuscito. Le valutazioni di ingresso rimangono in modifica.'
          : 'Salvataggio non riuscito. La Programmazione rimane aperta.');
    } finally {
      setPlanningExitSaving(false);
    }
  };
  // Keep background surfaces inert while the unsaved-changes decision is modal.
  useEffect(() => {
    if (!planningExitOpen) return;
    const dialog = planningExitDialogRef.current;
    const parent = dialog?.parentElement;
    const siblings = parent
      ? Array.from(parent.children).filter(node => node !== dialog && node instanceof HTMLElement)
      : [];
    const prior = siblings.map(node => (node as HTMLElement).inert);
    siblings.forEach(node => { (node as HTMLElement).inert = true; });
    dialog?.querySelector<HTMLButtonElement>('[data-int01-stay]')?.focus();
    return () => {
      siblings.forEach((node, index) => { (node as HTMLElement).inert = prior[index] ?? false; });
      if (planningExitRestoreFocusRef.current) {
        planningExitRestoreFocusRef.current = false;
        planningExitOriginFocusRef.current?.focus();
      }
    };
  }, [planningExitOpen]);

  const [teachingFocus, setTeachingFocus] = useState<LibraryTeachingContext | null>(null);
  const [todayAction, setTodayAction] = useState<TodayAction | null>(null);
  const [reviewSession, setReviewSession] = useState<ReviewSessionContext | null>(null);
  const reviewSessionRef = useRef<ReviewSessionContext | null>(null);
  const publishReviewSession = useCallback((next: ReviewSessionContext | null) => {
    reviewSessionRef.current = next;
    setReviewSession(next);
  }, []);
  const [recordSession, setRecordSession] = useState<RecordSessionDraft | null>(null);
  const recordSessionRef = useRef<RecordSessionDraft | null>(null);
  const publishRecordSession = useCallback((next: RecordSessionDraft | null) => {
    recordSessionRef.current = next;
    setRecordSession(next);
  }, []);
  const navigationVersionRef = useRef(0);
  const recordSpecialistNavigationVersionRef = useRef<number | null>(null);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  // Accepted application route, never a transient browser entry during guarded Back.
  const [matrixEvaluationMode,setMatrixEvaluationMode]=useState(false);
  const matrixEvaluationModeRef=useRef(false);
  const acceptMatrixEvaluationMode=useCallback((value:boolean)=>{matrixEvaluationModeRef.current=value;setMatrixEvaluationMode(value);},[]);
  const [selectedStudentForReport, setSelectedStudentForReport] = useState<string | null>(null);
  // Batch IDs never enter the browser history; only per-unlocked-session opaque tokens do.
  const evaluationTargetMemoryRef = useRef<SpecialistTargetMemory>(new Map());
  // Only one report detour can be active. Never persisted or added to history.state.
  const studentReportReturnContextRef = useRef<StudentReportReturnContext | null>(null);
  const [returningToStudentOrigin, setReturningToStudentOrigin] = useState<StudentReportReturnContext | null>(null);
  // A pending explicit route consumes the temporary inline Tabellone history
  // step before adding the new destination, avoiding a phantom Back entry.
  const pendingMobileMatrixExitRef = useRef<{ classId: string; proceed: () => void } | null>(null);
  // Only one cancellation traversal may be outstanding. New destinations are
  // queued until its matching popstate is delivered (latest intent wins).
  const pendingEvaluationCancelRef = useRef<{ classId: string; proceed: (() => void) | null } | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [saveIndicatorText, setSaveIndicatorText] = useState('Sincronizzato');
  const saveIndicatorResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isLibraryMutationPending, setIsLibraryMutationPending] = useState(false);
  const [libraryMutationError, setLibraryMutationError] = useState<string | null>(null);
  const [professionalMemoryError, setProfessionalMemoryError] = useState<string | null>(null);
  const [launchRequest, setLaunchRequest] = useState<LibraryCopilotLaunchRequest | null>(null);
  // INT-02: a transient reference only; never written to URL, history, vault or grades.
  const [assessmentHandoffRequest, setAssessmentHandoffRequest] = useState<AssessmentHandoffRequest | null>(null);
  // Ephemeral: no URL, browser history, Vault, backup or grades.
  const [pendingCopilotAssessment, setPendingCopilotAssessment] = useState<PendingCopilotAssessmentTransfer | null>(null);
  const [assessmentTransferNotice, setAssessmentTransferNotice] = useState<string | null>(null);
  const [isAssessmentEditorFocus, setIsAssessmentEditorFocus] = useState(false);
  const [copilotOpenRequestNonce, setCopilotOpenRequestNonce] = useState(0);
  const [copilotSurfaceMode, setCopilotSurfaceMode] = useState<CopilotSurfaceMode>('closed');

  useEffect(() => {
    onCopilotSurfaceOpenChange?.(copilotSurfaceMode !== 'closed');
  }, [copilotSurfaceMode, onCopilotSurfaceOpenChange]);

  const openLibraryCopilot = useCallback((
    context: CopilotLaunchContext,
    mission?: CopilotMissionLaunchV1
  ) => {
    setCopilotSurfaceMode('compose');
    setLaunchRequest(previous => ({
      nonce: (previous?.nonce ?? 0) + 1,
      context,
      ...(mission ? { mission } : {})
    }));
  }, []);

  const reopenLibraryCopilot = useCallback(() => {
    setLaunchRequest(null);
    setCopilotSurfaceMode('compose');
    setCopilotOpenRequestNonce(previous => previous + 1);
  }, []);

  // Metadata for backup tracking
  const [meta, setMeta] = useState<SecureMeta>(() =>
    initialSnapshot.meta || { changes: 0, lastBackup: null }
  );

  const appDataRef = useRef(appData);
  const currentClassIdRef = useRef(appData.currentClassId);
  const metaRef = useRef(meta);
  const settingsRef = useRef(settings);
  const udasRef = useRef(udas);
  const planningRef = useRef(planning);
  const libraryRef = useRef(library);
  const professionalMemoryRef = useRef(professionalMemory);
  const copilotStateRef = useRef(copilotState);
  const semanticMemoryPortRef = useRef<LocalSemanticMemoryPort | null>(null);
  const missionExecutionGrantsRef = useRef(new Map<string, CopilotMissionExecutionGrantV1>());
  const testsRef = useRef(tests);
  const submissionsRef = useRef(submissions);
  const libraryMutationPendingCountRef = useRef(0);

  const setActiveTab = useCallback((
    tab: ActiveTab,
    options: { preserveStudentReturnContext?: boolean } = {}
  ) => {
    if (!planningExitBypassRef.current && tab !== activeTabRef.current && hasUnsavedActiveDraft()) {
      requestPlanningDeparture(() => setActiveTab(tab, options), tab);
      return;
    }
    // Consigli is a general workspace: previous class is never an implicit authority.
    if (tab === 'consigli' && activeTabRef.current !== 'consigli') {
      currentClassIdRef.current = null;
      setAppData(previous => ({ ...previous, currentClassId: null }));
    }
    if(tab!=='voti')acceptMatrixEvaluationMode(false);
    if(tab!=='tabellone')acceptDailyMatrixMode(false);
    traceHpr('scheda-attivata', tab);
    if (tab !== 'verifiche-online') setAssessmentHandoffRequest(null);
    if (tab !== 'verifiche-online') setPendingCopilotAssessment(null);
    // Central navigation authority: direct routes (including backup, history,
    // editing and the Drawer) must invalidate the previous report detour.
    if (!options.preserveStudentReturnContext) {
      studentReportReturnContextRef.current = null;
      setReturningToStudentOrigin(null);
    }
    navigationVersionRef.current += 1;
    activeTabRef.current = tab;
    setActiveTabState(tab);
    setTeachingFocus(previous =>
      transitionTeachingFocusForTab(previous, currentClassIdRef.current, tab, teachingUdaCatalogRef.current)
    );

    const storedReviewSession = reviewSessionRef.current;
    if (!storedReviewSession) return;

    const nextReviewSession = transitionReviewSessionForTab(
      storedReviewSession,
      currentClassIdRef.current,
      tab
    );
    publishReviewSession(nextReviewSession);
    if (storedReviewSession && !nextReviewSession) {
      setTodayAction(null);
    }
  }, [hasUnsavedActiveDraft, publishReviewSession, requestPlanningDeparture, traceHpr, acceptMatrixEvaluationMode]);

  // A removed or no-longer-reconciled UDA can never remain a latent focus.
  useEffect(() => {
    setTeachingFocus(previous =>
      previous
        ? keepTeachingFocusForClass(previous, appData.currentClassId, teachingUdaCatalog)
        : null
    );
  }, [appData.currentClassId, teachingUdaCatalog]);

  const handleConnectSemanticMemory = useCallback(async ({
    endpoint
  }: SemanticMemoryConnectInput): Promise<boolean> => {
    setSemanticMemorySession({
      status: 'connecting',
      endpoint: null,
      health: null,
      expiresAt: null,
      sync: null
    });
    try {
      const bootstrap = await activateSemanticMemorySession({ endpointUrl: endpoint });
      const client = createSemanticMemoryHttpClient({ endpointUrl: endpoint, token: bootstrap.token });
      const health = bootstrap.health;
      semanticMemoryPortRef.current = client;
      setSemanticMemorySession({
        status: health.status,
        endpoint: new URL(endpoint).origin,
        health,
        expiresAt: bootstrap.expiresAt,
        sync: null
      });
      return true;
    } catch (error) {
      semanticMemoryPortRef.current = null;
      setSemanticMemorySession({
        status: 'error',
        endpoint: null,
        health: null,
        expiresAt: null,
        sync: null,
        errorCode: error instanceof SemanticMemorySessionBootstrapError
          ? error.code
          : error instanceof SemanticMemoryHttpError
            ? error.code
            : 'CONNECTION_FAILED'
      });
      return false;
    }
  }, []);

  const handleDisconnectSemanticMemory = useCallback(() => {
    semanticMemoryPortRef.current = null;
    setSemanticMemorySession({
      status: 'disconnected',
      endpoint: null,
      health: null,
      expiresAt: null,
      sync: null
    });
    setIsSemanticMemorySyncing(false);
  }, []);

  const invalidateSemanticMemorySession = useCallback(() => {
    semanticMemoryPortRef.current = null;
    setSemanticMemorySession({
      status: 'disconnected',
      endpoint: null,
      health: null,
      expiresAt: null,
      sync: null,
      errorCode: 'SESSION_EXPIRED'
    });
    setIsSemanticMemorySyncing(false);
  }, []);

  const handleSyncSemanticMemory = useCallback(async (): Promise<void> => {
    const port = semanticMemoryPortRef.current;
    const endpoint = semanticMemorySession.endpoint;
    const usable = semanticMemorySession.status === 'ready' || semanticMemorySession.status === 'degraded';
    if (!port || !endpoint || !usable || isSemanticMemorySyncing) return;

    setIsSemanticMemorySyncing(true);
    try {
      const projections = await buildRegistroSemanticMemorySnapshot({
        librarySources: libraryRef.current.sources,
        professionalMemory: professionalMemoryRef.current
      });
      const result = await syncRegistroSemanticMemory({
        port,
        endpoint,
        projections
      });
      if (result.status === 'failed' && result.errorCode === 'HTTP_401') {
        invalidateSemanticMemorySession();
        return;
      }
      setSemanticMemorySession(previous => ({
        ...previous,
        status: result.status === 'rebuild-required' ? 'rebuild-required' : previous.status,
        sync: result,
        ...(result.status === 'failed' || result.status === 'reconciliation-required'
          ? { errorCode: result.errorCode }
          : { errorCode: undefined })
      }));
    } catch {
      setSemanticMemorySession(previous => ({
        ...previous,
        sync: null,
        errorCode: 'SYNC_FAILED'
      }));
    } finally {
      setIsSemanticMemorySyncing(false);
    }
  }, [invalidateSemanticMemorySession, isSemanticMemorySyncing, semanticMemorySession.endpoint, semanticMemorySession.status]);

  // Consume only an actual owned Tabellone inline-detail entry, then perform
  // the requested explicit navigation from its preceding collapsed route.
  // The report route is different: it must preserve the originating detail.
  const queueMobileMatrixExit = useCallback((proceed: () => void): boolean => {
    // Last explicit destination wins; never traverse Back a second time
    // while the first asynchronous browser popstate is still pending.
    if (pendingMobileMatrixExitRef.current) {
      pendingMobileMatrixExitRef.current.proceed = proceed;
      return true;
    }
    const classId = currentClassIdRef.current;
    if (!classId || !isMobileMatrixDisclosureState(window.history.state, classId)) return false;
    pendingMobileMatrixExitRef.current = { classId, proceed };
    try {
      window.history.back();
      return true;
    } catch {
      pendingMobileMatrixExitRef.current = null;
      return false;
    }
  }, []);

  const handleNavigateTab = useCallback((
    tab: ActiveTab,
    options: {
      preserveRecordSession?: boolean;
      studentId?: string;
      preserveStudentReturnContext?: boolean;
      evaluationBatchId?: string | null;
      returnTab?: ActiveTab;
      navigationMode?: 'push' | 'replace';
    } = {}
  ) => {
    traceHpr('click-navigazione', tab);
    // Selecting the active navigation item is not a request to replace the
    // compact editor. Only an explicit specialist target may change its mode.
    if (tab==='voti' && activeTabRef.current==='voti' && matrixEvaluationModeRef.current
      && options.returnTab===undefined && options.evaluationBatchId===undefined && !options.preserveRecordSession) return;
    const changesEvaluationMode=tab==='voti' && activeTabRef.current==='voti'
      && matrixEvaluationModeRef.current!==(options.returnTab==='tabellone');
    // Browser-history writes must be delayed with the actual tab change.
    // Never let a dirty planning draft remain behind a new route.
    if (!planningExitBypassRef.current && (tab !== activeTabRef.current || changesEvaluationMode) && hasUnsavedActiveDraft()) {
      requestPlanningDeparture(() => handleNavigateTab(tab, options), tab);
      return;
    }
    if (pendingEvaluationCancelRef.current) {
      // Do not push on top of a history traversal that has not yet finished.
      pendingEvaluationCancelRef.current.proceed = tab === 'storico'
        ? null
        : () => handleNavigateTab(tab, options);
      return;
    }
    // A previous inline Back may still be pending when another control fires.
    // ALL destinations, including the student report, must be serialized here.
    // Only a report requested without a pending exit bypasses inline collapse.
    if (pendingMobileMatrixExitRef.current) {
      pendingMobileMatrixExitRef.current.proceed = tab === activeTabRef.current
        ? () => {} // latest tap cancels a requested route change
        : () => handleNavigateTab(tab, options);
      return;
    }
    if (tab !== 'report') {
      if (isMobileMatrixDisclosureState(window.history.state, currentClassIdRef.current ?? '')) {
        if (tab === activeTabRef.current) {
          // The active Tabellone button is just an inline collapse.
          if (queueMobileMatrixExit(() => {})) return;
        }
        if (queueMobileMatrixExit(() => handleNavigateTab(tab, options))) return;
      }
    }
    const hadReviewSession = reviewSessionRef.current !== null;
    acceptMatrixEvaluationMode(tab==='voti'&&options.returnTab==='tabellone');
    setActiveTab(tab, { preserveStudentReturnContext: options.preserveStudentReturnContext });
    const shouldPreserveRecordSession = Boolean(options.preserveRecordSession);
    if (!shouldPreserveRecordSession) {
      publishRecordSession(null);
      recordSpecialistNavigationVersionRef.current = null;
    }

    if (!hadReviewSession && tab !== 'dashboard') {
      setTodayAction(null);
    }

    const classId = currentClassIdRef.current;
    try {
      // Every professional transition must enter the browser history.
      // Keep the student ID in history.state, never in the URL.
      const studentId = tab === 'report'
        ? (options.studentId
          ?? appDataRef.current.classes.find(candidate => candidate.id === classId)?.students[0]?.id)
        : undefined;
      if (tab === 'report') setSelectedStudentForReport(studentId ?? null);
      // Existing student-report history remains authoritative (#128/#130/#134).
      // Only evaluation editing receives an additional session-only target token.
      const requestedBatch = tab === 'voti'
        ? (options.evaluationBatchId === undefined ? editingBatchId : options.evaluationBatchId)
        : null;
      const currentClass = appDataRef.current.classes.find(candidate => candidate.id === classId);
      const validBatch = requestedBatch && currentClass?.grades.some(grade => grade.batchId === requestedBatch)
        ? requestedBatch : null;
      let evaluationToken: string | null = null;
      if (classId && validBatch) {
        const token = crypto.randomUUID();
        if (rememberSpecialistTarget(evaluationTargetMemoryRef.current, token, classId, 'voti', {
          kind: 'evaluation', batchId: validBatch
        })) evaluationToken = token;
      }
      const state = tab === 'report' && classId && studentId
        ? createStudentReportHistoryState(classId, studentId)
        : {
            classId, tab,
            ...(evaluationToken ? { [SPECIALIST_TARGET_HISTORY_KEY]: evaluationToken } : {}),
            ...(options.returnTab ? { returnTab: options.returnTab } : {})
          };
      const params = new URLSearchParams();
      if (classId) params.set('class', classId);
      if (tab !== 'home' && tab !== 'dashboard') params.set('tab', tab);
      const query = params.toString();
      const nextHistoryUrl = withHprTraceQuery(query ? `?${query}` : window.location.pathname);
      if (options.navigationMode === 'replace') {
        history.replaceState(state, '', nextHistoryUrl);
      } else {
        history.pushState(state, '', nextHistoryUrl);
        markHistoryPush();
      }
    } catch {
      // History API failures never authorize a professional write.
    }
  }, [editingBatchId, hasUnsavedActiveDraft, markHistoryPush, publishRecordSession, queueMobileMatrixExit, requestPlanningDeparture, setActiveTab, traceHpr, withHprTraceQuery, acceptMatrixEvaluationMode]);

  /** INT-02/S3c-02: explicit teacher adoption opens only a transient editor draft. */
  const handleAcceptAssessmentDraft = useCallback(async (
    session:AssessmentGenerationSessionV1,
    draft:AssessmentDraftV1
  ):Promise<void> => {
    // Never permit a Copilot transfer to replace an unsaved editor or a
    // pending canonical mutation. Navigation guards remain authoritative.
    if (hasUnsavedActiveDraft()
      || !canAcceptAssessmentEditorTransfer({
        hasUnsavedChanges: Boolean(assessmentDraftGuardRef.current?.hasUnsavedChanges()),
        isSaving: Boolean(assessmentDraftGuardRef.current?.isSaving())
      })) {
      throw new Error('Conserva o chiudi prima la bozza già aperta. Non è stata sostituita.');
    }
    const activeClassId=currentClassIdRef.current;
    const resolved=prepareAssessmentEditorTransfer({
      session,draft,
      library:libraryRef.current,
      classes:appDataRef.current.classes,
      activeClassId,
      teacherConfirmedAdoption:true
    });
    if(resolved.status!=='ready') {
      throw new Error('La fonte o la classe non è più valida. Richiedi una nuova proposta.');
    }
    setAssessmentTransferNotice(null);
    setAssessmentHandoffRequest(null);
    setPendingCopilotAssessment({
      nonce:crypto.randomUUID(),
      session,draft,transfer:resolved.transfer
    });
    handleNavigateTab('verifiche-online');
  },[handleNavigateTab,hasUnsavedActiveDraft]);

  /** INT-02/S1: navigate only with the validated teacher-owned source reference. */
  const handlePrepareAssessmentFromLibrary = useCallback((sourceId: string) => {
    const classId = currentClassIdRef.current;
    const request: AssessmentHandoffRequest = { sourceId, classId: classId ?? '' };
    const resolution = resolveAssessmentHandoff({
      request,
      library: libraryRef.current,
      classes: appDataRef.current.classes,
      activeClassId: classId
    });
    if (resolution.status !== 'ready') {
      setAssessmentHandoffRequest(null);
      return;
    }
    setAssessmentHandoffRequest(request);
    handleNavigateTab('verifiche-online');
  }, [handleNavigateTab]);

  /** INT-02: teacher-authored continuation without a generative provider. */
  const handleContinueAssessmentManually = useCallback(async (
    sourceId:string, classId:string, objective:string
  ):Promise<void> => {
    if(hasUnsavedActiveDraft()
      || !canAcceptAssessmentEditorTransfer({
        hasUnsavedChanges:Boolean(assessmentDraftGuardRef.current?.hasUnsavedChanges()),
        isSaving:Boolean(assessmentDraftGuardRef.current?.isSaving())
      })) {
      throw new Error('Conserva o chiudi prima la bozza già aperta. Non è stata sostituita.');
    }
    const trimmedObjective=objective.trim();
    const liveClassId=currentClassIdRef.current;
    if(!trimmedObjective||trimmedObjective.length>400||liveClassId!==classId) {
      throw new Error('La fonte o la classe non è più valida. Richiedi una nuova proposta.');
    }
    const request:AssessmentHandoffRequest={
      sourceId,classId,objective:trimmedObjective,guided:true,nonce:crypto.randomUUID()
    };
    const result=resolveAssessmentHandoff({
      request,library:libraryRef.current,
      classes:appDataRef.current.classes,activeClassId:liveClassId
    });
    if(result.status!=='ready'){
      throw new Error('La fonte o la classe non è più valida. Richiedi una nuova proposta.');
    }
    setPendingCopilotAssessment(null);
    setAssessmentTransferNotice(null);
    setAssessmentHandoffRequest(request);
    handleNavigateTab('verifiche-online');
  },[handleNavigateTab,hasUnsavedActiveDraft]);

  /** Open one student's report as a REAL browser-history route, not only a React tab. */
  const handleOpenStudentReport = useCallback((
    studentId: string,
    originContext?: StudentReportReturnContext
  ) => {
    const classId = currentClassIdRef.current;
    const selectedClass = appDataRef.current.classes.find(candidate => candidate.id === classId);
    if (!selectedClass?.students.some(student => student.id === studentId)) return;

    // Accept a context only from the currently open professional surface.
    // If an earlier inline Back is already consuming its detail marker,
    // the report returns to the COLLAPSED Tabellone. Otherwise a later
    // Back would restore an expanded row without its corresponding step.
    // Keep the other transient filters but never put names or grades in history.
    const pendingInlineCollapse = pendingMobileMatrixExitRef.current !== null;
    const safeOriginContext = pendingInlineCollapse && originContext?.originTab === 'tabellone'
      ? { ...originContext, ui: { ...originContext.ui, expandedStudentId: null } }
      : originContext;
    studentReportReturnContextRef.current = safeOriginContext?.studentId === studentId
      ? resolveStudentReportReturnContext(
          safeOriginContext,
          classId,
          activeTab,
          appDataRef.current.classes
        )
      : null;
    handleNavigateTab('report', { studentId, preserveStudentReturnContext: true });
  }, [activeTab, handleNavigateTab]);

  /** Switching students within the report replaces only the current history entry. */
  const handleSelectStudentInReport = useCallback((studentId: string) => {
    const classId = currentClassIdRef.current;
    const selectedClass = appDataRef.current.classes.find(candidate => candidate.id === classId);
    if (!classId || !selectedClass?.students.some(student => student.id === studentId)) return;
    setSelectedStudentForReport(studentId);
    try {
      if (history.state?.classId === classId && history.state?.tab === 'report') {
        history.replaceState(
          createStudentReportHistoryState(classId, studentId),
          '',
          window.location.href
        );
      }
    } catch (error) {
      // The visible selection still succeeds when history is unavailable.
    }
  }, []);

  const mutationCoordinatorRef = useRef<ReturnType<typeof createDurableMutationCoordinator> | null>(null);
  const mutationCoordinator = mutationCoordinatorRef.current ?? (
    mutationCoordinatorRef.current = createDurableMutationCoordinator()
  );

  const toast = useCallback((msg: string) => {
    if (saveIndicatorResetTimerRef.current !== null) {
      clearTimeout(saveIndicatorResetTimerRef.current);
    }
    setSaveIndicatorText(msg);
    saveIndicatorResetTimerRef.current = setTimeout(() => {
      setSaveIndicatorText('Sincronizzato');
      saveIndicatorResetTimerRef.current = null;
    }, 2800);
  }, []);

  const commitAppDataMutation = useCallback((
    derive: (current: AppData) => AppData,
    options: {
      showBackupModal?: boolean;
      successMessage?: string;
      inlineFailure?: boolean;
      afterCommit?: () => void;
    } = {}
  ): Promise<AppData> => {
    const {
      showBackupModal,
      successMessage = 'Salvato nel vault locale',
      inlineFailure = false,
      afterCommit
    } = options;

    return mutationCoordinator.enqueue<{ appData: AppData; meta: SecureMeta }>({
      getCommitted: () => ({ appData: appDataRef.current, meta: metaRef.current }),
      derive: current => {
        const navigationAwareAppData = {
          ...current.appData,
          currentClassId: currentClassIdRef.current
        };
        return {
          appData: derive(navigationAwareAppData),
          meta: incrementBackupChanges(current.meta)
        };
      },
      persist: candidate => secureStorage.saveAppDataAndMeta(candidate.appData, candidate.meta),
      publish: candidate => {
        appDataRef.current = candidate.appData;
        metaRef.current = candidate.meta;
        const visibleCurrentClassId =
          currentClassIdRef.current === null
            ? null
            : candidate.appData.classes.some(c => c.id === currentClassIdRef.current)
              ? currentClassIdRef.current
              : candidate.appData.currentClassId;
        currentClassIdRef.current = visibleCurrentClassId;
        setAppData({ ...candidate.appData, currentClassId: visibleCurrentClassId });
        setMeta(candidate.meta);
      },
      afterCommit: (candidate, previous) => {
        if (successMessage) toast(successMessage);
        const shouldOpenBackupModal = showBackupModal === true
          || (showBackupModal === undefined
            && shouldSuggestBackupReminder(previous.meta, candidate.meta));
        if (shouldOpenBackupModal) setIsBackupModalOpen(true);
        afterCommit?.();
      }
    }).then(candidate => candidate.appData).catch(error => {
      if(!inlineFailure){console.error('Secure vault save failed', error);alert(DURABLE_SAVE_FAILURE_MESSAGE);}
      throw error;
    });
  }, [mutationCoordinator, secureStorage, toast]);

  const commitSettingsMutation = useCallback((patch: Partial<AppSettings>): Promise<AppSettings> => {
    return mutationCoordinator.enqueue<{ settings: AppSettings; meta: SecureMeta }>({
      getCommitted: () => ({ settings: settingsRef.current, meta: metaRef.current }),
      derive: current => ({
        settings: applySettingsPatch(current.settings, patch),
        meta: incrementBackupChanges(current.meta)
      }),
      persist: candidate => secureStorage.saveSettingsAndMeta(candidate.settings, candidate.meta),
      publish: candidate => {
        settingsRef.current = candidate.settings;
        metaRef.current = candidate.meta;
        setSettings(candidate.settings);
        setMeta(candidate.meta);
      },
      afterCommit: () => toast('Impostazioni aggiornate')
    }).then(candidate => candidate.settings).catch(error => {
      console.error('Secure settings save failed', error);
      alert(DURABLE_SAVE_FAILURE_MESSAGE);
      throw error;
    });
  }, [mutationCoordinator, secureStorage, toast]);

  const commitUdasMutation = useCallback((derive: (current: UdaRecord[]) => UdaRecord[]): Promise<UdaRecord[]> => {
    return mutationCoordinator.enqueue<{ udas: UdaRecord[]; meta: SecureMeta }>({
      getCommitted: () => ({ udas: udasRef.current, meta: metaRef.current }),
      derive: current => ({
        udas: derive(current.udas),
        meta: incrementBackupChanges(current.meta)
      }),
      persist: candidate => secureStorage.saveUdasAndMeta(candidate.udas, candidate.meta),
      publish: candidate => {
        udasRef.current = candidate.udas;
        metaRef.current = candidate.meta;
        setUdas(candidate.udas);
        setMeta(candidate.meta);
      },
      afterCommit: () => toast('UDA salvate')
    }).then(candidate => candidate.udas).catch(error => {
      console.error('Secure UDA save failed', error);
      alert(DURABLE_SAVE_FAILURE_MESSAGE);
      throw error;
    });
  }, [mutationCoordinator, secureStorage, toast]);

  const commitPlanningMutation = useCallback((
    derive: (current: PlanningState) => PlanningState
  ): Promise<PlanningState> => {
    return mutationCoordinator.enqueue<{ planning: PlanningState; meta: SecureMeta }>({
      getCommitted: () => ({ planning: planningRef.current, meta: metaRef.current }),
      derive: current => ({
        planning: applyPlanningMutation(current.planning, derive),
        meta: incrementBackupChanges(current.meta)
      }),
      persist: candidate => secureStorage.savePlanningAndMeta(candidate.planning, candidate.meta),
      publish: candidate => {
        planningRef.current = candidate.planning;
        metaRef.current = candidate.meta;
        setPlanning(candidate.planning);
        setMeta(candidate.meta);
      },
      afterCommit: () => toast('Programmazione salvata')
    }).then(candidate => candidate.planning).catch(error => {
      console.error('Secure planning save failed', error);
      alert(DURABLE_SAVE_FAILURE_MESSAGE);
      throw error;
    });
  }, [mutationCoordinator, secureStorage, toast]);

  const handleAcceptDocenteOsTeachingProjection = useCallback((payload: unknown): Promise<PlanningState> => {
    const preview = previewDocenteOsTeachingProjection(payload);
    if (!preview.ok) {
      return Promise.reject(new Error(`Proiezione Docente OS non valida (${preview.code}).`));
    }

    return commitPlanningMutation(current => {
      const previousAcceptedProjection = findAcceptedDocenteOsTeachingProjectionForSlot(
        current,
        preview.projection
      );
      const reconciliation = reconcileDocenteOsTeachingProjectionClasses(
        preview.projection,
        appDataRef.current.classes,
        previousAcceptedProjection?.classReconciliation
      );

      if (reconciliation.some(item => item.status !== 'resolved')) {
        throw new Error('Riconciliazione classi Docente OS incompleta: verifica le classi prima di accettare.');
      }

      return bindAcceptedDocenteOsTeachingProjection(
        current,
        preview.projection,
        reconciliation,
        { status: 'accepted', acceptedAt: new Date().toISOString() }
      );
    });
  }, [commitPlanningMutation]);

  const commitLibraryMutation = useCallback((
    derive: (current: LibraryStateV1) => LibraryStateV1,
    afterCanonicalCommit?: (committedLibrary: LibraryStateV1) => Promise<void>
  ): Promise<LibraryStateV1> => {
    libraryMutationPendingCountRef.current += 1;
    setIsLibraryMutationPending(true);
    setLibraryMutationError(null);

    return mutationCoordinator.enqueueTask(async () => {
      const candidate = await persistLibraryMutation(
        { library: libraryRef.current, meta: metaRef.current },
        derive,
        (nextLibrary, nextMeta) => secureStorage.saveLibraryAndMeta(nextLibrary, nextMeta)
      );

      libraryRef.current = candidate.library;
      metaRef.current = candidate.meta;
      setLibrary(candidate.library);
      setMeta(candidate.meta);
      toast('Biblioteca aggiornata');
      if (afterCanonicalCommit) {
        try {
          await afterCanonicalCommit(candidate.library);
        } catch (error) {
          console.error('Post-library derived work failed', error);
        }
      }
      return candidate.library;
    }).catch(error => {
      console.error('Secure library save failed', error);
      const message = error instanceof Error ? error.message : 'Salvataggio biblioteca non riuscito.';
      setLibraryMutationError(message);
      alert(DURABLE_SAVE_FAILURE_MESSAGE);
      throw error;
    }).finally(() => {
      libraryMutationPendingCountRef.current = Math.max(0, libraryMutationPendingCountRef.current - 1);
      if (libraryMutationPendingCountRef.current === 0) {
        setIsLibraryMutationPending(false);
      }
    });
  }, [mutationCoordinator, secureStorage, toast]);

  const persistDerivedMemoryEvent = useCallback(async (
    event: RecordProfessionalMemoryEventInput
  ): Promise<void> => {
    const result = await persistDerivedProfessionalMemoryAfterCanonicalCommit({
      current: professionalMemoryRef.current,
      event,
      persist: candidate => secureStorage.saveProfessionalMemory(candidate)
    });

    if (result.status === 'persisted') {
      professionalMemoryRef.current = result.state;
      setProfessionalMemory(result.state);
      setProfessionalMemoryError(null);
      return;
    }

    if (result.status === 'failed') {
      const message = result.error;
      const error = new Error(message);
      console.error('Professional memory save failed', error);
      setProfessionalMemoryError(message);
    }
  }, [secureStorage]);

  const commitProfessionalMemoryMutation = useCallback((
    derive: (current: ProfessionalMemoryStateV1) => ProfessionalMemoryStateV1,
    successMessage: string
  ): Promise<ProfessionalMemoryStateV1> => {
    setProfessionalMemoryError(null);
    return mutationCoordinator.enqueue<{
      professionalMemory: ProfessionalMemoryStateV1;
      meta: SecureMeta;
    }>({
      getCommitted: () => ({
        professionalMemory: professionalMemoryRef.current,
        meta: metaRef.current
      }),
      derive: current => ({
        professionalMemory: derive(current.professionalMemory),
        meta: incrementBackupChanges(current.meta)
      }),
      persist: candidate => secureStorage.saveProfessionalMemoryAndMeta(
        candidate.professionalMemory,
        candidate.meta
      ),
      publish: candidate => {
        professionalMemoryRef.current = candidate.professionalMemory;
        metaRef.current = candidate.meta;
        setProfessionalMemory(candidate.professionalMemory);
        setMeta(candidate.meta);
      },
      afterCommit: () => toast(successMessage)
    }).then(candidate => candidate.professionalMemory).catch(error => {
      console.error('Professional memory mutation failed', error);
      const message = error instanceof Error
        ? error.message
        : 'Salvataggio memoria professionale non riuscito.';
      setProfessionalMemoryError(message);
      throw error;
    });
  }, [mutationCoordinator, secureStorage, toast]);

  const commitCopilotStateMutation = useCallback((
    derive: (current: CopilotStateV1) => CopilotStateV1,
    successMessage: string
  ): Promise<CopilotStateV1> => {
    return mutationCoordinator.enqueue<{ copilotState: CopilotStateV1; meta: SecureMeta }>({
      getCommitted: () => ({ copilotState: copilotStateRef.current, meta: metaRef.current }),
      derive: current => ({
        copilotState: derive(current.copilotState),
        meta: incrementBackupChanges(current.meta)
      }),
      persist: candidate => secureStorage.saveCopilotStateAndMeta(candidate.copilotState, candidate.meta),
      publish: candidate => {
        copilotStateRef.current = candidate.copilotState;
        metaRef.current = candidate.meta;
        setCopilotState(candidate.copilotState);
        setMeta(candidate.meta);
      },
      afterCommit: () => toast(successMessage)
    }).then(candidate => candidate.copilotState).catch(error => {
      console.error('Supervised Copilot state save failed', error);
      alert(DURABLE_SAVE_FAILURE_MESSAGE);
      throw error;
    });
  }, [mutationCoordinator, secureStorage, toast]);

  const handleRememberProfessionalItem = useCallback((
    input: RememberProfessionalItemInput
  ): Promise<void> => commitProfessionalMemoryMutation(
    current => rememberProfessionalItem(current, input),
    'Ricordo professionale salvato'
  ).then(() => undefined), [commitProfessionalMemoryMutation]);

  const handleCorrectMemoryEntry = useCallback((
    entryId: string,
    summary: string
  ): Promise<void> => commitProfessionalMemoryMutation(
    current => correctProfessionalMemoryEntry(current, {
      entryId,
      summary,
      correctedAt: new Date().toISOString()
    }),
    'Ricordo professionale aggiornato'
  ).then(() => undefined), [commitProfessionalMemoryMutation]);

  const handleRemoveMemoryEntry = useCallback((entryId: string): Promise<void> =>
    commitProfessionalMemoryMutation(
      current => removeProfessionalMemoryEntry(current, entryId),
      'Ricordo professionale rimosso'
    ).then(() => undefined),
  [commitProfessionalMemoryMutation]);

  const handleSetMemoryCategory = useCallback((
    category: ProfessionalMemoryCategory,
    enabled: boolean
  ): Promise<void> => commitProfessionalMemoryMutation(
    current => setAutoRememberCategory(current, category, enabled),
    enabled ? 'Memoria automatica attivata' : 'Memoria automatica disattivata'
  ).then(() => undefined), [commitProfessionalMemoryMutation]);

  const handleRemoveMemoryCategory = useCallback((
    category: ProfessionalMemoryCategory
  ): Promise<void> => commitProfessionalMemoryMutation(
    current => removeProfessionalMemoryCategory(current, category),
    'Ricordi della categoria eliminati'
  ).then(() => undefined), [commitProfessionalMemoryMutation]);

  const handlePutAsideCopilotOpportunity = useCallback((
    opportunity: CopilotOpportunityV1,
    contextFingerprint: string
  ): Promise<void> => {
    const occurredAt = new Date().toISOString();
    return commitCopilotStateMutation(current => {
      const deferred = deferCopilotOpportunity(current, {
        opportunity,
        contextFingerprint,
        deferredAt: occurredAt
      });
      return recordCopilotOutcomeSignal(deferred, {
        id: uid(),
        opportunityKind: opportunity.kind,
        signal: 'put-aside',
        occurredAt
      });
    }, 'Opportunità messa da parte').then(() => undefined);
  }, [commitCopilotStateMutation]);

  const handleIgnoreCopilotOpportunity = useCallback((
    opportunity: CopilotOpportunityV1,
    contextFingerprint: string
  ): Promise<void> => {
    const occurredAt = new Date().toISOString();
    return commitCopilotStateMutation(current => {
      const dismissed = dismissCopilotOpportunity(current, {
        opportunityId: opportunity.id,
        contextFingerprint
      });
      return recordCopilotOutcomeSignal(dismissed, {
        id: uid(),
        opportunityKind: opportunity.kind,
        signal: 'ignore',
        occurredAt
      });
    }, 'Opportunità ignorata').then(() => undefined);
  }, [commitCopilotStateMutation]);

  const handleResetCopilotPreferences = useCallback((): Promise<void> =>
    commitCopilotStateMutation(
      current => resetCopilotStatePreferences(current),
      'Preferenze del Copilota reimpostate'
    ).then(() => undefined),
  [commitCopilotStateMutation]);

  const handleStartCopilotMission = useCallback(async (
    opportunity: CopilotOpportunityV1,
    preview: CopilotMissionPreviewV1,
    materialFingerprint: string
  ): Promise<void> => {
    const uda = udasRef.current.find(candidate => candidate.id === opportunity.contextRef.udaId);
    if (!uda) throw new Error('Il contesto della missione non è più disponibile.');
    const sources = libraryRef.current.sources.filter(source => opportunity.proposedMission.sourceRefs.includes(source.id));
    if (sources.length !== opportunity.proposedMission.sourceRefs.length
      || sources.some(source => source.status !== 'ready' || source.privacy !== 'teacher-professional')) {
      throw new Error('La fonte professionale della missione non è più disponibile.');
    }
    const currentTeachingContext = resolveLibraryTeachingContext(udasRef.current, {
      udaId: opportunity.contextRef.udaId,
      ...(opportunity.contextRef.lessonId ? { lessonId: opportunity.contextRef.lessonId } : {})
    });
    if (!currentTeachingContext || currentTeachingContext.className !== opportunity.contextRef.className) {
      throw new Error('Il contesto didattico della missione non è più disponibile.');
    }
    const currentPlanningContext = resolvePlanningContextForLibraryRelevance(
      currentTeachingContext,
      planningRef.current
    );
    const currentPlanningProfileId = currentPlanningContext?.status === 'resolved'
      ? currentPlanningContext.profile.id
      : null;
    const now = new Date().toISOString();
    const projection = buildCopilotContextProjection({
      surface: 'library',
      className: opportunity.contextRef.className,
      udaId: opportunity.contextRef.udaId,
      lessonId: opportunity.contextRef.lessonId,
      sourceId: opportunity.contextRef.sourceId ?? opportunity.proposedMission.sourceRefs[0],
      planningProfileId: currentPlanningProfileId
    });
    const currentContextFingerprint = buildMissionContextFingerprint({
      context: projection,
      uda,
      sources,
      planningProfileId: currentPlanningProfileId,
      missionSettings: {
        aiBudgetProfile: settingsRef.current.aiBudgetProfile ?? 'balanced',
        copilotProactivity: settingsRef.current.copilotProactivity ?? 'balanced'
      }
    });
    if (currentContextFingerprint !== materialFingerprint) {
      throw new Error('Il contesto della missione è cambiato: rivedi l’anteprima prima di avviare.');
    }
    const { mission, grant } = authorizeCopilotMission(preview, {
      id: uid(),
      opportunity,
      fingerprintInput: {
        context: projection,
        uda,
        sources,
        planningProfileId: currentPlanningProfileId,
        missionSettings: {
          aiBudgetProfile: settingsRef.current.aiBudgetProfile ?? 'balanced',
          copilotProactivity: settingsRef.current.copilotProactivity ?? 'balanced'
        }
      },
      budgetProfile: settingsRef.current.aiBudgetProfile ?? 'balanced',
      now
    });
    await commitCopilotStateMutation(current => recordCopilotOutcomeSignal(
      appendCopilotMission(current, mission),
      {
        id: uid(),
        opportunityKind: opportunity.kind,
        signal: 'play',
        occurredAt: now
      }
    ), 'Incarico del Copilota avviato');
    missionExecutionGrantsRef.current.set(mission.id, grant);
    const runtime = bindMissionRuntime(mission, grant);
    openLibraryCopilot({
      surface: 'library',
      className: mission.contextRef.className,
      udaId: mission.contextRef.udaId,
      ...(mission.contextRef.lessonId ? { lessonId: mission.contextRef.lessonId } : {}),
      ...(mission.contextRef.sourceId ? { sourceId: mission.contextRef.sourceId } : {}),
      teachingContextMode: 'explicit'
    }, runtime);
  }, [commitCopilotStateMutation, openLibraryCopilot]);

  const handleResumeCopilotMission = useCallback(async (
    mission: CopilotMissionV1
  ): Promise<MissionResumeDecision> => {
    const currentMission = copilotStateRef.current.missions.find(candidate => candidate.id === mission.id);
    if (!currentMission || currentMission.status !== 'suspended') return 'archive';

    const uda = udasRef.current.find(candidate => candidate.id === currentMission.contextRef.udaId);
    const sources = libraryRef.current.sources.filter(source => currentMission.sourceRefs.includes(source.id));
    if (!uda
      || sources.length !== currentMission.sourceRefs.length
      || sources.some(source => source.status !== 'ready' || source.privacy !== 'teacher-professional')) {
      missionExecutionGrantsRef.current.delete(currentMission.id);
      clearMissionRuntime(currentMission.id);
      await commitCopilotStateMutation(current => updateCopilotMission(
        current,
        currentMission.id,
        item => ({ ...item, status: 'archived' })
      ), 'Incarico non più riprendibile');
      return 'archive';
    }

    const currentTeachingContext = resolveLibraryTeachingContext(udasRef.current, {
      udaId: currentMission.contextRef.udaId,
      ...(currentMission.contextRef.lessonId ? { lessonId: currentMission.contextRef.lessonId } : {})
    });
    if (!currentTeachingContext || currentTeachingContext.className !== currentMission.contextRef.className) {
      missionExecutionGrantsRef.current.delete(currentMission.id);
      clearMissionRuntime(currentMission.id);
      await commitCopilotStateMutation(current => updateCopilotMission(
        current,
        currentMission.id,
        item => ({ ...item, status: 'archived' })
      ), 'Incarico non più riprendibile');
      return 'archive';
    }
    const currentPlanningContext = resolvePlanningContextForLibraryRelevance(
      currentTeachingContext,
      planningRef.current
    );
    const currentPlanningProfileId = currentPlanningContext?.status === 'resolved'
      ? currentPlanningContext.profile.id
      : null;
    const now = new Date().toISOString();
    const projection = buildCopilotContextProjection({
      surface: 'library',
      className: currentMission.contextRef.className,
      udaId: currentMission.contextRef.udaId,
      lessonId: currentMission.contextRef.lessonId,
      sourceId: currentMission.contextRef.sourceId ?? currentMission.sourceRefs[0],
      planningProfileId: currentPlanningProfileId
    });
    const currentContextFingerprint = buildMissionContextFingerprint({
      context: projection,
      uda,
      sources,
      planningProfileId: currentPlanningProfileId,
      missionSettings: {
        aiBudgetProfile: settingsRef.current.aiBudgetProfile ?? 'balanced',
        copilotProactivity: settingsRef.current.copilotProactivity ?? 'balanced'
      }
    });
    const decision = resolveMissionResume(currentMission, currentContextFingerprint, now);

    if (decision !== 'resume') {
      missionExecutionGrantsRef.current.delete(currentMission.id);
      clearMissionRuntime(currentMission.id);
      await commitCopilotStateMutation(current => updateCopilotMission(
        current,
        currentMission.id,
        item => ({ ...item, status: 'archived' })
      ), decision === 'repreview' ? 'Contesto cambiato: controlla la nuova anteprima' : 'Incarico archiviato');
      return decision;
    }

    const grant = authorizeCopilotMissionResume(currentMission, currentContextFingerprint, now);
    await commitCopilotStateMutation(current => updateCopilotMission(
      current,
      currentMission.id,
      item => ({ ...item, status: 'authorized' })
    ), 'Incarico del Copilota ripreso');
    missionExecutionGrantsRef.current.set(currentMission.id, grant);
    const runtime = bindMissionRuntime({ ...currentMission, status: 'authorized' }, grant);
    openLibraryCopilot({
      surface: 'library',
      className: currentMission.contextRef.className,
      udaId: currentMission.contextRef.udaId,
      ...(currentMission.contextRef.lessonId ? { lessonId: currentMission.contextRef.lessonId } : {}),
      ...(currentMission.contextRef.sourceId ? { sourceId: currentMission.contextRef.sourceId } : {}),
      teachingContextMode: 'explicit'
    }, runtime);
    return 'resume';
  }, [commitCopilotStateMutation, openLibraryCopilot]);

  const handleMissionInterrupted = useCallback((
    { missionId }: { missionId: string }
  ): Promise<void> => {
    const mission = copilotStateRef.current.missions.find(candidate => candidate.id === missionId);
    if (!mission || (mission.status !== 'authorized' && mission.status !== 'running')) {
      return Promise.resolve();
    }

    return commitCopilotStateMutation(current => updateCopilotMission(
      current,
      missionId,
      suspendCopilotMission
    ), '').then(() => {
      missionExecutionGrantsRef.current.delete(missionId);
      clearMissionRuntime(missionId);
    });
  }, [commitCopilotStateMutation]);

  const handleMissionProposalReady = useCallback(async (
    { missionId, proposal, receipt }: MissionProposalReadyNotification
  ): Promise<void> => {
    const mission = copilotStateRef.current.missions.find(candidate => candidate.id === missionId);
    if (!mission || !canAcceptMissionProposalResult(mission, proposal)) return;

    await commitCopilotStateMutation(current => updateCopilotMission(
      current,
      missionId,
      currentMission => ({ ...currentMission, status: 'ready', result: { proposal, receipt } })
    ), 'Incarico pronto da controllare');
    missionExecutionGrantsRef.current.delete(missionId);
    clearMissionRuntime(missionId);
  }, [commitCopilotStateMutation]);

  const handleMissionOutcome = useCallback((
    { missionId, signal }: { missionId: string; signal: CopilotPreferenceSignalKind }
  ): Promise<void> => {
    const mission = copilotStateRef.current.missions.find(candidate => candidate.id === missionId);
    if (!mission) return Promise.resolve();
    return commitCopilotStateMutation(current => recordCopilotMissionOutcome(current, {
      missionId,
      signal,
      signalId: uid(),
      occurredAt: new Date().toISOString()
    }), '').then(() => undefined);
  }, [commitCopilotStateMutation]);

  const handleAdoptTeachingProposalToUda = useCallback((
    input: TeachingProposalOutcomeMutationInput
  ): Promise<TeachingProposalOutcomeCandidate['receipt']> => {
    libraryMutationPendingCountRef.current += 1;
    setIsLibraryMutationPending(true);
    setLibraryMutationError(null);

    return mutationCoordinator.enqueueTask(async () => {
      const candidate = deriveTeachingProposalOutcomeCandidate({
        library: libraryRef.current,
        udas: udasRef.current,
        meta: metaRef.current
      }, input);

      await secureStorage.saveLibraryUdasAndMeta(candidate.library, candidate.udas, candidate.meta);
      libraryRef.current = candidate.library;
      udasRef.current = candidate.udas;
      metaRef.current = candidate.meta;
      setLibrary(candidate.library);
      setUdas(candidate.udas);
      setMeta(candidate.meta);
      await persistDerivedMemoryEvent({
        id: `proposal-adopted:${candidate.receipt.sourceId}:${candidate.receipt.udaId}:${candidate.receipt.lessonId}:${input.capturedAt}`,
        kind: 'proposal-adopted',
        category: 'material-reuse',
        occurredAt: input.capturedAt,
        descriptor: 'Proposta didattica adottata nell’UDA corrente.',
        context: {
          udaId: candidate.receipt.udaId,
          lessonId: candidate.receipt.lessonId,
          sourceId: candidate.receipt.sourceId
        },
        canonicalRef: `source:${candidate.receipt.sourceId}`,
        privacyClassification: 'TEACHER_PROFESSIONAL'
      });
      toast('Proposta aggiunta all’UDA');
      return candidate.receipt;
    }).catch(error => {
      console.error('Secure proposal outcome save failed', error);
      const message = error instanceof Error ? error.message : 'Salvataggio della proposta nell’UDA non riuscito.';
      setLibraryMutationError(message);
      alert(DURABLE_SAVE_FAILURE_MESSAGE);
      throw error;
    }).finally(() => {
      libraryMutationPendingCountRef.current = Math.max(0, libraryMutationPendingCountRef.current - 1);
      if (libraryMutationPendingCountRef.current === 0) {
        setIsLibraryMutationPending(false);
      }
    });
  }, [mutationCoordinator, persistDerivedMemoryEvent, secureStorage, toast]);

  const handleAddLibrarySource = useCallback((source: LibrarySource): Promise<void> =>
    commitLibraryMutation(current => addLibrarySource(current, source)).then(() => undefined),
  [commitLibraryMutation]);

  const handleUpdateLibrarySource = useCallback((
    sourceId: string,
    patch: LibrarySourcePatch
  ): Promise<void> =>
    commitLibraryMutation(current => updateLibrarySource(current, sourceId, patch)).then(() => undefined),
  [commitLibraryMutation]);

  const handleLinkLibrarySource = useCallback((
    sourceId: string,
    link: LibrarySourceLink
  ): Promise<void> =>
    commitLibraryMutation(
      current => linkLibrarySource(current, sourceId, link),
      async committedLibrary => {
        const source = committedLibrary.sources.find(candidate => candidate.id === sourceId);
        const privacyClassification: RecordProfessionalMemoryEventInput['privacyClassification'] =
          source?.privacy === 'teacher-professional'
            ? 'TEACHER_PROFESSIONAL'
            : source?.privacy === 'student-personal'
              ? 'STUDENT_PERSONAL'
              : 'AMBIGUOUS';
        const occurredAt = new Date().toISOString();
        await persistDerivedMemoryEvent({
          id: `source-linked:${sourceId}:${link.targetType}:${link.targetId}:${occurredAt}`,
          kind: 'source-linked',
          category: 'material-reuse',
          occurredAt,
          descriptor: 'Fonte professionale collegata al contesto didattico corrente.',
          context: {
            sourceId,
            ...(link.targetType === 'uda' ? { udaId: link.targetId } : {}),
            ...(link.targetType === 'lesson' ? { lessonId: link.targetId } : {})
          },
          canonicalRef: `source:${sourceId}`,
          privacyClassification
        });
      }
    ).then(() => undefined),
  [commitLibraryMutation, persistDerivedMemoryEvent]);

  const handleUnlinkLibrarySource = useCallback((
    sourceId: string,
    link: LibrarySourceLink
  ): Promise<void> =>
    commitLibraryMutation(current => unlinkLibrarySource(current, sourceId, link)).then(() => undefined),
  [commitLibraryMutation]);

  const handleDeleteLibrarySource = useCallback((sourceId: string): Promise<void> =>
    commitLibraryMutation(current => removeLibrarySource(current, sourceId)).then(() => undefined),
  [commitLibraryMutation]);

  const handleSaveTeachingProfile = useCallback((profile: TeachingProfile): Promise<void> => {
    const errors = validateTeachingProfile(profile);
    if (errors.length > 0) {
      return Promise.reject(new Error(`Profilo di programmazione non valido: ${errors.join(', ')}`));
    }

    return commitPlanningMutation(current => ({
      ...current,
      profiles: [...current.profiles.filter(existing => existing.id !== profile.id), profile]
    })).then(() => undefined);
  }, [commitPlanningMutation]);

  const handleAcceptArenaPlanningContext = useCallback((context: ArenaPlanningContextPreview): Promise<void> => {
    return commitPlanningMutation(current => {
      const profile = current.profiles.find(existing => existing.id === context.profileId);
      if (!profile) {
        throw new Error('Profilo di programmazione non più disponibile.');
      }
      const expectedSchoolOrder = profile.schoolOrder === 'primary' ? 'primaria' : 'secondaria';
      if (
        profile.schoolYear !== context.schoolYear ||
        expectedSchoolOrder !== context.schoolOrder ||
        profile.subjectCode !== context.subjectCode ||
        profile.gradeLevel !== context.gradeLevel ||
        profile.cohortRef !== context.cohortRef ||
        profile.normativeRegime !== context.regimeRef
      ) {
        throw new Error('ARENA_CONTEXT_PROFILE_CHANGED_REVIEW_REQUIRED');
      }

      return {
        ...current,
        arenaContexts: bindAcceptedArenaPlanningContext(current.arenaContexts, context, {
          accepted: true,
          acceptedAt: new Date().toISOString()
        })
      };
    }).then(() => undefined);
  }, [commitPlanningMutation]);

  const commitTestsMutation = useCallback((
    derive: (current: Record<string, OnlineTest>) => Record<string, OnlineTest>
  ): Promise<Record<string, OnlineTest>> => {
    return mutationCoordinator.enqueue<{ tests: Record<string, OnlineTest>; meta: SecureMeta }>({
      getCommitted: () => ({ tests: testsRef.current, meta: metaRef.current }),
      derive: current => ({
        tests: derive(current.tests),
        meta: incrementBackupChanges(current.meta)
      }),
      persist: candidate => secureStorage.saveCustomTestsAndMeta(candidate.tests, candidate.meta),
      publish: candidate => {
        testsRef.current = candidate.tests;
        metaRef.current = candidate.meta;
        setTests(candidate.tests);
        setMeta(candidate.meta);
      },
      afterCommit: () => toast('Test salvato')
    }).then(candidate => candidate.tests).catch(error => {
      console.error('Secure test save failed', error);
      alert(DURABLE_SAVE_FAILURE_MESSAGE);
      throw error;
    });
  }, [mutationCoordinator, secureStorage, toast]);

  const commitSubmissionsMutation = useCallback((
    derive: (current: OnlineSubmission[]) => OnlineSubmission[],
    options: { successMessage?: string; showFailureAlert?: boolean } = {}
  ): Promise<OnlineSubmission[]> => {
    const { successMessage, showFailureAlert = true } = options;
    return mutationCoordinator.enqueue<{ submissions: OnlineSubmission[]; meta: SecureMeta }>({
      getCommitted: () => ({ submissions: submissionsRef.current, meta: metaRef.current }),
      derive: current => ({
        submissions: derive(current.submissions),
        meta: incrementBackupChanges(current.meta)
      }),
      persist: candidate => secureStorage.saveSubmissionsAndMeta(candidate.submissions, candidate.meta),
      publish: candidate => {
        submissionsRef.current = candidate.submissions;
        metaRef.current = candidate.meta;
        setSubmissions(candidate.submissions);
        setMeta(candidate.meta);
      },
      afterCommit: () => {
        if (successMessage) toast(successMessage);
      }
    }).then(candidate => candidate.submissions).catch(error => {
      console.error('Secure submission save failed', error);
      if (showFailureAlert) alert(DURABLE_SAVE_FAILURE_MESSAGE);
      throw error;
    });
  }, [mutationCoordinator, secureStorage, toast]);

  // Privacy Shield (Modalità LIM: maschera i nomi degli studenti)
  const [isPrivacyShieldActive, setIsPrivacyShieldActive] = useState<boolean>(true);

  useEffect(() => {
    if (!isPrivacyShieldActive) return;
    // The privacy setting may change while the report is mounted, with the
    // originating Analytics view unmounted. Scrub BOTH snapshots immediately.
    const current = studentReportReturnContextRef.current;
    if (current?.originTab === 'analytics' && current.ui.studentSearch) {
      studentReportReturnContextRef.current = {
        ...current,
        ui: { ...current.ui, studentSearch: '' }
      };
    }
    setReturningToStudentOrigin(previous => {
      if (previous?.originTab !== 'analytics' || !previous.ui.studentSearch) return previous;
      return { ...previous, ui: { ...previous.ui, studentSearch: '' } };
    });
  }, [isPrivacyShieldActive]);

  const handleTogglePrivacyShield = useCallback(() => {
    setIsPrivacyShieldActive(prev => {
      const next = !prev;
      toast(next ? 'Privacy Shield LIM: Attivo' : 'Privacy Shield LIM: Disattivato');
      return next;
    });
  }, [toast]);

  // 7. Student Portal mode (if query param `?mode=student`)
  const [studentMode, setStudentMode] = useState<{
    isOpen: boolean;
    testId: string;
    className: string;
  }>(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      isOpen: params.get('mode') === 'student',
      testId: params.get('test') || 'energia',
      className: params.get('class') || '3ª A'
    };
  });

  // Current selected class
  const currentClass = appData.classes.find(c => c.id === appData.currentClassId);
  // Resolve again on arrival and on every render; revoked sources and changed
  // classes cannot retain a stale handoff even if history revisits this tab.
  const assessmentHandoffResolution = assessmentHandoffRequest
    ? resolveAssessmentHandoff({
        request: assessmentHandoffRequest,
        library,
        classes: appData.classes,
        activeClassId: currentClass?.id
      })
    : null;
  const activeAssessmentHandoff = assessmentHandoffResolution?.status === 'ready'
    ? assessmentHandoffResolution.handoff
    : null;

  const pendingCopilotAssessmentValid = pendingCopilotAssessment
    ? checkAssessmentEditorTransferContext(pendingCopilotAssessment.transfer,{
        session:pendingCopilotAssessment.session,
        draft:pendingCopilotAssessment.draft,
        library,
        classes:appData.classes,
        activeClassId:currentClass?.id ?? null,
        teacherConfirmedAdoption:true
      })
    : false;

  useEffect(()=>{
    if(!pendingCopilotAssessment || pendingCopilotAssessmentValid) return;
    setPendingCopilotAssessment(null);
    setAssessmentTransferNotice('La fonte o la classe è cambiata. La proposta non è stata aperta.');
  },[pendingCopilotAssessment,pendingCopilotAssessmentValid]);

  // Reclassification, source deletion and class changes revoke the old handoff.
  useEffect(() => {
    if (assessmentHandoffRequest && assessmentHandoffResolution?.status === 'unavailable') {
      setAssessmentHandoffRequest(null);
    }
  }, [assessmentHandoffRequest, assessmentHandoffResolution?.status]);

  // Separate the settings' display label from the authoritative curriculum code.
  const curricularSubjectCode = React.useMemo(
    () => resolveCurricularSubjectCode(settings.subject),
    [settings.subject]
  );
  const planningFrame = React.useMemo(() => resolvePlanningFrame({
    className: currentClass?.name ?? null,
    planning,
    schoolYear: settings.year,
    subjectCode: curricularSubjectCode
  }), [currentClass?.name, planning, settings.year, curricularSubjectCode]);
  const resolvedTeachingFocus = resolveTeachingFocusForClass({
    focus: teachingFocus,
    currentClassId: currentClass?.id ?? null,
    catalog: teachingUdaCatalog
  });
  const activeTeachingCandidate = resolvedTeachingFocus.status === 'resolved'
    ? teachingUdaCatalog.find(candidate => candidate.id === resolvedTeachingFocus.context.udaId)
    : null;
  const activeTeachingLesson = resolvedTeachingFocus.status === 'resolved'
    ? activeTeachingCandidate?.lessons.find(lesson => lesson.id === resolvedTeachingFocus.context.lessonId)
    : null;
  const isActiveRecordFocus = todayAction === 'record' && recordSession !== null && recordSession.status !== 'saved' && recordSession.context.classId === currentClass?.id;
  const conductContext = currentClass
    ? resolveConductContext({
        className: currentClass.name,
        udas,
        todayIsoDate: today()
      })
    : null;
  const activeRecordMission =
    (recordSession?.status === 'editing' || (recordSession?.status === 'saved' && recordSession.evidenceKind === 'behaviour'))
    && recordSession.context.classId === currentClass?.id
    && recordSession.evidenceKind
    && routeForRecordEvidence(recordSession.evidenceKind).tab === activeTab
      ? { ...recordSession, evidenceKind: recordSession.evidenceKind }
      : null;
  const ambientCopilotSurface =
    activeTab === 'home' ? 'home'
      : activeTab === 'dashboard' ? 'class-dashboard'
        : activeTab === 'biblioteca' ? 'library'
          : activeTab === 'uda-gantt'
            ? resolvedTeachingFocus.status === 'resolved'
              ? resolvedTeachingFocus.context.lessonId ? 'lesson' : 'uda'
              : 'other-teacher-surface'
            : activeTab === 'programmazione' ? 'planning'
              : activeTab === 'verifiche-online' ? 'online-tests'
                : activeTab === 'voti' ? 'evaluations'
                  : activeTab === 'tabellone' ? 'evaluations'
                    : 'other-teacher-surface';

  const ambientProfessionalContext = resolveProfessionalContext({
    surface: ambientCopilotSurface,
    currentClass: currentClass ? { id: currentClass.id, name: currentClass.name } : null,
    planningFrame: activeTab === 'programmazione' || activeTab === 'uda-gantt' ? planningFrame : null,
    teachingContext: (activeTab === 'programmazione' || activeTab === 'uda-gantt')
      && resolvedTeachingFocus.status === 'resolved'
      ? resolvedTeachingFocus.context
      : null,
    privacyScope:
      activeTab === 'voti'
      || activeTab === 'consigli'
      || activeTab === 'tabellone'
      || activeTab === 'analytics'
      || activeTab === 'storico'
      || activeTab === 'report'
      || activeTab === 'comportamenti'
      || activeTab === 'dati'
        ? 'STUDENT_PERSONAL_PRESENT'
        : 'TEACHER_PROFESSIONAL'
  });

  const ambientCopilotProjection = ambientProfessionalContext.status === 'resolved'
    ? toCopilotContextProjection(ambientProfessionalContext.context)
    : toCopilotContextProjection({
        schema: 'registro.professional-context/v1',
        surface: ambientCopilotSurface,
        time: { kind: 'unspecified' },
        privacyScope: 'TEACHER_PROFESSIONAL'
      });

  const ambientCopilotContext: CopilotLaunchContext = ambientCopilotProjection;

  // Synchronize URL query params
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const requestedClassId = typeof e.state?.classId === 'string' ? e.state.classId : null;
      // An old/deleted/foreign class in browser history must never select a class implicitly.
      const nextCurrentClassId = appDataRef.current.classes.some(c => c.id === requestedClassId)
        ? requestedClassId
        : null;
      const nextTab: ActiveTab = e.state?.tab || (nextCurrentClassId ? 'dashboard' : 'home');
      // INT-01 guards only the dirty planning editor; NAV-S1 popstate remains
      // the sole authority for student report, evaluation and Tabellone returns.
      traceHpr('evento-cronologia-browser', nextTab);
      const targetPosition = Number.isSafeInteger(e.state?.__tramaHistoryPosition)
        ? e.state.__tramaHistoryPosition as number : null;
      const targetEpoch = typeof e.state?.__tramaHistoryEpoch === 'string'
        && e.state.__tramaHistoryEpoch.length > 0
        ? e.state.__tramaHistoryEpoch as string : null;
      const browserIndex = readBrowserHistoryIndex();
      const targetEntryId = typeof e.state?.__tramaHistoryEntryId === 'string'
        && e.state.__tramaHistoryEntryId.length > 0
        ? e.state.__tramaHistoryEntryId as string : null;
      const navigate = () => {
        const currentEntryId = targetEntryId ?? crypto.randomUUID();
        if (!targetEntryId) {
          history.replaceState({
            ...(e.state && typeof e.state === 'object' ? e.state : {}),
            __tramaHistoryEntryId: currentEntryId
          }, '', window.location.href);
        }
        historyPositionRef.current = targetPosition;
        historyEpochRef.current = targetPosition !== null ? targetEpoch : null;
        historyEntryIdRef.current = currentEntryId;
        browserHistoryIndexRef.current = browserIndex;
        historyUrlRef.current = window.location.href;
        // Browser-approved traversal bypasses only the planning-draft prompt,
        // never its class/record authorization or specialist navigation guards.
        planningExitBypassRef.current = true;
        try {

      // Cancelled evaluation editors use their own serialized Back traversal.
      // Resolve it before allowing another explicit destination to be pushed.
      const pendingEvaluationCancel = pendingEvaluationCancelRef.current;
      if (pendingEvaluationCancel) pendingEvaluationCancelRef.current = null;
      const queuedEvaluationDestination = pendingEvaluationCancel
        && nextCurrentClassId === pendingEvaluationCancel.classId && nextTab === 'storico'
          ? pendingEvaluationCancel.proceed : null;

      const pendingExit = pendingMobileMatrixExitRef.current;
      if (pendingExit) {
        pendingMobileMatrixExitRef.current = null;
        // Only the expected collapsed row destination may complete this action.
        if (nextCurrentClassId === pendingExit.classId && nextTab === 'tabellone') {
          pendingExit.proceed();
          return;
        }
      }

      // A Back/Forward within one mobile Tabellone is a disclosure toggle,
      // not a professional navigation. Do not terminate Rivedi/record sessions.
      // MatrixView listens to this same event to close/reopen a valid row.
      if (!pendingEvaluationCancel
        && nextCurrentClassId === currentClassIdRef.current
        && nextTab === activeTabRef.current
        && nextTab !== 'report' && nextTab !== 'voti') {
        return;
      }

      const restoredStudentId = restoreStudentReportFromHistory(
        e.state,
        nextCurrentClassId,
        appDataRef.current.classes
      );
      const savedEvaluation = recallSpecialistTarget(
        evaluationTargetMemoryRef.current, e.state?.[SPECIALIST_TARGET_HISTORY_KEY],
        nextCurrentClassId, nextTab
      );
      const selectedClass = appDataRef.current.classes.find(candidate => candidate.id === nextCurrentClassId);
      const restoredBatch = savedEvaluation?.kind === 'evaluation'
        && selectedClass?.grades.some(grade => grade.batchId === savedEvaluation.batchId)
          ? savedEvaluation.batchId : null;
      if (savedEvaluation?.kind === 'evaluation' && !restoredBatch) {
        forgetSpecialistTarget(
          evaluationTargetMemoryRef.current, e.state?.[SPECIALIST_TARGET_HISTORY_KEY],
          nextCurrentClassId, nextTab
        );
      }
      acceptMatrixEvaluationMode(nextTab==='voti'&&e.state?.returnTab==='tabellone'&&e.state?.classId===nextCurrentClassId&&!restoredBatch);
      setEditingBatchId(nextTab === 'voti' ? restoredBatch : null);
      currentClassIdRef.current = nextCurrentClassId;
      setAppData(prev => ({ ...prev, currentClassId: nextCurrentClassId }));
      setSelectedStudentForReport(restoredStudentId);
      setTodayAction(null);
      publishReviewSession(null);
      publishRecordSession(null);
      // Never open a student report from stale or cross-class history state.
      const effectiveTab = nextTab === 'report' && !restoredStudentId
        ? (nextCurrentClassId ? 'dashboard' : 'home')
        : nextTab;
      const returningContext = resolveStudentReportReturnContext(
        studentReportReturnContextRef.current,
        nextCurrentClassId,
        effectiveTab,
        appDataRef.current.classes
      );
      // Forward back into a report keeps the context available for another Back.
      // Unrelated navigation permanently invalidates the temporary snapshot.
      if (effectiveTab !== 'report' && !returningContext) {
        studentReportReturnContextRef.current = null;
      }
      setReturningToStudentOrigin(returningContext);
      setActiveTab(effectiveTab, { preserveStudentReturnContext: true });
      // Execute only after restoring the legitimate underlying history entry.
      // A class mismatch discards the queued destination rather than guessing.
      queuedEvaluationDestination?.();
        } finally {
          planningExitBypassRef.current = false;
        }
      };

      const openUnverifiableDeparture = () => {
        // No history index and no common marker epoch: guessing Back/Forward
        // could leave the editor under another class's URL or hang forever.
        historyRestorePendingRef.current = null;
        setHistoryRestoringOrigin(false);
        if (!historyFallbackRef.current) {
          historyFallbackRef.current = {
            originUrl: historyUrlRef.current,
            classId: currentClassIdRef.current
          };
          setHistoryFallbackWarning(true);
          // If a navigation button already opened the modal, it has already
          // registered a pending action. Recovery must replace that action
          // with the browser's *actual* destination, not refuse the update.
          if (pendingExitRef.current) {
            pendingExitRef.current = navigate;
            setPlanningExitDestination(nextTab);
            setPlanningExitFromBrowser(true);
            traceHpr('sostituzione-da-cronologia', nextTab);
          } else {
            requestPlanningDeparture(navigate, nextTab);
          }
        } else {
          // Browser controls may still navigate while a modal is open: the
          // confirmation must always apply to the *actual* current entry.
          pendingExitRef.current = navigate;
          setPlanningExitDestination(nextTab);
          setPlanningExitFromBrowser(true);
          traceHpr('sostituzione-da-cronologia', nextTab);
        }
      };

      if (historyFallbackRef.current) {
        pendingExitRef.current = navigate;
        setPlanningExitDestination(nextTab);
        setPlanningExitFromBrowser(true);
        traceHpr('sostituzione-da-cronologia', nextTab);
        return;
      }
      const restoring = historyRestorePendingRef.current;
      if (restoring) {
        const originVerified =
          (browserIndex !== null && restoring.originBrowserIndex !== null
            && browserIndex === restoring.originBrowserIndex)
          || (targetEntryId !== null && targetEntryId === restoring.originEntryId);
        if (originVerified && window.location.href === restoring.originUrl) {
          historyRestorePendingRef.current = null;
          setHistoryRestoringOrigin(false);
          browserHistoryIndexRef.current = browserIndex;
          // A browser traversal supersedes an earlier «Apri UDA» click
          // whose confirmation is still open. Replace the stale callback
          // only after verifying the exact history origin and URL.
          const replayVerifiedTraversal = () => {
            historyApprovedTraversalRef.current = restoring.delta;
            history.go(restoring.delta);
          };
          if (pendingExitRef.current) {
            pendingExitRef.current = replayVerifiedTraversal;
            setPlanningExitDestination(restoring.destinationTab);
            setPlanningExitFromBrowser(true);
            traceHpr('sostituzione-da-cronologia', restoring.destinationTab);
          } else {
            requestPlanningDeparture(replayVerifiedTraversal, restoring.destinationTab);
          }
          return;
        }
        // Do not scan blindly toward an unverified origin.
        openUnverifiableDeparture();
        return;
      }

      if (historyApprovedTraversalRef.current !== null) {
        historyApprovedTraversalRef.current = null;
        planningExitBypassRef.current = true;
        try { navigate(); } finally { planningExitBypassRef.current = false; }
        return;
      }

      const currentPosition = historyPositionRef.current;
      if (hasUnsavedActiveDraft()) {
        const absoluteDelta = browserIndex !== null && browserHistoryIndexRef.current !== null
          ? browserIndex - browserHistoryIndexRef.current : null;
        const markedDelta = targetPosition !== null && currentPosition !== null
          && targetEpoch !== null && targetEpoch === historyEpochRef.current
          ? targetPosition - currentPosition : null;
        const delta = absoluteDelta
          ?? (targetEntryId === historyEntryIdRef.current ? 0 : markedDelta);

        if (delta === null) {
          openUnverifiableDeparture();
          return;
        }
        if (delta !== 0) {
          historyRestorePendingRef.current = {
            delta,
            originPosition: currentPosition,
            originEntryId: historyEntryIdRef.current ?? '',
            originBrowserIndex: browserHistoryIndexRef.current,
            originUrl: historyUrlRef.current,
            destinationTab: nextTab
          };
          setHistoryRestoringOrigin(true);
          history.go(-delta);
          return;
        }
        if (window.location.href !== historyUrlRef.current) {
          // Never overwrite a foreign browser entry just because numeric
          // positions happen to collide. Leave the dirty editor untouched.
          if (targetEntryId !== historyEntryIdRef.current) {
            openUnverifiableDeparture();
            return;
          }
          history.replaceState(
            { ...(history.state && typeof history.state === 'object' ? history.state : {}),
              ...(currentPosition !== null ? { __tramaHistoryPosition: currentPosition } : {}),
              ...(historyEpochRef.current !== null ? { __tramaHistoryEpoch: historyEpochRef.current } : {}),
              __tramaHistoryEntryId: historyEntryIdRef.current },
            '',
            historyUrlRef.current
          );
          return;
        }
      }
      navigate();

    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [hasUnsavedActiveDraft, publishRecordSession, publishReviewSession, requestPlanningDeparture, setActiveTab, traceHpr]);

  const handleOpenPreparationCopilot = useCallback(() => {
    const launchContext = buildPreparationCopilotLaunchContext(currentClass);
    if (!launchContext) return;
    openLibraryCopilot(launchContext);
  }, [currentClass, openLibraryCopilot]);

  const handleOpenConductCopilot = useCallback(() => {
    if (!conductContext) return;
    const launchContext: CopilotLaunchContext = {
      surface: 'class-dashboard',
      className: conductContext.className,
      intent: 'conduct',
      ...(conductContext.status === 'resolved'
        ? {
            udaId: conductContext.udaId,
            ...(conductContext.lessonId ? { lessonId: conductContext.lessonId } : {})
          }
        : {})
    };
    openLibraryCopilot(launchContext);
  }, [conductContext, openLibraryCopilot]);

  const handleContinueFromConductToRecord = useCallback((stagedNote?: string) => {
    const selectedClass = appDataRef.current.classes.find(
      candidate => candidate.id === currentClassIdRef.current
    );
    if (!selectedClass) return;

    const session = buildRecordSession({
      classId: selectedClass.id,
      className: selectedClass.name,
      conductContext,
      stagedNote
    });
    publishRecordSession(session);
    setTodayAction('record');
  }, [conductContext, publishRecordSession]);

  const completeRecordFlow = useCallback((
    kind: RecordEvidenceKind,
    navigationVersionAtSave: number,
    originatingSession: RecordSessionDraft | null,
    originatingClassId: string
  ): boolean => {
    const session = recordSessionRef.current;
    if (!originatingSession
      || !session
      || session !== originatingSession
      || session.status !== 'editing'
      || session.evidenceKind !== kind
      || session.context.classId !== originatingClassId
      || currentClassIdRef.current !== originatingClassId
      || navigationVersionRef.current !== navigationVersionAtSave) {
      return false;
    }

    publishRecordSession(markRecordSessionSaved(session));
    setTodayAction('record');
    // A committed observation must complete its session even when a departure
    // decision is open. Only the automatic navigation is deferred.
    if (kind === 'behaviour' && (pendingExitRef.current || historyRestorePendingRef.current || historyFallbackRef.current)) return true;
    setActiveTab('dashboard');
    return true;
  }, [publishRecordSession, setActiveTab]);

  const handleChooseRecordEvidence = useCallback((kind: RecordEvidenceKind) => {
    const session = recordSessionRef.current;
    if (!session || session.context.classId !== currentClassIdRef.current) return;

    const editingSession = setRecordEvidenceKind(session, kind);
    publishRecordSession(editingSession);
    const route = routeForRecordEvidence(kind);
    setTodayAction('record');
    setActiveTab(route.tab);
    recordSpecialistNavigationVersionRef.current = navigationVersionRef.current;

    try {
      const classId = currentClassIdRef.current;
      const params = new URLSearchParams();
      if (classId) params.set('class', classId);
      params.set('tab', route.tab);
      history.pushState({ classId, tab: route.tab }, '', withHprTraceQuery(`?${params.toString()}`));
      markHistoryPush();
    } catch (e) {}
  }, [publishRecordSession, setActiveTab]);

  const handleRecordLessonCommitted = useCallback((udaId: string, navigationVersionAtSave: number) => {
    const session = recordSessionRef.current;
    if (
      !session ||
      session.status !== 'editing' ||
      session.evidenceKind !== 'lesson-log' ||
      session.context.classId !== currentClassIdRef.current ||
      (session.context.udaId && session.context.udaId !== udaId)
    ) {
      return;
    }

    const completed = completeRecordFlow('lesson-log', navigationVersionAtSave, session, session.context.classId);
    if (completed) {
      recordSpecialistNavigationVersionRef.current = null;
    }
  }, [completeRecordFlow]);

  const handleReturnToRecord = useCallback(() => {
    const session = recordSessionRef.current;
    if (!session || (session.status !== 'editing' && !(session.status === 'saved' && session.evidenceKind === 'behaviour')) || session.context.classId !== currentClassIdRef.current) return;
    recordSpecialistNavigationVersionRef.current = null;
    setTodayAction('record');
    setActiveTab('dashboard');
  }, [setActiveTab]);

  const handleUpdateRecordStagedNote = useCallback((note: string) => {
    const session = recordSessionRef.current;
    if (!session || session.context.classId !== currentClassIdRef.current) return;
    publishRecordSession(updateRecordStagedNote(session, note));
  }, [publishRecordSession]);

  const handleRecordAnother = useCallback(() => {
    const session = recordSessionRef.current;
    if (!session || session.context.classId !== currentClassIdRef.current) return;
    publishRecordSession({ context: session.context, status: 'choose' });
    setTodayAction('record');
    setActiveTab('dashboard');
  }, [publishRecordSession, setActiveTab]);

  const handleContinueRecordToReview = useCallback(() => {
    const session = recordSessionRef.current;
    if (!session || session.context.classId !== currentClassIdRef.current) return;
    publishReviewSession(buildReviewSession({
      classId: session.context.classId,
      className: session.context.className,
      origin: 'post-record',
      evidenceKind: session.evidenceKind ?? null
    }));
    publishRecordSession(null);
    setTodayAction('review');
    setActiveTab('dashboard');
  }, [publishRecordSession, publishReviewSession, setActiveTab]);

  const handleStartTodayAction = useCallback((action: TodayAction) => {
    publishReviewSession(null);
    const decision = resolveTodayRoute(action, currentClassIdRef.current);
    if (action !== 'record') publishRecordSession(null);
    setTodayAction(action);
    if (decision.status === 'needs-class') {
      publishRecordSession(null);
      setActiveTab('home');
      return;
    }

    const selectedClass = appDataRef.current.classes.find(candidate => candidate.id === decision.classId);
    if (!selectedClass) {
      publishRecordSession(null);
      publishReviewSession(null);
      setTodayAction(null);
      return;
    }

    if (action === 'record') {
      publishRecordSession(buildRecordSession({
        classId: selectedClass.id,
        className: selectedClass.name
      }));
    }
    if (action === 'review') {
      publishReviewSession(buildReviewSession({
        classId: selectedClass.id,
        className: selectedClass.name,
        origin: 'today-review'
      }));
    }
    handleNavigateTab(decision.target, { preserveRecordSession: action === 'record' });
  }, [handleNavigateTab, publishRecordSession, publishReviewSession, setActiveTab]);

  const handleOpenReviewSurface = useCallback((tab: ActiveTab) => {
    const session = keepReviewSessionForClass(
      reviewSessionRef.current,
      currentClassIdRef.current
    );
    if (!session || !isReviewSurface(tab)) return;
    publishReviewSession(enterReviewSurface(session, tab));
    setTodayAction('review');
    handleNavigateTab(tab);
  }, [handleNavigateTab, publishReviewSession]);

  const handleReturnToReview = useCallback(() => {
    const session = keepReviewSessionForClass(
      reviewSessionRef.current,
      currentClassIdRef.current
    );
    if (!session) {
      publishReviewSession(null);
      setTodayAction(null);
      return;
    }
    publishReviewSession(returnToReviewRouter(session));
    setTodayAction('review');
    handleNavigateTab('dashboard');
  }, [handleNavigateTab, publishReviewSession]);

  const handleCloseReview = useCallback(() => {
    publishReviewSession(null);
    setTodayAction(null);
  }, [publishReviewSession]);

  const handleContinueToday = useCallback((tab: ActiveTab) => {
    const activeReviewSession = keepReviewSessionForClass(
      reviewSessionRef.current,
      currentClassIdRef.current
    );
    if (activeReviewSession && isReviewSurface(tab)) {
      handleOpenReviewSurface(tab);
      return;
    }
    setTodayAction(null);
    publishReviewSession(null);
    publishRecordSession(null);
    handleNavigateTab(tab);
  }, [handleNavigateTab, handleOpenReviewSurface, publishRecordSession, publishReviewSession]);

  const handleCancelTodayAction = useCallback(() => {
    setTodayAction(null);
    publishReviewSession(null);
    publishRecordSession(null);
  }, [publishRecordSession, publishReviewSession]);

  // Handle Class selection
  const handleSelectClass = (classId: string) => {
    if (!planningExitBypassRef.current && hasUnsavedActiveDraft()) {
      requestPlanningDeparture(() => handleSelectClass(classId), 'dashboard');
      return;
    }
    if (pendingEvaluationCancelRef.current) {
      pendingEvaluationCancelRef.current.proceed = () => handleSelectClass(classId);
      return;
    }
    if (queueMobileMatrixExit(() => handleSelectClass(classId))) return;
    studentReportReturnContextRef.current = null;
    setReturningToStudentOrigin(null);
    const shouldStartPendingReview =
      todayAction === 'review'
      && currentClassIdRef.current === null
      && reviewSessionRef.current === null;
    publishReviewSession(null);
    setTeachingFocus(null);
    currentClassIdRef.current = classId;
    setAppData(prev => ({ ...prev, currentClassId: classId }));
    const selectedClass = appDataRef.current.classes.find(candidate => candidate.id === classId);
    publishRecordSession(
      todayAction === 'record' && selectedClass
        ? buildRecordSession({ classId: selectedClass.id, className: selectedClass.name })
        : null
    );
    if (shouldStartPendingReview && selectedClass) {
      publishReviewSession(buildReviewSession({
        classId: selectedClass.id,
        className: selectedClass.name,
        origin: 'today-review'
      }));
    } else if (todayAction === 'review') {
      setTodayAction(null);
    }
    setActiveTab('dashboard');
    setEditingBatchId(null);
    setSelectedStudentForReport(null);
    try {
      history.pushState({ classId, tab: 'dashboard' }, '', withHprTraceQuery(`?class=${classId}`));
      markHistoryPush();
    } catch (e) {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateHome = () => {
    if (!planningExitBypassRef.current && hasUnsavedActiveDraft()) {
      requestPlanningDeparture(handleNavigateHome, 'home');
      return;
    }
    if (pendingEvaluationCancelRef.current) {
      pendingEvaluationCancelRef.current.proceed = handleNavigateHome;
      return;
    }
    if (queueMobileMatrixExit(handleNavigateHome)) return;
    studentReportReturnContextRef.current = null;
    setReturningToStudentOrigin(null);
    setTodayAction(null);
    publishReviewSession(null);
    publishRecordSession(null);
    currentClassIdRef.current = null;
    setAppData(prev => ({ ...prev, currentClassId: null }));
    setActiveTab('home');
    setEditingBatchId(null);
    setSelectedStudentForReport(null);
    try {
      history.pushState(null, '', withHprTraceQuery(window.location.pathname));
      markHistoryPush();
    } catch (e) {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Add new class
  const handleAddClass = (): Promise<void> => {
    const name = prompt('Inserisci la denominazione della nuova classe (es. 2ª B):');
    if (!name || !name.trim()) return Promise.resolve();

    const newClass: ClassData = {
      id: uid(),
      name: sanitizeName(name),
      students: [],
      grades: [],
      behaviors: []
    };
    const navigationVersionAtSave = navigationVersionRef.current;

    return commitAppDataMutation(current => ({
      ...current,
      classes: [...current.classes, newClass],
      currentClassId: newClass.id
    }), {
      successMessage: 'Classe creata',
      afterCommit: () => {
        if (navigationVersionRef.current === navigationVersionAtSave) {
          currentClassIdRef.current = newClass.id;
          setAppData(prev => ({ ...prev, currentClassId: newClass.id }));
          setActiveTab('dati');
        }
      }
    }).then(() => undefined);
  };

  // Delete class
  const handleDeleteClass = (classId: string): Promise<void> => {
    return commitAppDataMutation(current => ({
      ...current,
      classes: current.classes.filter(c => c.id !== classId),
      currentClassId: current.currentClassId === classId ? null : current.currentClassId
    }), {
      showBackupModal: false,
      successMessage: 'Classe eliminata'
    }).then(() => undefined);
  };

  // Save evaluations batch (add new or update existing)
  const handleSaveEvaluations = (batchData: {
    batchId: string;
    period: 'Q1' | 'Q2';
    type: EvaluationType;
    date: string;
    title: string;
    udaId?: string;
    grades: { studentId: string; value: string; delayed: boolean }[];
  }): Promise<void> => {
    const classId = currentClass?.id;
    if (!classId) return Promise.resolve();
    const navigationVersionAtSave = navigationVersionRef.current;
    const recordSessionAtSave = recordSessionRef.current;

    const newGrades: Grade[] = batchData.grades.map(st => ({
      id: uid(),
      batchId: batchData.batchId,
      studentId: st.studentId,
      date: batchData.date,
      type: batchData.type,
      period: batchData.period,
      title: batchData.title,
      value: st.value,
      delayed: st.delayed,
      udaId: batchData.udaId
    }));

    return commitAppDataMutation(current => {
      const targetClass = current.classes.find(c => c.id === classId);
      if (!targetClass) throw new Error('Classe non più disponibile.');
      const remainingGrades = (targetClass.grades || []).filter(g => g.batchId !== batchData.batchId);
      const updatedClass: ClassData = {
        ...targetClass,
        grades: [...remainingGrades, ...newGrades]
      };
      return {
        ...current,
        classes: current.classes.map(c => (c.id === classId ? updatedClass : c))
      };
    }, {
      afterCommit: () => {
        const recordCompleted = completeRecordFlow('evaluation', navigationVersionAtSave, recordSessionAtSave, classId);
        setEditingBatchId(null);
        if (!recordCompleted && navigationVersionRef.current === navigationVersionAtSave) {
          if (currentClassIdRef.current === classId) {
            handleNavigateTab('storico', { navigationMode: 'replace', evaluationBatchId: null });
          }
        }
      }
    }).then(() => undefined);
  };

  // VAL-01/S4a: one explicit cell confirmation, no export or navigation.
  const requestDailyContextChange=(action:()=>void)=>{
    if(evaluationSavePendingRef.current)return;
    if(hasUnsavedActiveDraft()&&!planningExitBypassRef.current){requestPlanningDeparture(action,'tabellone');return;}
    action();
  };
  const switchDailyMatrixMode=(daily:boolean)=>{
    if(daily===dailyMatrixModeRef.current)return;
    requestDailyContextChange(()=>{
      if(daily&&queueMobileMatrixExit(()=>acceptDailyMatrixMode(true)))return;
      acceptDailyMatrixMode(daily);
    });
  };
  const handleDailyGrade=async(request:DailyGradeWrite):Promise<Grade>=>{
    const classId=currentClassIdRef.current;
    if(!classId||activeTabRef.current!=='tabellone'||!dailyMatrixModeRef.current||evaluationSavePendingRef.current)throw Error('Contesto giornata non disponibile.');
    evaluationSavePendingRef.current=true;setEvaluationSavePending(true);
    try{
      const result=await commitAppDataMutation(current=>applyDailyGrade(current,classId,request,udasRef.current,crypto.randomUUID()),{showBackupModal:false,successMessage:'',inlineFailure:true});
      const grade=result.classes.find(c=>c.id===classId)?.grades.find(g=>g.batchId===request.proof.batchId&&g.studentId===request.studentId);
      if(!grade)throw Error('Ricevuta non disponibile.');return grade;
    }finally{evaluationSavePendingRef.current=false;setEvaluationSavePending(false);}
  };
  const handleDailyObservation=async(request:DailyObservationWrite):Promise<BehaviorRecord>=>{
    const classId=currentClassIdRef.current;
    if(!classId||activeTabRef.current!=='tabellone'||!dailyMatrixModeRef.current||evaluationSavePendingRef.current)throw Error('Contesto giornata non disponibile.');
    evaluationSavePendingRef.current=true;setEvaluationSavePending(true);
    try{
      const result=await commitAppDataMutation(current=>applyDailyObservation(current,classId,request,crypto.randomUUID()),{showBackupModal:false,successMessage:'',inlineFailure:true});
      const record=result.classes.find(c=>c.id===classId)?.behaviors.filter(b=>b.date===request.date&&b.studentId===request.studentId).at(-1);
      if(!record)throw Error('Ricevuta non disponibile.');return record;
    }finally{evaluationSavePendingRef.current=false;setEvaluationSavePending(false);}
  };
  const handleSaveMatrixCell = async (request:MatrixCellWrite):Promise<Grade> => {
    const classId=currentClassIdRef.current;
    if(!classId||!matrixEvaluationModeRef.current||activeTabRef.current!=='voti'||evaluationSavePendingRef.current)throw Error('Contesto valutazione non disponibile.');
    evaluationSavePendingRef.current=true;setEvaluationSavePending(true);
    try{
      const result=await commitAppDataMutation(current=>applyMatrixCell(current,classId,request,udasRef.current,crypto.randomUUID()),{showBackupModal:false,successMessage:'',inlineFailure:true});
      const grade=result.classes.find(c=>c.id===classId)?.grades.find(g=>g.batchId===request.proof.batchId&&g.studentId===request.studentId);
      if(!grade)throw Error('Ricevuta della valutazione non disponibile.');
      return grade;
    }finally{evaluationSavePendingRef.current=false;setEvaluationSavePending(false);}
  };

  // Save behavior notes
  const handleSaveBehaviors = async (newRecords: BehaviorRecord[]): Promise<void> => {
    const classId = currentClass?.id;
    if (!classId || currentClassIdRef.current !== classId || activeTabRef.current !== 'comportamenti'
      || behaviorSavePendingRef.current || !newRecords.length) throw new Error('Contesto osservazioni non disponibile.');
    const navigationVersionAtSave = navigationVersionRef.current;
    const recordSessionAtSave = recordSessionRef.current;
    const originGuard = behaviorDraftGuardRef.current;
    behaviorSavePendingRef.current = true;
    setBehaviorSavePending(true);
    try {
      await commitAppDataMutation(current => {
        const targetClass = current.classes.find(c => c.id === classId);
        if (!targetClass) throw new Error('Classe non più disponibile.');
        const updatedClass = applyObservationChanges(targetClass, newRecords);
        return {
          ...current,
          classes: current.classes.map(c => (c.id === classId ? updatedClass : c))
        };
      }, {
        afterCommit: () => {
          // The successful durable commit is the only authority for clearing
          // a draft. Never navigate through a pending departure decision.
          originGuard?.markCommitted();
          behaviorSavePendingRef.current = false;
          const recordCompleted = completeRecordFlow('behaviour', navigationVersionAtSave, recordSessionAtSave, classId);
          if (pendingExitRef.current || historyRestorePendingRef.current || historyFallbackRef.current) return;
          if (!recordCompleted && navigationVersionRef.current === navigationVersionAtSave) {
            setActiveTab('dashboard');
          }
        }
      });
    } finally {
      behaviorSavePendingRef.current = false;
      setBehaviorSavePending(false);
    }
  };

  // Edit batch: create a navigable history entry associated with the authorized class.
  const handleEditBatch = (batchId: string) => {
    if(matrixEvaluationModeRef.current && !planningExitBypassRef.current && hasUnsavedActiveDraft()){
      requestPlanningDeparture(()=>handleEditBatch(batchId),'voti');return;
    }
    if (pendingEvaluationCancelRef.current) {
      // Defer BOTH the selected batch and the history transition. Merely
      // queuing handleNavigateTab would let popstate reset editingBatchId.
      pendingEvaluationCancelRef.current.proceed = () => handleEditBatch(batchId);
      return;
    }
    const classId = currentClassIdRef.current;
    const selectedClass = appDataRef.current.classes.find(candidate => candidate.id === classId);
    if (!selectedClass?.grades.some(grade => grade.batchId === batchId)) return;
    setEditingBatchId(batchId);
    const fromStorico = window.history.state?.classId === classId
      && window.history.state?.tab === 'storico';
    handleNavigateTab('voti', {
      evaluationBatchId: batchId,
      ...(fromStorico ? { returnTab: 'storico' } : {})
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Annulla Modifica: never write, and never leave an orphaned new-evaluation editor.
  const handleCancelEvaluationEdit = () => {
    const classId = currentClassIdRef.current;
    if(matrixEvaluationModeRef.current){handleNavigateTab('tabellone',{navigationMode:'replace',evaluationBatchId:null});return;}
    const entry = window.history.state;
    forgetSpecialistTarget(
      evaluationTargetMemoryRef.current,
      entry?.[SPECIALIST_TARGET_HISTORY_KEY], classId, 'voti'
    );
    setEditingBatchId(null);
    if (classId && entry?.classId === classId && entry?.tab === 'voti'
      && entry?.returnTab === 'storico' && window.history.length > 1) {
      try {
        const query = new URLSearchParams({ class: classId, tab: 'storico' });
        history.replaceState({ classId, tab: 'storico' }, '', `?${query.toString()}`);
        pendingEvaluationCancelRef.current = { classId, proceed: null };
        setActiveTab('storico');
        history.back();
        return;
      } catch {
        pendingEvaluationCancelRef.current = null;
        // Fallback to an explicit safe replacement.
      }
    }
    if (classId) handleNavigateTab('storico', { navigationMode: 'replace', evaluationBatchId: null });
  };

  // Delete batch
  const handleDeleteBatch = (batchId: string): Promise<void> => {
    const classId = currentClass?.id;
    if (!classId) return Promise.resolve();

    return commitAppDataMutation(current => {
      const targetClass = current.classes.find(c => c.id === classId);
      if (!targetClass) throw new Error('Classe non più disponibile.');
      const updatedClass: ClassData = {
        ...targetClass,
        grades: (targetClass.grades || []).filter(g => g.batchId !== batchId)
      };
      return {
        ...current,
        classes: current.classes.map(c => (c.id === classId ? updatedClass : c))
      };
    }, {
      showBackupModal: false,
      successMessage: 'Valutazione eliminata'
    }).then(() => undefined);
  };

  // Add single student
  const handleAddStudent = (name: string): Promise<void> => {
    const classId = currentClass?.id;
    if (!classId) return Promise.resolve();
    const newStudent: Student = { id: uid(), name };

    return commitAppDataMutation(current => {
      const targetClass = current.classes.find(c => c.id === classId);
      if (!targetClass) throw new Error('Classe non più disponibile.');
      const updatedClass: ClassData = {
        ...targetClass,
        students: sortStudents([...targetClass.students, newStudent])
      };
      return {
        ...current,
        classes: current.classes.map(c => (c.id === classId ? updatedClass : c))
      };
    }, {
      showBackupModal: false,
      successMessage: 'Alunno inserito'
    }).then(() => undefined);
  };

  // Remove single student
  const handleRemoveStudent = (studentId: string): Promise<void> => {
    const classId = currentClass?.id;
    if (!classId) return Promise.resolve();

    return commitAppDataMutation(current => {
      const targetClass = current.classes.find(c => c.id === classId);
      if (!targetClass) throw new Error('Classe non più disponibile.');
      const updatedClass: ClassData = {
        ...targetClass,
        students: targetClass.students.filter(s => s.id !== studentId),
        grades: (targetClass.grades || []).filter(g => g.studentId !== studentId),
        behaviors: (targetClass.behaviors || []).filter(b => b.studentId !== studentId),
        // Keep Council backup references consistent after an explicit pupil deletion.
        councilAssessments: (targetClass.councilAssessments || [])
          .filter(entry => entry.studentId !== studentId)
      };
      return {
        ...current,
        classes: current.classes.map(c => (c.id === classId ? updatedClass : c))
      };
    }, {
      showBackupModal: false,
      successMessage: 'Alunno rimosso'
    }).then(() => undefined);
  };

  // Bulk add students from Excel
  const handleBulkAddStudents = (newStudents: Student[]): Promise<number> => {
    const classId = currentClass?.id;
    if (!classId) return Promise.resolve(0);
    let addedCount = 0;

    return commitAppDataMutation(current => {
      const targetClass = current.classes.find(c => c.id === classId);
      if (!targetClass) throw new Error('Classe non più disponibile.');
      const existingNames = new Set(targetClass.students.map(student => student.name.toLowerCase()));
      const appendableStudents = newStudents.filter(student => {
        const normalizedName = student.name.toLowerCase();
        if (existingNames.has(normalizedName)) return false;
        existingNames.add(normalizedName);
        return true;
      });
      addedCount = appendableStudents.length;
      const updatedClass: ClassData = {
        ...targetClass,
        students: sortStudents([...targetClass.students, ...appendableStudents])
      };
      return {
        ...current,
        classes: current.classes.map(c => (c.id === classId ? updatedClass : c))
      };
    }, {
      successMessage: ''
    }).then(() => addedCount);
  };

  // Invert student names (Cognome Nome <-> Nome Cognome)
  const handleInvertNames = (): Promise<void> => {
    const classId = currentClass?.id;
    if (!classId) return Promise.resolve();

    return commitAppDataMutation(current => {
      const targetClass = current.classes.find(c => c.id === classId);
      if (!targetClass) throw new Error('Classe non più disponibile.');
      const inverted = targetClass.students.map(s => {
        const parts = s.name.split(/\s+/);
        if (parts.length > 1) {
          return {
            ...s,
            name: `${parts.pop()} ${parts.join(' ')}`
          };
        }
        return s;
      });
      const updatedClass: ClassData = {
        ...targetClass,
        students: sortStudents(inverted)
      };
      return {
        ...current,
        classes: current.classes.map(c => (c.id === classId ? updatedClass : c))
      };
    }, {
      showBackupModal: false,
      successMessage: 'Nomi invertiti'
    }).then(() => undefined);
  };

  // Save new test
  const handleSaveNewTest = (newTest: OnlineTest): Promise<void> => {
    // Recheck at the durable mutation boundary: a stale/foreign UDA cannot
    // be linked even if a UI selector or active class changed since rendering.
    if (newTest.udaId) {
      const activeClass = appDataRef.current.classes.find(item =>
        item.id === currentClassIdRef.current
      );
      if (!activeClass || !isAssessmentUdaSelectionAllowed(
        newTest.udaId, udasRef.current, activeClass.name,
        appDataRef.current.classes.map(item => item.name)
      )) {
        return Promise.reject(new Error('UDA non appartenente alla classe attiva'));
      }
    }
    return commitTestsMutation(current => {
      // Validate the teacher's explicit source choice inside the serialized
      // durable mutation, against the current committed library and class.
      const verified = prepareAssessmentTestForCommit({
        nextTest: newTest,
        previousTest: current[newTest.id],
        request: assessmentHandoffRequest,
        library: libraryRef.current,
        classes: appDataRef.current.classes,
        activeClassId: currentClassIdRef.current
      });
      return { ...current, [verified.id]: verified };
    }).then(() => undefined);
  };

  // Delete submission
  const handleDeleteSubmission = (submissionId: string): Promise<void> => {
    return commitSubmissionsMutation(
      current => current.filter(s => s.id !== submissionId),
      { successMessage: 'Consegna eliminata' }
    ).then(() => undefined);
  };

  const handleSaveStudentSubmission = useCallback(async (submission: OnlineSubmission) => {
    await commitSubmissionsMutation(
      current => [...current, submission],
      {
        successMessage: 'Consegna salvata nel vault locale',
        showFailureAlert: false
      }
    );
  }, [commitSubmissionsMutation]);

  // Import submissions into class grades (IMPORT-01)
  const handlePreviewSubmissionImport = (selection: SubmissionImportSelection): SubmissionImportPreview =>
    reconcileSubmissionGrades(appDataRef.current.classes, submissionsRef.current, {
      selection, tests: testsRef.current, udas: udasRef.current
    }).preview;

  const handleImportSubmissionsToRegister = (
    selection: SubmissionImportSelection,
    confirmedSignature: string
  ): Promise<void> => {
    if (!confirmedSignature || submissionsRef.current.length === 0) {
      return Promise.reject(new Error('Non ci sono consegne approvate per l’importazione.'));
    }

    let importedCount = 0;
    let importedCountByClassId: Record<string, number> = {};
    const navigationVersionAtSave = navigationVersionRef.current;
    const recordSessionAtSave = recordSessionRef.current;
    const recordingClassId = recordSessionAtSave?.context.classId;

    return commitAppDataMutation(current => {
      // Rebuild from the latest committed state INSIDE the serialized mutation.
      const result = reconcileSubmissionGrades(current.classes, submissionsRef.current, {
        selection, tests: testsRef.current, udas: udasRef.current
      });
      if (result.preview.signature !== confirmedSignature) {
        throw new Error('Le consegne o i dati sono cambiati. Riesaminare l’anteprima prima di importare.');
      }
      if (result.importedCount === 0) {
        throw new Error('Nessuna valutazione nuova da importare.');
      }
      importedCount = result.importedCount;
      importedCountByClassId = result.importedCountByClassId;
      return {
        ...current,
        classes: result.classes
      };
    }, {
      afterCommit: () => {
        alert(`Importazione completata con successo! ${importedCount} valutazioni sono state registrate negli elenchi di classe.`);
        if (recordingClassId && (importedCountByClassId[recordingClassId] || 0) > 0) {
          completeRecordFlow('online-outcomes', navigationVersionAtSave, recordSessionAtSave, recordingClassId);
        }
      }
    }).then(() => undefined);
  };

  // Save UDAs
  const handleSaveUdas = (newUdas: UdaRecord[]): Promise<void> => {
    const mutation = createUdaSnapshotMutation(udasRef.current, newUdas);
    return commitUdasMutation(mutation).then(() => undefined);
  };

  // Save Settings
  const handleUpdateSettings = (patch: Partial<AppSettings>): Promise<void> => {
    return commitSettingsMutation(patch).then(() => undefined);
  };

  // Backup actions are routed to the protected Privacy area.
  const handleExportBackup = () => {
    setActiveTab('privacy');
    toast('Usa il backup cifrato con password nella sezione Privacy');
  };

  const handleImportBackup = () => {
    setActiveTab('privacy');
    toast('Ripristina un backup cifrato nella sezione Privacy');
  };

  // Prepare encrypted backup checkpoint
  const getCompleteCommittedSnapshot = (): CompleteSecureAppSnapshot => ({
    appData: appDataRef.current,
    settings: settingsRef.current,
    udas: udasRef.current,
    customTests: testsRef.current,
    submissions: submissionsRef.current,
    planning: planningRef.current,
    library: libraryRef.current,
    professionalMemory: professionalMemoryRef.current,
    copilotState: copilotStateRef.current,
    meta: metaRef.current
  });

  const prepareEncryptedBackup = (): Promise<PreparedBackupCheckpoint> => {
    return mutationCoordinator.enqueueTask(() =>
      prepareBackupCheckpoint(getCompleteCommittedSnapshot(), new Date().toISOString())
    );
  };

  const recordEncryptedBackupExport = (
    checkpoint: Pick<PreparedBackupCheckpoint, 'includedChanges' | 'checkpointAt'>
  ): Promise<void> => {
    return mutationCoordinator.enqueue<SecureMeta>({
      getCommitted: () => metaRef.current,
      derive: current => applyBackupReceipt(current, checkpoint),
      persist: candidate => secureStorage.saveMeta(candidate),
      publish: candidate => {
        metaRef.current = candidate;
        setMeta(candidate);
      }
    }).then(() => undefined);
  };

  // CDC-01: teacher-assigned council entry values are persisted in the existing appData Vault record.
  const handleSaveCouncilEntries = (classId: string, schoolYear: string, values: Record<string, string>): Promise<void> => {
    return commitAppDataMutation(current => assignCouncilValues(
      current, classId, schoolYear, 'ingresso', values, new Date().toISOString()
    ), { successMessage: 'Valutazioni di ingresso salvate', showBackupModal: false }).then(() => undefined);
  };

  // CDC-02/S1: append-only, explicitly confirmed council-session index in the existing Vault.
  const handleCreateCouncilSession = (
    classId: string, schoolYear: string, kind: CouncilSessionKind, date: string, sessionId: string
  ): Promise<void> => {
    return commitAppDataMutation(current => appendCouncilSession(
      current, classId, schoolYear, kind, date, sessionId, new Date().toISOString()
    ), { successMessage: 'Seduta archiviata', showBackupModal: false }).then(() => undefined);
  };

  // CDC-02/S2b-P3: read-only preview, serialized after preceding durable work.
  const handlePrepareCouncilSnapshot = (
    context: CouncilSnapshotContextV1
  ): Promise<CouncilSnapshotPreviewV1> => {
    return mutationCoordinator.enqueueTask(async () => {
      const clock = createCaptureClock(new Date());
      return prepareCouncilSnapshot(appDataRef.current, context, settingsRef.current, clock);
    });
  };

  // Explicit teacher confirmation only. Never derive from a render-time snapshot.
  // All input verification precedes persistence; React publishes only after the
  // existing encrypted Vault has committed appData and backup metadata together.
  const handleConfirmCouncilSnapshot = (
    reviewed: CouncilSnapshotPreviewV1, snapshotId: string
  ): Promise<void> => {
    return mutationCoordinator.enqueueTask(async () => {
      const previous = appDataRef.current;
      const previousMeta = metaRef.current;
      const clock = createCaptureClock(new Date());
      const candidate = await appendConfirmedCouncilSnapshot(
        previous, reviewed, settingsRef.current, snapshotId, clock
      );
      if (candidate === previous) return; // exact retry, no duplicate write/revision
      const nextMeta = incrementBackupChanges(previousMeta);
      await secureStorage.saveAppDataAndMeta(candidate, nextMeta);
      appDataRef.current = candidate;
      metaRef.current = nextMeta;
      const visibleCurrentClassId =
        currentClassIdRef.current === null
          ? null
          : candidate.classes.some(klass => klass.id === currentClassIdRef.current)
            ? currentClassIdRef.current
            : candidate.currentClassId;
      setAppData({ ...candidate, currentClassId: visibleCurrentClassId });
      setMeta(nextMeta);
      toast('Fotografia della seduta confermata e salvata');
    });
  };

  // Import Encrypted Backup
  const handleImportEncryptedBackup = (decryptedData: unknown): Promise<void> => {
    return mutationCoordinator.enqueueTask(async () => {
      const previousLogical = getCompleteCommittedSnapshot();
      const candidate = await normalizeBackupPayloadVerified(decryptedData, previousLogical);
      if (wouldLoseCouncilEntries(previousLogical.appData, candidate.appData)
        && !window.confirm('ATTENZIONE: questo ripristino sostituirà valutazioni, sedute o fotografie storiche dei Consigli già salvate. Conserva prima un nuovo backup cifrato. Vuoi sostituire comunque i dati correnti?')) {
        throw new Error('Importazione annullata: i dati dei Consigli già salvati sono stati conservati.');
      }
      const restored = await secureStorage.restoreSnapshotVerified(candidate, previousLogical);
      const restoredVisibleAppData = { ...restored.appData, currentClassId: null };
      appDataRef.current = restoredVisibleAppData;
      currentClassIdRef.current = null;
      setTodayAction(null);
      publishReviewSession(null);
      publishRecordSession(null);
      settingsRef.current = restored.settings;
      udasRef.current = restored.udas;
      testsRef.current = restored.customTests;
      submissionsRef.current = restored.submissions;
      planningRef.current = restored.planning;
      libraryRef.current = restored.library;
      professionalMemoryRef.current = restored.professionalMemory;
      copilotStateRef.current = restored.copilotState;
      metaRef.current = restored.meta;
      setAppData(restoredVisibleAppData);
      setSettings(restored.settings);
      setUdas(restored.udas);
      setTests(restored.customTests);
      setSubmissions(restored.submissions);
      setPlanning(restored.planning);
      setLibrary(restored.library);
      setProfessionalMemory(restored.professionalMemory);
      setCopilotState(restored.copilotState);
      setMeta(restored.meta);
      setActiveTab('home');
      toast('Backup cifrato verificato e ripristinato');
    });
  };

  // Factory Reset / Diritto all'Oblio
  const handleFactoryReset = async () => {
    try {
      await onFactoryReset();
      const resetAppData: AppData = { classes: [], currentClassId: null };
      const resetPlanning = createEmptyPlanningState();
      const resetLibrary = createEmptyLibraryState();
      const resetProfessionalMemory = createEmptyProfessionalMemoryState();
      const resetCopilotState = createEmptyCopilotState();
      const resetMeta: SecureMeta = { changes: 0, lastBackup: null };
      appDataRef.current = resetAppData;
      currentClassIdRef.current = null;
      setTodayAction(null);
      publishReviewSession(null);
      publishRecordSession(null);
      planningRef.current = resetPlanning;
      libraryRef.current = resetLibrary;
      professionalMemoryRef.current = resetProfessionalMemory;
      copilotStateRef.current = resetCopilotState;
      metaRef.current = resetMeta;
      setAppData(resetAppData);
      setPlanning(resetPlanning);
      setLibrary(resetLibrary);
      setProfessionalMemory(resetProfessionalMemory);
      setCopilotState(resetCopilotState);
      setMeta(resetMeta);
      setActiveTab('home');
      toast('Reset dati completato');
    } catch (error) {
      console.error('Secure factory reset failed', error);
      alert('Reset sicuro non riuscito. I dati cifrati non sono stati dichiarati cancellati.');
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] text-[#f8fafc] flex flex-col pb-36 md:pb-20">
      {/* If in Student Portal Mode */}
      {studentMode.isOpen && (
        <StudentPortal
          tests={projectAssessmentsForStudent(tests)}
          classNames={appData.classes.map(c => c.name)}
          defaultTestId={studentMode.testId}
          defaultClassName={studentMode.className}
          onSaveSubmission={handleSaveStudentSubmission}
          onExit={() => {
            setStudentMode(prev => ({ ...prev, isOpen: false }));
            try {
              history.pushState(null, '', window.location.pathname);
            } catch (e) {}
          }}
        />
      )}

      {/* Main Navbar & Navigation Drawer */}
      <Navbar
        headerSecurity={headerSecurity}
        activeTab={activeTab}
        setActiveTab={handleNavigateTab}
        currentClass={currentClass}
        classes={appData.classes}
        onSelectClass={handleSelectClass}
        onNavigateHome={handleNavigateHome}
        isDrawerOpen={isDrawerOpen}
        setIsDrawerOpen={setIsDrawerOpen}
        saveIndicatorText={saveIndicatorText}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        isPrivacyShieldActive={isPrivacyShieldActive}
        onTogglePrivacyShield={handleTogglePrivacyShield}
      />

      {hprTraceEnabled && (
        <details aria-label="Diagnostica navigazione INT-01"
          className="mx-auto w-full max-w-5xl border-b border-cyan-800 bg-slate-950 px-4 py-2 text-xs text-slate-200">
          <summary className="cursor-pointer font-semibold">Diagnostica INT-01 — {hprLoadKind === 'reload' ? 'ricaricamento pagina' : hprLoadKind === 'back_forward' ? 'ritorno dalla cronologia' : hprLoadKind === 'navigate' ? 'nuovo caricamento' : 'tipo di avvio non disponibile'}</summary>
          <p className="py-2 text-slate-400">Solo eventi e nomi di schermate; nessun dato della classe o della password.</p>
          <ol aria-label="Eventi INT-01" className="max-h-40 list-decimal space-y-1 overflow-auto pl-5">
            {hprTrace.map((event, index) => <li key={index}>{event}</li>)}
          </ol>
        </details>
      )}

      {!studentMode.isOpen && (
        <>
          {!isAssessmentEditorFocus && (
          <CopilotExperience
            settings={settings}
            copilotState={copilotState}
            library={library}
            udas={udas}
            planning={planning}
            ambientContext={ambientCopilotContext}
            onPutAside={handlePutAsideCopilotOpportunity}
            onIgnore={handleIgnoreCopilotOpportunity}
            onResume={handleResumeCopilotMission}
            onStart={handleStartCopilotMission}
            onOpenConversation={reopenLibraryCopilot}
            surfaceMode={copilotSurfaceMode}
            onSurfaceModeChange={setCopilotSurfaceMode}
            showClosedTrigger={todayAction !== 'conduct' && !isActiveRecordFocus && activeTab !== 'report' && !(activeTab==='tabellone'&&dailyMatrixMode)}
            suppressMobileTrigger={isDrawerOpen || ['voti', 'comportamenti', 'consigli'].includes(activeTab) || (activeTab==='tabellone'&&dailyMatrixMode)}
            inlineMobileTrigger={['analytics', 'programmazione', 'verifiche-online'].includes(activeTab)}
          />
          )}
        </>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-3 sm:p-5">
        {/* TAB 1: Cruscotto Istituto */}
        {activeTab === 'home' && (
          <HomeView
            classes={appData.classes}
            onSelectClass={handleSelectClass}
            onAddClass={handleAddClass}
            onDeleteClass={handleDeleteClass}
            onExportBackup={handleExportBackup}
            lastBackupDate={meta.lastBackup}
            unsavedChangesCount={meta.changes || 0}
            onStartTodayAction={handleStartTodayAction}
            pendingTodayAction={todayAction}
            onCancelTodayAction={handleCancelTodayAction}
          />
        )}

        {/* TAB 2: Dashboard Classe */}
        {activeTab === 'dashboard' && currentClass && (
          <DashboardView
            currentClass={currentClass}
            onNavigateTab={handleNavigateTab}
            onEditBatch={handleEditBatch}
            todayAction={todayAction}
            reviewSession={reviewSession}
            onContinueToday={handleContinueToday}
            onOpenReviewSurface={handleOpenReviewSurface}
            onCloseReview={handleCloseReview}
            onDismissToday={handleCancelTodayAction}
            onOpenPreparationCopilot={handleOpenPreparationCopilot}
            conductContext={conductContext}
            privacyShieldActive={isPrivacyShieldActive}
            onTogglePrivacyShield={handleTogglePrivacyShield}
            onOpenConductCopilot={handleOpenConductCopilot}
            onOpenRecordCopilot={reopenLibraryCopilot}
            onGoToRecord={handleContinueFromConductToRecord}
            recordSession={recordSession}
            onChangeRecordStagedNote={handleUpdateRecordStagedNote}
            onChooseRecordEvidence={handleChooseRecordEvidence}
            onReviewRecord={handleContinueRecordToReview}
            onRecordAnother={handleRecordAnother}
          />
        )}

        {reviewSession
          && currentClass
          && reviewSession.classId === currentClass.id
          && isReviewSurface(activeTab)
          && reviewSession.currentSurface === activeTab && (
            <ReviewMissionBanner
              session={reviewSession}
              onReturn={handleReturnToReview}
              onDismiss={handleCloseReview}
            />
          )}

        {activeRecordMission && (
          <RecordMissionBanner
            className={activeRecordMission.context.className}
            evidenceKind={activeRecordMission.evidenceKind}
            udaTitle={activeRecordMission.context.udaTitle}
            activityLabel={activeRecordMission.context.activityLabel}
            onOpenCopilot={reopenLibraryCopilot}
            onReturn={handleReturnToRecord}
          />
        )}

        {/* TAB 3: Inserisci Valutazioni */}
        {activeTab === 'voti' && currentClass && (
          matrixEvaluationMode ? <MatrixEvaluationEntry key={currentClass.id} currentClass={currentClass} udas={udas} isPrivacyShieldActive={isPrivacyShieldActive} onRegisterDraftGuard={registerEvaluationDraftGuard} onSaveCell={handleSaveMatrixCell} onClose={handleCancelEvaluationEdit}/> : <EvaluationsView
            key={currentClass.id+':ordinary'}
            currentClass={currentClass}
            editingBatchId={editingBatchId}
            udas={udas}
            initialUdaId={recordSession?.status === 'editing' && recordSession.evidenceKind === 'evaluation'
              ? recordSession.context.udaId
              : undefined}
            initialDate={recordSession?.status === 'editing' && recordSession.evidenceKind === 'evaluation' ? today() : undefined}
            onSaveEvaluations={handleSaveEvaluations}
            onCancelEdit={handleCancelEvaluationEdit}
            isPrivacyShieldActive={isPrivacyShieldActive}
          />
        )}

        {/* TAB 4: Valutazione Comportamenti */}
        {activeTab === 'comportamenti' && currentClass && (
          <BehaviorsView
            currentClass={currentClass}
            onSaveBehaviors={handleSaveBehaviors}
            isPrivacyShieldActive={isPrivacyShieldActive}
            onRegisterDraftGuard={registerBehaviorDraftGuard}
          />
        )}

        {/* TAB 5: Analisi & Soglie D.M. 221/2025 */}
        {activeTab === 'analytics' && currentClass && (
          <AnalyticsView
            key={currentClass.id}
            currentClass={currentClass}
            settings={settings}
            onOpenStudentReport={handleOpenStudentReport}
            isPrivacyShieldActive={isPrivacyShieldActive}
            returnContext={returningToStudentOrigin?.originTab === 'analytics'
              && returningToStudentOrigin.classId === currentClass.id
                ? returningToStudentOrigin : undefined}
          />
        )}

        {/* TAB 6: Tabellone Classe */}
        {activeTab === 'tabellone' && currentClass && (
          <div className="space-y-3">
            <div role="group" aria-label="Vista Tabellone" className="grid grid-cols-2 gap-2"><button type="button" aria-pressed={dailyMatrixMode} onClick={()=>switchDailyMatrixMode(true)} className={'min-h-[48px] rounded-lg border '+(dailyMatrixMode?'neon-btn-primary':'border-[var(--border)]')}>Oggi</button><button type="button" aria-pressed={!dailyMatrixMode} onClick={()=>switchDailyMatrixMode(false)} className={'min-h-[48px] rounded-lg border '+(!dailyMatrixMode?'neon-btn-primary':'border-[var(--border)]')}>Storico</button></div>
            {dailyMatrixMode ? <DailyMatrixWorkspace key={currentClass.id} data={appData} currentClass={currentClass} udas={udas} isPrivacyShieldActive={isPrivacyShieldActive} onRegisterDraftGuard={registerEvaluationDraftGuard} requestChange={requestDailyContextChange} onSaveGrade={handleDailyGrade} onSaveObservation={handleDailyObservation}/> : <MatrixView
            onInsertEvaluation={()=>{setEditingBatchId(null);handleNavigateTab('voti',{evaluationBatchId:null,returnTab:'tabellone'});}}
            key={currentClass.id}
            currentClass={currentClass}
            onOpenStudentReport={handleOpenStudentReport}
            onRequestMobileDisclosureCollapse={() => { queueMobileMatrixExit(() => {}); }}
            isPrivacyShieldActive={isPrivacyShieldActive}
            settings={settings}
            returnContext={returningToStudentOrigin?.originTab === 'tabellone'
              && returningToStudentOrigin.classId === currentClass.id
                ? returningToStudentOrigin : undefined}
          />}
          </div>
        )}

        {/* CDC-01: destination generale, classe scelta esplicitamente in questa sezione. */}
        {activeTab === 'consigli' && (
          <CouncilView
            classes={appData.classes}
            settings={settings}
            isPrivacyShieldActive={isPrivacyShieldActive}
            onSave={handleSaveCouncilEntries}
            onCreateSession={handleCreateCouncilSession}
            onPrepareSnapshot={handlePrepareCouncilSnapshot}
            onConfirmSnapshot={handleConfirmCouncilSnapshot}
            onRegisterDraftGuard={registerCouncilDraftGuard}
            onOpenCopilot={() => setCopilotSurfaceMode('home')}
          />
        )}

        {/* TAB 7: Storico Prove */}
        {activeTab === 'storico' && currentClass && (
          <HistoryView
            currentClass={currentClass}
            onEditBatch={handleEditBatch}
            onDeleteBatch={handleDeleteBatch}
            onNewEvaluation={() => {
              setEditingBatchId(null);
              handleNavigateTab('voti', { evaluationBatchId: null });
            }}
          />
        )}

        {/* TAB 8: Scheda Alunno */}
        {activeTab === 'report' && currentClass && (
          <StudentReportView
            currentClass={currentClass}
            selectedStudentId={selectedStudentForReport}
            onSelectStudent={handleSelectStudentInReport}
            settings={settings}
            udas={udas}
            isPrivacyShieldActive={isPrivacyShieldActive}
          />
        )}

        {/* TAB 9: Gestione Alunni */}
        {activeTab === 'dati' && currentClass && (
          <StudentsManagementView
            currentClass={currentClass}
            onAddStudent={handleAddStudent}
            onRemoveStudent={handleRemoveStudent}
            onInvertNames={handleInvertNames}
            onBulkAddStudents={handleBulkAddStudents}
            isPrivacyShieldActive={isPrivacyShieldActive}
          />
        )}

        {/* TAB 10: Verifiche Online, Flashcards & Parser ZIP/DOCX */}
        {activeTab === 'verifiche-online' && (
          <VerificheOnlineView
            classes={appData.classes}
            tests={tests}
            submissions={submissions}
            udas={udas}
            settings={settings}
            assessmentHandoff={activeAssessmentHandoff}
            onGuidedAssessmentHandoffConsumed={nonce => {
              setAssessmentHandoffRequest(previous => previous?.nonce===nonce
                // Consume the one-use guided launch but keep the validated
                // professional source/class reference for an optional, explicit
                // provenance checkbox in the unsaved editor.
                ? {sourceId:previous.sourceId,classId:previous.classId}
                : previous);
            }}
            assessmentEditorTransfer={pendingCopilotAssessmentValid ? pendingCopilotAssessment : null}
            assessmentTransferNotice={assessmentTransferNotice}
            onAssessmentEditorFocusChange={setIsAssessmentEditorFocus}
            onAssessmentTransferResult={(nonce,success)=>{
              setPendingCopilotAssessment(previous=>previous?.nonce===nonce ? null : previous);
              setAssessmentTransferNotice(success
                ? 'Proposta aperta. Nulla è stato salvato.'
                : 'La proposta non è stata aperta: controlla la classe o la bozza già presente.');
            }}
            activeClassId={currentClass?.id ?? null}
            assessmentOriginStatuses={Object.fromEntries(Object.entries(tests).map(
              ([id, test]) => [id, resolveSavedAssessmentOrigin(test, library)]
            ))}
            activeClassName={currentClass?.name ?? null}
            onRegisterDraftGuard={registerAssessmentDraftGuard}
            initialClassName={recordSession?.status === 'editing'
              && recordSession.evidenceKind === 'online-outcomes'
              && recordSession.context.classId === currentClass?.id
              ? recordSession.context.className
              : undefined}
            isPrivacyShieldActive={isPrivacyShieldActive}
            onSaveNewTest={handleSaveNewTest}
            onDeleteSubmission={handleDeleteSubmission}
            onPreviewSubmissionImport={handlePreviewSubmissionImport}
            onImportSubmissionsToRegister={handleImportSubmissionsToRegister}
            onSimulateTest={(testId, className) => {
              setStudentMode({
                isOpen: true,
                testId,
                className
              });
            }}
          />
        )}

        {/* TAB 11: Programmazione didattica annuale */}
        {activeTab === 'programmazione' && (
          <PlanningProfileView
            profiles={planning.profiles}
            arenaContexts={planning.arenaContexts}
            planning={planning}
            classes={appData.classes}
            onAcceptDocenteOsProjection={handleAcceptDocenteOsTeachingProjection}
            onSaveProfile={handleSaveTeachingProfile}
            onRegisterDraftGuard={registerPlanningDraftGuard}
            onAcceptArenaContext={handleAcceptArenaPlanningContext}
            currentClassName={currentClass?.name ?? null}
            planningFrame={planningFrame}
            focusedProfileId={planningFrame.status === 'resolved' ? planningFrame.profile.id : null}
            defaultSubjectCode={curricularSubjectCode}
            subjectDisplayLabel={settings.subject}
            teachingContext={resolvedTeachingFocus.status === 'resolved' ? resolvedTeachingFocus.context : null}
            udaTitle={activeTeachingCandidate?.title ?? null}
            lessonTitle={activeTeachingLesson?.topic ?? null}
            onOpenUda={() => handleNavigateTab('uda-gantt')}
          />
        )}

        {/* Biblioteca privata del docente */}
        {activeTab === 'biblioteca' && (
          <LibraryView
            library={library}
            udas={udas}
            classes={appData.classes}
            planning={planning}
            currentClassName={currentClass?.name ?? null}
            embeddingConfig={settings.embeddingConfig}
            semanticMemoryPort={
              semanticMemorySession.status === 'ready' || semanticMemorySession.status === 'degraded'
                ? semanticMemoryPortRef.current
                : null
            }
            semanticMemorySessionErrorCode={semanticMemorySession.errorCode ?? null}
            onSemanticMemorySessionExpired={invalidateSemanticMemorySession}
            onAddSource={handleAddLibrarySource}
            onUpdateSource={handleUpdateLibrarySource}
            onLinkSource={handleLinkLibrarySource}
            onUnlinkSource={handleUnlinkLibrarySource}
            onDeleteSource={handleDeleteLibrarySource}
            onOpenCopilot={openLibraryCopilot}
            onPrepareAssessment={handlePrepareAssessmentFromLibrary}
            isCopilotOpen={copilotSurfaceMode === 'compose'}
            isPending={isLibraryMutationPending}
            errorMessage={libraryMutationError}
          />
        )}

        {/* TAB 12: Programmazione UDA & Gantt legacy */}
        {activeTab === 'uda-gantt' && (
          <UdaGanttView
            classes={appData.classes}
            udas={udas}
            settings={settings}
            tests={tests}
            onSaveUdas={handleSaveUdas}
            currentClassName={currentClass?.name ?? null}
            planningFrame={planningFrame}
            teachingFocus={resolvedTeachingFocus.status === 'resolved' ? teachingFocus : null}
            teachingContext={resolvedTeachingFocus.status === 'resolved' ? resolvedTeachingFocus.context : null}
            udaTitle={activeTeachingCandidate?.title ?? null}
            lessonTitle={activeTeachingLesson?.topic ?? null}
            onTeachingFocusChange={focus => setTeachingFocus(
              keepTeachingFocusForClass(focus, currentClass?.id ?? null, teachingUdaCatalog)
            )}
            onOpenPlanning={() => handleNavigateTab('programmazione')}
            onNavigateTab={handleNavigateTab}
            recordLessonPrefill={recordSession?.status === 'editing' && recordSession.evidenceKind === 'lesson-log'
              && recordSession.context.classId === currentClass?.id
              && recordSpecialistNavigationVersionRef.current !== null
              ? {
                  className: recordSession.context.className,
                  udaId: recordSession.context.udaId,
                  date: today(),
                  topic: recordSession.context.activityLabel,
                  notes: recordSession.stagedNote,
                  navigationVersion: recordSpecialistNavigationVersionRef.current
                }
              : undefined}
            getRecordLessonNavigationVersion={() => navigationVersionRef.current}
            onRecordLessonCommitted={handleRecordLessonCommitted}
            onOpenCopilot={openLibraryCopilot}
          />
        )}

        {/* TAB 12: Impostazioni & Tema */}
        {activeTab === 'impostazioni' && (
          <div className="space-y-4">
            <SettingsView
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              onExportBackup={handleExportBackup}
              onImportBackup={handleImportBackup}
            />
            <SemanticMemorySettings
              session={semanticMemorySession}
              isSyncing={isSemanticMemorySyncing}
              onConnect={handleConnectSemanticMemory}
              onDisconnect={handleDisconnectSemanticMemory}
              onSync={handleSyncSemanticMemory}
            />
            <CopilotProactivitySettings
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              onResetCopilotPreferences={handleResetCopilotPreferences}
            />
          </div>
        )}

        {/* TAB 13: Privacy First & GDPR */}
        {activeTab === 'privacy' && (
          <PrivacyView
            settings={settings}
            classes={appData.classes}
            isPrivacyShieldActive={isPrivacyShieldActive}
            onTogglePrivacyShield={handleTogglePrivacyShield}
            onPrepareEncryptedBackup={prepareEncryptedBackup}
            onRecordBackupExport={recordEncryptedBackupExport}
            onImportEncryptedBackup={handleImportEncryptedBackup}
            onFactoryReset={handleFactoryReset}
          />
        )}

      </main>

      {!studentMode.isOpen && (
        <>
          <LibraryCopilotComposer
              library={library}
              udas={udas}
              planning={planning}
              professionalMemory={professionalMemory}
              aiBudgetProfile={settings.aiBudgetProfile}
              copilotProactivity={settings.copilotProactivity}
              memoryError={professionalMemoryError}
              currentClassId={currentClass?.id ?? null}
              currentClassName={currentClass?.name ?? null}
              onAcceptAssessmentDraft={handleAcceptAssessmentDraft}
              onContinueAssessmentManually={handleContinueAssessmentManually}
              classes={appData.classes}
              launchRequest={launchRequest}
              openRequestNonce={copilotOpenRequestNonce}
              ambientContext={ambientCopilotContext}
              showStandaloneTrigger={false}
              surfaceMode={copilotSurfaceMode}
              onSurfaceModeChange={setCopilotSurfaceMode}
              onAddSource={handleAddLibrarySource}
              onAdoptProposalToUda={handleAdoptTeachingProposalToUda}
              onUpdateSource={handleUpdateLibrarySource}
              onLink={handleLinkLibrarySource}
              onRemember={handleRememberProfessionalItem}
              onCorrectMemoryEntry={handleCorrectMemoryEntry}
              onRemoveMemoryEntry={handleRemoveMemoryEntry}
              onSetMemoryCategory={handleSetMemoryCategory}
              onRemoveMemoryCategory={handleRemoveMemoryCategory}
              onMissionProposalReady={handleMissionProposalReady}
              onMissionInterrupted={handleMissionInterrupted}
              onMissionOutcome={handleMissionOutcome}
              isPending={isLibraryMutationPending}
            />
        </>
      )}

      {planningExitOpen && (
        <div ref={planningExitDialogRef}
          role="dialog" aria-modal="true" aria-labelledby="planning-exit-title"
          onKeyDown={event => {
            if (event.key === 'Escape') {
              event.preventDefault();
              cancelPlanningExit();
            }
            if (event.key !== 'Tab') return;
            const focusable = Array.from(planningExitDialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? []);
            if (focusable.length === 0) { event.preventDefault(); return; }
            const index = focusable.indexOf(document.activeElement as HTMLButtonElement);
            if (event.shiftKey && index <= 0) {
              event.preventDefault();
              focusable[focusable.length - 1]?.focus();
            } else if (!event.shiftKey && (index === focusable.length - 1 || index < 0)) {
              event.preventDefault();
              focusable[0]?.focus();
            }
          }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-amber-800 bg-slate-950 p-5 shadow-2xl">
            <h2 id="planning-exit-title" className="text-xl font-bold text-white">Modifiche non salvate</h2>
            <p className="text-sm text-slate-300">
              {activeTab === 'verifiche-online'
                ? 'La verifica contiene modifiche non salvate. Scegli se rimanere nell’editor o uscire senza salvare.'
                : activeTab === 'consigli'
                  ? 'Ci sono valutazioni di ingresso non salvate. Puoi salvarle, scartarle o rimanere qui.'
                  : activeTab === 'comportamenti'
                    ? behaviorSavePending ? 'Salvataggio delle osservazioni in corso.' : behaviorDraftGuardRef.current?.hasUnsavedChanges()
                      ? 'Ci sono osservazioni non salvate. Puoi rimanere qui o uscire senza salvarle.'
                      : 'Le osservazioni sono state salvate. Puoi proseguire o rimanere qui.'
                    : (activeTab==='voti'||activeTab==='tabellone') ? evaluationSavePending?'Salvataggio delle valutazioni in corso.': 'Ci sono voti non confermati. I voti già registrati restano salvati.'
                    : 'Hai modificato la Programmazione. Scegli come procedere prima di cambiare schermata.'}
            </p>
            {planningExitFromBrowser && (
              <p role="note" className="text-sm font-semibold text-amber-200">
                Una navigazione del browser ha sostituito il percorso iniziale.
                Controlla la destinazione prima di confermare.
              </p>
            )}
            {planningExitDestination && (
              <p role="status" aria-label="Destinazione richiesta" className="rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-sm font-semibold text-white">
                Destinazione: {planningExitDestination === 'uda-gantt' ? 'Unità didattiche (UDA)'
                  : planningExitDestination === 'dashboard' ? 'Panoramica della classe'
                  : planningExitDestination === 'home' ? 'Oggi'
                  : planningExitDestination === 'biblioteca' ? 'Biblioteca privata'
                  : planningExitDestination === 'verifiche-online' ? 'Verifiche online'
                  : planningExitDestination === 'consigli' ? 'Consigli di classe'
                  : 'schermata selezionata'}.
              </p>
            )}
            {historyRestoringOrigin && (
              <p role="status" className="text-sm text-amber-200">
                {activeTab === 'verifiche-online'
                  ? 'Ripristino della verifica in corso. Le scelte saranno disponibili dopo la verifica del percorso.'
                  : activeTab === 'consigli'
                    ? 'Ripristino della schermata Consigli in corso. Le scelte saranno disponibili dopo la verifica del percorso.'
                    : activeTab === 'comportamenti'
                      ? 'Ripristino della schermata Comportamento in corso.'
                      : 'Ripristino della Programmazione in corso. Le scelte saranno disponibili dopo la verifica del percorso.'}
              </p>
            )}
            {historyFallbackWarning && (
              <p role="status" className="text-sm text-amber-200">
                Il navigatore non permette di verificare il percorso precedente. La bozza è ancora disponibile.
                {activeTab === 'verifiche-online'
                  ? 'Se scegli «Rimani», sarà ripristinato l’editor della verifica e la cronologia in avanti potrebbe essere sostituita.'
                  : activeTab === 'consigli'
                    ? 'Se scegli «Rimani», sarà riaperta la sezione Consigli e la cronologia in avanti potrebbe essere sostituita.'
                    : activeTab === 'comportamenti'
                      ? 'Se scegli «Rimani», sarà riaperta la schermata Comportamento; la cronologia in avanti potrebbe essere sostituita.'
                      : 'Se scegli «Rimani», sarà riaperta la Programmazione e la cronologia in avanti potrebbe essere sostituita.'}
              </p>
            )}
            {planningExitError && <p role="alert" className="text-sm text-amber-200">{planningExitError}</p>}
            <div className="flex flex-col gap-2">
              {['programmazione', 'consigli'].includes(activeTab) && (
                <button type="button" onClick={() => void saveAndLeavePlanning()} disabled={planningExitSaving || historyRestoringOrigin}
                  className="min-h-[44px] rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950 disabled:opacity-60">
                  {planningExitSaving ? 'Salvataggio…' : 'Salva e continua'}
                </button>
              )}
              <button type="button" onClick={() => performPlanningExit(activeTab !== 'comportamenti' || Boolean(behaviorDraftGuardRef.current?.hasUnsavedChanges()))} disabled={planningExitSaving || historyRestoringOrigin || behaviorSavePending || evaluationSavePending}
                className="min-h-[44px] rounded-lg border border-amber-700 px-4 py-2 text-sm font-semibold text-amber-200 disabled:opacity-60">
                {activeTab === 'verifiche-online' ? 'Esci senza salvare' : activeTab === 'comportamenti' && !behaviorDraftGuardRef.current?.hasUnsavedChanges() ? 'Continua' : 'Continua senza salvare'}
              </button>
              <button type="button" onClick={cancelPlanningExit} autoFocus data-int01-stay disabled={planningExitSaving || historyRestoringOrigin}
                className="min-h-[44px] rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {activeTab === 'verifiche-online' ? 'Rimani nell’editor' : activeTab === 'consigli' ? 'Rimani nei Consigli' : activeTab === 'comportamenti' ? 'Rimani nelle osservazioni' : activeTab==='tabellone'?'Rimani nel Tabellone':activeTab==='voti'?'Rimani nelle valutazioni':'Rimani nella Programmazione'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistence confirmation modal */}
      <BackupReminderModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        onExport={handleExportBackup}
      />
    </div>
  );
}