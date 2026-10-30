import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ActiveTab,
  AppData,
  AppSettings,
  ClassData,
  EvaluationType,
  Grade,
  OnlineSubmission,
  OnlineTest,
  Student,
  UdaRecord
} from './types';
import type { ArenaPlanningContextPreview, PlanningState, TeachingProfile } from './planning/types';
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
import { normalizeBackupPayload } from './security/backupPayload';
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
import { applySettingsPatch } from './persistence/settingsMutation';
import { reconcileSubmissionGrades } from './persistence/submissionGradeImport';

import { Navbar } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { DashboardView } from './components/DashboardView';
import { EvaluationsView } from './components/EvaluationsView';
import { BehaviorsView } from './components/BehaviorsView';
import { AnalyticsView } from './components/AnalyticsView';
import { MatrixView } from './components/MatrixView';
import { HistoryView } from './components/HistoryView';
import { StudentReportView } from './components/StudentReportView';
import { StudentsManagementView } from './components/StudentsManagementView';
import { VerificheOnlineView } from './components/VerificheOnlineView';
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
import type {
  CopilotLaunchContext,
  CopilotMissionLaunchV1,
  LibraryCopilotLaunchRequest
} from './library/copilotLaunchContext';

const DURABLE_SAVE_FAILURE_MESSAGE = 'Salvataggio non riuscito. La modifica non è stata applicata.';

export type CopilotSurfaceMode = 'closed' | 'home' | 'compose';

export interface AppProps {
  initialSnapshot: SecureAppSnapshot;
  secureStorage: SecureAppStorage;
  onFactoryReset: () => Promise<void>;
  onCopilotSurfaceOpenChange?: (isOpen: boolean) => void;
}

