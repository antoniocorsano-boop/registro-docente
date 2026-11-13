import React, { useState, useEffect, useRef } from 'react';
import { ClassData, EvaluationType, Grade, UdaRecord } from '../types';
import { normalizeGrade, today, TYPES_LABEL, uid, formatStudentNameWithPrivacy } from '../utils';
import { Save, X, Calendar, BookOpen, Layers, Check, Clock } from 'lucide-react';
import { MOBILE_TOUCH_TARGET_CLASS } from './mobileTouch';

export interface EvaluationDraftGuard {
  hasUnsavedChanges:()=>boolean;
  discardChanges:()=>void;
  markCommitted:()=>void;
}

interface EvaluationsViewProps {
  compact?: boolean;
  onRegisterDraftGuard?: (guard: EvaluationDraftGuard | null)=>void;
  currentClass: ClassData;
  editingBatchId: string | null;
  udas?: UdaRecord[];
  initialUdaId?: string;
  initialDate?: string;
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

const isIsoDate = (value?: string): value is string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export const EvaluationsView: React.FC<EvaluationsViewProps> = ({
  currentClass,
  compact = false,
  onRegisterDraftGuard,
  editingBatchId,
  udas = [],
  initialUdaId,
  initialDate,
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
  const evaluationInitializationSignatureRef = useRef<string | null>(null);
  const dirtyRef=useRef(false);
  const submittingRef=useRef(false);
  const committedRef=useRef(false);
  const [committed,setCommitted]=useState(false);
  const [validationMessage,setValidationMessage]=useState('');
  const [showProofDetails,setShowProofDetails]=useState(true);
  React.useLayoutEffect(()=>{
    if(!compact||!onRegisterDraftGuard)return;
    const guard:EvaluationDraftGuard={hasUnsavedChanges:()=>dirtyRef.current,markCommitted:()=>{dirtyRef.current=false;committedRef.current=true;setCommitted(true);},discardChanges:()=>{dirtyRef.current=false;setGradesMap({});setTitle('');setUdaId('');setValidationMessage('');}};
    onRegisterDraftGuard(guard);
    return ()=>onRegisterDraftGuard(null);
  },[compact,onRegisterDraftGuard,currentClass.id]);

  useEffect(() => {
    const safeInitialUdaId = udas.some(u => u.id === initialUdaId && u.className === currentClass.name) ? initialUdaId || '' : '';
    const signature = JSON.stringify([
      currentClass.id,
      editingBatchId,
      editingBatchId ? null : safeInitialUdaId,
      editingBatchId ? null : (isIsoDate(initialDate) ? initialDate : null)
    ]);
    if (evaluationInitializationSignatureRef.current === signature) return;
    evaluationInitializationSignatureRef.current = signature;

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
      setTitle('');
      setDate(isIsoDate(initialDate) ? initialDate! : today());
      setUdaId(safeInitialUdaId);
      setGradesMap({});
    }
  }, [editingBatchId, currentClass, udas, initialUdaId, initialDate]);

  const handleInputChange = (studentId: string, rawVal: string) => {
    if(compact)dirtyRef.current=true;
    setValidationMessage('');
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
    if(compact)dirtyRef.current=true;
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
    if (submittingRef.current || (compact&&committedRef.current)) return;
    if(compact){
      if(!isIsoDate(date)||!title.trim()){setShowProofDetails(true);setValidationMessage('Indica data e argomento della prova.');return;}
      if(udaId && (udas.filter(u=>u.id===udaId).length!==1||!udas.some(u=>u.id===udaId&&u.className===currentClass.name))){setValidationMessage('L’unità di apprendimento non è più disponibile.');return;}
      if(currentClass.students.some(s=>gradesMap[s.id]?.value.trim()&&!normalizeGrade(gradesMap[s.id].value))){setValidationMessage('Controlla i voti non validi: nessuna valutazione è stata salvata.');return;}
    }

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
    submittingRef.current=true;
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
      submittingRef.current=false;
      setIsSaving(false);
    }
  };

