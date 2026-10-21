import React, { useState, useEffect, useCallback } from 'react';
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


export default function App() {
  // 1. Settings & Theme
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          embeddingConfig: parsed.embeddingConfig || DEFAULT_SETTINGS.embeddingConfig
        };
      }
      return DEFAULT_SETTINGS;
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
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
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.classes)) {
          return {
            classes: parsed.classes.map((c: any) => ({
              ...c,
              students: sortStudents(c.students || []),
              grades: c.grades || [],
              behaviors: c.behaviors || []
            })),
            currentClassId: parsed.currentClassId || null
          };
        }
      }
    } catch (e) {
      console.error('Error loading app data', e);
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
  const [tests, setTests] = useState<Record<string, OnlineTest>>(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_TESTS_KEY);
      return raw ? { ...INITIAL_TESTS, ...JSON.parse(raw) } : INITIAL_TESTS;
    } catch (e) {
      return INITIAL_TESTS;
    }
  });

  // 4. Online Submissions
  const [submissions, setSubmissions] = useState<OnlineSubmission[]>(() => {
    try {
      const raw = localStorage.getItem(SUBMISSIONS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });

  // 5. UDA Records
  const [udas, setUdas] = useState<UdaRecord[]>(() => {
    try {
      const raw = localStorage.getItem(UDA_KEY);
      return raw ? JSON.parse(raw) : INITIAL_UDAS;
    } catch (e) {
      return INITIAL_UDAS;
    }
  });

  // 6. Navigation and UI state
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [selectedStudentForReport, setSelectedStudentForReport] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [saveIndicatorText, setSaveIndicatorText] = useState('Sincronizzato');

  // Metadata for backup tracking
  const [meta, setMeta] = useState<{ changes: number; lastBackup: string | null }>(() => {
    try {
      const raw = localStorage.getItem(META_KEY);
      return raw ? JSON.parse(raw) : { changes: 0, lastBackup: null };
    } catch (e) {
      return { changes: 0, lastBackup: null };
    }
  });

  const toast = useCallback((msg: string) => {
    setSaveIndicatorText(msg);
    setTimeout(() => {
      setSaveIndicatorText('Sincronizzato');
    }, 2800);
  }, []);

  // Privacy Shield (Modalità LIM: maschera i nomi degli studenti)
  const [isPrivacyShieldActive, setIsPrivacyShieldActive] = useState<boolean>(() => {
    try {
      return localStorage.getItem('registro_privacy_shield_active') === 'true';
    } catch (e) {
      return false;
    }
  });

  const handleTogglePrivacyShield = useCallback(() => {
    setIsPrivacyShieldActive(prev => {
      const next = !prev;
      try {
        localStorage.setItem('registro_privacy_shield_active', String(next));
      } catch (e) {}
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
      if (e.state && e.state.classId) {
        setAppData(prev => ({ ...prev, currentClassId: e.state.classId }));
        setActiveTab(e.state.tab || 'dashboard');
      } else {
        setAppData(prev => ({ ...prev, currentClassId: null }));
        setActiveTab('home');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Save changes to localStorage and increment modification counter
  const persistAppData = useCallback((newAppData: AppData, showModal = true) => {
    setAppData(newAppData);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newAppData));
      const nextMeta = { ...meta, changes: (meta.changes || 0) + 1 };
      setMeta(nextMeta);
      localStorage.setItem(META_KEY, JSON.stringify(nextMeta));
      toast('Salvato in locale');
      if (showModal) {
        setIsBackupModalOpen(true);
      }
    } catch (e) {
      console.error('Save failed', e);
      alert('Attenzione: salvataggio locale non riuscito.');
    }
  }, [meta, toast]);

  // Handle Class selection
  const handleSelectClass = (classId: string) => {
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

    const nextAppData: AppData = {
      classes: [...appData.classes, newClass],
      currentClassId: newClass.id
    };

    persistAppData(nextAppData);
    setActiveTab('dati');
    toast('Classe creata');
  };

  // Delete class
  const handleDeleteClass = (classId: string) => {
    const nextAppData: AppData = {
      classes: appData.classes.filter(c => c.id !== classId),
      currentClassId: appData.currentClassId === classId ? null : appData.currentClassId
    };
    persistAppData(nextAppData, false);
    toast('Classe eliminata');
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
    if (!currentClass) return;

    // Filter out existing grades with this batchId if updating
    const remainingGrades = (currentClass.grades || []).filter(g => g.batchId !== batchData.batchId);

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

    const updatedClass: ClassData = {
      ...currentClass,
      grades: [...remainingGrades, ...newGrades]
    };

    const nextAppData: AppData = {
      ...appData,
      classes: appData.classes.map(c => (c.id === updatedClass.id ? updatedClass : c))
    };

    setEditingBatchId(null);
    persistAppData(nextAppData, true);
    setActiveTab('storico');
  };

  // Save behavior notes
  const handleSaveBehaviors = (newRecords: any[]) => {
    if (!currentClass) return;

    const dateStr = newRecords[0]?.date || today();
    // Replace today's records
    const remaining = (currentClass.behaviors || []).filter(b => b.date !== dateStr);
    const updatedClass: ClassData = {
      ...currentClass,
      behaviors: [...remaining, ...newRecords]
    };

    const nextAppData: AppData = {
      ...appData,
      classes: appData.classes.map(c => (c.id === updatedClass.id ? updatedClass : c))
    };

    persistAppData(nextAppData, true);
    setActiveTab('dashboard');
  };

  // Edit batch
  const handleEditBatch = (batchId: string) => {
    setEditingBatchId(batchId);
    setActiveTab('voti');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Delete batch
  const handleDeleteBatch = (batchId: string) => {
    if (!currentClass) return;
    const updatedClass: ClassData = {
      ...currentClass,
      grades: (currentClass.grades || []).filter(g => g.batchId !== batchId)
    };

    const nextAppData: AppData = {
      ...appData,
      classes: appData.classes.map(c => (c.id === updatedClass.id ? updatedClass : c))
    };

    persistAppData(nextAppData, false);
    toast('Valutazione eliminata');
  };

  // Add single student
  const handleAddStudent = (name: string) => {
    if (!currentClass) return;
    const newStudent: Student = { id: uid(), name };
    const updatedClass: ClassData = {
      ...currentClass,
      students: sortStudents([...currentClass.students, newStudent])
    };

    const nextAppData: AppData = {
      ...appData,
      classes: appData.classes.map(c => (c.id === updatedClass.id ? updatedClass : c))
    };

    persistAppData(nextAppData, false);
    toast('Alunno inserito');
  };

  // Remove single student
  const handleRemoveStudent = (studentId: string) => {
    if (!currentClass) return;
    const updatedClass: ClassData = {
      ...currentClass,
      students: currentClass.students.filter(s => s.id !== studentId),
      grades: (currentClass.grades || []).filter(g => g.studentId !== studentId),
      behaviors: (currentClass.behaviors || []).filter(b => b.studentId !== studentId)
    };

    const nextAppData: AppData = {
      ...appData,
      classes: appData.classes.map(c => (c.id === updatedClass.id ? updatedClass : c))
    };

    persistAppData(nextAppData, false);
    toast('Alunno rimosso');
  };

  // Bulk add students from Excel
  const handleBulkAddStudents = (newStudents: Student[]) => {
    if (!currentClass) return;
    const updatedClass: ClassData = {
      ...currentClass,
      students: sortStudents([...currentClass.students, ...newStudents])
    };

    const nextAppData: AppData = {
      ...appData,
      classes: appData.classes.map(c => (c.id === updatedClass.id ? updatedClass : c))
    };

    persistAppData(nextAppData, true);
    toast('Alunni importati');
  };

  // Invert student names (Cognome Nome <-> Nome Cognome)
  const handleInvertNames = () => {
    if (!currentClass) return;
    const inverted = currentClass.students.map(s => {
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
      ...currentClass,
      students: sortStudents(inverted)
    };

    const nextAppData: AppData = {
      ...appData,
      classes: appData.classes.map(c => (c.id === updatedClass.id ? updatedClass : c))
    };

    persistAppData(nextAppData, false);
    toast('Nomi invertiti');
  };

  // Save new test
  const handleSaveNewTest = (newTest: OnlineTest) => {
    const updatedTests = { ...tests, [newTest.id]: newTest };
    setTests(updatedTests);
    try {
      localStorage.setItem(CUSTOM_TESTS_KEY, JSON.stringify(updatedTests));
      toast('Test salvato');
    } catch (e) {}
  };

  // Delete submission
  const handleDeleteSubmission = (submissionId: string) => {
    const updated = submissions.filter(s => s.id !== submissionId);
    setSubmissions(updated);
    try {
      localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(updated));
      toast('Consegna eliminata');
    } catch (e) {}
  };

  // Import submissions into class grades
  const handleImportSubmissionsToRegister = (targetUdaId?: string) => {
    if (submissions.length === 0) {
      alert('Nessuna consegna online ricevuta da importare.');
      return;
    }

    let count = 0;
    const updatedClasses = appData.classes.map(cls => {
      let clsGrades = [...(cls.grades || [])];

      submissions.forEach(sub => {
        // Match class name
        if (cls.name.toLowerCase().includes(sub.class.toLowerCase()) || sub.class.toLowerCase().includes(cls.name.toLowerCase())) {
          // Match student name
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
            count++;
          }
        }
      });

      return {
        ...cls,
        grades: clsGrades
      };
    });

    const nextAppData: AppData = {
      ...appData,
      classes: updatedClasses
    };

    persistAppData(nextAppData, true);
    alert(`Importazione completata con successo! ${count} valutazioni sono state registrate negli elenchi di classe.`);
  };

  // Save UDAs
  const handleSaveUdas = (newUdas: UdaRecord[]) => {
    setUdas(newUdas);
    try {
      localStorage.setItem(UDA_KEY, JSON.stringify(newUdas));
      toast('UDA salvate');
    } catch (e) {}
  };

  // Save Settings
  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
      toast('Impostazioni aggiornate');
    } catch (e) {}
  };

  // Export JSON Backup
  const handleExportBackup = () => {
    const payload = {
      app: 'registro-docente',
      version: 2,
      exportedAt: new Date().toISOString(),
      data: appData,
      settings: settings,
      udas: udas,
      customTests: tests,
      submissions: submissions
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Backup_RegistroDocente_${today()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const nextMeta = { changes: 0, lastBackup: new Date().toISOString() };
    setMeta(nextMeta);
    localStorage.setItem(META_KEY, JSON.stringify(nextMeta));
    toast('Backup esportato');
  };

  // Import JSON Backup
  const handleImportBackup = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const raw = JSON.parse(event.target?.result as string);
          if (raw && (raw.data || raw.classes)) {
            const loadedData: AppData = raw.data || { classes: raw.classes, currentClassId: null };
            setAppData(loadedData);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(loadedData));

            if (raw.settings) {
              setSettings(raw.settings);
              localStorage.setItem(SETTINGS_KEY, JSON.stringify(raw.settings));
            }

            if (raw.udas) {
              setUdas(raw.udas);
              localStorage.setItem(UDA_KEY, JSON.stringify(raw.udas));
            }

            if (raw.customTests) {
              setTests(raw.customTests);
              localStorage.setItem(CUSTOM_TESTS_KEY, JSON.stringify(raw.customTests));
            }

            if (raw.submissions) {
              setSubmissions(raw.submissions);
              localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(raw.submissions));
            }

            const nextMeta = { changes: 0, lastBackup: new Date().toISOString() };
            setMeta(nextMeta);
            localStorage.setItem(META_KEY, JSON.stringify(nextMeta));

            setActiveTab('home');
            alert('Registro ripristinato con successo dal file di backup!');
          } else {
            alert('Il file selezionato non contiene una struttura di backup valida.');
          }
        } catch (err) {
          console.error(err);
          alert('Errore durante la decodifica del file JSON di backup.');
        }
      };
      reader.readAsText(file);
    };

    input.click();
  };

  // Import Encrypted Backup
  const handleImportEncryptedBackup = (decryptedData: any) => {
    if (decryptedData.classes || decryptedData.data) {
      const loadedClasses = decryptedData.classes || decryptedData.data?.classes || [];
      const nextAppData: AppData = {
        classes: loadedClasses,
        currentClassId: null
      };
      setAppData(nextAppData);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextAppData));

      if (decryptedData.settings) {
        setSettings(decryptedData.settings);
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(decryptedData.settings));
      }

      toast('Registro cifrato ripristinato');
      setActiveTab('home');
    }
  };

  // Factory Reset / Diritto all'Oblio
  const handleFactoryReset = () => {
    localStorage.clear();
    setAppData({ classes: [], currentClassId: null });
    setMeta({ changes: 0, lastBackup: null });
    setActiveTab('home');
    toast('Reset dati completato');
    alert('Tutti i dati e la memoria locale sono stati cancellati definitivamente (Diritto all\'Oblio).');
  };

  return (
    <div className="min-h-screen bg-[#030712] text-[#f8fafc] flex flex-col pb-16 sm:pb-8">
      {/* If in Student Portal Mode */}
      {studentMode.isOpen && (
        <StudentPortal
          tests={tests}
          defaultTestId={studentMode.testId}
          defaultClassName={studentMode.className}
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
            isPrivacyShieldActive={isPrivacyShieldActive}
            onTogglePrivacyShield={handleTogglePrivacyShield}
            onExportEncryptedBackup={() => {}}
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