export default function App({ initialSnapshot, secureStorage, onFactoryReset, onCopilotSurfaceOpenChange }: AppProps) {
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
      classes: INITIAL_CLASSES.map(c => ({
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
    initialSnapshot.customTests
      ? { ...INITIAL_TESTS, ...initialSnapshot.customTests }
      : INITIAL_TESTS
  );

  // 4. Online Submissions
  const [submissions, setSubmissions] = useState<OnlineSubmission[]>(() =>
    initialSnapshot.submissions || []
  );

  // 5. UDA Records
  const [udas, setUdas] = useState<UdaRecord[]>(() =>
    initialSnapshot.udas || INITIAL_UDAS
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

  // 6. Navigation and UI state
  const [activeTab, setActiveTabState] = useState<ActiveTab>('home');
  const navigationVersionRef = useRef(0);
  const setActiveTab = useCallback((tab: ActiveTab) => {
    navigationVersionRef.current += 1;
    setActiveTabState(tab);
  }, []);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [selectedStudentForReport, setSelectedStudentForReport] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [saveIndicatorText, setSaveIndicatorText] = useState('Sincronizzato');
  const [isLibraryMutationPending, setIsLibraryMutationPending] = useState(false);
  const [libraryMutationError, setLibraryMutationError] = useState<string | null>(null);
  const [professionalMemoryError, setProfessionalMemoryError] = useState<string | null>(null);
  const [launchRequest, setLaunchRequest] = useState<LibraryCopilotLaunchRequest | null>(null);
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
  const missionExecutionGrantsRef = useRef(new Map<string, CopilotMissionExecutionGrantV1>());
  const testsRef = useRef(tests);
  const submissionsRef = useRef(submissions);
  const libraryMutationPendingCountRef = useRef(0);

  const handleNavigateTab = useCallback((tab: ActiveTab) => {
    navigationVersionRef.current += 1;
    setActiveTabState(tab);
    const classId = currentClassIdRef.current;
    try {
      const state = { classId, tab };
      const params = new URLSearchParams();
      if (classId) params.set('class', classId);
      if (tab !== 'home' && tab !== 'dashboard') params.set('tab', tab);
      const query = params.toString();
      history.pushState(state, '', query ? `?${query}` : window.location.pathname);
    } catch (e) {}
  }, []);

  const mutationCoordinatorRef = useRef<ReturnType<typeof createDurableMutationCoordinator> | null>(null);
  const mutationCoordinator = mutationCoordinatorRef.current ?? (
    mutationCoordinatorRef.current = createDurableMutationCoordinator()
  );

  const toast = useCallback((msg: string) => {
    setSaveIndicatorText(msg);
    setTimeout(() => {
      setSaveIndicatorText('Sincronizzato');
    }, 2800);
  }, []);

  const commitAppDataMutation = useCallback((
    derive: (current: AppData) => AppData,
    options: {
      showBackupModal?: boolean;
      successMessage?: string;
      afterCommit?: () => void;
    } = {}
  ): Promise<AppData> => {
    const {
      showBackupModal = true,
      successMessage = 'Salvato nel vault locale',
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
      afterCommit: () => {
        if (successMessage) toast(successMessage);
        if (showBackupModal) setIsBackupModalOpen(true);
        afterCommit?.();
      }
    }).then(candidate => candidate.appData).catch(error => {
      console.error('Secure vault save failed', error);
      alert(DURABLE_SAVE_FAILURE_MESSAGE);
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
  const ambientCopilotContext: CopilotLaunchContext = {
    surface:
      activeTab === 'home' ? 'home'
        : activeTab === 'dashboard' ? 'class-dashboard'
          : activeTab === 'biblioteca' ? 'library'
            : activeTab === 'uda-gantt' ? 'other-teacher-surface'
              : activeTab === 'programmazione' ? 'planning'
                : activeTab === 'verifiche-online' ? 'online-tests'
                  : activeTab === 'voti' ? 'evaluations'
                    : activeTab === 'tabellone' ? 'evaluations'
                      : 'other-teacher-surface',
    className: currentClass?.name
  };

  // Synchronize URL query params
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const nextCurrentClassId = e.state?.classId || null;
      currentClassIdRef.current = nextCurrentClassId;
      setAppData(prev => ({ ...prev, currentClassId: nextCurrentClassId }));
      setActiveTab(e.state?.tab || (nextCurrentClassId ? 'dashboard' : 'home'));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Handle Class selection
  const handleSelectClass = (classId: string) => {
    currentClassIdRef.current = classId;
    setAppData(prev => ({ ...prev, currentClassId: classId }));
    setActiveTab('dashboard');
    setEditingBatchId(null);
    setSelectedStudentForReport(null);
    try {
      history.pushState({ classId, tab: 'dashboard' }, '', `?class=${classId}`);
    } catch (e) {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateHome = () => {
    currentClassIdRef.current = null;
    setAppData(prev => ({ ...prev, currentClassId: null }));
    setActiveTab('home');
    setEditingBatchId(null);
    setSelectedStudentForReport(null);
    try {
      history.pushState(null, '', window.location.pathname);
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
        setEditingBatchId(null);
        if (navigationVersionRef.current === navigationVersionAtSave) {
          setActiveTab('storico');
        }
      }
    }).then(() => undefined);
  };

  // Save behavior notes
  const handleSaveBehaviors = (newRecords: any[]): Promise<void> => {
    const classId = currentClass?.id;
    if (!classId) return Promise.resolve();
    const navigationVersionAtSave = navigationVersionRef.current;
    const dateStr = newRecords[0]?.date || today();

    return commitAppDataMutation(current => {
      const targetClass = current.classes.find(c => c.id === classId);
      if (!targetClass) throw new Error('Classe non più disponibile.');
      const remaining = (targetClass.behaviors || []).filter(b => b.date !== dateStr);
      const updatedClass: ClassData = {
        ...targetClass,
        behaviors: [...remaining, ...newRecords]
      };
      return {
        ...current,
        classes: current.classes.map(c => (c.id === classId ? updatedClass : c))
      };
    }, {
      afterCommit: () => {
        if (navigationVersionRef.current === navigationVersionAtSave) {
          setActiveTab('dashboard');
        }
      }
    }).then(() => undefined);
  };

  // Edit batch
  const handleEditBatch = (batchId: string) => {
    setEditingBatchId(batchId);
    setActiveTab('voti');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
        behaviors: (targetClass.behaviors || []).filter(b => b.studentId !== studentId)
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
    return commitTestsMutation(current => ({
      ...current,
      [newTest.id]: newTest
    })).then(() => undefined);
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

  // Import submissions into class grades
  const handleImportSubmissionsToRegister = (targetUdaId?: string): Promise<void> => {
    if (submissionsRef.current.length === 0) {
      alert('Nessuna consegna online ricevuta da importare.');
      return Promise.resolve();
    }

    let importedCount = 0;

    return commitAppDataMutation(current => {
      const result = reconcileSubmissionGrades(current.classes, submissionsRef.current, targetUdaId);
      importedCount = result.importedCount;
      return {
        ...current,
        classes: result.classes
      };
    }, {
      afterCommit: () => {
        alert(`Importazione completata con successo! ${importedCount} valutazioni sono state registrate negli elenchi di classe.`);
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

  // Import Encrypted Backup
  const handleImportEncryptedBackup = (decryptedData: unknown): Promise<void> => {
    return mutationCoordinator.enqueueTask(async () => {
      const previousLogical = getCompleteCommittedSnapshot();
      const candidate = normalizeBackupPayload(decryptedData, previousLogical);
      const restored = await secureStorage.restoreSnapshotVerified(candidate, previousLogical);
      const restoredVisibleAppData = { ...restored.appData, currentClassId: null };
      appDataRef.current = restoredVisibleAppData;
      currentClassIdRef.current = null;
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
          tests={tests}
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
          />
        )}

        {/* TAB 2: Dashboard Classe */}
        {activeTab === 'dashboard' && currentClass && (
          <DashboardView
            currentClass={currentClass}
            onNavigateTab={handleNavigateTab}
            onEditBatch={handleEditBatch}
          />
        )}

        {/* TAB 3: Inserisci Valutazioni */}
        {activeTab === 'voti' && currentClass && (
          <EvaluationsView
            currentClass={currentClass}
            editingBatchId={editingBatchId}
            udas={udas}
            onSaveEvaluations={handleSaveEvaluations}
            onCancelEdit={() => setEditingBatchId(null)}
            isPrivacyShieldActive={isPrivacyShieldActive}
          />
        )}

        {/* TAB 4: Valutazione Comportamenti */}
        {activeTab === 'comportamenti' && currentClass && (
          <BehaviorsView
            currentClass={currentClass}
            onSaveBehaviors={handleSaveBehaviors}
            isPrivacyShieldActive={isPrivacyShieldActive}
          />
        )}

        {/* TAB 5: Analisi & Soglie D.M. 221/2025 */}
        {activeTab === 'analytics' && currentClass && (
          <AnalyticsView
            currentClass={currentClass}
            settings={settings}
            onOpenStudentReport={(studentId) => {
              setSelectedStudentForReport(studentId);
              setActiveTab('report');
            }}
            isPrivacyShieldActive={isPrivacyShieldActive}
          />
        )}

        {/* TAB 6: Tabellone Classe */}
        {activeTab === 'tabellone' && currentClass && (
          <MatrixView
            currentClass={currentClass}
            onOpenStudentReport={(studentId) => {
              setSelectedStudentForReport(studentId);
              setActiveTab('report');
            }}
            isPrivacyShieldActive={isPrivacyShieldActive}
            settings={settings}
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
              setActiveTab('voti');
            }}
          />
        )}

        {/* TAB 8: Scheda Alunno */}
        {activeTab === 'report' && currentClass && (
          <StudentReportView
            currentClass={currentClass}
            selectedStudentId={selectedStudentForReport}
            onSelectStudent={setSelectedStudentForReport}
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
            isPrivacyShieldActive={isPrivacyShieldActive}
            onSaveNewTest={handleSaveNewTest}
            onDeleteSubmission={handleDeleteSubmission}
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
            onSaveProfile={handleSaveTeachingProfile}
            onAcceptArenaContext={handleAcceptArenaPlanningContext}
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
            onAddSource={handleAddLibrarySource}
            onUpdateSource={handleUpdateLibrarySource}
            onLinkSource={handleLinkLibrarySource}
            onUnlinkSource={handleUnlinkLibrarySource}
            onDeleteSource={handleDeleteLibrarySource}
            onOpenCopilot={openLibraryCopilot}
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
            onNavigateTab={handleNavigateTab}
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
          />
          <LibraryCopilotComposer
              library={library}
              udas={udas}
              planning={planning}
              professionalMemory={professionalMemory}
              aiBudgetProfile={settings.aiBudgetProfile}
              copilotProactivity={settings.copilotProactivity}
              memoryError={professionalMemoryError}
              currentClassName={currentClass?.name ?? null}
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

      {/* Persistence confirmation modal */}
      <BackupReminderModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        onExport={handleExportBackup}
      />
    </div>
  );
}
