import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { ClassData, Student } from '../types';
import { formatStudentNameWithPrivacy, sanitizeName, sortStudents, uid } from '../utils';
import { Users, UserPlus, Upload, RefreshCw, Trash2, FileSpreadsheet } from 'lucide-react';

interface StudentsManagementViewProps {
  currentClass: ClassData;
  onAddStudent: (name: string) => Promise<void>;
  onRemoveStudent: (studentId: string) => Promise<void>;
  onInvertNames: () => Promise<void>;
  onBulkAddStudents: (students: Student[]) => Promise<void>;
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

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        const imported: Student[] = [];
        const existingNames = new Set(currentClass.students.map(s => s.name.toLowerCase()));

        rows.forEach(row => {
          if (!Array.isArray(row)) return;
          // Find text cell with Italian alphabet / surname-name
          const textCell = row.find(cell => typeof cell === 'string' && /[A-Za-zÀ-ÿ]{2}/.test(cell));
          if (textCell) {
            const clean = sanitizeName(textCell);
            if (clean && clean.length > 3 && !clean.toLowerCase().includes('cognome') && !clean.toLowerCase().includes('nome')) {
              if (!existingNames.has(clean.toLowerCase())) {
                imported.push({ id: uid(), name: clean });
                existingNames.add(clean.toLowerCase());
              }
            }
          }
        });

        if (imported.length > 0) {
          if (isStudentMutationPending) return;
          setIsStudentMutationPending(true);
          try {
            await onBulkAddStudents(imported);
            alert(`Importazione completata con successo! Aggiunti ${imported.length} nuovi alunni.`);
          } catch {
            return;
          } finally {
            setIsStudentMutationPending(false);
          }
        } else {
          alert('Nessun nominativo valido trovato nel file Excel/CSV.');
        }
      } catch (err) {
        console.error('Error importing file', err);
        alert('Errore durante la lettura del file Excel/CSV.');
      } finally {
        e.target.value = '';
        setIsImporting(false);
      }
    };

    reader.onerror = () => {
      setIsImporting(false);
      alert('Errore durante la lettura del file Excel/CSV.');
    };

    reader.readAsArrayBuffer(file);
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
                    if (confirm(`Rimuovere l'alunno "${formatStudentNameWithPrivacy(student.name, isPrivacyShieldActive)}" e tutte le sue valutazioni da questa classe?`)) {
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
