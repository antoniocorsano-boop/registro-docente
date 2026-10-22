import React from 'react';
import { ActiveTab, ClassData } from '../types';
import { calcAvg, formatGrade, TYPES_LABEL } from '../utils';
import { Sparkline } from './Sparkline';
import {
  ClipboardList,
  Sparkles,
  Table,
  BarChart3,
  Users,
  GraduationCap,
  Calendar,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface DashboardViewProps {
  currentClass: ClassData;
  onNavigateTab: (tab: ActiveTab) => void;
  onEditBatch: (batchId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentClass,
  onNavigateTab,
  onEditBatch
}) => {
  const students = currentClass.students || [];
  const grades = currentClass.grades || [];

  const studentAvgs = students
    .map(s => calcAvg(grades.filter(g => g.studentId === s.id)))
    .filter((v): v is number => v !== null && !isNaN(v));

  const classAvg = studentAvgs.length > 0
    ? studentAvgs.reduce((a, b) => a + b, 0) / studentAvgs.length
    : null;

  const suffRate = studentAvgs.length > 0
    ? Math.round((studentAvgs.filter(v => v >= 6.0).length / studentAvgs.length) * 100)
    : null;

  // Group assessments by batchId / date
  const groupsMap: Record<string, { batchId: string; date: string; type: string; title: string; period: string; votes: typeof grades }> = {};
  grades.forEach(g => {
    const key = g.batchId || `${g.date}_${g.type}_${g.title}`;
    if (!groupsMap[key]) {
      groupsMap[key] = {
        batchId: key,
        date: g.date,
        type: g.type,
        title: g.title,
        period: g.period,
        votes: []
      };
    }
    groupsMap[key].votes.push(g);
  });

  const recentActivities = Object.values(groupsMap)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Overview & KPIs */}
      <div className="neon-card neon-card-highlight p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-lg font-bold text-[var(--primary)] drop-shadow-[0_0_8px_var(--primary)]">
              Panoramica Sezione: {currentClass.name}
            </h3>
            <p className="text-xs text-slate-400">
              Metriche di rendimento e scorciatoie operative per la classe.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700">
              {students.length} alunni iscritti
            </span>
          </div>
        </div>

        {/* Section KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="p-3.5 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] text-center">
            <b className="text-2xl font-bold block text-white drop-shadow-sm">
              {formatGrade(classAvg)}
            </b>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
              Media Sezione
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] text-center">
            <b className={`text-2xl font-bold block ${suffRate === null ? 'text-slate-400' : suffRate >= 60 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {suffRate === null ? '—' : `${suffRate}%`}
            </b>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
              {suffRate === null ? 'Nessun dato' : 'Tasso Sufficienze'}
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] text-center">
            <b className="text-2xl font-bold block text-cyan-400 drop-shadow-sm">
              {grades.length}
            </b>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
              Voti Registrati
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] text-center">
            <div className="h-7 flex items-center justify-center">
              <Sparkline grades={grades} width={75} height={20} />
            </div>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
              Trend Generale
            </span>
          </div>
        </div>

        {/* Navigation Action Buttons Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            onClick={() => onNavigateTab('voti')}
            className="p-3 rounded-lg neon-btn-primary text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-2"
          >
            <ClipboardList className="w-4 h-4" />
            <span>Valutazioni</span>
          </button>

          <button
            onClick={() => onNavigateTab('comportamenti')}
            className="p-3 rounded-lg bg-[var(--surface-variant)] hover:bg-slate-800 text-[var(--primary)] border border-[var(--primary)]/50 text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-2 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            <span>Comportamento</span>
          </button>

          <button
            onClick={() => onNavigateTab('tabellone')}
            className="p-3 rounded-lg bg-[var(--surface-variant)] hover:bg-slate-800 text-slate-200 border border-[var(--border)] text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-2 transition-colors"
          >
            <Table className="w-4 h-4 text-sky-400" />
            <span>Tabellone</span>
          </button>

          <button
            onClick={() => onNavigateTab('analytics')}
            className="p-3 rounded-lg bg-[var(--surface-variant)] hover:bg-slate-800 text-slate-200 border border-[var(--border)] text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-2 transition-colors"
          >
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span>Analisi</span>
          </button>
        </div>
      </div>

      {/* Recent Evaluations Activity */}
      <div className="neon-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--primary)]" /> Ultime Prove Registrate
          </h3>
          <button
            onClick={() => onNavigateTab('storico')}
            className="text-xs text-[var(--primary)] hover:underline"
          >
            Vedi tutte ({Object.keys(groupsMap).length})
          </button>
        </div>

        {recentActivities.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">
            Nessuna valutazione registrata per questa classe. Inizia inserendo una nuova prova!
          </p>
        ) : (
          <div className="space-y-2">
            {recentActivities.map(activity => {
              const batchAvg = calcAvg(activity.votes);
              return (
                <div
                  key={activity.batchId}
                  onClick={() => onEditBatch(activity.batchId)}
                  className="p-3 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] hover:border-[var(--primary)]/60 cursor-pointer transition-all flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-slate-300 font-mono text-[10px]">
                      {activity.period}
                    </div>
                    <div className="truncate">
                      <div className="font-semibold text-slate-100 truncate">
                        {activity.title || 'Senza Titolo'}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>{activity.date.split('-').reverse().join('/')}</span>
                        <span>·</span>
                        <span>{TYPES_LABEL[activity.type as keyof typeof TYPES_LABEL] || activity.type}</span>
                        <span>·</span>
                        <span>{activity.votes.length} voti</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2.5 py-1 rounded text-xs font-bold ${batchAvg && batchAvg >= 6 ? 'badge-ok' : 'badge-bad'}`}>
                      Media: {formatGrade(batchAvg)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
