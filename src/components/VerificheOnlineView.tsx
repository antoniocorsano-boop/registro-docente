import React, { useRef, useState } from 'react';
import JSZip from 'jszip';
import * as mammoth from 'mammoth';
import { AppSettings, ClassData, OnlineSubmission, OnlineTest, Question, QuestionType, UdaRecord } from '../types';
import { formatStudentNameWithPrivacy, uid } from '../utils';
import {
  FileQuestion,
  Upload,
  Copy,
  ExternalLink,
  Download,
  Trash2,
  CheckCircle,
  FileArchive,
  Printer,
  Sparkles,
  BarChart2,
  Plus,
  BookOpen,
  HelpCircle,
  Lightbulb,
  AlertTriangle,
  Layers,
  Edit3,
  Eye,
  Check,
  X
} from 'lucide-react';

interface VerificheOnlineViewProps {
  classes: ClassData[];
  tests: Record<string, OnlineTest>;
  submissions: OnlineSubmission[];
  udas?: UdaRecord[];
  settings?: AppSettings;
  isPrivacyShieldActive?: boolean;
  onSaveNewTest: (test: OnlineTest) => Promise<void>;
  onDeleteTest?: (testId: string) => void;
  onDeleteSubmission: (submissionId: string) => Promise<void>;
  onImportSubmissionsToRegister: (targetUdaId?: string) => Promise<void>;
  onSimulateTest: (testId: string, className: string) => void;
}

