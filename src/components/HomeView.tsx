import React, { useState } from 'react';
import { ClassData } from '../types';
import { calcAvg, formatGrade } from '../utils';
import { Sparkline } from './Sparkline';
import {
  GraduationCap,
  Plus,
  Users,
  Award,
  AlertTriangle,
  Download,
  ChevronDown,
  Trash2,
  TrendingUp,
  FolderOpen
} from 'lucide-react';

interface HomeViewProps {
  classes: ClassData[];
  onSelectClass: (classId: string) => void;
  onAddClass: () => Promise<void>;
  onDeleteClass: (classId: string) => Promise<void>;
  onExportBackup: () => void;
  lastBackupDate: string | null;
  unsavedChangesCount: number;
}

export const HomeView: React.FC<HomeViewProps> = ({
  classes,
  onSelectClass,
  onAddClass,
  onDeleteClass,
  onExportBackup,
  lastBackupDate,
  unsavedChangesCount
}) => {
  const [isCrossExpanded, setIsCrossExpanded] = useState(true);
  const [isClassMutationPending, setIsClassMutationPending] = useState(false);

  const handleAddClass = async () => {
    if (isClassMutationPending) return;
    setIsClassMutationPending(true);
    try {
      await onAddClass();
    } catch {
      return;
    } finally {
      setIsClassMutationPending(false);
    }
  };

  const handleDeleteClass = async (classId: string) => {
    if (isClassMutationPending) return;
    setIsClassMutationPending(true);
    try {
      await onDeleteClass(classId);
    } catch {
      return;
    } finally {
      setIsClassMutationPending(false);
    }
  };

  // Calculate Institute-wide aggregate metrics
  let totalStudents = 0;
  let totalGrades = 0;
  const allStudentAverages: number[] = [];

  classes.forEach(c => {
    totalStudents += c.students.length;
    totalGrades += (c.grades || []).length;
    c.students.forEach(s => {
      const avg = calcAvg((c.grades || []).filter(g => g.studentId === s.id));
      if (avg !== null && !isNaN(avg)) {
        allStudentAverages.push(avg);
      }
    });
  });

  const instituteAvg = allStudentAverages.length > 0
    ? allStudentAverages.reduce((a, b) => a + b, 0) / allStudentAverages.length
    : null;

  const instituteSuffRate = allStudentAverages.length > 0
    ? Math.round((allStudentAverages.filter(v => v >= 6.0).length / allStudentAverages.length) * 100)
    : null;

  const isBackupStale = !lastBackupDate || unsavedChangesCount >= 10;

  return (
    <div className="space-y-4">
      {/* Overview Card */}
      <div className="neon-card neon-card-highlight p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-xl font-bold text-[var(--primary)] drop-shadow-[0_0_8px_var(--primary)]">
              Le mie classi
            </h2>
            <p className="text-xs text-slate-400">
              Seleziona una classe e accedi alle attività del registro.
            </p>
          </div>

          <button
            onClick={handleAddClass}
            disabled={isClassMutationPending}
            className="self-start sm:self-auto px-3.5 py-2 rounded-lg neon-btn-primary text-xs font-semibold flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Nuova Classe
          </button>
        </div>

        {/* Global KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="p-3.5 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] text-center">
            <b className="text-2xl font-bold block text-white drop-shadow-sm">
              {formatGrade(instituteAvg)}
            </b>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
              Media Istituto
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] text-center">
            <b className={`text-2xl font-bold block ${instituteSuffRate === null ? 'text-slate-400' : instituteSuffRate >= 60 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {instituteSuffRate === null ? '—' : `${instituteSuffRate}%`}
            </b>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
              {instituteSuffRate === null ? 'Nessun dato' : 'Sufficienze Totali'}
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] text-center">
            <b className="text-2xl font-bold block text-white drop-shadow-sm">
              {totalStudents}
            </b>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
              Alunni Iscritti
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] text-center">
            <b className="text-2xl font-bold block text-cyan-400 drop-shadow-sm">
              {totalGrades}
            </b>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
              Valutazioni Registrate
            </span>
          </div>
        </div>

        {/* Backup Status Reminder Bar */}
        <div
          className={`p-3 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs border ${
            isBackupStale
              ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
              : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-4 h-4 shrink-0 ${isBackupStale ? 'text-amber-400' : 'text-emerald-400'}`} />
            <span>
              Ultimo backup JSON:{' '}
              <b>
                {lastBackupDate
                  ? new Date(lastBackupDate).toLocaleDateString('it-IT', { hour: '2-digit', minute: '2-digit' })
                  : 'Mai effettuato'}
              </b>
              {unsavedChangesCount > 0 && ` · (${unsavedChangesCount} modifiche da salvare)`}
            </span>
          </div>
          <button
            onClick={onExportBackup}
            className="px-3 py-1.5 rounded bg-[var(--surface-variant)] hover:bg-slate-800 border border-[var(--border)] text-white text-xs font-semibold flex items-center gap-1.5 shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-[var(--primary)]" /> Esporta Backup JSON
          </button>
        </div>
      </div>

      {/* Class comparison table */}
      <div className="neon-card p-4">
        <button
          onClick={() => setIsCrossExpanded(!isCrossExpanded)}
          className="w-full flex items-center justify-between text-left text-sm font-semibold text-[var(--primary)] focus:outline-none"
        >
          <span className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Confronto tra classi
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isCrossExpanded ? 'rotate-180' : ''}`} />
        </button>

        {isCrossExpanded && (
          <div className="mt-3 overflow-x-auto border border-[var(--border)] rounded-lg">
            <table className="w-full text-xs text-center border-collapse">
              <thead>
                <tr className="bg-[var(--surface-variant)] text-slate-400 uppercase tracking-wider text-[10px] font-semibold">
                  <th className="p-2.5 text-left sticky left-0 bg-[var(--surface-variant)] border-r border-[var(--border)] min-w-[140px]">
                    Classe
                  </th>
                  <th className="p-2.5 border-r border-[var(--border)]">Alunni</th>
                  <th className="p-2.5 border-r border-[var(--border)]">Media</th>
                  <th className="p-2.5 border-r border-[var(--border)]">Trend</th>
                  <th className="p-2.5 border-r border-[var(--border)]">Suff. %</th>
                  <th className="p-2.5 border-r border-[var(--border)]">Fascia alta (≥ 8,5)</th>
                  <th className="p-2.5">Media &lt; 6</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {classes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-slate-500">
                      Nessuna classe configurata. Clicca su "+ Nuova Classe" per iniziare.
                    </td>
                  </tr>
                ) : (
                  classes.map(c => {
                    const cAvgs = c.students
                      .map(s => calcAvg((c.grades || []).filter(g => g.studentId === s.id)))
                      .filter((v): v is number => v !== null && !isNaN(v));

                    const hasClassAverages = cAvgs.length > 0;
                    const cAvg = hasClassAverages ? cAvgs.reduce((a, b) => a + b, 0) / cAvgs.length : null;
                    const cSuff = hasClassAverages
                      ? Math.round((cAvgs.filter(v => v >= 6.0).length / cAvgs.length) * 100)
                      : null;
                    const advancedCount = hasClassAverages ? cAvgs.filter(v => v >= 8.5).length : null;
                    const atRiskCount = hasClassAverages ? cAvgs.filter(v => v < 6.0).length : null;

                    return (
                      <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                        <td
                          onClick={() => onSelectClass(c.id)}
                          className="p-2.5 text-left font-semibold text-[var(--primary)] cursor-pointer hover:underline sticky left-0 bg-[var(--surface)] border-r border-[var(--border)]"
                        >
                          {c.name}
                        </td>
                        <td className="p-2.5 border-r border-[var(--border)]">{c.students.length}</td>
                        <td className="p-2.5 border-r border-[var(--border)] font-bold text-white">
                          {formatGrade(cAvg)}
                        </td>
                        <td className="p-2.5 border-r border-[var(--border)]">
                          <Sparkline grades={c.grades || []} width={65} height={20} />
                        </td>
                        <td className="p-2.5 border-r border-[var(--border)]">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${cSuff === null ? 'bg-slate-800 text-slate-400' : cSuff >= 60 ? 'badge-ok' : 'badge-bad'}`}>
                            {cSuff === null ? '—' : `${cSuff}%`}
                          </span>
                        </td>
                        <td className="p-2.5 border-r border-[var(--border)]">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold badge-info">
                            {advancedCount === null ? '—' : advancedCount}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold badge-bad">
                            {atRiskCount === null ? '—' : atRiskCount}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Class Cards Grid */}
      <div className="neon-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-[var(--primary)]" /> Classi
          </h3>
          <span className="text-xs text-slate-400">{classes.length} sezioni registrate</span>
        </div>

        {classes.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-700 rounded-lg p-6">
            <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400 mb-3">Nessuna classe presente nel registro.</p>
            <button
              onClick={handleAddClass}
              className="px-4 py-2 rounded-lg neon-btn-primary text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Crea la Prima Classe
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {classes.map(c => {
              const cGrades = c.grades || [];
              const cAvgs = c.students
                .map(s => calcAvg(cGrades.filter(g => g.studentId === s.id)))
                .filter((v): v is number => v !== null && !isNaN(v));
              const cAvg = cAvgs.length > 0 ? cAvgs.reduce((a, b) => a + b, 0) / cAvgs.length : null;

              return (
                <div
                  key={c.id}
                  className="neon-card p-4 border-l-4 border-l-[var(--primary)] hover:border-l-[var(--primary-hover)] transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4
                        onClick={() => onSelectClass(c.id)}
                        className="font-bold text-base text-white group-hover:text-[var(--primary)] cursor-pointer transition-colors"
                      >
                        {c.name}
                      </h4>
                      <button
                        disabled={isClassMutationPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Eliminare definitivamente la classe "${c.name}" con tutti i suoi dati?`)) {
                            void handleDeleteClass(c.id);
                          }
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-slate-800 transition-colors"
                        title="Elimina classe"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1 text-xs text-slate-400 mb-3">
                      <div className="flex justify-between">
                        <span>Alunni iscritti:</span>
                        <b className="text-slate-200">{c.students.length}</b>
                      </div>
                      <div className="flex justify-between">
                        <span>Valutazioni totali:</span>
                        <b className="text-slate-200">{cGrades.length}</b>
                      </div>
                      <div className="flex justify-between">
                        <span>Media sezione:</span>
                        <b className="text-white font-bold">{formatGrade(cAvg)}</b>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectClass(c.id)}
                    className="w-full py-2 px-3 rounded-lg neon-btn-primary text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <FolderOpen className="w-3.5 h-3.5" /> Apri classe
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
