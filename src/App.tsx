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
import type { ArenaPlanningContextPreview, PlanningStateV1, TeachingProfile } from './planning/types';
import { bindAcceptedArenaPlanningContext } from './planning/arenaPlanningContext';
import { validateTeachingProfile } from './planning/validation';
import { createEmptyPlanningState } from './planning/emptyPlanningState';
import type { LibrarySource, LibrarySourceLink, LibraryStateV1 } from './library/types';
import { createEmptyLibraryState } from './library/emptyLibraryState';
import {
  addLibrarySource,
  linkLibrarySource,
  removeLibrarySource,
  unlinkLibrarySource,
  updateLibrarySource,
  type LibrarySourcePatch
} from './library/libraryState';
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
import { BackupReminderModal } from './components/BackupReminderModal';
import { StudentPortal } from './components/StudentPortal';
import { PrivacyView } from './components/PrivacyView';
import { PlanningProfileView } from './components/planning/PlanningProfileView';
import { LibraryView } from './components/LibraryView';
import { LibraryCopilotComposer } from './components/LibraryCopilotComposer';
import type {
  CopilotLaunchContext,
  LibraryCopilotLaunchRequest
} from './library/copilotLaunchContext';

const DURABLE_SAVE_FAILURE_MESSAGE = 'Salvataggio non riuscito. La modifica non è stata applicata.';

export interface AppProps {
  initialSnapshot: SecureAppSnapshot;
  secureStorage: SecureAppStorage;
  onFactoryReset: () => Promise<void>;
}

export default function App({ initialSnapshot, secureStorage, onFactoryReset }: AppProps) {
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
  const [planning, setPlanning] = useState<PlanningStateV1>(() =>
    initialSnapshot.planning || createEmptyPlanningState()
  );

  // 5c. Private teacher library (local-first, no provider side effects)
  const [library, setLibrary] = useState<LibraryStateV1>(() =>
    initialSnapshot.library || createEmptyLibraryState()
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
  const [launchRequest, setLaunchRequest] = useState<LibraryCopilotLaunchRequest | null>(null);

  const openLibraryCopilot = useCallback((context: CopilotLaunchContext) => {
    setLaunchRequest(previous => ({
      nonce: (previous?.nonce ?? 0) + 1,
      context
    }));
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
    derive: (current: PlanningStateV1) => PlanningStateV1
  ): Promise<PlanningStateV1> => {
    return mutationCoordinator.enqueue<{ planning: PlanningStateV1; meta: SecureMeta }>({
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

  const commitLibraryMutation = useCallback((
    derive: (current: LibraryStateV1) => LibraryStateV1
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
    commitLibraryMutation(current => linkLibrarySource(current, sourceId, link)).then(() => undefined),
  [commitLibraryMutation]);

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
            : activeTab === 'uda-gantt' ? 'uda'
              : activeTab === 'programmazione' ? 'planning'
                : activeTab === 'verifiche-online' ? 'online-tests'
                  : activeTab === 'voti' ? 'evaluations'
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
      metaRef.current = restored.meta;
      setAppData(restoredVisibleAppData);
      setSettings(restored.settings);
      setUdas(restored.udas);
      setTests(restored.customTests);
      setSubmissions(restored.submissions);
      setPlanning(restored.planning);
      setLibrary(restored.library);
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
      const resetMeta: SecureMeta = { changes: 0, lastBackup: null };
      appDataRef.current = resetAppData;
      currentClassIdRef.current = null;
      planningRef.current = resetPlanning;
      libraryRef.current = resetLibrary;
      metaRef.current = resetMeta;
      setAppData(resetAppData);
      setPlanning(resetPlanning);
      setLibrary(resetLibrary);
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
          <SettingsView
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
          />
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
        <LibraryCopilotComposer
          library={library}
          udas={udas}
          planning={planning}
          currentClassName={currentClass?.name ?? null}
          launchRequest={launchRequest}
          ambientContext={ambientCopilotContext}
          onAddSource={handleAddLibrarySource}
          onUpdateSource={handleUpdateLibrarySource}
          onLink={handleLinkLibrarySource}
          isPending={isLibraryMutationPending}
        />
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