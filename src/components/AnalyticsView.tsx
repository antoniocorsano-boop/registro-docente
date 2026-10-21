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
  isPrivacyShieldActive = false
}) => {
  const [periodFilter, setPeriodFilter] = useState<'ALL' | 'Q1' | 'Q2'>('ALL');
  const [useWeighted, setUseWeighted] = useState<boolean>(settings.useWeightedAverage ?? true);
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

    // Ponderata (D.M. 221/2025)
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
    : 0;

  // Level counts based on active calculation
  const levelCounts: Record<string, number> = { AV: 0, IN: 0, BA: 0, PA: 0 };
  studentMetrics.forEach(m => {
    if (m.level) {
      levelCounts[m.level.id]++;
    }
  });

  const totalAssessedStudents = validAvgs.length || 1;

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
          filename: `Prospetto_Scrutinio_${currentClass.name.replace(/\s+/g, '_')}.pdf`,
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
              <span>Analisi Soglie & Media Ponderata (D.M. 221/2025)</span>
            </h3>
            <p className="text-xs text-slate-400">
              Calcolo automatico della media ponderata per tipologia di prova conforme alle linee guida ministeriali sulla valutazione formativa e sommativa.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={periodFilter}
              onChange={e => setPeriodFilter(e.target.value as any)}
              className="p-1.5 px-3 neon-input text-xs text-white bg-slate-900"
            >
              <option value="ALL">Proiezione Finale Anno</option>
              <option value="Q1">Soglia Intermedia (Q1)</option>
              <option value="Q2">Soglia Finale (Q2)</option>
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
              <div className="inline-flex rounded-lg p-0.5 bg-slate-800 border border-slate-700">
                <button
                  type="button"
                  onClick={() => setUseWeighted(true)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                    useWeighted
                      ? 'neon-btn-primary shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ⚖️ Media Ponderata D.M. 221
                </button>
                <button
                  type="button"
                  onClick={() => setUseWeighted(false)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
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
                  ? 'La media ponderata bilancia le verifiche sommative rispetto ai quiz formativi e alle osservazioni.'
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
            <b className={`text-2xl font-bold block ${suffRate >= 60 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {suffRate}%
            </b>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
              Tasso Sufficienza ({validAvgs.filter(v => v >= 6.0).length}/{validAvgs.length})
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] text-center">
            <b className="text-2xl font-bold block text-emerald-400 drop-shadow-sm">
              {levelCounts.AV}
            </b>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
              Livello Avanzato (AV)
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] text-center">
            <b className={`text-2xl font-bold block ${levelCounts.PA > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              {levelCounts.PA}
            </b>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
              Alunni a Rischio (PA)
            </span>
          </div>
        </div>

        {/* Competence Levels Chart / Progress Distribution */}
        <div className="mt-4 pt-4 border-t border-[var(--border)]">
          <h4 className="text-xs uppercase tracking-wider font-bold text-slate-300 mb-3 flex items-center justify-between">
            <span>Distribuzione Livelli di Competenza (D.M. 221/2025)</span>
            <span className="text-slate-500 font-normal">
              Calcolati su {useWeighted ? 'Media Ponderata' : 'Media Aritmetica'}
            </span>
          </h4>

          <div className="space-y-3">
            {LEVELS.map(lvl => {
              const count = levelCounts[lvl.id] || 0;
              const pct = Math.round((count / totalAssessedStudents) * 100);

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
            })}
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
            <FileText className="w-4 h-4 text-[var(--primary)]" /> Report Scrutinio & Prospetto Valutazioni D.M. 221/2025
          </h3>
          <p className="text-xs text-slate-400">
            Esporta il tabellone con media ponderata e livelli ministeriali per il verbale del Consiglio di Classe.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" /> Stampa
          </button>

          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="px-3.5 py-2 rounded-lg neon-btn-primary text-xs font-semibold flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Generazione...' : 'Esporta PDF Scrutinio'}</span>
          </button>
        </div>
      </div>

      {/* Scrutinio Risk Projection Table with Weighted Averages */}
      <div className="neon-card p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span>Proiezione Scrutinio: Medie Ponderate & Confronto Aritmetico</span>
          </h3>
          <span className="text-xs text-slate-400">
            {useWeighted ? '⭐ Modalità Ponderata Attiva' : 'Modalità Aritmetica'}
          </span>
        </div>

        <div className="overflow-x-auto border border-[var(--border)] rounded-lg">
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
                <th className="p-2.5 border-r border-[var(--border)] min-w-[130px]">Livello D.M. 221</th>
                <th className="p-2.5 border-r border-[var(--border)] min-w-[75px]">Trend</th>
                <th className="p-2.5 min-w-[90px]">Esito Previsto</th>
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
                            {m.level.id} - {m.level.label.split(' ')[0]}
                          </span>
                        ) : (
                          <span className="text-slate-500">–</span>
                        )}
                      </td>

                      <td className="p-2.5 border-r border-[var(--border)]">
                        <Sparkline grades={m.allGrades} width={65} height={18} />
                      </td>

                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${m.isAtRisk ? 'badge-bad' : 'badge-ok'}`}>
                          {m.isAtRisk ? 'A Rischio (PA)' : 'Regolare'}
                        </span>
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
              Prospetto di Scrutinio & Valutazione Ponderata · D.M. 221/2025
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Classe: <b>{currentClass.name}</b> · Disciplina: <b>{settings.subject}</b> · A.S. <b>{settings.year}</b>
            </p>
          </div>
          <div className="text-right text-[11px] text-slate-600">
            <div>Docente: <b>{settings.teacher}</b></div>
            <div>Data Scrutinio: <b>{new Date().toLocaleDateString('it-IT')}</b></div>
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
              <th className="border border-slate-300 p-2">Media Q1 (Pond.)</th>
              <th className="border border-slate-300 p-2">Media Q2 (Pond.)</th>
              <th className="border border-slate-300 p-2 font-extrabold">Media Ponderata Finale</th>
              <th className="border border-slate-300 p-2">Media Semplice</th>
              <th className="border border-slate-300 p-2">Livello Competenza (D.M. 221)</th>
              <th className="border border-slate-300 p-2">Esito</th>
            </tr>
          </thead>
          <tbody>
            {studentMetrics.map((m, idx) => (
              <tr key={m.student.id} className="even:bg-slate-50">
                <td className="border border-slate-300 p-1.5">{idx + 1}</td>
                <td className="border border-slate-300 p-1.5 text-left font-medium">{m.student.name}</td>
                <td className="border border-slate-300 p-1.5">{formatGrade(m.q1WeightedAvg)}</td>
                <td className="border border-slate-300 p-1.5">{formatGrade(m.q2WeightedAvg)}</td>
                <td className="border border-slate-300 p-1.5 font-bold">{formatGrade(m.totalWeightedAvg)}</td>
                <td className="border border-slate-300 p-1.5 text-slate-600">{formatGrade(m.totalSimpleAvg)}</td>
                <td className="border border-slate-300 p-1.5">{m.level?.label || '–'}</td>
                <td className="border border-slate-300 p-1.5 font-semibold">
                  {m.totalWeightedAvg !== null && m.totalWeightedAvg >= 6 ? 'Idoneo' : 'A Rischio'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-8 pt-4 border-t border-slate-300 flex justify-between text-xs text-slate-600">
          <div>Firma del Docente Coordinatore: ____________________________</div>
          <div>Firma del Dirigente Scolastico: ____________________________</div>
        </div>
      </div>
    </div>
  );
};
