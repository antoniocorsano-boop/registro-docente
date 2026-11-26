import React, { useEffect, useRef, useState } from 'react';
import { STUDENT_IMPORT_LIMITS, studentImportFormat, type StudentImportFormat } from './studentImportLimits';
import { ClassData, Student } from '../types';
import { formatStudentNameWithPrivacy, sanitizeName, uid } from '../utils';
import { Users, UserPlus, RefreshCw, Trash2, FileSpreadsheet } from 'lucide-react';

function readRosterOffThread(
  buffer: ArrayBuffer, format: StudentImportFormat, existingNames: string[], signal: AbortSignal
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(); return; }
    const worker = new Worker(new URL('./studentImport.worker.ts', import.meta.url), { type: 'module' });
    const finish = (names?: string[]) => {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      worker.terminate();
      if (names) resolve(names);
      else reject();
    };
    const abort = () => finish();
    const timeout = window.setTimeout(abort, 10_000);
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data }) => finish(data.names);
    worker.onerror = event => { event.preventDefault(); finish(); };
    worker.onmessageerror = abort;
    try { worker.postMessage({ buffer, format, existingNames }, [buffer]); }
    catch { finish(); }
  });
}

interface StudentsManagementViewProps {
  currentClass: ClassData;
  onAddStudent: (name: string) => Promise<void>;
  onRemoveStudent: (studentId: string) => Promise<void>;
  onInvertNames: () => Promise<void>;
  onBulkAddStudents: (students: Student[]) => Promise<number>;
  isPrivacyShieldActive?: boolean;
}

