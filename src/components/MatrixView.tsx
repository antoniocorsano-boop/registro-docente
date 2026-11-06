import React, { useState } from 'react';
import { AppSettings, ClassData, EvaluationType, Grade } from '../types';
import {
  calcAvg,
  calcWeightedAvg,
  DEFAULT_EVALUATION_WEIGHTS,
  formatGrade,
  parseGrade,
  TYPES_LABEL,
  getCompetenceLevel,
  formatStudentNameWithPrivacy
} from '../utils';
import { Sparkline } from './Sparkline';
import { CompactStudentDisclosureRow } from './CompactStudentDisclosureRow';
import { Table, Filter, Sparkles, User, Calendar, Award, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface MatrixViewProps {
  currentClass: ClassData;
  onOpenStudentReport: (studentId: string) => void;
  isPrivacyShieldActive?: boolean;
  settings?: AppSettings;
}

export const MatrixView: React.FC<MatrixViewProps> = ({
  currentClass,
  onOpenStudentReport,
  isPrivacyShieldActive = true,
  settings
}) => {
  const [periodFilter, setPeriodFilter] = useState<'ALL' | 'Q1' | 'Q2'>('ALL');
  const [viewMode, setViewMode] = useState<'cron' | 'type' | 'avg'>('cron');
  const [showProposedGrade, setShowProposedGrade] = useState<boolean>(true);
  const [expandedMobileStudent, setExpandedMobileStudent] = useState<{ classId: string; studentId: string } | null>(null);

  const students = currentClass.students || [];
  const allGrades = currentClass.grades || [];

  const filteredGrades = allGrades.filter(g =>
    periodFilter === 'ALL' ? true : g.period === periodFilter
  );

  const weights = settings?.evaluationWeights || DEFAULT_EVALUATION_WEIGHTS;
  const isWeighted = settings?.useWeightedAverage === true;

  // Compute a mathematical support indicator based on current active settings
  const computeProposed = (sGrades: Grade[]) => {
    const avg = isWeighted ? calcWeightedAvg(sGrades, weights) : calcAvg(sGrades);
    if (avg === null || isNaN(avg)) {
      return { avg: null, isAtRisk: false };
    }
    return {
      avg,
      isAtRisk: avg < 6.0
    };
  };

  // Group assessments by batchId / date for chronological view
  const batchesMap: Record<string, { batchId: string; date: string; type: EvaluationType; title: string; period: string }> = {};
  filteredGrades.forEach(g => {
    const key = g.batchId || `${g.date}_${g.type}`;
    if (!batchesMap[key]) {
      batchesMap[key] = {
        batchId: key,
        date: g.date,
        type: g.type,
        title: g.title,
        period: g.period
      };
    }
  });

  const batches = Object.values(batchesMap).sort((a, b) => a.date.localeCompare(b.date));

  // Evaluation types present in this class
  const typesList: EvaluationType[] = ['test', 'verifica', 'orale', 'disegno', 'osserv'];

  // Helper renderer for proposed grade cell
  const renderProposedCell = (proposed: ReturnType<typeof computeProposed>) => (
    <td className="p-2 border-r border-[var(--border)] bg-slate-900/40">
      {proposed.avg !== null ? (
        <div className="flex flex-col items-center justify-center gap-0.5">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-black ${
              proposed.isAtRisk
                ? 'badge-bad shadow-[0_0_8px_rgba(244,63,94,0.4)] animate-pulse'
                : 'badge-ok shadow-[0_0_6px_rgba(16,185,129,0.2)]'
            }`}
          >
            {proposed.isAtRisk && <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />}
            {formatGrade(proposed.avg)}
          </span>
          <span
            className={`text-[9px] font-semibold leading-tight ${
              proposed.isAtRisk ? 'text-rose-400 font-bold' : 'text-slate-400'
            }`}
          >
            {proposed.isAtRisk ? 'Media < 6' : 'Media ≥ 6'}
          </span>
        </div>
      ) : (
        <span className="text-slate-600">–</span>
      )}
    </td>
  );

  return (
    <div className="neon-card p-4 sm:p-5">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[var(--border)]">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Table className="w-5 h-5 text-[var(--primary)]" /> Tabellone Classe: {currentClass.name}
          </h3>
          <p className="text-xs text-slate-400">
            Griglia sinottica con voti, medie e un <b>Indicatore media</b> di supporto matematico, non deliberativo.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={periodFilter}
            onChange={e => setPeriodFilter(e.target.value as any)}
            className="p-1.5 px-3 neon-input text-xs text-white bg-slate-900"
          >
            <option value="ALL">Tutto l'Anno</option>
            <option value="Q1">1° Quadrimestre (Q1)</option>
            <option value="Q2">2° Quadrimestre (Q2)</option>
          </select>
        </div>
      </div>

      {/* View Mode Toggle Buttons & Proposed Grade Switch */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2 mb-4">
        <div className="flex gap-2 overflow-x-auto w-full sm:w-auto">
          <button
            onClick={() => setViewMode('cron')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
              viewMode === 'cron'
                ? 'neon-btn-primary'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            Tutti i Voti (Cronologico)
          </button>

          <button
            onClick={() => setViewMode('type')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
              viewMode === 'type'
                ? 'neon-btn-primary'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            Per Tipologia
          </button>

          <button
            onClick={() => setViewMode('avg')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
              viewMode === 'avg'
                ? 'neon-btn-primary'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            Solo Medie & Fasce
          </button>
        </div>

        {/* Optional Proposed Grade Column Toggle Button */}
        <button
          type="button"
          onClick={() => setShowProposedGrade(!showProposedGrade)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border flex items-center gap-1.5 shrink-0 ${
            showProposedGrade
              ? 'bg-purple-950/70 border-purple-500 text-purple-300 shadow-[0_0_10px_rgba(192,132,252,0.3)]'
              : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
          }`}
          title="Mostra / nascondi la colonna con l'indicatore matematico della media"
        >
          <Award className="w-3.5 h-3.5 text-purple-400" />
          <span>Indicatore media: {showProposedGrade ? 'VISIBILE' : 'NASCOSTO'}</span>
        </button>
      </div>

      {/* Mobile student list: one compact row per student; only the selected
          student's full information is rendered. Desktop matrix is unchanged. */}
      <div
        data-testid="matrix-compact-list"
        className="md:hidden min-w-0 divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]"
      >
        {students.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">
            Nessun alunno presente in questa classe.
          </div>
        ) : (
          students.map(s => {
            const sGrades = filteredGrades.filter(g => g.studentId === s.id);
            const sAllGrades = allGrades.filter(g => g.studentId === s.id);
            const mobileGrades = viewMode === 'avg' ? sAllGrades : sGrades;
            const mobileAvg = calcAvg(mobileGrades);
            const proposed = computeProposed(mobileGrades);
            const q1Avg = calcAvg(sAllGrades.filter(g => g.period === 'Q1'));
            const q2Avg = calcAvg(sAllGrades.filter(g => g.period === 'Q2'));
            const totalAvg = calcAvg(sAllGrades);
            const level = getCompetenceLevel(proposed.avg ?? totalAvg);
            const expanded = expandedMobileStudent?.classId === currentClass.id
              && expandedMobileStudent.studentId === s.id;

            return (
              <CompactStudentDisclosureRow
                key={s.id}
                rowId={s.id}
                displayName={formatStudentNameWithPrivacy(s.name, isPrivacyShieldActive)}
                primaryLabel="Media"
                primaryValue={formatGrade(mobileAvg)}
                expanded={expanded}
                onToggle={() => setExpandedMobileStudent(current =>
                  current?.classId === currentClass.id && current.studentId === s.id
                    ? null : { classId: currentClass.id, studentId: s.id }
                )}
                onOpenStudentReport={() => onOpenStudentReport(s.id)}
              >
                <div className={`grid gap-2 ${showProposedGrade ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                    <div className="text-[10px] uppercase text-slate-400">Media</div>
                    <div className="text-base font-bold text-slate-100">{formatGrade(mobileAvg)}</div>
                  </div>
                  {showProposedGrade && (
                    <div className="min-w-0 rounded-lg border border-purple-700/40 bg-purple-950/25 p-2">
                      <div className="text-[10px] uppercase text-purple-300">Indicatore</div>
                      <div className="text-sm font-bold text-purple-100">{formatGrade(proposed.avg)}</div>
                      <div className="text-[10px] text-slate-400">
                        {proposed.avg === null ? 'Non disponibile' : proposed.isAtRisk ? 'Media < 6' : 'Media ≥ 6'}
                      </div>
                    </div>
                  )}
                  <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                    <div className="text-[10px] uppercase text-slate-400">Andamento</div>
                    <div className="pt-1">
                      <Sparkline grades={mobileGrades} width={72} height={20} />
                    </div>
                  </div>
                </div>

                {viewMode === 'cron' && (
                  <section aria-label="Voti recenti" className="space-y-2">
                    <h4 className="flex justify-between text-xs font-semibold text-slate-200">
                      <span>Voti recenti</span>
                      <span className="text-slate-400">{sGrades.length}</span>
                    </h4>
                    {sGrades.length === 0 ? (
                      <p className="text-xs text-slate-400">Nessuna prova nel periodo.</p>
                    ) : (
                      [...sGrades].sort((a, b) => b.date.localeCompare(a.date)).map(g => (
                        <div key={g.id} className="flex min-w-0 items-center justify-between gap-3 border-t border-slate-800 pt-2 text-xs">
                          <div className="min-w-0">
                            <div className="truncate text-slate-200">{g.title || TYPES_LABEL[g.type] || g.type}</div>
                            <div className="text-[10px] text-slate-400">{g.date} · {TYPES_LABEL[g.type] || g.type}</div>
                          </div>
                          <span className={`shrink-0 font-mono font-bold ${parseGrade(g.value) !== null && (parseGrade(g.value) as number) < 6 ? 'text-rose-400' : 'text-slate-100'}`}>
                            {g.value}{g.delayed ? ' R' : ''}
                          </span>
                        </div>
                      ))
                    )}
                  </section>
                )}

                {viewMode === 'type' && (
                  <section aria-label="Medie per tipologia" className="space-y-2">
                    <h4 className="text-xs font-semibold text-slate-200">Medie per tipologia</h4>
                    {typesList.map(t => {
                      const typedGrades = sGrades.filter(g => g.type === t);
                      const typedAvg = calcAvg(typedGrades);
                      return (
                        <div key={t} className="flex items-center justify-between gap-3 text-xs">
                          <span className="text-slate-300">{TYPES_LABEL[t]}</span>
                          <span className="shrink-0 font-mono text-slate-100">
                            {formatGrade(typedAvg)} <span className="text-slate-400">({typedGrades.length})</span>
                          </span>
                        </div>
                      );
                    })}
                  </section>
                )}

                {viewMode === 'avg' && (
                  <section aria-label="Medie periodo" className="space-y-2">
                    <h4 className="text-xs font-semibold text-slate-200">Medie periodo</h4>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div><div className="text-[10px] text-slate-400">Q1</div><div className="font-mono text-sm">{formatGrade(q1Avg)}</div></div>
                      <div><div className="text-[10px] text-slate-400">Q2</div><div className="font-mono text-sm">{formatGrade(q2Avg)}</div></div>
                      <div><div className="text-[10px] text-slate-400">Anno</div><div className="font-mono text-sm font-bold">{formatGrade(totalAvg)}</div></div>
                    </div>
                    {level && (
                      <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                        <span className="text-slate-400">Fascia analitica</span>
                        <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${level.badgeClass}`}>{level.label}</span>
                      </div>
                    )}
                  </section>
                )}
              </CompactStudentDisclosureRow>
            );
          })
        )}
      </div>

      {/* Desktop table matrix */}
      <div className="hidden md:block overflow-x-auto border border-[var(--border)] rounded-lg bg-[var(--surface)] max-w-full">
        {students.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Nessun alunno presente in questa classe.
          </div>
        ) : viewMode === 'cron' ? (
          /* Chronological Full Table */
          <table className="w-full text-xs text-center border-collapse">
            <thead>
              <tr className="bg-[var(--surface-variant)] text-slate-400 uppercase tracking-wider text-[10px] font-semibold">
                <th className="p-2.5 text-left sticky left-0 z-10 bg-[var(--surface-variant)] border-r-2 border-[var(--border)] min-w-[150px]">
                  Alunno
                </th>
                <th className="p-2.5 border-r border-[var(--border)] bg-[var(--primary)] text-[var(--primary-text)] font-extrabold min-w-[70px]">
                  MEDIA
                </th>
                {showProposedGrade && (
                  <th className="p-2.5 border-r border-[var(--border)] bg-purple-950/70 text-purple-200 font-extrabold min-w-[110px]" title="Indicatore matematico della media con soglia analitica 6/10">
                    IND. MEDIA
                  </th>
                )}
                <th className="p-2.5 border-r border-[var(--border)] min-w-[80px]">Trend</th>
                {batches.length === 0 ? (
                  <th className="p-2.5 text-slate-500">Nessuna prova nel periodo</th>
                ) : (
                  batches.map(b => (
                    <th
                      key={b.batchId}
                      className="p-2 border-r border-[var(--border)] min-w-[85px] font-normal leading-tight"
                      title={b.title}
                    >
                      <div className="font-bold text-slate-200">
                        {b.date.split('-').slice(1).reverse().join('/')}
                      </div>
                      <div className="text-[9px] text-[var(--primary)] font-semibold uppercase truncate max-w-[80px]">
                        {TYPES_LABEL[b.type] || b.type}
                      </div>
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {students.map(s => {
                const sGrades = filteredGrades.filter(g => g.studentId === s.id);
                const sAvg = calcAvg(sGrades);
                const proposed = computeProposed(sGrades);

                return (
                  <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                    <td
                      onClick={() => onOpenStudentReport(s.id)}
                      className="p-2.5 text-left font-semibold text-slate-200 cursor-pointer hover:text-[var(--primary)] sticky left-0 z-10 bg-[var(--surface)] border-r-2 border-[var(--border)] truncate"
                    >
                      {formatStudentNameWithPrivacy(s.name, isPrivacyShieldActive)}
                    </td>
                    <td className="p-2.5 border-r border-[var(--border)] font-bold text-white bg-slate-900/40">
                      <span className={sAvg !== null && sAvg < 6 ? 'text-rose-400' : 'text-emerald-400'}>
                        {formatGrade(sAvg)}
                      </span>
                    </td>
                    {showProposedGrade && renderProposedCell(proposed)}
                    <td className="p-2.5 border-r border-[var(--border)]">
                      <Sparkline grades={sGrades} width={65} height={18} />
                    </td>
                    {batches.length === 0 ? (
                      <td className="p-2.5 text-slate-600">–</td>
                    ) : (
                      batches.map(b => {
                        const gObj = sGrades.find(g => (g.batchId || `${g.date}_${g.type}`) === b.batchId);
                        const numericVal = gObj ? parseGrade(gObj.value) : null;
                        const isFail = numericVal !== null && numericVal < 6;

                        return (
                          <td
                            key={b.batchId}
                            className={`p-2 border-r border-[var(--border)] font-mono ${
                              gObj ? (isFail ? 'text-rose-400 font-bold' : 'text-slate-200') : 'text-slate-600'
                            }`}
                          >
                            {gObj ? (
                              <span>
                                {gObj.value}
                                {gObj.delayed && <span className="text-[9px] text-amber-400 ml-0.5">R</span>}
                              </span>
                            ) : (
                              '–'
                            )}
                          </td>
                        );
                      })
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : viewMode === 'type' ? (
          /* Grouped by Evaluation Type Table */
          <table className="w-full text-xs text-center border-collapse">
            <thead>
              <tr className="bg-[var(--surface-variant)] text-slate-400 uppercase tracking-wider text-[10px] font-semibold">
                <th className="p-2.5 text-left sticky left-0 z-10 bg-[var(--surface-variant)] border-r-2 border-[var(--border)] min-w-[150px]">
                  Alunno
                </th>
                <th className="p-2.5 border-r border-[var(--border)] bg-[var(--primary)] text-[var(--primary-text)] font-extrabold min-w-[70px]">
                  MEDIA
                </th>
                {showProposedGrade && (
                  <th className="p-2.5 border-r border-[var(--border)] bg-purple-950/70 text-purple-200 font-extrabold min-w-[110px]">
                    IND. MEDIA
                  </th>
                )}
                {typesList.map(t => (
                  <th key={t} className="p-2.5 border-r border-[var(--border)] min-w-[90px]">
                    {TYPES_LABEL[t]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {students.map(s => {
                const sGrades = filteredGrades.filter(g => g.studentId === s.id);
                const sAvg = calcAvg(sGrades);
                const proposed = computeProposed(sGrades);

                return (
                  <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                    <td
                      onClick={() => onOpenStudentReport(s.id)}
                      className="p-2.5 text-left font-semibold text-slate-200 cursor-pointer hover:text-[var(--primary)] sticky left-0 z-10 bg-[var(--surface)] border-r-2 border-[var(--border)] truncate"
                    >
                      {formatStudentNameWithPrivacy(s.name, isPrivacyShieldActive)}
                    </td>
                    <td className="p-2.5 border-r border-[var(--border)] font-bold text-white bg-slate-900/40">
                      <span className={sAvg !== null && sAvg < 6 ? 'text-rose-400' : 'text-emerald-400'}>
                        {formatGrade(sAvg)}
                      </span>
                    </td>
                    {showProposedGrade && renderProposedCell(proposed)}
                    {typesList.map(t => {
                      const typedGrades = sGrades.filter(g => g.type === t);
                      const typedAvg = calcAvg(typedGrades);
                      return (
                        <td key={t} className="p-2.5 border-r border-[var(--border)]">
                          {typedAvg !== null ? (
                            <div>
                              <b className={typedAvg < 6 ? 'text-rose-400' : 'text-slate-200'}>
                                {formatGrade(typedAvg)}
                              </b>
                              <span className="text-[10px] text-slate-500 block">({typedGrades.length})</span>
                            </div>
                          ) : (
                            <span className="text-slate-600">–</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          /* Summary Medie Table */
          <table className="w-full text-xs text-center border-collapse">
            <thead>
              <tr className="bg-[var(--surface-variant)] text-slate-400 uppercase tracking-wider text-[10px] font-semibold">
                <th className="p-2.5 text-left sticky left-0 z-10 bg-[var(--surface-variant)] border-r-2 border-[var(--border)] min-w-[150px]">
                  Alunno
                </th>
                <th className="p-2.5 border-r border-[var(--border)] min-w-[80px]">Media Q1</th>
                <th className="p-2.5 border-r border-[var(--border)] min-w-[80px]">Media Q2</th>
                <th className="p-2.5 border-r border-[var(--border)] bg-slate-800/80 text-white font-bold min-w-[90px]">
                  MEDIA ANNO
                </th>
                {showProposedGrade && (
                  <th className="p-2.5 border-r border-[var(--border)] bg-purple-950/70 text-purple-200 font-extrabold min-w-[110px]">
                    IND. MEDIA
                  </th>
                )}
                <th className="p-2.5 border-r border-[var(--border)] min-w-[80px]">Trend</th>
                <th className="p-2.5 border-r border-[var(--border)] min-w-[120px]">Fascia analitica</th>
                <th className="p-2.5 min-w-[90px]">Indicatore 6/10</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {students.map(s => {
                const sAllGrades = allGrades.filter(g => g.studentId === s.id);
                const q1Avg = calcAvg(sAllGrades.filter(g => g.period === 'Q1'));
                const q2Avg = calcAvg(sAllGrades.filter(g => g.period === 'Q2'));
                const totalAvg = calcAvg(sAllGrades);
                const proposed = computeProposed(sAllGrades);
                const lvl = getCompetenceLevel(proposed.avg ?? totalAvg);

                return (
                  <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                    <td
                      onClick={() => onOpenStudentReport(s.id)}
                      className="p-2.5 text-left font-semibold text-slate-200 cursor-pointer hover:text-[var(--primary)] sticky left-0 z-10 bg-[var(--surface)] border-r-2 border-[var(--border)] truncate"
                    >
                      {formatStudentNameWithPrivacy(s.name, isPrivacyShieldActive)}
                    </td>
                    <td className="p-2.5 border-r border-[var(--border)]">{formatGrade(q1Avg)}</td>
                    <td className="p-2.5 border-r border-[var(--border)]">{formatGrade(q2Avg)}</td>
                    <td className="p-2.5 border-r border-[var(--border)] font-bold text-white bg-slate-900/40">
                      <span className={totalAvg !== null && totalAvg < 6 ? 'text-rose-400' : 'text-emerald-400'}>
                        {formatGrade(totalAvg)}
                      </span>
                    </td>
                    {showProposedGrade && renderProposedCell(proposed)}
                    <td className="p-2.5 border-r border-[var(--border)]">
                      <Sparkline grades={sAllGrades} width={65} height={18} />
                    </td>
                    <td className="p-2.5 border-r border-[var(--border)]">
                      {lvl ? (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${lvl.badgeClass}`}>
                          {lvl.label}
                        </span>
                      ) : (
                        '–'
                      )}
                    </td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${totalAvg !== null && totalAvg >= 6 ? 'badge-ok' : 'badge-bad'}`}>
                        {totalAvg === null ? 'Non disponibile' : totalAvg >= 6 ? 'Media ≥ 6' : 'Media < 6'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
