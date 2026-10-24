import React, { useState } from 'react';
import { ClassData } from '../../src/types';
import { calcAvg, formatGrade } from '../../src/utils';
import { Sparkline } from '../../src/components/Sparkline';
import {
  AlertTriangle,
  Download,
  FolderOpen,
  GraduationCap,
  Plus,
  Trash2,
  TrendingUp,
  Users
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

type HomeViewMode = 'classes' | 'summary' | 'comparison';

const CLASS_ACCENTS = [
  '#38bdf8',
  '#a78bfa',
  '#fbbf24',
  '#60a5fa',
  '#e879f9',
  '#fb923c',
  '#818cf8'
] as const;

export const HomeView: React.FC<HomeViewProps> = ({
  classes,
  onSelectClass,
  onAddClass,
  onDeleteClass,
  onExportBackup,
  lastBackupDate,
  unsavedChangesCount
}) => {
  const [activeView, setActiveView] = useState<HomeViewMode>('classes');
  const [isClassMutationPending, setIsClassMutationPending] = useState(false);

  const handleAddClass = async () => {
    if (isClassMutationPending) return;
    setIsClassMutationPending(true);
    try {
      await onAddClass();
    } finally {
      setIsClassMutationPending(false);
    }
  };

  const handleDeleteClass = async (classId: string) => {
    if (isClassMutationPending) return;
    setIsClassMutationPending(true);
    try {
      await onDeleteClass(classId);
    } finally {
      setIsClassMutationPending(false);
    }
  };

  const metrics = classes.map(classData => {
    const grades = classData.grades || [];
    const averages = classData.students
      .map(student => calcAvg(grades.filter(grade => grade.studentId === student.id)))
      .filter((value): value is number => value !== null && !Number.isNaN(value));
    const average = averages.length > 0
      ? averages.reduce((sum, value) => sum + value, 0) / averages.length
      : null;
    const sufficiency = averages.length > 0
      ? Math.round((averages.filter(value => value >= 6).length / averages.length) * 100)
      : null;

    return {
      classData,
      grades,
      averages,
      average,
      sufficiency,
      advancedCount: averages.length > 0 ? averages.filter(value => value >= 8.5).length : null,
      atRiskCount: averages.length > 0 ? averages.filter(value => value < 6).length : null
    };
  });

  const totalStudents = classes.reduce((sum, item) => sum + item.students.length, 0);
  const totalGrades = classes.reduce((sum, item) => sum + (item.grades || []).length, 0);
  const allAverages = metrics.flatMap(item => item.averages);
  const instituteAverage = allAverages.length > 0
    ? allAverages.reduce((sum, value) => sum + value, 0) / allAverages.length
    : null;
  const instituteSufficiency = allAverages.length > 0
    ? Math.round((allAverages.filter(value => value >= 6).length / allAverages.length) * 100)
    : null;
  const isBackupStale = !lastBackupDate || unsavedChangesCount >= 10;

  const modeClass = (mode: HomeViewMode) =>
    `min-h-[44px] px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
      activeView === mode
        ? 'bg-[var(--primary)] text-slate-950 border-[var(--primary)] shadow-[0_0_10px_var(--primary)]'
        : 'bg-[var(--surface-variant)] text-slate-300 border-[var(--border)] hover:text-white hover:border-[var(--primary)]'
    }`;

  return (
    <div className="space-y-4">
      <section className="neon-card neon-card-highlight p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[var(--primary)] drop-shadow-[0_0_8px_var(--primary)]">
              Le mie classi
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Scegli la classe su cui vuoi lavorare. Nessuna classe viene attivata automaticamente.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddClass}
            disabled={isClassMutationPending}
            className="min-h-[44px] self-start sm:self-auto px-4 py-2 rounded-lg neon-btn-primary text-xs font-semibold inline-flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Nuova Classe
          </button>
        </div>

        <div role="group" aria-label="Vista home" className="grid grid-cols-3 gap-2 mt-4">
          <button type="button" aria-pressed={activeView === 'classes'} onClick={() => setActiveView('classes')} className={modeClass('classes')}>
            Classi
          </button>
          <button type="button" aria-pressed={activeView === 'summary'} onClick={() => setActiveView('summary')} className={modeClass('summary')}>
            Sintesi
          </button>
          <button type="button" aria-pressed={activeView === 'comparison'} onClick={() => setActiveView('comparison')} className={modeClass('comparison')}>
            Confronto
          </button>
        </div>
      </section>

      {activeView === 'classes' && (
        <section className="neon-card p-4" aria-label="Classi disponibili">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-[var(--primary)]" /> Classi
            </h3>
            <span className="text-xs text-slate-400">{classes.length} sezioni</span>
          </div>

          {classes.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-slate-700 rounded-lg p-6">
              <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400 mb-3">Nessuna classe presente nel registro.</p>
              <button
                type="button"
                onClick={handleAddClass}
                disabled={isClassMutationPending}
                className="min-h-[44px] px-4 py-2 rounded-lg neon-btn-primary text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Crea la Prima Classe
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {metrics.map((item, index) => {
                const accentIndex = index % CLASS_ACCENTS.length;
                const accent = CLASS_ACCENTS[accentIndex];
                const classData = item.classData;

                return (
                  <article
                    key={classData.id}
                    data-uxqa-class-card
                    data-accent-index={accentIndex}
                    className="relative rounded-xl border bg-[var(--surface-variant)]/75 overflow-hidden min-w-0"
                    style={{ borderColor: accent }}
                  >
                    <button
                      type="button"
                      aria-label={`Apri classe ${classData.name}`}
                      onClick={() => onSelectClass(classData.id)}
                      className="w-full min-h-[112px] p-3 pr-12 text-left flex flex-col justify-between hover:bg-slate-800/50 transition-colors"
                    >
                      <span>
                        <span className="block text-lg font-black leading-none" style={{ color: accent }}>
                          {classData.name}
                        </span>
                        <span className="block text-[11px] text-slate-400 mt-2">
                          {classData.students.length} {classData.students.length === 1 ? 'alunno' : 'alunni'} · media {formatGrade(item.average)}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-200 mt-3">
                        <FolderOpen className="w-3.5 h-3.5" /> Apri classe
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Elimina classe ${classData.name}`}
                      title="Elimina classe"
                      disabled={isClassMutationPending}
                      onClick={() => {
                        if (confirm(`Eliminare definitivamente la classe "${classData.name}" con tutti i suoi dati?`)) {
                          void handleDeleteClass(classData.id);
                        }
                      }}
                      className="absolute top-1 right-1 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-900/70"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {activeView === 'summary' && (
        <section className="neon-card p-4 sm:p-5" aria-label="Sintesi del registro">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-base font-bold text-white">Sintesi numerica</h3>
            <span className="text-xs text-slate-400">Tutte le classi</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="p-3.5 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] text-center">
              <b className="text-2xl font-bold block text-white">{formatGrade(instituteAverage)}</b>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Media Istituto</span>
            </div>
            <div className="p-3.5 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] text-center">
              <b className={`text-2xl font-bold block ${instituteSufficiency === null ? 'text-slate-400' : instituteSufficiency >= 60 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {instituteSufficiency === null ? '—' : `${instituteSufficiency}%`}
              </b>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                {instituteSufficiency === null ? 'Nessun dato' : 'Sufficienze Totali'}
              </span>
            </div>
            <div className="p-3.5 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] text-center">
              <b className="text-2xl font-bold block text-white">{totalStudents}</b>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Alunni Iscritti</span>
            </div>
            <div className="p-3.5 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] text-center">
              <b className="text-2xl font-bold block text-cyan-400">{totalGrades}</b>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Valutazioni Registrate</span>
            </div>
          </div>

          <div className={`p-3 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs border ${isBackupStale ? 'bg-amber-950/30 border-amber-500/40 text-amber-200' : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'}`}>
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-4 h-4 shrink-0 ${isBackupStale ? 'text-amber-400' : 'text-emerald-400'}`} />
              <span>
                Ultimo backup cifrato:{' '}
                <b>{lastBackupDate ? new Date(lastBackupDate).toLocaleDateString('it-IT', { hour: '2-digit', minute: '2-digit' }) : 'Mai effettuato'}</b>
                {unsavedChangesCount > 0 && ` · (${unsavedChangesCount} modifiche da salvare)`}
              </span>
            </div>
            <button
              type="button"
              onClick={onExportBackup}
              className="min-h-[44px] px-3 py-2 rounded bg-[var(--surface-variant)] hover:bg-slate-800 border border-[var(--border)] text-white text-xs font-semibold flex items-center gap-1.5 shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-[var(--primary)]" /> Esporta backup cifrato
            </button>
          </div>
        </section>
      )}

      {activeView === 'comparison' && (
        <section className="neon-card p-4" aria-label="Confronto tra classi">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold text-[var(--primary)] flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Confronto tra classi
            </h3>
            <span className="text-xs text-slate-400">{classes.length} sezioni</span>
          </div>
          <div className="overflow-x-auto border border-[var(--border)] rounded-lg">
            <table className="w-full text-xs text-center border-collapse">
              <thead>
                <tr className="bg-[var(--surface-variant)] text-slate-400 uppercase tracking-wider text-[10px] font-semibold">
                  <th className="p-2.5 text-left sticky left-0 bg-[var(--surface-variant)] border-r border-[var(--border)] min-w-[140px]">Classe</th>
                  <th className="p-2.5 border-r border-[var(--border)]">Alunni</th>
                  <th className="p-2.5 border-r border-[var(--border)]">Media</th>
                  <th className="p-2.5 border-r border-[var(--border)]">Trend</th>
                  <th className="p-2.5 border-r border-[var(--border)]">Suff. %</th>
                  <th className="p-2.5 border-r border-[var(--border)]">Fascia alta (≥ 8,5)</th>
                  <th className="p-2.5">Media &lt; 6</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {metrics.length === 0 ? (
                  <tr><td colSpan={7} className="p-4 text-slate-500">Nessuna classe configurata.</td></tr>
                ) : metrics.map(item => (
                  <tr key={item.classData.id} className="hover:bg-slate-800/40 transition-colors">
                    <td onClick={() => onSelectClass(item.classData.id)} className="p-2.5 text-left font-semibold text-[var(--primary)] cursor-pointer hover:underline sticky left-0 bg-[var(--surface)] border-r border-[var(--border)]">
                      {item.classData.name}
                    </td>
                    <td className="p-2.5 border-r border-[var(--border)]">{item.classData.students.length}</td>
                    <td className="p-2.5 border-r border-[var(--border)] font-bold text-white">{formatGrade(item.average)}</td>
                    <td className="p-2.5 border-r border-[var(--border)]"><Sparkline grades={item.grades} width={65} height={20} /></td>
                    <td className="p-2.5 border-r border-[var(--border)]">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${item.sufficiency === null ? 'bg-slate-800 text-slate-400' : item.sufficiency >= 60 ? 'badge-ok' : 'badge-bad'}`}>
                        {item.sufficiency === null ? '—' : `${item.sufficiency}%`}
                      </span>
                    </td>
                    <td className="p-2.5 border-r border-[var(--border)]"><span className="px-2 py-0.5 rounded text-[10px] font-semibold badge-info">{item.advancedCount === null ? '—' : item.advancedCount}</span></td>
                    <td className="p-2.5"><span className="px-2 py-0.5 rounded text-[10px] font-semibold badge-bad">{item.atRiskCount === null ? '—' : item.atRiskCount}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
