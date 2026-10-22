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
        currentClassId: persisted.currentClassId || null
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

  // 6. Navigation and UI state
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [selectedStudentForReport, setSelectedStudentForReport] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [saveIndicatorText, setSaveIndicatorText] = useState('Sincronizzato');

  // Metadata for backup tracking
  const [meta, setMeta] = useState<SecureMeta>(() =>
    initialSnapshot.meta || { changes: 0, lastBackup: null }
  );

  const appDataRef = useRef(appData);
  const metaRef = useRef(meta);
  const settingsRef = useRef(settings);
  const udasRef = useRef(udas);
  const testsRef = useRef(tests);
  const submissionsRef = useRef(submissions);
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
      derive: current => ({
        appData: derive(current.appData),
        meta: { ...current.meta, changes: (current.meta.changes || 0) + 1 }
      }),
      persist: candidate => secureStorage.saveAppDataAndMeta(candidate.appData, candidate.meta),
      publish: candidate => {
        appDataRef.current = candidate.appData;
        metaRef.current = candidate.meta;
        setAppData(candidate.appData);
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

  const commitMetaMutation = useCallback((
    derive: (current: SecureMeta) => SecureMeta,
    afterCommit?: () => void
  ): Promise<SecureMeta> => {
    return mutationCoordinator.enqueue<SecureMeta>({
      getCommitted: () => metaRef.current,
      derive,
      persist: candidate => secureStorage.saveMeta(candidate),
      publish: candidate => {
        metaRef.current = candidate;
        setMeta(candidate);
      },
      afterCommit
    }).catch(error => {
      console.error('Secure vault metadata save failed', error);
      alert(DURABLE_SAVE_FAILURE_MESSAGE);
      throw error;
    });
  }, [mutationCoordinator, secureStorage]);

  const commitSettingsMutation = useCallback((candidate: AppSettings): Promise<AppSettings> => {
    return mutationCoordinator.enqueue<AppSettings>({
      getCommitted: () => settingsRef.current,
      derive: () => candidate,
      persist: next => secureStorage.saveSettings(next),
      publish: next => {
        settingsRef.current = next;
        setSettings(next);
      },
      afterCommit: () => toast('Impostazioni aggiornate')
    }).catch(error => {
      console.error('Secure settings save failed', error);
      alert(DURABLE_SAVE_FAILURE_MESSAGE);
      throw error;
    });
  }, [mutationCoordinator, secureStorage, toast]);

  const commitUdasMutation = useCallback((candidate: UdaRecord[]): Promise<UdaRecord[]> => {
    return mutationCoordinator.enqueue<UdaRecord[]>({
      getCommitted: () => udasRef.current,
      derive: () => candidate,
      persist: next => secureStorage.saveUdas(next),
      publish: next => {
        udasRef.current = next;
        setUdas(next);
      },
      afterCommit: () => toast('UDA salvate')
    }).catch(error => {
      console.error('Secure UDA save failed', error);
      alert(DURABLE_SAVE_FAILURE_MESSAGE);
      throw error;
    });
  }, [mutationCoordinator, secureStorage, toast]);

  const commitTestsMutation = useCallback((
    derive: (current: Record<string, OnlineTest>) => Record<string, OnlineTest>
  ): Promise<Record<string, OnlineTest>> => {
    return mutationCoordinator.enqueue<Record<string, OnlineTest>>({
      getCommitted: () => testsRef.current,
      derive,
      persist: candidate => secureStorage.saveCustomTests(candidate),
      publish: candidate => {
        testsRef.current = candidate;
        setTests(candidate);
      },
      afterCommit: () => toast('Test salvato')
    }).catch(error => {
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
    return mutationCoordinator.enqueue<OnlineSubmission[]>({
      getCommitted: () => submissionsRef.current,
      derive,
      persist: candidate => secureStorage.saveSubmissions(candidate),
      publish: candidate => {
        submissionsRef.current = candidate;
        setSubmissions(candidate);
      },
      afterCommit: () => {
        if (successMessage) toast(successMessage);
      }
    }).catch(error => {
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

  // Synchronize URL query params
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const nextAppData = e.state && e.state.classId
        ? { ...appDataRef.current, currentClassId: e.state.classId }
        : { ...appDataRef.current, currentClassId: null };
      appDataRef.current = nextAppData;
      setAppData(nextAppData);
      setActiveTab(e.state?.tab || (e.state?.classId ? 'dashboard' : 'home'));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Handle Class selection
  const handleSelectClass = (classId: string) => {
    const nextAppData = { ...appDataRef.current, currentClassId: classId };
    appDataRef.current = nextAppData;
    setAppData(nextAppData);
    setActiveTab('dashboard');
    setEditingBatchId(null);
    setSelectedStudentForReport(null);
    try {
      history.pushState({ classId, tab: 'dashboard' }, '', `?class=${classId}`);
    } catch (e) {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateHome = () => {
    const nextAppData = { ...appDataRef.current, currentClassId: null };
    appDataRef.current = nextAppData;
    setAppData(nextAppData);
    setActiveTab('home');
    setEditingBatchId(null);
    setSelectedStudentForReport(null);
    try {
      history.pushState(null, '', window.location.pathname);
    } catch (e) {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Add new class
  const handleAddClass = () => {
    const name = prompt('Inserisci la denominazione della nuova classe (es. 2ª B):');
    if (!name || !name.trim()) return;

    const newClass: ClassData = {
      id: uid(),
      name: sanitizeName(name),
      students: [],
      grades: [],
      behaviors: []
    };

    void commitAppDataMutation(current => ({
      ...current,
      classes: [...current.classes, newClass],
      currentClassId: newClass.id
    }), {
      successMessage: 'Classe creata',
      afterCommit: () => setActiveTab('dati')
    }).catch(() => undefined);
  };

  // Delete class
  const handleDeleteClass = (classId: string) => {
    void commitAppDataMutation(current => ({
      ...current,
      classes: current.classes.filter(c => c.id !== classId),
      currentClassId: current.currentClassId === classId ? null : current.currentClassId
    }), {
      showBackupModal: false,
      successMessage: 'Classe eliminata'
    }).catch(() => undefined);
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
  }) => {
    const classId = currentClass?.id;
    if (!classId) return;

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

    void commitAppDataMutation(current => {
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
        setActiveTab('storico');
      }
    }).catch(() => undefined);
  };

  // Save behavior notes
  const handleSaveBehaviors = (newRecords: any[]) => {
    const classId = currentClass?.id;
    if (!classId) return;
    const dateStr = newRecords[0]?.date || today();

    void commitAppDataMutation(current => {
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
      afterCommit: () => setActiveTab('dashboard')
    }).catch(() => undefined);
  };

  // Edit batch
  const handleEditBatch = (batchId: string) => {
    setEditingBatchId(batchId);
    setActiveTab('voti');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Delete batch
  const handleDeleteBatch = (batchId: string) => {
    const classId = currentClass?.id;
    if (!classId) return;

    void commitAppDataMutation(current => {
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
    }).catch(() => undefined);
  };

  // Add single student
  const handleAddStudent = (name: string) => {
    const classId = currentClass?.id;
    if (!classId) return;
    const newStudent: Student = { id: uid(), name };

    void commitAppDataMutation(current => {
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
    }).catch(() => undefined);
  };

  // Remove single student
  const handleRemoveStudent = (studentId: string) => {
    const classId = currentClass?.id;
    if (!classId) return;

    void commitAppDataMutation(current => {
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
    }).catch(() => undefined);
  };

  // Bulk add students from Excel
  const handleBulkAddStudents = (newStudents: Student[]) => {
    const classId = currentClass?.id;
    if (!classId) return;

    void commitAppDataMutation(current => {
      const targetClass = current.classes.find(c => c.id === classId);
      if (!targetClass) throw new Error('Classe non più disponibile.');
      const updatedClass: ClassData = {
        ...targetClass,
        students: sortStudents([...targetClass.students, ...newStudents])
      };
      return {
        ...current,
        classes: current.classes.map(c => (c.id === classId ? updatedClass : c))
      };
    }, {
      successMessage: 'Alunni importati'
    }).catch(() => undefined);
  };

  // Invert student names (Cognome Nome <-> Nome Cognome)
  const handleInvertNames = () => {
    const classId = currentClass?.id;
    if (!classId) return;

    void commitAppDataMutation(current => {
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
    }).catch(() => undefined);
  };

  // Save new test
  const handleSaveNewTest = (newTest: OnlineTest) => {
    void commitTestsMutation(current => ({
      ...current,
      [newTest.id]: newTest
    })).catch(() => undefined);
  };

  // Delete submission
  const handleDeleteSubmission = (submissionId: string) => {
    void commitSubmissionsMutation(
      current => current.filter(s => s.id !== submissionId),
      { successMessage: 'Consegna eliminata' }
    ).catch(() => undefined);
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
  const handleImportSubmissionsToRegister = (targetUdaId?: string) => {
    if (submissionsRef.current.length === 0) {
      alert('Nessuna consegna online ricevuta da importare.');
      return;
    }

    const submissionSnapshot = submissionsRef.current;
    let importedCount = 0;

    void commitAppDataMutation(current => {
      importedCount = 0;
      const updatedClasses = current.classes.map(cls => {
        const clsGrades = [...(cls.grades || [])];

        submissionSnapshot.forEach(sub => {
          if (cls.name.toLowerCase().includes(sub.class.toLowerCase()) || sub.class.toLowerCase().includes(cls.name.toLowerCase())) {
            const matchStudent = cls.students.find(st =>
              st.name.toLowerCase().trim() === sub.name.toLowerCase().trim() ||
              st.name.toLowerCase().includes(sub.name.toLowerCase()) ||
              sub.name.toLowerCase().includes(st.name.toLowerCase())
            );

            if (matchStudent) {
              const grade10 = sub.total > 0 ? Math.round((sub.score / sub.total) * 10 * 10) / 10 : 0;
              clsGrades.push({
                id: uid(),
                batchId: `online_${uid()}`,
                studentId: matchStudent.id,
                date: sub.date.slice(0, 10),
                type: 'test',
                period: 'Q1',
                title: `Flashcard: ${sub.testTitle}`,
                value: String(grade10),
                udaId: targetUdaId || sub.testId
              });
              importedCount++;
            }
          }
        });

        return {
          ...cls,
          grades: clsGrades
        };
      });

      return {
        ...current,
        classes: updatedClasses
      };
    }, {
      afterCommit: () => {
        alert(`Importazione completata con successo! ${importedCount} valutazioni sono state registrate negli elenchi di classe.`);
      }
    }).catch(() => undefined);
  };

  // Save UDAs
  const handleSaveUdas = (newUdas: UdaRecord[]) => {
    void commitUdasMutation(newUdas).catch(() => undefined);
  };

  // Save Settings
  const handleUpdateSettings = (newSettings: AppSettings) => {
    void commitSettingsMutation(newSettings).catch(() => undefined);
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

  // Import Encrypted Backup
  const handleImportEncryptedBackup = async (decryptedData: unknown) => {
    const currentSnapshot: CompleteSecureAppSnapshot = {
      appData: appDataRef.current,
      settings: settingsRef.current,
      udas: udasRef.current,
      customTests: testsRef.current,
      submissions: submissionsRef.current,
      meta: metaRef.current
    };
    const candidate = normalizeBackupPayload(decryptedData, currentSnapshot);
    const restored = await secureStorage.restoreSnapshotVerified(candidate);

    appDataRef.current = restored.appData;
    settingsRef.current = restored.settings;
    udasRef.current = restored.udas;
    testsRef.current = restored.customTests;
    submissionsRef.current = restored.submissions;
    metaRef.current = restored.meta;
    setAppData(restored.appData);
    setSettings(restored.settings);
    setUdas(restored.udas);
    setTests(restored.customTests);
    setSubmissions(restored.submissions);
    setMeta(restored.meta);
    setActiveTab('home');
    toast('Backup cifrato verificato e ripristinato');
  };

  // Factory Reset / Diritto all'Oblio
  const handleFactoryReset = async () => {
    try {
      await onFactoryReset();
      const resetAppData: AppData = { classes: [], currentClassId: null };
      const resetMeta: SecureMeta = { changes: 0, lastBackup: null };
      appDataRef.current = resetAppData;
      metaRef.current = resetMeta;
      setAppData(resetAppData);
      setMeta(resetMeta);
      setActiveTab('home');
      toast('Reset dati completato');
    } catch (error) {
      console.error('Secure factory reset failed', error);
      alert('Reset sicuro non riuscito. I dati cifrati non sono stati dichiarati cancellati.');
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] text-[#f8fafc] flex flex-col pb-16 md:pb-8">
      {/* If in Student Portal Mode */}
      {studentMode.isOpen && (
        <StudentPortal
          tests={tests}
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
        setActiveTab={setActiveTab}
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
            onNavigateTab={setActiveTab}
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

        {/* TAB 11: Programmazione UDA & Gantt */}
        {activeTab === 'uda-gantt' && (
          <UdaGanttView
            classes={appData.classes}
            udas={udas}
            settings={settings}
            tests={tests}
            onSaveUdas={handleSaveUdas}
            onNavigateTab={setActiveTab}
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
            backupSnapshot={{
              appData,
              settings,
              udas,
              customTests: tests,
              submissions,
              meta
            }}
            isPrivacyShieldActive={isPrivacyShieldActive}
            onTogglePrivacyShield={handleTogglePrivacyShield}
            onExportEncryptedBackup={() => {
              const nextMeta = { changes: 0, lastBackup: new Date().toISOString() };
              void commitMetaMutation(() => nextMeta).catch(() => undefined);
            }}
            onImportEncryptedBackup={handleImportEncryptedBackup}
            onFactoryReset={handleFactoryReset}
          />
        )}

      </main>

      {/* Persistence confirmation modal */}
      <BackupReminderModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        onExport={handleExportBackup}
      />
    </div>
  );
}