export const StudentsManagementView: React.FC<StudentsManagementViewProps> = ({
  currentClass,
  onAddStudent,
  onRemoveStudent,
  onInvertNames,
  onBulkAddStudents,
  isPrivacyShieldActive = true
}) => {
  const [newStudentName, setNewStudentName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isStudentMutationPending, setIsStudentMutationPending] = useState(false);

  const importJob = useRef<AbortController | null>(null);
  useEffect(() => {
    setIsImporting(false);
    return () => {
      importJob.current?.abort();
      importJob.current = null;
    };
  }, [currentClass.id]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isImporting || isStudentMutationPending || !newStudentName.trim()) return;
    setIsStudentMutationPending(true);
    try {
      await onAddStudent(sanitizeName(newStudentName));
      setNewStudentName('');
    } catch {
      return;
    } finally {
      setIsStudentMutationPending(false);
    }
  };

  const handleInvertNames = async () => {
    if (isImporting || isStudentMutationPending) return;
    setIsStudentMutationPending(true);
    try {
      await onInvertNames();
    } catch {
      return;
    } finally {
      setIsStudentMutationPending(false);
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    if (isImporting || isStudentMutationPending) return;
    setIsStudentMutationPending(true);
    try {
      await onRemoveStudent(studentId);
    } catch {
      return;
    } finally {
      setIsStudentMutationPending(false);
    }
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || importJob.current || isStudentMutationPending) return;

    let format: StudentImportFormat;
    try {
      format = studentImportFormat(file.name, file.size);
    } catch {
      e.target.value = '';
      alert('Seleziona un file XLS, XLSX o CSV non vuoto, fino a 2 MB.');
      return;
    }

    const job = new AbortController();
    importJob.current = job;
    setIsImporting(true);
    try {
      const names = await readRosterOffThread(
        await file.arrayBuffer(), format, currentClass.students.map(student => student.name), job.signal
      );
      if (job.signal.aborted) return;
      if (names.length === 0) {
        alert('Nessun nuovo nominativo valido nel file.');
        return;
      }
      const count = names.length === 1 ? '1 nuovo nominativo' : `${names.length} nuovi nominativi`;
      if (!confirm(`Aggiungere ${count} alla classe ${currentClass.name}?`)) return;

      const imported = names.map(name => ({ id: uid(), name }));
      try {
        const addedCount = await onBulkAddStudents(imported);
        if (job.signal.aborted) return;
        alert(addedCount > 0
          ? `Importazione completata con successo! Aggiunti ${addedCount} nuovi alunni.`
          : 'Nessun nuovo alunno aggiunto: i nominativi erano già presenti.');
      } catch {
        if (!job.signal.aborted) alert('Importazione non salvata. Riprova.');
        return;
      }
    } catch {
      if (!job.signal.aborted) {
        alert(`Importazione non completata. Verifica che il file sia leggibile e che il primo foglio non superi ${STUDENT_IMPORT_LIMITS.rows} righe.`);
      }
    } finally {
      e.target.value = '';
      if (importJob.current === job) {
        importJob.current = null;
        setIsImporting(false);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Add & Actions Card */}
      <div className="neon-card neon-card-highlight p-5">
        <div className="mb-4 pb-3 border-b border-[var(--border)]">
          <h3 className="text-lg font-bold text-[var(--primary)] drop-shadow-[0_0_8px_var(--primary)] flex items-center gap-2">
            <Users className="w-5 h-5 text-[var(--primary)]" /> Gestione Elenco Alunni: {currentClass.name}
          </h3>
          <p className="text-xs text-slate-400">
            Aggiungi singoli alunni, importa massivamente il registro da file Excel/CSV o inverti Cognome e Nome.
          </p>
        </div>

        {/* Add single student form */}
        <form onSubmit={handleAdd} className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Cognome e Nome (es. Rossi Maria)"
            value={newStudentName}
            onChange={e => setNewStudentName(e.target.value)}
            disabled={isImporting || isStudentMutationPending}
            className="flex-1 p-2.5 neon-input text-xs sm:text-sm text-white placeholder-slate-500"
          />
          <button
            type="submit"
            disabled={isImporting || isStudentMutationPending}
            className="px-4 py-2.5 rounded-lg neon-btn-primary text-xs font-semibold flex items-center gap-1.5 shrink-0"
          >
            <UserPlus className="w-4 h-4" /> Aggiungi
          </button>
        </form>

        {/* Excel Import & Invert Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[var(--border)]">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Importazione massiva da Excel (.xlsx, .xls, .csv)
            </label>
            <label className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-dashed border-slate-600 bg-slate-900/60 hover:bg-slate-800 text-xs font-medium text-slate-300 cursor-pointer transition-colors">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>{isImporting ? 'Elaborazione in corso...' : 'Seleziona File Excel / CSV'}</span>
              <input
                type="file"
                accept=".xls,.xlsx,.csv"
                onChange={handleExcelImport}
                className="hidden"
                disabled={isImporting || isStudentMutationPending}
              />
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Normalizzazione registro
            </label>
            <button
              type="button"
              onClick={handleInvertNames}
              disabled={isImporting || isStudentMutationPending}
              className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg border border-slate-700 bg-[var(--surface-variant)] hover:bg-slate-800 text-xs font-semibold text-slate-200 transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-cyan-400" /> Inverti Nome / Cognome
            </button>
          </div>
        </div>
      </div>

      {/* Student List Card */}
      <div className="neon-card p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <span>Registro Alunni</span>
            <span className="text-xs font-normal text-slate-400 font-mono">
              ({currentClass.students.length} iscritti)
            </span>
          </h4>
          <span className="text-[11px] text-slate-500 italic">Ordinamento alfabetico automatico</span>
        </div>

        {currentClass.students.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            Nessun alunno presente. Inseriscine uno o carica un file Excel.
          </p>
        ) : (
          <div className="border border-[var(--border)] rounded-lg overflow-hidden divide-y divide-[var(--border)] max-h-[50vh] overflow-y-auto">
            {currentClass.students.map((student, idx) => (
              <div
                key={student.id}
                className="p-2.5 px-3 flex items-center justify-between hover:bg-slate-800/40 transition-colors text-xs sm:text-sm"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-slate-500 font-mono text-xs w-5 text-right">{idx + 1}.</span>
                  <span className="font-semibold text-slate-200">{formatStudentNameWithPrivacy(student.name, isPrivacyShieldActive)}</span>
                </div>

                <button
                  type="button"
                  disabled={isImporting || isStudentMutationPending}
                  onClick={() => {
                    if (confirm(`Rimuovere l'alunno "${formatStudentNameWithPrivacy(student.name, isPrivacyShieldActive)}" dalla classe? Se sono presenti valutazioni o evidenze storiche, la rimozione sarà bloccata per conservarle.`)) {
                      void handleRemoveStudent(student.id);
                    }
                  }}
                  className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                  title="Elimina alunno"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
