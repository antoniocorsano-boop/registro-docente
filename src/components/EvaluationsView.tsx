import React, { useState, useEffect } from 'react';
import { ClassData, EvaluationType, Grade, UdaRecord } from '../types';
import { normalizeGrade, today, TYPES_LABEL, uid, formatStudentNameWithPrivacy } from '../utils';
import { Save, X, Calendar, BookOpen, Layers, Check, Clock } from 'lucide-react';

interface EvaluationsViewProps {
  currentClass: ClassData;
  editingBatchId: string | null;
  udas?: UdaRecord[];
  onSaveEvaluations: (batchData: {
    batchId: string;
    period: 'Q1' | 'Q2';
    type: EvaluationType;
    date: string;
    title: string;
    udaId?: string;
    grades: { studentId: string; value: string; delayed: boolean }[];
  }) => Promise<void>;
  onCancelEdit: () => void;
  isPrivacyShieldActive?: boolean;
}

export const EvaluationsView: React.FC<EvaluationsViewProps> = ({
  currentClass,
  editingBatchId,
  udas = [],
  onSaveEvaluations,
  onCancelEdit,
  isPrivacyShieldActive = true
}) => {

  const [period, setPeriod] = useState<'Q1' | 'Q2'>('Q1');
  const [type, setType] = useState<EvaluationType>('test');
  const [date, setDate] = useState<string>(today());
  const [title, setTitle] = useState<string>('');
  const [udaId, setUdaId] = useState<string>('');
  const [gradesMap, setGradesMap] = useState<Record<string, { value: string; delayed: boolean }>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (editingBatchId) {
      const existingGrades = (currentClass.grades || []).filter(g => g.batchId === editingBatchId);
      if (existingGrades.length > 0) {
        setPeriod(existingGrades[0].period || 'Q1');
        setType(existingGrades[0].type || 'test');
        setDate(existingGrades[0].date || today());
        setTitle(existingGrades[0].title || '');
        setUdaId(existingGrades[0].udaId || '');

        const newMap: Record<string, { value: string; delayed: boolean }> = {};
        existingGrades.forEach(g => {
          newMap[g.studentId] = {
            value: g.value,
            delayed: !!g.delayed
          };
        });
        setGradesMap(newMap);
      }
    } else {
      // Clear or initialize
      setTitle('');
      setDate(today());
      setUdaId('');
      setGradesMap({});
    }
  }, [editingBatchId, currentClass]);

  const handleInputChange = (studentId: string, rawVal: string) => {
    const isDelayed = rawVal.toUpperCase().includes('R') || rawVal.toUpperCase().includes('RIT');
    setGradesMap(prev => ({
      ...prev,
      [studentId]: {
        value: rawVal,
        delayed: isDelayed || !!prev[studentId]?.delayed
      }
    }));
  };

  const toggleDelayed = (studentId: string) => {
    setGradesMap(prev => ({
      ...prev,
      [studentId]: {
        value: prev[studentId]?.value || '',
        delayed: !prev[studentId]?.delayed
      }
    }));
  };

  const handleQuickFill = (val: string) => {
    const newMap: Record<string, { value: string; delayed: boolean }> = {};
    currentClass.students.forEach(s => {
      newMap[s.id] = { value: val, delayed: false };
    });
    setGradesMap(newMap);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const staged: { studentId: string; value: string; delayed: boolean }[] = [];
    currentClass.students.forEach(s => {
      const record = gradesMap[s.id];
      if (record && record.value.trim() !== '') {
        const parsed = normalizeGrade(record.value);
        if (parsed) {
          staged.push({
            studentId: s.id,
            value: parsed.value,
            delayed: record.delayed || parsed.delayed
          });
        }
      }
    });

    if (staged.length === 0) {
      alert('Inserisci almeno un voto valido prima di salvare (es. 8, 7.5, 6+, 6½, A, NC, G).');
      return;
    }

    const batchId = editingBatchId || uid();
    setIsSaving(true);
    try {
      await onSaveEvaluations({
        batchId,
        period,
        type,
        date,
        title: title.trim() || `${TYPES_LABEL[type]} del ${date}`,
        udaId: udaId || undefined,
        grades: staged
      });
    } catch {
      return;
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="neon-card neon-card-highlight p-5">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--border)]">
        <div>
          <h3 className="text-lg font-bold text-[var(--primary)] drop-shadow-[0_0_8px_var(--primary)]">
            {editingBatchId ? 'Modifica Valutazione Esistente' : 'Nuova Valutazione di Classe'}
          </h3>
          <p className="text-xs text-slate-400">
            Inserisci i voti numerici (1-10, +, -, ½) o codici speciali (A = Assente, NC = Non Classificato, G = Giustificato).
          </p>
        </div>

        {editingBatchId && (
          <button
            type="button"
            onClick={onCancelEdit}
            disabled={isSaving}
            className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" /> Annulla Modifica
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset disabled={isSaving} className="space-y-4 border-0 p-0 m-0 min-w-0">
        {/* Row 1: Period, Type & UDA */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Periodo Didattico
            </label>
            <select
              value={period}
              onChange={e => setPeriod(e.target.value as 'Q1' | 'Q2')}
              className="w-full p-2.5 neon-input text-xs sm:text-sm text-white bg-slate-900"
            >
              <option value="Q1">1° Quadrimestre (Soglia Intermedia)</option>
              <option value="Q2">2° Quadrimestre (Soglia Finale)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Tipologia Prova
            </label>
            <select
              value={type}
              onChange={e => setType(e.target.value as EvaluationType)}
              className="w-full p-2.5 neon-input text-xs sm:text-sm text-white bg-slate-900"
            >
              <option value="test">Test / Quiz Formativo</option>
              <option value="verifica">Verifica Scritta Sommativa</option>
              <option value="orale">Colloquio Orale</option>
              <option value="disegno">Disegno Tecnico / Grafica</option>
              <option value="osserv">Osservazione Sistematica</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Collega a UDA Curricolare
            </label>
            <select
              value={udaId}
              onChange={e => setUdaId(e.target.value)}
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

        {/* Row 2: Date & Title */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Data Svolgimento
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full p-2.5 neon-input text-xs sm:text-sm text-white"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Titolo / Argomento Prova
            </label>
            <input
              type="text"
              placeholder="es. Verifica su Fonti Rinnovabili"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full p-2.5 neon-input text-xs sm:text-sm text-white placeholder-slate-500"
            />
          </div>
        </div>

        {/* Quick Fill suggestions */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
            Compilazione rapida:
          </span>
          {['6', '7', '8', 'A'].map(qv => (
            <button
              key={qv}
              type="button"
              onClick={() => handleQuickFill(qv)}
              className="px-2 py-0.5 rounded text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono"
            >
              Tutti {qv}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setGradesMap({})}
            className="px-2 py-0.5 rounded text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700"
          >
            Svuota
          </button>
        </div>

        {/* Students Grade Input List */}
        <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-slate-900/60 divide-y divide-[var(--border)] max-h-[50vh] overflow-y-auto">
          {currentClass.students.length === 0 ? (
            <p className="p-4 text-xs text-slate-400 text-center">
              Nessun alunno presente in questa classe. Aggiungili dalla sezione "Gestione Alunni".
            </p>
          ) : (
            currentClass.students.map((student, idx) => {
              const currentRecord = gradesMap[student.id] || { value: '', delayed: false };
              const isDelayed = currentRecord.delayed;

              return (
                <div
                  key={student.id}
                  className="p-2.5 px-3 flex items-center justify-between gap-3 hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-slate-500 font-mono text-xs w-5 text-right">{idx + 1}.</span>
                    <span className="font-semibold text-slate-200 text-xs sm:text-sm truncate">
                      {formatStudentNameWithPrivacy(student.name, isPrivacyShieldActive)}
                    </span>

                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleDelayed(student.id)}
                      className={`p-1.5 rounded text-[10px] font-semibold flex items-center gap-1 border transition-all ${
                        isDelayed
                          ? 'bg-amber-950/60 border-amber-500 text-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.25)]'
                          : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
                      }`}
                      title="Contrassegna come prova di recupero / svolta in ritardo"
                    >
                      <Clock className="w-3 h-3" />
                      <span>{isDelayed ? 'Ritardo (R)' : 'R'}</span>
                    </button>

                    <input
                      type="text"
                      value={currentRecord.value}
                      onChange={e => handleInputChange(student.id, e.target.value)}
                      placeholder="es. 7.5"
                      className="w-20 sm:w-24 p-1.5 text-center font-bold text-xs sm:text-sm neon-input text-white uppercase placeholder-slate-600"
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSaving}
          className="w-full py-3 rounded-lg neon-btn-primary text-sm font-semibold flex items-center justify-center gap-2 shadow-lg"
        >
          <Save className="w-4 h-4" />
          <span>{editingBatchId ? 'Aggiorna Valutazione' : 'Salva Valutazioni di Classe'}</span>
        </button>
        </fieldset>
      </form>
    </div>
  );
};