export const VerificheOnlineView: React.FC<VerificheOnlineViewProps> = ({
  classes,
  tests,
  submissions,
  udas = [],
  settings,
  isPrivacyShieldActive = true,
  onSaveNewTest,
  onDeleteTest,
  onDeleteSubmission,
  onImportSubmissionsToRegister,
  onSimulateTest
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'bacheca' | 'editor' | 'stampa' | 'analisi'>('bacheca');
  const [selectedClass, setSelectedClass] = useState<string>(classes[0]?.name || '3ª A');
  const [selectedTestId, setSelectedTestId] = useState<string>(Object.keys(tests)[0] || 'energia');
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [isSavingTest, setIsSavingTest] = useState(false);
  const testSavePendingRef = useRef(false);
  const [isSubmissionActionPending, setIsSubmissionActionPending] = useState(false);
  const submissionActionPendingRef = useRef(false);

  // Manual raw text parsing modal or box
  const [manualTitle, setManualTitle] = useState('');
  const [manualRawText, setManualRawText] = useState('');
  const [manualUdaId, setManualUdaId] = useState('');

  // Interactive Question-by-Question Test Editor State
  const [isEditingTest, setIsEditingTest] = useState(false);
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorDescription, setEditorDescription] = useState('');
  const [editorUdaId, setEditorUdaId] = useState('');
  const [editorDuration, setEditorDuration] = useState(15);
  const [editorQuestions, setEditorQuestions] = useState<Question[]>([]);

  // Print Mode State
  const [printDocenteMode, setPrintDocenteMode] = useState(false);

  const currentSelectedTest = tests[selectedTestId] || Object.values(tests)[0];

  // Open interactive editor for new test
  const handleStartNewInteractiveTest = () => {
    setEditingTestId(null);
    setEditorTitle('');
    setEditorDescription('');
    setEditorUdaId(udas[0]?.id || '');
    setEditorDuration(15);
    setEditorQuestions([
      {
        q: 'Inserisci qui la prima domanda formativa...',
        options: ['Opzione A', 'Opzione B', 'Opzione C'],
        correct: 0,
        explanation: 'Fornisci una breve spiegazione del perché questa risposta è corretta.',
        type: 'multiple_choice'
      }
    ]);
    setIsEditingTest(true);
    setActiveSubTab('editor');
  };

  // Open interactive editor for existing test
  const handleEditExistingTest = (test: OnlineTest) => {
    setEditingTestId(test.id);
    setEditorTitle(test.title);
    setEditorDescription(test.description || '');
    setEditorUdaId(test.udaId || '');
    setEditorDuration(test.durationMinutes || 15);
    setEditorQuestions(JSON.parse(JSON.stringify(test.questions)));
    setIsEditingTest(true);
    setActiveSubTab('editor');
  };

  // Add question to editor
  const handleAddQuestionToEditor = (type: QuestionType = 'multiple_choice') => {
    if (type === 'true_false') {
      setEditorQuestions(prev => [
        ...prev,
        {
          q: 'Affermazione da verificare come Vera o Falsa...',
          options: ['Vero', 'Falso'],
          correct: 0,
          explanation: 'Motivazione didattica...',
          type: 'true_false'
        }
      ]);
    } else {
      setEditorQuestions(prev => [
        ...prev,
        {
          q: 'Nuovo quesito formativo...',
          options: ['Prima opzione', 'Seconda opzione', 'Terza opzione'],
          correct: 0,
          explanation: '',
          type: 'multiple_choice'
        }
      ]);
    }
  };

  // Remove question from editor
  const handleRemoveQuestionFromEditor = (index: number) => {
    if (editorQuestions.length <= 1) {
      alert('Il test deve contenere almeno un quesito.');
      return;
    }
    setEditorQuestions(prev => prev.filter((_, i) => i !== index));
  };

  // Update question property
  const handleUpdateQuestion = (index: number, field: keyof Question, value: any) => {
    setEditorQuestions(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Add option to a question
  const handleAddOption = (qIndex: number) => {
    setEditorQuestions(prev => {
      const copy = [...prev];
      const q = { ...copy[qIndex] };
      q.options = [...q.options, `Nuova opzione ${q.options.length + 1}`];
      copy[qIndex] = q;
      return copy;
    });
  };

  // Remove option from a question
  const handleRemoveOption = (qIndex: number, optIndex: number) => {
    setEditorQuestions(prev => {
      const copy = [...prev];
      const q = { ...copy[qIndex] };
      if (q.options.length <= 2) {
        alert('Una domanda a risposta multipla richiede almeno 2 opzioni.');
        return prev;
      }
      q.options = q.options.filter((_, i) => i !== optIndex);
      if (q.correct >= q.options.length) {
        q.correct = 0;
      }
      copy[qIndex] = q;
      return copy;
    });
  };

  const commitTestSaveIntent = async (buildTest: () => OnlineTest): Promise<OnlineTest | null> => {
    if (testSavePendingRef.current) return null;
    testSavePendingRef.current = true;
    setIsSavingTest(true);
    try {
      const test = buildTest();
      await onSaveNewTest(test);
      return test;
    } catch {
      return null;
    } finally {
      testSavePendingRef.current = false;
      setIsSavingTest(false);
    }
  };

  const commitSubmissionAction = async (action: () => Promise<void>): Promise<boolean> => {
    if (submissionActionPendingRef.current) return false;
    submissionActionPendingRef.current = true;
    setIsSubmissionActionPending(true);
    try {
      await action();
      return true;
    } catch {
      return false;
    } finally {
      submissionActionPendingRef.current = false;
      setIsSubmissionActionPending(false);
    }
  };

  const handleDeleteSubmission = async (sub: OnlineSubmission) => {
    await commitSubmissionAction(() => onDeleteSubmission(sub.id));
  };

  const handleImportSubmissions = async () => {
    await commitSubmissionAction(() => onImportSubmissionsToRegister(currentSelectedTest?.udaId));
  };

  // Save interactive test
  const handleSaveInteractiveTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editorTitle.trim()) {
      alert('Inserisci il titolo del test.');
      return;
    }
    if (editorQuestions.length === 0) {
      alert('Inserisci almeno una domanda.');
      return;
    }

    const savedTest = await commitTestSaveIntent(() => {
      const testId = editingTestId || `test_${uid()}`;
      return {
        id: testId,
        title: editorTitle.trim(),
        description: editorDescription.trim(),
        udaId: editorUdaId || undefined,
        durationMinutes: Number(editorDuration) || 15,
        questions: editorQuestions
      };
    });
    if (!savedTest) return;
    setSelectedTestId(savedTest.id);
    setIsEditingTest(false);
    alert(`Test "${savedTest.title}" salvato con successo!`);
  };

  // Parse questions from DOCX/ZIP text
  const parseQuestionsFromText = (text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const questions: Question[] = [];
    let currentQ: string | null = null;
    let currentOpts: string[] = [];
    let correctIdx = 0;

    lines.forEach(line => {
      if (line.endsWith('?') || /^\d+[\.\)]\s+[A-Za-z]/.test(line)) {
        if (currentQ && currentOpts.length >= 2) {
          questions.push({
            q: currentQ,
            options: currentOpts,
            correct: correctIdx,
            type: currentOpts.length === 2 && currentOpts.includes('Vero') ? 'true_false' : 'multiple_choice'
          });
        }
        currentQ = line.replace(/^\d+[\.\)]\s*/, '');
        currentOpts = [];
        correctIdx = 0;
      } else if (/^[a-d1-4][\.\)]\s+/i.test(line) || (currentQ && line.length < 90)) {
        if (currentQ) {
          let opt = line.replace(/^[a-d1-4][\.\)]\s*/i, '');
          if (opt.includes('[CORRETTA]')) {
            correctIdx = currentOpts.length;
            opt = opt.replace('[CORRETTA]', '').trim();
          }
          currentOpts.push(opt);
        }
      }
    });

    if (currentQ && currentOpts.length >= 2) {
      questions.push({
        q: currentQ,
        options: currentOpts,
        correct: correctIdx,
        type: currentOpts.length === 2 && currentOpts.includes('Vero') ? 'true_false' : 'multiple_choice'
      });
    }

    return questions;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingFile(true);
    try {
      let fullText = '';

      if (file.name.endsWith('.zip')) {
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(file);
        for (const filename of Object.keys(zipContent.files)) {
          if (filename.endsWith('.docx') && !filename.startsWith('~$')) {
            const docxData = await zipContent.files[filename].async('arraybuffer');
            const result = await mammoth.extractRawText({ arrayBuffer: docxData });
            fullText += `\n\n=== ${filename} ===\n\n${result.value}`;
          }
        }
      } else if (file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        fullText = result.value;
      } else {
        alert('Formato non supportato. Carica un archivio .zip o un documento Word .docx.');
        setIsParsingFile(false);
        return;
      }

      if (!fullText.trim()) {
        alert('Nessun testo leggibile trovato nel file.');
        setIsParsingFile(false);
        return;
      }

      const questions = parseQuestionsFromText(fullText);
      if (questions.length === 0) {
        alert('Impossibile estrarre domande a risposta multipla in automatico. Assicurati che le domande terminino con "?" e le opzioni siano su righe successive.');
        setIsParsingFile(false);
        return;
      }

      const testTitle = `Test: ${file.name.replace(/\.[^/.]+$/, '')}`;
      const savedTest = await commitTestSaveIntent(() => ({
        id: `test_auto_${uid()}`,
        title: testTitle,
        questions,
        udaId: udas[0]?.id
      }));
      if (!savedTest) return;
      setSelectedTestId(savedTest.id);
      e.target.value = '';
      alert(`Successo! Creato il test "${savedTest.title}" con ${questions.length} domande estratte.`);
    } catch (err) {
      console.error('Error parsing file', err);
      alert("Si è verificato un errore durante l'estrazione del file ZIP / DOCX.");
    } finally {
      setIsParsingFile(false);
    }
  };

  const handleSaveManualTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim() || !manualRawText.trim()) {
      alert('Inserisci sia il titolo del test sia il testo con domande e risposte.');
      return;
    }

    const blocks = manualRawText.split(/\n\s*\n/);
    const questions: Question[] = [];

    blocks.forEach(b => {
      const lines = b.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 3) return;
      const qText = lines[0].replace(/^\d+[\.\)]\s*/, '');
      const options: string[] = [];
      let correctIdx = 0;

      for (let i = 1; i < lines.length; i++) {
        let optLine = lines[i].replace(/^[a-d1-4][\.\)]\s*/i, '');
        if (optLine.includes('[CORRETTA]')) {
          correctIdx = options.length;
          optLine = optLine.replace('[CORRETTA]', '').trim();
        }
        options.push(optLine);
      }

      if (options.length >= 2) {
        questions.push({
          q: qText,
          options,
          correct: correctIdx,
          type: options.length === 2 && (options.includes('Vero') || options.includes('V')) ? 'true_false' : 'multiple_choice'
        });
      }
    });

    if (questions.length === 0) {
      alert('Formato non riconosciuto. Scrivi la domanda al primo rigo, poi le risposte sotto. Aggiungi [CORRETTA] accanto alla risposta esatta.');
      return;
    }

    const savedTest = await commitTestSaveIntent(() => ({
      id: `test_${uid()}`,
      title: manualTitle.trim(),
      udaId: manualUdaId || undefined,
      questions
    }));
    if (!savedTest) return;
    setSelectedTestId(savedTest.id);
    setManualTitle('');
    setManualRawText('');
    alert(`Test "${savedTest.title}" creato con ${questions.length} domande!`);
  };

  const copyPadletLink = () => {
    const origin = window.location.origin;
    const path = window.location.pathname;
    const link = `${origin}${path}?mode=student&test=${selectedTestId}&class=${encodeURIComponent(selectedClass)}`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(link).then(() => {
        alert(`Link Flashcard per Padlet / Classroom copiato negli appunti!\n\n${link}`);
      }).catch(() => {
        prompt('Copia il link qui:', link);
      });
    } else {
      prompt('Copia il link qui:', link);
    }
  };

  // Item analysis for selected test
  const relevantSubmissions = submissions.filter(
    s => s.testTitle === currentSelectedTest?.title || s.testId === currentSelectedTest?.id
  );

  // Calculate success rate per question
  const itemAnalysis = (currentSelectedTest?.questions || []).map((q, qIndex) => {
    let totalAttempts = 0;
    let correctAttempts = 0;

    relevantSubmissions.forEach(sub => {
      if (sub.answers && sub.answers.length > 0) {
        const found = sub.answers.find(a => a.questionIndex === qIndex);
        if (found) {
          totalAttempts++;
          if (found.isCorrect) correctAttempts++;
        }
      }
    });

    const percent = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : null;
    return {
      questionIndex: qIndex,
      questionText: q.q,
      correctAnswer: q.options[q.correct],
      explanation: q.explanation,
      totalAttempts,
      correctAttempts,
      percent
    };
  });

  // Print test handler
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Sub-navigation Header Bar */}
      <div className="neon-card p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileQuestion className="w-5 h-5 text-[var(--primary)] drop-shadow-[0_0_8px_var(--primary)]" />
          <h2 className="text-base sm:text-lg font-bold text-white">
            Verifiche sulle Lezioni & Flashcards Formative
          </h2>
        </div>

        {/* Tab pills */}
        <div className="flex flex-wrap gap-1.5 bg-slate-900/80 p-1 rounded-lg border border-slate-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => { setActiveSubTab('bacheca'); setIsEditingTest(false); }}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
              activeSubTab === 'bacheca'
                ? 'bg-[var(--primary)] text-[var(--primary-text)] font-bold shadow-[0_0_8px_var(--primary)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Copy className="w-3.5 h-3.5" /> Condivisione Padlet
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('editor')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
              activeSubTab === 'editor'
                ? 'bg-[var(--primary)] text-[var(--primary-text)] font-bold shadow-[0_0_8px_var(--primary)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" /> Editor Verifiche & UDA
          </button>

          <button
            type="button"
            onClick={() => { setActiveSubTab('stampa'); setIsEditingTest(false); }}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
              activeSubTab === 'stampa'
                ? 'bg-[var(--primary)] text-[var(--primary-text)] font-bold shadow-[0_0_8px_var(--primary)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Printer className="w-3.5 h-3.5" /> Scheda Cartacea / PDF
          </button>

          <button
            type="button"
            onClick={() => { setActiveSubTab('analisi'); setIsEditingTest(false); }}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
              activeSubTab === 'analisi'
                ? 'bg-[var(--primary)] text-[var(--primary-text)] font-bold shadow-[0_0_8px_var(--primary)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" /> Esiti & Item Analysis ({submissions.length})
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SUB-TAB 1: BACHECA & CONDIVISIONE PADLET */}
      {/* ============================================================== */}
      {activeSubTab === 'bacheca' && (
        <div className="space-y-4">
          {/* Padlet Link Generator Card */}
          <div className="neon-card neon-card-highlight p-5">
            <div className="mb-4 pb-3 border-b border-[var(--border)]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Copy className="w-4 h-4 text-[var(--primary)]" /> Generatore Link per Bacheca Padlet, Classroom o Registro
              </h3>
              <p className="text-xs text-slate-400">
                Seleziona la classe e il test formativo per generare il link diretto. Gli studenti potranno completare la prova con flashcards interattive e feedback didattico immediato.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Classe Destinataria
                </label>
                <select
                  value={selectedClass}
                  onChange={e => setSelectedClass(e.target.value)}
                  className="w-full p-2.5 neon-input text-xs sm:text-sm text-white bg-slate-900"
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Test / Verifica Formativa
                </label>
                <select
                  value={selectedTestId}
                  onChange={e => setSelectedTestId(e.target.value)}
                  className="w-full p-2.5 neon-input text-xs sm:text-sm text-white bg-slate-900"
                >
                  {Object.keys(tests).map(k => (
                    <option key={k} value={k}>
                      {tests[k].title} ({tests[k].questions.length} domande)
                      {tests[k].udaId ? ` · [UDA collegata]` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {currentSelectedTest && (
              <div className="p-3.5 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] mb-4 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <span className="font-bold text-white text-sm">{currentSelectedTest.title}</span>
                  <div className="flex items-center gap-2">
                    {currentSelectedTest.udaId && (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800">
                        {udas.find(u => u.id === currentSelectedTest.udaId)?.title || 'UDA Collegata'}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">
                      {currentSelectedTest.questions.length} Quesiti
                    </span>
                  </div>
                </div>
                {currentSelectedTest.description && (
                  <p className="text-slate-400 text-xs mb-2">{currentSelectedTest.description}</p>
                )}
                <p className="text-[11px] text-slate-500 font-mono break-all">
                  URL Studente: {window.location.origin}{window.location.pathname}?mode=student&test={selectedTestId}&class={encodeURIComponent(selectedClass)}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={copyPadletLink}
                className="flex-1 py-2.5 px-4 rounded-lg neon-btn-primary text-xs font-semibold flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" /> Copia Link per Studenti
              </button>
              <button
                type="button"
                onClick={() => onSimulateTest(selectedTestId, selectedClass)}
                className="py-2.5 px-4 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5"
                title="Avvia simulazione come alunno"
              >
                <ExternalLink className="w-4 h-4" /> Prova come Alunno (Flashcard)
              </button>
              <button
                type="button"
                onClick={() => handleEditExistingTest(currentSelectedTest)}
                className="py-2.5 px-4 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5"
              >
                <Edit3 className="w-4 h-4" /> Modifica Test
              </button>
            </div>
          </div>

          {/* Quick Import Card: ZIP/DOCX & Text Parser */}
          <div className="neon-card p-5">
            <div className="mb-4 pb-3 border-b border-[var(--border)]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileArchive className="w-4 h-4 text-[var(--primary)]" /> Importazione Rapida da File Word (.DOCX / .ZIP)
              </h3>
              <p className="text-xs text-slate-400">
                Hai già una verifica pronta in Word? Caricala direttamente: l'app estrarrà automaticamente i quesiti e le risposte.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <label className="w-full flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-slate-600 bg-slate-900/60 hover:bg-slate-800 text-xs font-semibold text-slate-200 cursor-pointer transition-colors">
                <Upload className="w-4 h-4 text-[var(--primary)]" />
                <span>{isParsingFile ? 'Estrazione e parsing in corso...' : 'Carica File .ZIP o .DOCX'}</span>
                <input
                  type="file"
                  accept=".zip,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isParsingFile || isSavingTest}
                />
              </label>

              <button
                type="button"
                onClick={handleStartNewInteractiveTest}
                className="w-full sm:w-auto px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--surface-variant)] hover:bg-[var(--surface-hover)] text-xs font-semibold text-[var(--primary)] flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Crea Test da Zero con Editor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SUB-TAB 2: EDITOR VISUALE TEST & COLLEGAMENTO UDA */}
      {/* ============================================================== */}
      {activeSubTab === 'editor' && (
        <div className="space-y-4">
          {!isEditingTest ? (
            /* Test List & Management View */
            <div className="neon-card neon-card-highlight p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[var(--border)]">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-[var(--primary)]" /> Catalogo Verifiche & Test Didattici
                  </h3>
                  <p className="text-xs text-slate-400">
                    Crea, modifica e collega le prove formative ai moduli curricolari e alle UDA.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleStartNewInteractiveTest}
                    className="px-3.5 py-2 rounded-lg neon-btn-primary text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Nuovo Test Formativo
                  </button>
                </div>
              </div>

              {/* Grid of tests */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {Object.values(tests).map(t => {
                  const linkedUda = udas.find(u => u.id === t.udaId);
                  return (
                    <div
                      key={t.id}
                      className="p-4 rounded-xl bg-[var(--surface-variant)] border border-[var(--border)] hover:border-[var(--primary)]/60 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-bold text-white text-sm">{t.title}</h4>
                          <span className="px-2 py-0.5 rounded text-[11px] bg-cyan-950/80 text-cyan-300 font-mono font-semibold shrink-0">
                            {t.questions.length} domande
                          </span>
                        </div>

                        {t.description && (
                          <p className="text-xs text-slate-400 mb-3 line-clamp-2">{t.description}</p>
                        )}

                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mb-4">
                          {linkedUda ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 flex items-center gap-1">
                              <Layers className="w-3 h-3" /> UDA: {linkedUda.title}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">Nessuna UDA collegata</span>
                          )}
                          {t.durationMinutes && (
                            <span>· ~{t.durationMinutes} min</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800 text-xs">
                        <button
                          type="button"
                          onClick={() => handleEditExistingTest(t)}
                          className="flex-1 py-1.5 px-3 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center justify-center gap-1.5"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Modifica
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTestId(t.id);
                            setActiveSubTab('stampa');
                          }}
                          className="py-1.5 px-3 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center justify-center gap-1"
                          title="Stampa scheda cartacea"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onSimulateTest(t.id, selectedClass)}
                          className="py-1.5 px-3 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center justify-center gap-1"
                          title="Simula prova studente"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Fast Manual Text Creator (Accordion) */}
              <details className="mt-6 pt-4 border-t border-[var(--border)] text-xs text-slate-400">
                <summary className="cursor-pointer font-semibold text-slate-300 hover:text-[var(--primary)] transition-colors select-none flex items-center gap-2">
                  <Upload className="w-4 h-4 text-[var(--primary)]" />
                  Oppure incolla rapidamente domande da testo formattato (con tag [CORRETTA])
                </summary>
                <form onSubmit={handleSaveManualTest} className="mt-3 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Titolo della verifica (es. Disegno Tecnico e Assonometrie)"
                      value={manualTitle}
                      onChange={e => setManualTitle(e.target.value)}
                      className="p-2.5 neon-input text-xs text-white placeholder-slate-500"
                    />
                    <select
                      value={manualUdaId}
                      onChange={e => setManualUdaId(e.target.value)}
                      className="p-2.5 neon-input text-xs text-white bg-slate-900"
                    >
                      <option value="">-- Seleziona UDA di riferimento (opzionale) --</option>
                      {udas.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.className} · {u.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    rows={4}
                    placeholder={`1. Quale proprietà descrive la capacità di un metallo di essere ridotto in fili?\na) Malleabilità\nb) Duttilità [CORRETTA]\nc) Durezza\n\n2. L'energia eolica è una fonte:\na) Rinnovabile [CORRETTA]\nb) Esauribile`}
                    value={manualRawText}
                    onChange={e => setManualRawText(e.target.value)}
                    className="w-full p-2.5 neon-input text-xs font-mono text-white placeholder-slate-600"
                  />
                  <button
                    type="submit"
                    disabled={isSavingTest}
                    className="px-4 py-2 rounded-lg neon-btn-primary text-xs font-semibold"
                  >
                    Genera Test da Testo
                  </button>
                </form>
              </details>
            </div>
          ) : (
            /* Interactive Visual Question-by-Question Form */
            <form onSubmit={handleSaveInteractiveTest} className="neon-card neon-card-highlight p-5 space-y-5">
              <fieldset disabled={isSavingTest} className="space-y-5 border-0 p-0 m-0 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
                  <div>
                    <h3 className="text-base font-bold text-[var(--primary)] flex items-center gap-2">
                      <Edit3 className="w-5 h-5 text-[var(--primary)]" />
                      {editingTestId ? 'Modifica Verifica Formativa' : 'Crea Nuova Verifica Formativa'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Definisci quesiti, opzioni di risposta, soluzioni corrette e spiegazioni didattiche per lo studente.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={isSavingTest}
                      className="px-4 py-2 rounded-lg neon-btn-primary text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" /> Salva Verifica
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingTest(false)}
                      className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1"
                    >
                      <X className="w-4 h-4" /> Chiudi
                    </button>
                  </div>
                </div>

                {/* Test Meta Configuration */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Titolo Verifica / Argomento Lezione
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="es. Verifica Formativa: Energie Rinnovabili e Impatto Ambientale"
                      value={editorTitle}
                      onChange={e => setEditorTitle(e.target.value)}
                      className="w-full p-2.5 neon-input text-xs sm:text-sm text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Collega a UDA Curricolare
                    </label>
                    <select
                      value={editorUdaId}
                      onChange={e => setEditorUdaId(e.target.value)}
                      className="w-full p-2.5 neon-input text-xs sm:text-sm text-white bg-slate-900"
                    >
                      <option value="">-- Nessuna UDA associata --</option>
                      {udas.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.className} · {u.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Descrizione / Obiettivi Didattici (Opzionale)
                    </label>
                    <input
                      type="text"
                      placeholder="es. Prova per verificare l'acquisizione dei concetti di rendimento energetico e celle solari."
                      value={editorDescription}
                      onChange={e => setEditorDescription(e.target.value)}
                      className="w-full p-2 neon-input text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Tempo Stimato (Minuti)
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={120}
                      value={editorDuration}
                      onChange={e => setEditorDuration(Number(e.target.value))}
                      className="w-full p-2 neon-input text-xs text-white font-mono"
                    />
                  </div>
                </div>

                {/* Questions List Header */}
                <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between">
                  <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-cyan-400" />
                    Quesiti del Test ({editorQuestions.length})
                  </h4>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddQuestionToEditor('multiple_choice')}
                      className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 border border-slate-700"
                    >
                      <Plus className="w-3.5 h-3.5 text-cyan-400" /> + Domanda Scelta Multipla
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuestionToEditor('true_false')}
                      className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 border border-slate-700"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-400" /> + Vero / Falso
                    </button>
                  </div>
                </div>

                {/* Questions Editor Cards */}
                <div className="space-y-4">
                  {editorQuestions.map((q, qIndex) => (
                    <div
                      key={qIndex}
                      className="p-4 rounded-xl bg-[var(--surface-variant)] border border-slate-700 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-[var(--primary)] text-[var(--primary-text)] font-bold text-xs flex items-center justify-center shrink-0">
                            {qIndex + 1}
                          </span>
                          <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                            {q.type === 'true_false' ? 'Vero / Falso' : 'Scelta Multipla'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveQuestionFromEditor(qIndex)}
                          className="text-slate-500 hover:text-rose-400 p-1 rounded"
                          title="Elimina domanda"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Question text */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          Testo del Quesito
                        </label>
                        <textarea
                          rows={2}
                          value={q.q}
                          onChange={e => handleUpdateQuestion(qIndex, 'q', e.target.value)}
                          className="w-full p-2.5 neon-input text-xs sm:text-sm text-white"
                          placeholder="Formula chiaramente la domanda..."
                        />
                      </div>

                      {/* Options with radio button for correct answer */}
                      <div className="space-y-2">
                        <label className="block text-[11px] font-semibold text-slate-400">
                          Opzioni di Risposta (seleziona il pallino della risposta corretta)
                        </label>

                        {q.options.map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-2">
                            <label className="flex items-center gap-1.5 cursor-pointer text-xs shrink-0">
                              <input
                                type="radio"
                                name={`correct_${qIndex}`}
                                checked={q.correct === optIdx}
                                onChange={() => handleUpdateQuestion(qIndex, 'correct', optIdx)}
                                className="accent-[var(--primary)] w-4 h-4 cursor-pointer"
                              />
                              <span className={q.correct === optIdx ? 'font-bold text-emerald-400' : 'text-slate-400'}>
                                {String.fromCharCode(65 + optIdx)})
                              </span>
                            </label>

                            <input
                              type="text"
                              value={opt}
                              onChange={e => {
                                const newOpts = [...q.options];
                                newOpts[optIdx] = e.target.value;
                                handleUpdateQuestion(qIndex, 'options', newOpts);
                              }}
                              className={`flex-1 p-2 rounded border text-xs text-white ${
                                q.correct === optIdx
                                  ? 'border-emerald-500 bg-emerald-950/30'
                                  : 'border-slate-700 bg-slate-900'
                              }`}
                            />

                            {q.type !== 'true_false' && q.options.length > 2 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveOption(qIndex, optIdx)}
                                className="text-slate-500 hover:text-rose-400 p-1"
                                title="Rimuovi opzione"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}

                        {q.type !== 'true_false' && q.options.length < 5 && (
                          <button
                            type="button"
                            onClick={() => handleAddOption(qIndex)}
                            className="text-[11px] text-[var(--primary)] hover:underline pt-1 flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Aggiungi ulteriore opzione
                          </button>
                        )}
                      </div>

                      {/* Formative Explanation (Rationale) */}
                      <div className="pt-2 border-t border-slate-800">
                        <label className="block text-[11px] font-semibold text-amber-300 flex items-center gap-1.5 mb-1">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                          Spiegazione Didattica / Rationale Formativo (visualizzato dopo la risposta dell'alunno)
                        </label>
                        <input
                          type="text"
                          value={q.explanation || ''}
                          onChange={e => handleUpdateQuestion(qIndex, 'explanation', e.target.value)}
                          placeholder="Spiega perché la risposta è corretta o evidenzia il concetto chiave della lezione..."
                          className="w-full p-2 rounded border border-amber-500/30 bg-amber-950/20 text-xs text-amber-200 placeholder-amber-400/50"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 pt-3 border-t border-[var(--border)]">
                  <button
                    type="submit"
                    disabled={isSavingTest}
                    className="flex-1 py-3 rounded-lg neon-btn-primary text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" /> Salva Tutte le Modifiche al Test
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingTest(false)}
                    className="px-5 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold"
                  >
                    Annulla
                  </button>
                </div>
              </fieldset>
            </form>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* SUB-TAB 3: SCHEDA CARTACEA / STAMPA & PDF */}
      {/* ============================================================== */}
      {activeSubTab === 'stampa' && currentSelectedTest && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="neon-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
            <div className="flex items-center gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                  Test da Stampare
                </label>
                <select
                  value={selectedTestId}
                  onChange={e => setSelectedTestId(e.target.value)}
                  className="p-2 neon-input text-xs text-white bg-slate-900"
                >
                  {Object.keys(tests).map(k => (
                    <option key={k} value={k}>
                      {tests[k].title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Version toggle */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs mt-3.5">
                <button
                  type="button"
                  onClick={() => setPrintDocenteMode(false)}
                  className={`px-3 py-1.5 rounded transition-all font-semibold ${
                    !printDocenteMode ? 'bg-[var(--primary)] text-[var(--primary-text)] font-bold' : 'text-slate-400'
                  }`}
                >
                  Scheda Alunno (Verifica)
                </button>
                <button
                  type="button"
                  onClick={() => setPrintDocenteMode(true)}
                  className={`px-3 py-1.5 rounded transition-all font-semibold ${
                    printDocenteMode ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400'
                  }`}
                >
                  Griglia Docente (Soluzioni)
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2.5 rounded-lg neon-btn-primary text-xs font-semibold flex items-center justify-center gap-2 self-start sm:self-auto"
            >
              <Printer className="w-4 h-4" /> Stampa Scheda / Salva in PDF
            </button>
          </div>

          {/* Printable Sheet Canvas */}
          <div className="bg-white text-slate-950 p-8 sm:p-12 rounded-xl shadow-xl max-w-4xl mx-auto border border-slate-300 font-sans print:p-0 print:border-none print:shadow-none">
            {/* School Header */}
            <div className="border-b-2 border-slate-900 pb-4 mb-6">
              <div className="flex justify-between items-start text-xs text-slate-700 mb-2">
                <div>
                  <div className="font-bold uppercase tracking-wider text-sm text-slate-900">
                    {settings?.school || "ISTITUTO D'ISTRUZIONE SECONDARIA"}
                  </div>
                  <div>Anno Scolastico: <b>{settings?.year || '2026/2027'}</b></div>
                </div>
                <div className="text-right">
                  <div>Disciplina: <b>{settings?.subject || 'Tecnologia / STEM'}</b></div>
                  <div>Docente: <b>{settings?.teacher || 'Professore'}</b></div>
                </div>
              </div>

              <div className="text-center my-4">
                <h1 className="text-xl sm:text-2xl font-black uppercase text-slate-900 tracking-tight">
                  {currentSelectedTest.title}
                </h1>
                <div className="text-xs text-slate-600 mt-1">
                  {printDocenteMode ? (
                    <span className="font-bold text-amber-800 uppercase px-2 py-0.5 bg-amber-100 rounded">
                      [ CHIAVE DI CORREZIONE E GRIGLIA DOCENTE ]
                    </span>
                  ) : (
                    <span>Verifica Formativa delle Competenze (D.M. 221/2025)</span>
                  )}
                </div>
              </div>

              {/* Student Metadata Fields */}
              <div className="grid grid-cols-12 gap-3 mt-4 pt-3 border-t border-slate-300 text-xs">
                <div className="col-span-6 sm:col-span-5">
                  <span className="font-bold">Alunno/a: </span>
                  <span className="border-b border-dotted border-slate-600 inline-block w-48 sm:w-56 h-4"></span>
                </div>
                <div className="col-span-3 sm:col-span-3">
                  <span className="font-bold">Classe: </span>
                  <span className="border-b border-dotted border-slate-600 inline-block w-16 h-4"></span>
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <span className="font-bold">Data: </span>
                  <span className="border-b border-dotted border-slate-600 inline-block w-16 h-4"></span>
                </div>
                <div className="col-span-12 sm:col-span-2 text-right">
                  <span className="font-bold">Voto: </span>
                  <span className="border border-slate-900 inline-block w-12 h-6 text-center leading-6 font-bold"></span>
                </div>
              </div>
            </div>

            {/* Questions List */}
            <div className="space-y-6">
              {currentSelectedTest.questions.map((q, idx) => (
                <div key={idx} className="page-break-inside-avoid">
                  <div className="flex items-start gap-2 text-sm font-bold text-slate-900 mb-2">
                    <span className="font-mono text-xs bg-slate-200 px-2 py-0.5 rounded">Q{idx + 1}</span>
                    <span>{q.q}</span>
                  </div>

                  {/* Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 ml-6 text-xs text-slate-800">
                    {q.options.map((opt, optIdx) => {
                      const isCorrect = optIdx === q.correct;
                      return (
                        <div
                          key={optIdx}
                          className={`p-2 rounded flex items-center gap-2 border ${
                            printDocenteMode && isCorrect
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold'
                              : 'border-slate-300'
                          }`}
                        >
                          <span className="w-5 h-5 rounded-full border border-slate-600 flex items-center justify-center font-mono text-[11px] shrink-0 font-bold">
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span>{opt}</span>
                          {printDocenteMode && isCorrect && (
                            <span className="ml-auto text-[10px] text-emerald-700 uppercase font-black">
                              ✓ Esatta
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Educational explanation in teacher mode */}
                  {printDocenteMode && q.explanation && (
                    <div className="mt-2 ml-6 p-2 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                      <b>Spiegazione didattica:</b> {q.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Bottom Evaluation Box */}
            <div className="mt-10 pt-4 border-t-2 border-slate-900 flex justify-between items-end text-xs text-slate-700">
              <div>
                <p className="italic">Note per l'alunno: Barrare una sola risposta per ogni quesito.</p>
                <p className="text-[10px] text-slate-500 mt-1">
                  Generato con Registro Docente & Flashcards Pro Neon
                </p>
              </div>
              <div className="text-right">
                <div className="border-t border-slate-400 pt-1 w-48 text-center">
                  Firma del Docente
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SUB-TAB 4: ESITI, ITEM ANALYSIS & DIDATTICA FORMATIVA */}
      {/* ============================================================== */}
      {activeSubTab === 'analisi' && (
        <div className="space-y-4">
          {/* Item Analysis Card for Selected Test */}
          <div className="neon-card neon-card-highlight p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[var(--border)]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Item Analysis Formativa per Domanda
                </h3>
                <p className="text-xs text-slate-400">
                  Analisi statistica delle risposte: individua immediatamente le domande critiche su cui svolgere il recupero o debriefing didattico.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400">Analizza Test:</label>
                <select
                  value={selectedTestId}
                  onChange={e => setSelectedTestId(e.target.value)}
                  className="p-2 neon-input text-xs text-white bg-slate-900"
                >
                  {Object.keys(tests).map(k => (
                    <option key={k} value={k}>
                      {tests[k].title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Questions breakdown */}
            <div className="space-y-3">
              {itemAnalysis.map((item, idx) => {
                const isCritical = item.percent !== null && item.percent < 50;
                const isGood = item.percent !== null && item.percent >= 75;

                return (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border transition-all text-xs ${
                      isCritical
                        ? 'border-rose-500/50 bg-rose-950/20'
                        : isGood
                        ? 'border-emerald-500/40 bg-emerald-950/20'
                        : 'border-[var(--border)] bg-[var(--surface-variant)]'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-200 font-mono text-[11px] flex items-center justify-center font-bold">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-slate-200">{item.questionText}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.percent !== null ? (
                          <>
                            <span className="font-mono font-bold text-sm text-white">
                              {item.percent}% esatte
                            </span>
                            <span className="text-[10px] text-slate-400">
                              ({item.correctAttempts}/{item.totalAttempts} alunni)
                            </span>
                            {isCritical && (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> Nodo Critico
                              </span>
                            )}
                            {isGood && (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                                Consolidato ✓
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">Nessun dato di risposta</span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {item.percent !== null && (
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-2">
                        <div
                          className={`h-full transition-all duration-500 ${
                            isCritical ? 'bg-rose-500' : isGood ? 'bg-emerald-400' : 'bg-amber-400'
                          }`}
                          style={{ width: `${item.percent}%` }}
                        />
                      </div>
                    )}

                    <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-3">
                      <span>Risposta Corretta: <b className="text-emerald-300">{item.correctAnswer}</b></span>
                      {item.explanation && (
                        <span>· Spiegazione: <i className="text-amber-200">{item.explanation}</i></span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Submissions List Card */}
          <div className="neon-card p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[var(--border)]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  Consegne Ricevute dagli Alunni ({submissions.length})
                </h3>
                <p className="text-xs text-slate-400">
                  Esiti inviati dagli studenti durante le prove con flashcards o verifiche online.
                </p>
              </div>

              <button
                type="button"
                onClick={handleImportSubmissions}
                disabled={isSubmissionActionPending}
                className="px-3.5 py-2 rounded-lg neon-btn-primary text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Download className="w-4 h-4" /> Importa Voti nel Registro
              </button>
            </div>

            {submissions.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                Nessuna consegna online registrata al momento. Condividi il link Padlet per raccogliere i primi risultati!
              </p>
            ) : (
              <div className="overflow-x-auto border border-[var(--border)] rounded-lg">
                <table className="w-full text-xs text-center border-collapse">
                  <thead>
                    <tr className="bg-[var(--surface-variant)] text-slate-400 uppercase tracking-wider text-[10px] font-semibold">
                      <th className="p-2.5 text-left border-r border-[var(--border)]">Alunno</th>
                      <th className="p-2.5 border-r border-[var(--border)]">Classe</th>
                      <th className="p-2.5 text-left border-r border-[var(--border)]">Test Svolto</th>
                      <th className="p-2.5 border-r border-[var(--border)]">Punteggio</th>
                      <th className="p-2.5 border-r border-[var(--border)]">Voto Conv.</th>
                      <th className="p-2.5 border-r border-[var(--border)]">Data</th>
                      <th className="p-2.5">Azione</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {submissions.map(sub => {
                      const grade10 = sub.total > 0 ? Math.round((sub.score / sub.total) * 10 * 10) / 10 : 0;
                      return (
                        <tr key={sub.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-2.5 text-left font-semibold text-slate-100 border-r border-[var(--border)]">
                            {formatStudentNameWithPrivacy(sub.name, isPrivacyShieldActive)}
                          </td>
                          <td className="p-2.5 border-r border-[var(--border)]">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-cyan-300 font-mono">
                              {sub.class}
                            </span>
                          </td>
                          <td className="p-2.5 text-left text-slate-300 border-r border-[var(--border)] truncate max-w-[180px]">
                            {sub.testTitle}
                          </td>
                          <td className="p-2.5 border-r border-[var(--border)] font-mono font-bold text-white">
                            {sub.score} / {sub.total}
                          </td>
                          <td className="p-2.5 border-r border-[var(--border)] font-mono font-bold">
                            <span className={grade10 >= 6 ? 'text-emerald-400' : 'text-rose-400'}>
                              {grade10} / 10
                            </span>
                          </td>
                          <td className="p-2.5 border-r border-[var(--border)] text-slate-400 text-[11px]">
                            {new Date(sub.date).toLocaleDateString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="p-2.5">
                            <button
                              type="button"
                              onClick={() => { void handleDeleteSubmission(sub); }}
                              disabled={isSubmissionActionPending}
                              className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40"
                              title="Elimina consegna"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
