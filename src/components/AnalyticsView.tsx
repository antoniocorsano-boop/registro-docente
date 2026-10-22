import React, { useState } from 'react';
import { AppSettings, ClassData, EvaluationType } from '../types';
import {
  calcAvg,
  calcWeightedAvg,
  DEFAULT_EVALUATION_WEIGHTS,
  formatGrade,
  getCompetenceLevel,
  LEVELS,
  formatStudentNameWithPrivacy,
  TYPES_LABEL
} from '../utils';
import { Sparkline } from './Sparkline';
import { StudentGradesTimelineChart } from './StudentGradesTimelineChart';
import { ClassComparisonBarChart } from './ClassComparisonBarChart';


import {
  BarChart3,
  FileText,
  AlertCircle,
  Download,
  Filter,
  CheckCircle,
  Printer,
  Scale,
  Calculator,
  Sliders,
  TrendingUp,
  TrendingDown,
  Info
} from 'lucide-react';

interface AnalyticsViewProps {
  currentClass: ClassData;
  settings: AppSettings;
  onOpenStudentReport: (studentId: string) => void;
  isPrivacyShieldActive?: boolean;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  currentClass,
  settings,
  onOpenStudentReport,
  isPrivacyShieldActive = true
}) => {
  const [periodFilter, setPeriodFilter] = useState<'ALL' | 'Q1' | 'Q2'>('ALL');
  const [useWeighted, setUseWeighted] = useState<boolean>(settings.useWeightedAverage ?? false);
  const [isExporting, setIsExporting] = useState(false);

  const students = currentClass.students || [];
  const allGrades = currentClass.grades || [];

  const weights: Record<EvaluationType, number> = settings.evaluationWeights || DEFAULT_EVALUATION_WEIGHTS;

  const filteredGrades = allGrades.filter(g =>
    periodFilter === 'ALL' ? true : g.period === periodFilter
  );

  // Student metrics with both weighted and arithmetic averages
  const studentMetrics = students.map(s => {
    const sAllGrades = allGrades.filter(g => g.studentId === s.id);
    const sFilteredGrades = filteredGrades.filter(g => g.studentId === s.id);
    const q1Grades = allGrades.filter(g => g.studentId === s.id && g.period === 'Q1');
    const q2Grades = allGrades.filter(g => g.studentId === s.id && g.period === 'Q2');

    // Aritmetica
    const totalSimpleAvg = calcAvg(sAllGrades);
    const currentSimpleAvg = calcAvg(sFilteredGrades);
    const q1SimpleAvg = calcAvg(q1Grades);
    const q2SimpleAvg = calcAvg(q2Grades);

    // Ponderata secondo i pesi configurati dal docente/istituto
    const totalWeightedAvg = calcWeightedAvg(sAllGrades, weights);
    const currentWeightedAvg = calcWeightedAvg(sFilteredGrades, weights);
    const q1WeightedAvg = calcWeightedAvg(q1Grades, weights);
    const q2WeightedAvg = calcWeightedAvg(q2Grades, weights);

    // Active average based on toggle
    const activeAvg = useWeighted ? currentWeightedAvg : currentSimpleAvg;
    const activeTotalAvg = useWeighted ? totalWeightedAvg : totalSimpleAvg;

    // Delta between weighted and arithmetic
    const delta = totalWeightedAvg !== null && totalSimpleAvg !== null
      ? totalWeightedAvg - totalSimpleAvg
      : null;

    return {
      student: s,
      allGrades: sAllGrades,
      totalSimpleAvg,
      currentSimpleAvg,
      q1SimpleAvg,
      q2SimpleAvg,
      totalWeightedAvg,
      currentWeightedAvg,
      q1WeightedAvg,
      q2WeightedAvg,
      activeAvg,
      activeTotalAvg,
      delta,
      level: getCompetenceLevel(activeAvg),
      isAtRisk: activeAvg !== null && activeAvg < 6.0
    };
  });

  const validAvgs = studentMetrics
    .map(m => m.activeAvg)
    .filter((v): v is number => v !== null && !isNaN(v));

  const classAvg = validAvgs.length > 0
    ? validAvgs.reduce((a, b) => a + b, 0) / validAvgs.length
    : null;

  const suffRate = validAvgs.length > 0
    ? Math.round((validAvgs.filter(v => v >= 6.0).length / validAvgs.length) * 100)
    : null;

  // Level counts based on active calculation
  const levelCounts: Record<string, number> = { AV: 0, IN: 0, BA: 0, PA: 0 };
  studentMetrics.forEach(m => {
    if (m.level) {
      levelCounts[m.level.id]++;
    }
  });


  // Official PDF export using html2pdf
  const handleExportPDF = async () => {
    setIsExporting(true);
    const element = document.getElementById('official-pdf-report');
    if (!element) {
      window.print();
      setIsExporting(false);
      return;
    }

    try {
      if (typeof html2pdf !== 'undefined') {
        const opt = {
          margin: 10,
          filename: `Prospetto_Lavoro_${currentClass.name.replace(/\s+/g, '_')}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        await (html2pdf() as any).set(opt).from(element).save();
      } else {
        window.print();
      }
    } catch (e) {
      console.error('PDF generation error', e);
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Analytics Header Card */}
      <div className="neon-card neon-card-highlight p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[var(--border)]">
          <div>
            <h3 className="text-lg font-bold text-[var(--primary)] drop-shadow-[0_0_8px_var(--primary)] flex items-center gap-2">
              <Scale className="w-5 h-5 text-[var(--primary)]" />
              <span>Analisi medie & fasce analitiche</span>
            </h3>
            <p className="text-xs text-slate-400">
              Indicatori matematici di supporto alla valutazione professionale; non determinano voti o decisioni di scrutinio.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={periodFilter}
              onChange={e => setPeriodFilter(e.target.value as any)}
              className="w-full sm:w-auto min-h-[44px] p-1.5 px-3 neon-input text-xs text-white bg-slate-900"
            >
              <option value="ALL">Anno completo</option>
              <option value="Q1">Primo periodo (Q1)</option>
              <option value="Q2">Secondo periodo (Q2)</option>
            </select>
          </div>
        </div>

        {/* Weighted vs Arithmetic Toggle & Active Weights Chips */}
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-[var(--border)] mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-[var(--primary)]" /> Algoritmo di Calcolo:
              </span>
              <div className="w-full sm:w-auto grid grid-cols-1 sm:grid-cols-2 rounded-lg p-0.5 bg-slate-800 border border-slate-700">
                <button
                  type="button"
                  onClick={() => setUseWeighted(true)}
                  className={`min-h-[44px] px-3 py-1 rounded-md text-xs font-bold transition-all ${
                    useWeighted
                      ? 'neon-btn-primary shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ⚖️ Media ponderata configurabile
                </button>
                <button
                  type="button"
                  onClick={() => setUseWeighted(false)}
                  className={`min-h-[44px] px-3 py-1 rounded-md text-xs font-bold transition-all ${
                    !useWeighted
                      ? 'neon-btn-primary shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  📊 Media Aritmetica Semplice
                </button>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <Info className="w-3 h-3 text-cyan-400 shrink-0" />
              <span>
                {useWeighted
                  ? 'La media ponderata usa esclusivamente i pesi configurati nelle impostazioni dal docente o dall’istituto.'
                  : 'Media puramente aritmetica (tutte le valutazioni concorrono con uguale peso 1:1).'}
              </span>
            </div>
          </div>

          {/* Active weights chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mr-1">
              Pesi Attivi:
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-cyan-300 border border-cyan-800/60" title="Verifica Scritta Sommativa">
              Scritto: {weights.verifica}%
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-cyan-300 border border-cyan-800/60" title="Colloquio Orale">
              Orale: {weights.orale}%
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-cyan-300 border border-cyan-800/60" title="Disegno Tecnico / Pratico">
              Pratico: {weights.disegno}%
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-purple-300 border border-purple-800/60" title="Test / Quiz Formativo">
              Test: {weights.test}%
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-amber-300 border border-amber-800/60" title="Osservazione Sistematica">
              Osserv.: {weights.osserv}%
            </span>
          </div>
        </div>

        {/* Analytics KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="p-3 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] text-center">
            <b className="text-2xl font-bold block text-white drop-shadow-sm">
              {formatGrade(classAvg)}
            </b>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
              Media {useWeighted ? 'Ponderata' : 'Aritmetica'} {periodFilter === 'ALL' ? 'Anno' : periodFilter}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] text-center">
            <b className={`text-2xl font-bold block ${
              suffRate === null
                ? 'text-slate-500'
                : suffRate >= 60
                  ? 'text-emerald-400'
                  : 'text-rose-400'
            }`}>
              {suffRate === null ? '—' : `${suffRate}%`}
            </b>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
              {suffRate === null ? 'Nessun dato' : `Tasso Sufficienza (${validAvgs.filter(v => v >= 6.0).length}/${validAvgs.length})`}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] text-center">
            <b className="text-2xl font-bold block text-emerald-400 drop-shadow-sm">
              {validAvgs.length === 0 ? '—' : levelCounts.AV}
            </b>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
              Fascia alta (≥ 8,5)
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] text-center">
            <b className={`text-2xl font-bold block ${levelCounts.PA > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              {validAvgs.length === 0 ? '—' : levelCounts.PA}
            </b>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
              Sotto soglia analitica (&lt; 6)
            </span>
          </div>
        </div>

        {/* Competence Levels Chart / Progress Distribution */}
        <div className="mt-4 pt-4 border-t border-[var(--border)]">
          <h4 className="text-xs uppercase tracking-wider font-bold text-slate-300 mb-3 flex items-center justify-between">
            <span>Fasce analitiche della media</span>
            <span className="text-slate-500 font-normal">
              Calcolati su {useWeighted ? 'Media Ponderata' : 'Media Aritmetica'}
            </span>
          </h4>

          <div className="space-y-3">
            {validAvgs.length === 0 ? (
              <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800 text-center text-xs text-slate-500">
                Nessun dato disponibile per la distribuzione dei livelli.
              </div>
            ) : (
              LEVELS.map(lvl => {
                const count = levelCounts[lvl.id] || 0;
                const pct = Math.round((count / validAvgs.length) * 100);

                return (
                  <div key={lvl.id} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-200 flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ backgroundColor: lvl.color }}
                        />
                        {lvl.label}
                      </span>
                      <span className="text-slate-400 font-mono">
                        <b>{count}</b> alunni ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden border border-slate-700/60 flex">
                      <div
                        className="h-full transition-all duration-500 rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: lvl.color,
                          boxShadow: `0 0 10px ${lvl.color}66`
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Recharts Timeline Graph Segmented by Evaluation Type */}
      <StudentGradesTimelineChart
        students={students}
        grades={allGrades}
        isPrivacyShieldActive={isPrivacyShieldActive}
      />

      {/* Recharts Comparative Bar Chart: Students vs Class Average */}
      <ClassComparisonBarChart
        studentMetrics={studentMetrics}
        classAvg={classAvg}
        isPrivacyShieldActive={isPrivacyShieldActive}
        useWeighted={useWeighted}
      />

      {/* Official Export Card */}


      <div className="neon-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-[var(--primary)]" /> Prospetto di lavoro docente
          </h3>
          <p className="text-xs text-slate-400">
            Esporta un prospetto interno di supporto: non costituisce verbale, voto deliberato o certificazione ufficiale.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full sm:w-auto">
          <button
            onClick={() => window.print()}
            className="min-h-[44px] w-full sm:w-auto px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" /> Stampa
          </button>

          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="min-h-[44px] w-full sm:w-auto px-3.5 py-2 rounded-lg neon-btn-primary text-xs font-semibold flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Generazione...' : 'Esporta PDF di lavoro'}</span>
          </button>
        </div>
      </div>

      {/* Internal analytical table with weighted and arithmetic averages */}
      <div className="neon-card p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span>Indicatori di media: ponderata & confronto aritmetico</span>
          </h3>
          <span className="text-xs text-slate-400">
            {useWeighted ? '⭐ Modalità Ponderata Attiva' : 'Modalità Aritmetica'}
          </span>
        </div>

        {/* Mobile scrutiny cards */}
        <div className="md:hidden space-y-2">
          {studentMetrics.length === 0 ? (
            <div className="p-4 rounded-lg border border-[var(--border)] bg-slate-900/40 text-center text-xs text-slate-500">
              Nessun alunno presente.
            </div>
          ) : (
            studentMetrics.map(m => {
              const displayQ1 = useWeighted ? m.q1WeightedAvg : m.q1SimpleAvg;
              const displayQ2 = useWeighted ? m.q2WeightedAvg : m.q2SimpleAvg;
              const displayTotal = useWeighted ? m.totalWeightedAvg : m.totalSimpleAvg;

              return (
                <article key={m.student.id} className="rounded-lg border border-[var(--border)] bg-slate-900/45 p-3 space-y-3">
                  <button
                    type="button"
                    onClick={() => onOpenStudentReport(m.student.id)}
                    className="min-h-[44px] w-full text-left flex items-center justify-between gap-3 rounded-md px-2 -mx-2 text-sm font-semibold text-slate-100 hover:text-[var(--primary)] hover:bg-slate-800/70"
                  >
                    <span className="truncate">{formatStudentNameWithPrivacy(m.student.name, isPrivacyShieldActive)}</span>
                    <span className="text-[10px] uppercase tracking-wider text-[var(--primary)] shrink-0">Scheda</span>
                  </button>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md bg-slate-950/70 p-2">
                      <span className="block text-[10px] uppercase text-slate-500">Q1</span>
                      <b className="font-mono text-sm text-slate-200">{formatGrade(displayQ1)}</b>
                    </div>
                    <div className="rounded-md bg-slate-950/70 p-2">
                      <span className="block text-[10px] uppercase text-slate-500">Q2</span>
                      <b className="font-mono text-sm text-slate-200">{formatGrade(displayQ2)}</b>
                    </div>
                    <div className="rounded-md bg-slate-950/70 p-2">
                      <span className="block text-[10px] uppercase text-slate-500">Anno</span>
                      <b className="font-mono text-sm text-white">{formatGrade(displayTotal)}</b>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-slate-400">
                      Fascia analitica: <b className="text-slate-200">{m.level ? m.level.label : '–'}</b>
                    </span>
                    {displayTotal === null ? (
                      <span className="px-2 py-1 rounded text-[10px] font-semibold text-slate-500 bg-slate-800/70">Non disponibile</span>
                    ) : (
                      <span className={`px-2 py-1 rounded text-[10px] font-semibold ${m.isAtRisk ? 'badge-bad' : 'badge-ok'}`}>
                        {m.isAtRisk ? 'Media < 6' : 'Media ≥ 6'}
                      </span>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>

        <div className="hidden md:block overflow-x-auto border border-[var(--border)] rounded-lg">
          <table className="w-full text-xs text-center border-collapse">
            <thead>
              <tr className="bg-[var(--surface-variant)] text-slate-400 uppercase tracking-wider text-[10px] font-semibold">
                <th className="p-2.5 text-left sticky left-0 bg-[var(--surface-variant)] border-r border-[var(--border)] min-w-[150px]">
                  Alunno
                </th>
                <th className="p-2.5 border-r border-[var(--border)] min-w-[80px]">
                  Media Q1 {useWeighted && '(Pond.)'}
                </th>
                <th className="p-2.5 border-r border-[var(--border)] min-w-[80px]">
                  Media Q2 {useWeighted && '(Pond.)'}
                </th>
                <th className="p-2.5 border-r border-[var(--border)] bg-[var(--primary)] text-[var(--primary-text)] font-extrabold min-w-[95px]">
                  MEDIA ANNO {useWeighted ? 'PONDERATA' : 'ARITMETICA'}
                </th>
                <th className="p-2.5 border-r border-[var(--border)] min-w-[85px]" title="Confronto con media aritmetica semplice">
                  Media Semplice (Δ)
                </th>
                <th className="p-2.5 border-r border-[var(--border)] min-w-[130px]">Fascia analitica</th>
                <th className="p-2.5 border-r border-[var(--border)] min-w-[75px]">Trend</th>
                <th className="p-2.5 min-w-[90px]">Indicatore 6/10</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {studentMetrics.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-4 text-slate-500">
                    Nessun alunno presente.
                  </td>
                </tr>
              ) : (
                studentMetrics.map(m => {
                  const displayQ1 = useWeighted ? m.q1WeightedAvg : m.q1SimpleAvg;
                  const displayQ2 = useWeighted ? m.q2WeightedAvg : m.q2SimpleAvg;
                  const displayTotal = useWeighted ? m.totalWeightedAvg : m.totalSimpleAvg;

                  return (
                    <tr key={m.student.id} className="hover:bg-slate-800/40 transition-colors">
                      <td
                        onClick={() => onOpenStudentReport(m.student.id)}
                        className="p-2.5 text-left font-semibold text-slate-200 cursor-pointer hover:text-[var(--primary)] sticky left-0 bg-[var(--surface)] border-r border-[var(--border)]"
                      >
                        {formatStudentNameWithPrivacy(m.student.name, isPrivacyShieldActive)}
                      </td>

                      <td className="p-2.5 border-r border-[var(--border)] font-mono">
                        {formatGrade(displayQ1)}
                      </td>

                      <td className="p-2.5 border-r border-[var(--border)] font-mono">
                        {formatGrade(displayQ2)}
                      </td>

                      <td className="p-2.5 border-r border-[var(--border)] font-mono font-bold text-base text-white bg-slate-900/60">
                        <span className={displayTotal !== null && displayTotal < 6 ? 'text-rose-400' : 'text-emerald-400'}>
                          {formatGrade(displayTotal)}
                        </span>
                      </td>

                      <td className="p-2.5 border-r border-[var(--border)] font-mono text-slate-300">
                        {m.totalSimpleAvg !== null ? (
                          <div className="flex items-center justify-center gap-1">
                            <span>{formatGrade(m.totalSimpleAvg)}</span>
                            {m.delta !== null && Math.abs(m.delta) >= 0.05 && (
                              <span
                                className={`text-[10px] font-bold px-1 rounded ${
                                  m.delta > 0
                                    ? 'text-emerald-400 bg-emerald-950/60'
                                    : 'text-rose-400 bg-rose-950/60'
                                }`}
                              >
                                {m.delta > 0 ? `+${m.delta.toFixed(1)}` : m.delta.toFixed(1)}
                              </span>
                            )}
                          </div>
                        ) : (
                          '–'
                        )}
                      </td>

                      <td className="p-2.5 border-r border-[var(--border)]">
                        {m.level ? (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${m.level.badgeClass}`}>
                            {m.level.label}
                          </span>
                        ) : (
                          <span className="text-slate-500">–</span>
                        )}
                      </td>

                      <td className="p-2.5 border-r border-[var(--border)]">
                        <Sparkline grades={m.allGrades} width={65} height={18} />
                      </td>

                      <td className="p-2.5">
                        {displayTotal === null ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold text-slate-500 bg-slate-800/70">
                            Non disponibile
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${m.isAtRisk ? 'badge-bad' : 'badge-ok'}`}>
                            {m.isAtRisk ? 'Media < 6' : 'Media ≥ 6'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hidden printable template used by html2pdf and print */}
      <div id="official-pdf-report" className="hidden print:block p-8 bg-white text-black font-sans text-xs">
        <div className="border-b-2 border-slate-900 pb-3 mb-4 flex justify-between items-start">
          <div>
            <h1 className="text-base font-bold text-slate-900 uppercase tracking-tight">
              {settings.school}
            </h1>
            <h2 className="text-sm font-semibold text-slate-700">
              Prospetto di lavoro docente · Indicatori di valutazione
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Classe: <b>{currentClass.name}</b> · Disciplina: <b>{settings.subject}</b> · A.S. <b>{settings.year}</b>
            </p>
          </div>
          <div className="text-right text-[11px] text-slate-600">
            <div>Docente: <b>{settings.teacher}</b></div>
            <div>Data elaborazione: <b>{new Date().toLocaleDateString('it-IT')}</b></div>
            <div className="text-[10px] mt-1 text-slate-500">
              Pesi: Scritto {weights.verifica}% · Orale {weights.orale}% · Pratico {weights.disegno}% · Test {weights.test}% · Osserv. {weights.osserv}%
            </div>
          </div>
        </div>

        <table className="w-full border-collapse border border-slate-300 text-center text-xs mt-4">
          <thead>
            <tr className="bg-slate-100 font-bold text-slate-800">
              <th className="border border-slate-300 p-2">#</th>
              <th className="border border-slate-300 p-2 text-left">Cognome e Nome</th>
              <th className="border border-slate-300 p-2">Media Q1 {useWeighted ? '(Pond.)' : '(Aritm.)'}</th>
              <th className="border border-slate-300 p-2">Media Q2 {useWeighted ? '(Pond.)' : '(Aritm.)'}</th>
              <th className="border border-slate-300 p-2 font-extrabold">Media Finale {useWeighted ? 'Ponderata' : 'Aritmetica'}</th>
              <th className="border border-slate-300 p-2">Media Semplice</th>
              <th className="border border-slate-300 p-2">Fascia analitica</th>
              <th className="border border-slate-300 p-2">Indicatore 6/10</th>
            </tr>
          </thead>
          <tbody>
            {studentMetrics.map((m, idx) => {
              const exportQ1 = useWeighted ? m.q1WeightedAvg : m.q1SimpleAvg;
              const exportQ2 = useWeighted ? m.q2WeightedAvg : m.q2SimpleAvg;
              const exportTotal = useWeighted ? m.totalWeightedAvg : m.totalSimpleAvg;
              const exportLevel = getCompetenceLevel(exportTotal);

              return (
                <tr key={m.student.id} className="even:bg-slate-50">
                  <td className="border border-slate-300 p-1.5">{idx + 1}</td>
                  <td className="border border-slate-300 p-1.5 text-left font-medium">{formatStudentNameWithPrivacy(m.student.name, isPrivacyShieldActive)}</td>
                  <td className="border border-slate-300 p-1.5">{formatGrade(exportQ1)}</td>
                  <td className="border border-slate-300 p-1.5">{formatGrade(exportQ2)}</td>
                  <td className="border border-slate-300 p-1.5 font-bold">{formatGrade(exportTotal)}</td>
                  <td className="border border-slate-300 p-1.5 text-slate-600">{formatGrade(m.totalSimpleAvg)}</td>
                  <td className="border border-slate-300 p-1.5">{exportLevel?.label || '–'}</td>
                  <td className="border border-slate-300 p-1.5 font-semibold">
                    {exportTotal === null ? 'Non disponibile' : exportTotal >= 6 ? 'Media ≥ 6' : 'Media < 6'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-8 pt-4 border-t border-slate-300 text-xs text-slate-600">
          Documento di lavoro interno del docente. Le medie sono indicatori di supporto e non sostituiscono la valutazione professionale o collegiale.
        </div>
      </div>
    </div>
  );
};
