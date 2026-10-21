import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { OnlineSubmission, OnlineTest } from '../types';
import { uid } from '../utils';
import { ArrowRight, CheckCircle2, RotateCcw, XCircle, Award, Lightbulb, AlertCircle } from 'lucide-react';

interface StudentPortalProps {
  tests: Record<string, OnlineTest>;
  defaultTestId?: string;
  defaultClassName?: string;
  onSaveSubmission: (submission: OnlineSubmission) => Promise<void>;
  onExit: () => void;
}

export const StudentPortal: React.FC<StudentPortalProps> = ({
  tests,
  defaultTestId = 'energia',
  defaultClassName = '3ª A',
  onSaveSubmission,
  onExit
}) => {
  const currentTest = tests[defaultTestId] || Object.values(tests)[0] || {
    id: 'sample',
    title: 'Test Formativo',
    questions: []
  };

  const [step, setStep] = useState<'login' | 'quiz' | 'result'>('login');
  const [studentName, setStudentName] = useState('');
  const [selectedClass, setSelectedClass] = useState(defaultClassName);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [userAnswers, setUserAnswers] = useState<{ questionIndex: number; selected: number; isCorrect: boolean }[]>([]);

  const startQuiz = () => {
    if (!studentName.trim()) {
      alert('Per favore, inserisci Cognome e Nome prima di iniziare.');
      return;
    }
    setCurrentIndex(0);
    setScore(0);
    setUserAnswers([]);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setStep('quiz');
  };

  const handleSelectOption = (idx: number) => {
    if (isAnswered) return;
    setSelectedAnswer(idx);
    setIsAnswered(true);

    const question = currentTest.questions[currentIndex];
    const isCorrect = idx === question.correct;
    if (isCorrect) {
      setScore(prev => prev + 1);
    }

    setUserAnswers(prev => [
      ...prev.filter(a => a.questionIndex !== currentIndex),
      { questionIndex: currentIndex, selected: idx, isCorrect }
    ]);
  };

  const handleNext = () => {
    if (currentIndex + 1 < currentTest.questions.length) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setIsAnswered(false);
    } else {
      // Finished
      const finalScore = score;
      const total = currentTest.questions.length;
      setStep('result');

      // Trigger confetti celebration
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {}

      const submission: OnlineSubmission = {
        id: uid(),
        testId: currentTest.id,
        name: studentName.trim(),
        class: selectedClass,
        testTitle: currentTest.title,
        score: finalScore,
        total: total,
        date: new Date().toISOString(),
        answers: userAnswers
      };

      void onSaveSubmission(submission).catch(error => {
        console.error('Secure submission save failed', error);
        alert('La consegna non è stata salvata nel vault locale. Avvisa il docente.');
      });
    }
  };

  const currentQ = currentTest.questions[currentIndex];
  const progressPercent = currentTest.questions.length > 0
    ? Math.round(((currentIndex + 1) / currentTest.questions.length) * 100)
    : 0;

  const finalGrade = currentTest.questions.length > 0
    ? Math.round((score / currentTest.questions.length) * 10 * 10) / 10
    : 0;

  return (
    <div className="fixed inset-0 z-50 bg-[#030712] overflow-y-auto p-4 sm:p-6 flex justify-center items-start">
      <div className="w-full max-w-lg mt-6 sm:mt-12 neon-card neon-card-highlight p-6">
        <div className="flex justify-between items-center mb-4">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold badge-info">
            <Award className="w-3.5 h-3.5" /> Flashcard Formativa
          </span>
          <button
            onClick={onExit}
            className="text-xs px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            Esci / Torna al Registro
          </button>
        </div>

        <h1 className="text-xl font-bold text-[var(--primary)] mb-2 drop-shadow-[0_0_8px_var(--primary)]">
          {currentTest.title}
        </h1>

        {step === 'login' && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-slate-400">
              Benvenuto! Inserisci i tuoi dati per iniziare la sessione di flashcards formative. I risultati verranno inviati al registro del docente.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Cognome e Nome
              </label>
              <input
                type="text"
                placeholder="es. Rossi Maria"
                value={studentName}
                onChange={e => setStudentName(e.target.value)}
                className="w-full p-3 neon-input text-sm text-white placeholder-slate-500"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Classe
              </label>
              <select
                value={selectedClass}
                onChange={e => setSelectedClass(e.target.value)}
                className="w-full p-3 neon-input text-sm text-white bg-slate-900"
              >
                <option value="3ª A">3ª A</option>
                <option value="3ª B">3ª B</option>
                <option value="3ª C">3ª C</option>
                <option value="3ª D">3ª D</option>
                <option value="1ª A">1ª A</option>
                <option value="2ª A">2ª A</option>
              </select>
            </div>

            <button
              onClick={startQuiz}
              className="w-full py-3.5 mt-2 rounded-lg neon-btn-primary flex items-center justify-center gap-2"
            >
              Inizia Flashcard <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 'quiz' && currentQ && (
          <div className="mt-4">
            <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
              <span>Domanda {currentIndex + 1} di {currentTest.questions.length}</span>
              <span className="font-semibold text-[var(--primary)]">{progressPercent}%</span>
            </div>

            <div className="w-full bg-slate-800 h-2 rounded-full mb-5 overflow-hidden border border-slate-700">
              <div
                className="h-full bg-[var(--primary)] transition-all duration-300 shadow-[0_0_10px_var(--primary)]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <h3 className="text-base sm:text-lg font-semibold text-slate-100 mb-5 leading-relaxed">
              {currentQ.q}
            </h3>

            <div className="space-y-2.5">
              {currentQ.options.map((opt, idx) => {
                let btnStyle = 'border-slate-800 bg-slate-900/80 hover:bg-slate-800/80 text-slate-200';
                let icon = null;

                if (isAnswered) {
                  if (idx === currentQ.correct) {
                    btnStyle = 'border-emerald-500 bg-emerald-950/60 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.3)] font-semibold';
                    icon = <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
                  } else if (idx === selectedAnswer) {
                    btnStyle = 'border-rose-500 bg-rose-950/60 text-rose-200 shadow-[0_0_15px_rgba(244,63,94,0.3)]';
                    icon = <XCircle className="w-5 h-5 text-rose-400 shrink-0" />;
                  } else {
                    btnStyle = 'border-slate-800 bg-slate-900/40 text-slate-500 opacity-60';
                  }
                }

                return (
                  <button
                    key={idx}
                    disabled={isAnswered}
                    onClick={() => handleSelectOption(idx)}
                    className={`w-full p-3.5 rounded-lg border text-left text-sm transition-all flex items-center justify-between gap-3 ${btnStyle}`}
                  >
                    <span>{opt}</span>
                    {icon}
                  </button>
                );
              })}
            </div>

            {/* Immediate Formative Feedback & Rationale */}
            {isAnswered && (
              <div className="mt-4 p-3.5 rounded-lg border bg-slate-900/90 text-xs transition-all space-y-2 border-slate-700">
                <div className="flex items-center gap-2 font-semibold">
                  {selectedAnswer === currentQ.correct ? (
                    <span className="text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Ottimo lavoro! Risposta corretta.
                    </span>
                  ) : (
                    <span className="text-rose-400 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" /> Risposta non corretta.
                    </span>
                  )}
                </div>

                {currentQ.explanation && (
                  <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-200/90 flex items-start gap-2 text-[12px] leading-relaxed">
                    <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <b className="text-amber-300 font-semibold">Spiegazione didattica:</b> {currentQ.explanation}
                    </div>
                  </div>
                )}
              </div>
            )}

            {isAnswered && (
              <button
                onClick={handleNext}
                className="w-full py-3.5 mt-4 rounded-lg neon-btn-primary flex items-center justify-center gap-2 animate-pulse"
              >
                {currentIndex + 1 < currentTest.questions.length ? (
                  <>Prossima Scheda <ArrowRight className="w-4 h-4" /></>
                ) : (
                  <>Completa e Consegna <Award className="w-4 h-4" /></>
                )}
              </button>
            )}
          </div>
        )}

        {step === 'result' && (
          <div className="mt-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 mb-2">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <h2 className="text-2xl font-bold text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.4)]">
              Flashcard Completata con Successo!
            </h2>
            <p className="text-sm text-slate-300">
              Bravo/a, <b>{studentName}</b>! La tua prova è stata registrata correttamente per la classe <b>{selectedClass}</b>.
            </p>

            <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-xl my-4">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold block mb-1">
                Punteggio & Valutazione Calcolata
              </span>
              <div className="text-3xl font-extrabold text-[var(--primary)] drop-shadow-[0_0_10px_var(--primary)]">
                {finalGrade} <span className="text-base text-slate-400">/ 10</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Risposte corrette: {score} su {currentTest.questions.length}
              </div>
            </div>

            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={() => {
                  setStep('login');
                  setStudentName('');
                }}
                className="px-5 py-2.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-sm font-semibold flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> Nuova Prova
              </button>
              <button
                onClick={onExit}
                className="px-5 py-2.5 rounded-lg neon-btn-primary text-sm font-semibold"
              >
                Torna al Registro
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
