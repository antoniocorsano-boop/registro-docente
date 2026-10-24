import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell
} from 'recharts';
import { formatGrade, formatStudentNameWithPrivacy } from '../utils';
import { BarChart3, TrendingUp, TrendingDown, Users, CheckCircle, AlertTriangle } from 'lucide-react';

interface StudentMetricItem {
  student: { id: string; name: string };
  activeAvg: number | null;
  level: any;
  isAtRisk: boolean;
}

interface ClassComparisonBarChartProps {
  studentMetrics: StudentMetricItem[];
  classAvg: number | null;
  isPrivacyShieldActive?: boolean;
  useWeighted?: boolean;
}

export const ClassComparisonBarChart: React.FC<ClassComparisonBarChartProps> = ({
  studentMetrics,
  classAvg,
  isPrivacyShieldActive = true,
  useWeighted = true
}) => {
  const chartData = useMemo(() => {
    return studentMetrics.map(m => {
      const avg = m.activeAvg !== null && !isNaN(m.activeAvg) ? Number(m.activeAvg.toFixed(2)) : null;
      const diff = avg !== null && classAvg !== null ? Number((avg - classAvg).toFixed(2)) : null;
      const isAbove = diff !== null && diff >= 0;

      return {
        id: m.student.id,
        name: formatStudentNameWithPrivacy(m.student.name, isPrivacyShieldActive),
        rawName: m.student.name,
        avg: avg ?? 0,
        hasGrade: avg !== null,
        diff: diff ?? 0,
        isAbove,
        isAtRisk: m.isAtRisk
      };
    });
  }, [studentMetrics, classAvg, isPrivacyShieldActive]);

  const validStudents = chartData.filter(d => d.hasGrade);
  const aboveCount = validStudents.filter(d => d.isAbove).length;
  const belowCount = validStudents.filter(d => !d.isAbove).length;
  const totalCount = validStudents.length || 1;
  const abovePct = Math.round((aboveCount / totalCount) * 100);

  // Custom Neon Tooltip for comparative bars
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      if (!data.hasGrade) return null;

      const isAbove = data.isAbove;
      const diffVal = data.diff;
      const formattedDiff = diffVal > 0 ? `+${diffVal.toFixed(2)}` : diffVal.toFixed(2);

      return (
        <div className="bg-[#0b0f19] border border-cyan-500/40 p-3 rounded-xl shadow-2xl backdrop-blur-md text-xs space-y-2 min-w-[210px]">
          <div className="flex justify-between items-center pb-1.5 border-b border-slate-800">
            <span className="font-bold text-white text-sm truncate max-w-[150px]">
              {data.name}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                isAbove ? 'badge-ok' : data.isAtRisk ? 'badge-bad' : 'badge-warn'
              }`}
            >
              {isAbove ? 'Sopra Media' : data.isAtRisk ? 'A Rischio' : 'Sotto Media'}
            </span>
          </div>

          <div className="space-y-1 text-slate-300">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Media Alunno ({useWeighted ? 'Pond.' : 'Aritm.'}):</span>
              <b className="text-white font-mono text-sm">{formatGrade(data.avg)}</b>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Media di Sezione:</span>
              <b className="text-cyan-400 font-mono">{formatGrade(classAvg)}</b>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-800/80">
              <span className="text-slate-400">Scostamento (Δ):</span>
              <b className={`font-mono font-bold ${isAbove ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formattedDiff} pt
              </b>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="neon-card min-w-0 overflow-hidden p-4 sm:p-5 mt-4">
      {/* Header and Summary stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[var(--border)]">
        <div>
          <h4 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[var(--primary)]" />
            <span>Analisi comparativa: studenti vs media di sezione</span>
          </h4>
          <p className="text-xs text-slate-400">
            Raffronto puntuale tra la media di ciascun alunno ({useWeighted ? 'Ponderata' : 'Aritmetica'}) e la media generale della classe.
          </p>
        </div>

        {/* Legend / Quick stats */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-md text-xs font-semibold badge-ok flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Sopra Media: <b>{aboveCount}</b> ({abovePct}%)</span>
          </span>
          <span className="px-2.5 py-1 rounded-md text-xs font-semibold badge-warn flex items-center gap-1.5">
            <TrendingDown className="w-3.5 h-3.5" />
            <span>Sotto Media: <b>{belowCount}</b> ({100 - abovePct}%)</span>
          </span>
        </div>
      </div>

      {validStudents.length === 0 ? (
        <div className="h-56 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs p-6 text-center">
          <Users className="w-8 h-8 text-slate-600 mb-2" />
          <span>Dati insufficienti per generare il grafico comparativo di sezione.</span>
        </div>
      ) : (
        <div className="w-full h-80 sm:h-96 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 15, left: -20, bottom: 45 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />

              <XAxis
                dataKey="name"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                interval={0}
                angle={-35}
                textAnchor="end"
                axisLine={{ stroke: '#334155' }}
              />

              <YAxis
                domain={[2, 10]}
                ticks={[2, 4, 6, 8, 10]}
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={{ stroke: '#334155' }}
              />

              {/* Reference line for Sufficiency (6.0) */}
              <ReferenceLine
                y={6}
                stroke="#10b981"
                strokeDasharray="4 4"
                label={{
                  value: 'Sufficienza (6.0)',
                  fill: '#10b981',
                  fontSize: 10,
                  position: 'insideBottomRight'
                }}
              />

              {/* Reference line for Class Average */}
              {classAvg !== null && !isNaN(classAvg) && (
                <ReferenceLine
                  y={classAvg}
                  stroke="#00d8d6"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  label={{
                    value: `Media Classe (${formatGrade(classAvg)})`,
                    fill: '#00d8d6',
                    fontSize: 11,
                    position: 'insideTopLeft',
                    fontWeight: 'bold'
                  }}
                />
              )}

              <Tooltip content={<CustomTooltip />} />

              <Bar dataKey="avg" name="Media Studente" radius={[4, 4, 0, 0]}>
                {chartData.map(entry => {
                  let fillColor = '#00d8d6'; // cyan for above class avg
                  if (entry.avg < 6.0) {
                    fillColor = '#f43f5e'; // red for failing (< 6)
                  } else if (!entry.isAbove) {
                    fillColor = '#fbbf24'; // amber for below class avg but >= 6
                  } else {
                    fillColor = '#10b981'; // emerald green for above class avg
                  }

                  return (
                    <Cell
                      key={entry.id}
                      fill={fillColor}
                      fillOpacity={0.88}
                      stroke={fillColor}
                      strokeWidth={1}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Footer Legend Guide */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-[var(--border)] flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#10b981] inline-block" />
            <span>Al di sopra della media di classe</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#fbbf24] inline-block" />
            <span>Sotto la media di classe (ma sufficiente)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#f43f5e] inline-block" />
            <span>Sotto la sufficienza (a rischio debito)</span>
          </span>
        </div>

        <span className="text-[10px] text-slate-500 italic">
          Linea tratteggiata ciano = Media di Sezione · Linea verde = soglia analitica 6/10
        </span>
      </div>
    </div>
  );
};