  if(compact&&committed)return <div data-testid="matrix-evaluation-committed" className="space-y-3"><p role="status">Valutazioni salvate.</p><button type="button" onClick={onCancelEdit} className="min-h-[48px] w-full rounded-lg neon-btn-primary font-semibold">Torna al Tabellone</button></div>;
  return (
    <div data-testid={compact?"matrix-evaluation-editor":undefined} className={compact?"matrix-evaluation-workspace min-w-0 space-y-3":"neon-card neon-card-highlight p-5"}>
      <div className={compact?"matrix-evaluation-heading mb-3 pb-2 border-b border-[var(--border)]":"flex items-center justify-between mb-4 pb-3 border-b border-[var(--border)]"}>
        <div>
          <h3 className="text-lg font-bold text-[var(--primary)] drop-shadow-[0_0_8px_var(--primary)]">
            {compact ? 'Inserisci valutazione' : editingBatchId ? 'Modifica Valutazione Esistente' : 'Nuova Valutazione di Classe'}
          </h3>
          {!compact && <p className="text-xs text-slate-400">
            Inserisci i voti numerici (1-10, +, -, ½) o codici speciali (A = Assente, NC = Non Classificato, G = Giustificato).
          </p>}
        </div>

        {(editingBatchId || compact) && (
          <button
            type="button"
            onClick={onCancelEdit}
            disabled={isSaving}
            className={`${MOBILE_TOUCH_TARGET_CLASS} ${compact?"matrix-evaluation-cancel":""} px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-1.5`}
          >
            <X className="w-3.5 h-3.5" /> {compact?'Annulla':'Annulla Modifica'}
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} onChangeCapture={()=>{if(compact)dirtyRef.current=true;}} className="space-y-4">
        <fieldset disabled={isSaving} className="space-y-4 border-0 p-0 m-0 min-w-0">
        {compact && !showProofDetails && <div className="matrix-evaluation-proof-summary"><div className="min-w-0"><strong className="block break-words">{title||"Prova"}</strong><p className="text-xs text-slate-400 break-words">{TYPES_LABEL[type]} · {date} · {period==="Q1"?"Primo periodo":"Secondo periodo"}</p>{udaId && <p className="text-xs text-slate-400 break-words">{udas.find(u=>u.id===udaId)?.title||"UDA da verificare"}</p>}</div><button type="button" onClick={()=>setShowProofDetails(true)} className="min-h-[48px] px-2 rounded border border-[var(--border)] text-sm">Modifica dati</button></div>}
        <div hidden={compact&&!showProofDetails} className={compact?"matrix-evaluation-proof space-y-3":"space-y-4"}>
        <div className={compact?"matrix-evaluation-fields gap-2 min-w-0":"grid grid-cols-1 sm:grid-cols-3 gap-3"}>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              {compact?"Periodo":"Periodo Didattico"}
            </label>
            <select
              aria-label="Periodo didattico"
              value={period}
              onChange={e => setPeriod(e.target.value as 'Q1' | 'Q2')}
              className="w-full p-2.5 neon-input text-xs sm:text-sm text-white bg-slate-900"
            >
              <option value="Q1">{compact?"Primo periodo":"1° Quadrimestre (Soglia Intermedia)"}</option>
              <option value="Q2">{compact?"Secondo periodo":"2° Quadrimestre (Soglia Finale)"}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              {compact?"Tipologia":"Tipologia Prova"}
            </label>
            <select
              aria-label="Tipologia prova"
              value={type}
              onChange={e => setType(e.target.value as EvaluationType)}
              className="w-full p-2.5 neon-input text-xs sm:text-sm text-white bg-slate-900"
            >
              <option value="test">{compact?"Test / Quiz":"Test / Quiz Formativo"}</option>
              <option value="verifica">{compact?"Verifica scritta":"Verifica Scritta Sommativa"}</option>
              <option value="orale">{compact?"Orale":"Colloquio Orale"}</option>
              <option value="disegno">{compact?"Disegno":"Disegno Tecnico / Grafica"}</option>
              <option value="osserv">{compact?"Osservazione":"Osservazione Sistematica"}</option>
            </select>
          </div>

          <div className={compact?"matrix-evaluation-uda min-w-0":undefined}>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              {compact?"UDA (facoltativa)":"Collega a UDA Curricolare"}
            </label>
            <select
              aria-label="Collega a UDA Curricolare"
              value={udaId}
              onChange={e => setUdaId(e.target.value)}
              className="w-full p-2.5 neon-input text-xs sm:text-sm text-white bg-slate-900"
            >
              <option value="">-- Nessuna UDA associata --</option>
              {udas.filter(u => u.className === currentClass.name).map(u => (
                <option key={u.id} value={u.id}>
                  {u.className} · {u.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={compact?"matrix-evaluation-fields gap-2":"grid grid-cols-1 sm:grid-cols-2 gap-3"}>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              {compact?"Data":"Data Svolgimento"}
            </label>
            <input
              aria-label="Data svolgimento"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full p-2.5 neon-input text-xs sm:text-sm text-white"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              {compact?"Argomento":"Titolo / Argomento Prova"}
            </label>
            <input
              aria-label="Titolo / Argomento prova"
              type="text"
              placeholder="es. Verifica su Fonti Rinnovabili"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full p-2.5 neon-input text-xs sm:text-sm text-white placeholder-slate-500"
            />
          </div>
        </div>

        {compact && <button type="button" onClick={()=>{if(!title.trim()||!isIsoDate(date)){setValidationMessage("Indica data e argomento della prova.");return;}setValidationMessage("");setShowProofDetails(false);}} className="w-full min-h-[48px] rounded-lg border border-[var(--border)] text-sm font-semibold">Vai ai voti</button>}
        </div>
        {!compact && <div className="flex items-center gap-2 flex-wrap pt-1">
          <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
            Compilazione rapida:
          </span>
          {['6', '7', '8', 'A'].map(qv => (
            <button
              key={qv}
              type="button"
              onClick={() => handleQuickFill(qv)}
              className={`${MOBILE_TOUCH_TARGET_CLASS} px-2 py-0.5 rounded text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono`}
            >
              Tutti {qv}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setGradesMap({})}
            className={`${MOBILE_TOUCH_TARGET_CLASS} px-2 py-0.5 rounded text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700`}
          >
            Svuota
          </button>
        </div>}

        {compact && <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><strong>Alunni</strong><span>{currentClass.students.filter(s=>gradesMap[s.id]?.value.trim()).length} / {currentClass.students.length} inseriti</span></div>}
        <div className={compact?"divide-y divide-[var(--border)] border-y border-[var(--border)]":"border border-[var(--border)] rounded-lg overflow-hidden bg-slate-900/60 divide-y divide-[var(--border)] max-h-[50vh] overflow-y-auto"}>
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
                  data-testid={compact?"matrix-evaluation-row":undefined}
                  className={compact?"matrix-evaluation-row min-h-[48px] py-1 gap-2 min-w-0":"p-2.5 px-3 flex items-center justify-between gap-3 hover:bg-slate-800/40 transition-colors"}
                >
                  <div className={compact?"matrix-evaluation-name":"flex items-center gap-2 overflow-hidden"}>
                    <span className={compact?"text-slate-400 text-xs shrink-0":"text-slate-500 font-mono text-xs w-5 text-right"}>{idx + 1}.</span>
                    <span className={compact?"font-medium text-slate-200 text-sm min-w-0":"font-semibold text-slate-200 text-xs sm:text-sm truncate"}>
                      {formatStudentNameWithPrivacy(student.name, isPrivacyShieldActive)}
                    </span>
                  </div>

                  <div className={compact?"matrix-evaluation-actions":"flex items-center gap-2 shrink-0"}>
                    <button
                      type="button"
                      onClick={() => toggleDelayed(student.id)}
                      className={`${MOBILE_TOUCH_TARGET_CLASS} p-1.5 ${compact?"matrix-evaluation-recovery":""} rounded text-[10px] font-semibold flex items-center gap-1 border transition-all ${
                        isDelayed
                          ? 'bg-amber-950/60 border-amber-500 text-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.25)]'
                          : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
                      }`}
                      aria-label={compact?"Recupero alunno "+(idx+1):undefined}
                      aria-pressed={isDelayed}
                      title="Contrassegna come prova di recupero / svolta in ritardo"
                    >
                      <Clock className={compact?'w-[18px] h-[18px] shrink-0':'w-3 h-3'} />
                      {!compact && <span>{isDelayed ? 'Ritardo (R)' : 'R'}</span>}
                    </button>

                    <input
                      type="text"
                      aria-label={compact?"Voto alunno "+(idx+1):undefined}
                      value={currentRecord.value}
                      onChange={e => handleInputChange(student.id, e.target.value)}
                      placeholder={compact?"—":"es. 7.5"}
                      className={compact?"matrix-evaluation-vote min-h-[48px] p-1 text-center font-semibold text-base neon-input text-white uppercase":"w-20 sm:w-24 p-1.5 text-center font-bold text-xs sm:text-sm neon-input text-white uppercase placeholder-slate-600"}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {compact && <p className="text-xs text-slate-400 break-words">A: assente · NC: non classificato · G: giustificato · <Clock className="inline w-[16px] h-[16px]"/> recupero</p>}
        {validationMessage && <p role="alert" className="text-sm text-amber-200">{validationMessage}</p>}
        <button
          type="submit"
          disabled={isSaving}
          className={`${compact?"min-h-[48px] ":""}w-full py-3 rounded-lg neon-btn-primary text-sm font-semibold flex items-center justify-center gap-2 shadow-lg`}
        >
          <Save className="w-4 h-4" />
          <span>{isSaving?'Salvataggio…':compact?'Salva valutazioni':editingBatchId ? 'Aggiorna Valutazione' : 'Salva Valutazioni di Classe'}</span>
        </button>
        </fieldset>
      </form>
    </div>
  );
};
