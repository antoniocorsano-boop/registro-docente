import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import { EvaluationType, Grade, Student } from '../types';
import { formatStudentNameWithPrivacy, parseGrade, TYPES_LABEL } from '../utils';
import { LineChart as ChartIcon, User, Layers, Calendar, Filter } from 'lucide-react';

interface StudentGradesTimelineChartProps {
  students: Student[];
  grades: Grade[];
  initialStudentId?: string | null;
  isPrivacyShieldActive?: boolean;
}

const TYPE_COLORS: Record<EvaluationType, { stroke: string; label: string }> = {
  verifica: { stroke: '#00d8d6', label: 'Verifica Scritta' },
  orale: { stroke: '#10b981', label: 'Colloquio Orale' },
  disegno: { stroke: '#fbbf24', label: 'Disegno / Pratico' },
  test: { stroke: '#c084fc', label: 'Test / Quiz' },
  osserv: { stroke: '#38bdf8', label: 'Osservazione' }
};

export const StudentGradesTimelineChart: React.FC<StudentGradesTimelineChartProps> = ({
  students,
  grades,
  initialStudentId,
  isPrivacyShieldActive = true
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    initialStudentId || students[0]?.id || ''
  );
  const [activeTypes, setActiveTypes] = useState<Record<EvaluationType, boolean>>({
    verifica: true,
    orale: true,
    disegno: true,
    test: true,
    osserv: true
  });

  const currentStudent = students.find(s => s.id === selectedStudentId) || students[0];

  // Prepare chronological dataset for the student
  const chartData = useMemo(() => {
    if (!currentStudent) return [];

    const studentGrades = grades
      .filter(g => g.studentId === currentStudent.id)
      .sort((a, b) => a.date.localeCompare(b.date));

    return studentGrades.map((g, idx) => {
      const num = parseGrade(g.value);
      const dateLabel = g.date.split('-').slice(1).reverse().join('/'); // "05/10"

      const dataPoint: any = {
        id: g.id,
        index: idx + 1,
        date: dateLabel,
        fullDate: g.date,
        title: g.title,
        period: g.period,
        type: g.type,
        rawGrade: g.value,
        delayed: g.delayed
      };

      // Assign grade to specific type key
      if (num !== null && !isNaN(num)) {
        dataPoint[g.type] = num;
      }

      return dataPoint;
    });
  }, [currentStudent, grades]);

  const toggleType = (t: EvaluationType) => {
    setActiveTypes(prev => ({
      ...prev,
      [t]: !prev[t]
    }));
  };

  if (!currentStudent || students.length === 0) {
    return null;
  }

  // Custom Neon Tooltip for Recharts
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const numGrade = parseGrade(data.rawGrade);
      const isSuff = numGrade !== null && numGrade >= 6.0;

      return (
        <div className="bg-[#0b0f19] border border-cyan-500/40 p-3 rounded-xl shadow-2xl backdrop-blur-md text-xs space-y-1.5 min-w-[190px]">
          <div className="flex justify-between items-center pb-1.5 border-b border-slate-800 text-[11px] text-slate-400">
            <span className="font-mono text-cyan-400 font-bold">{data.fullDate}</span>
            <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-300">
              {data.period}
            </span>
          </div>

          <div className="font-semibold text-white leading-tight">
            {data.title || 'Valutazione'}
          </div>

          <div className="flex items-center justify-between pt-1">
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold"
              style={{
                backgroundColor: `${TYPE_COLORS[data.type as EvaluationType]?.stroke}20`,
                color: TYPE_COLORS[data.type as EvaluationType]?.stroke,
                border: `1px solid ${TYPE_COLORS[data.type as EvaluationType]?.stroke}50`
              }}
            >
              {TYPES_LABEL[data.type as EvaluationType] || data.type}
            </span>

            <div className="flex items-center gap-1 font-mono font-bold text-sm">
              <span className={isSuff ? 'text-emerald-400' : 'text-rose-400'}>
                {data.rawGrade}
              </span>
              {data.delayed && <span className="text-[10px] text-amber-400">R</span>}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="neon-card p-4 sm:p-5 mt-4">
      {/* Header and Student Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[var(--border)]">
        <div>
          <h4 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <ChartIcon className="w-4 h-4 text-[var(--primary)]" />
            <span>Andamento Voti nel Tempo per Studente (Segmentato per Tipologia)</span>
          </h4>
          <p className="text-xs text-slate-400">
            Evoluzione cronologica dei risultati con serie distinte per verifiche scritte, orali, prove pratiche e test.
          </p>
        </div>

        {/* Student Selector */}
        <div className="flex items-center gap-2 w-full sm:w-64">
          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={currentStudent.id}
            onChange={e => setSelectedStudentId(e.target.value)}
            className="w-full p-2 neon-input text-xs sm:text-sm font-semibold text-white bg-slate-900"
          >
            {students.map(s => (
              <option key={s.id} value={s.id}>
                {formatStudentNameWithPrivacy(s.name, isPrivacyShieldActive)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Type Filter Buttons */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mr-1 flex items-center gap-1">
          <Filter className="w-3 h-3 text-cyan-400" /> Filtra Tipologie:
        </span>
        {(Object.keys(TYPE_COLORS) as EvaluationType[]).map(t => {
          const cfg = TYPE_COLORS[t];
          const isEnabled = activeTypes[t];

          return (
            <button
              key={t}
              type="button"
              onClick={() => toggleType(t)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                isEnabled
                  ? 'border-transparent text-slate-100 shadow-sm'
                  : 'bg-slate-900 text-slate-600 border-slate-800 line-through opacity-50'
              }`}
              style={{
                backgroundColor: isEnabled ? `${cfg.stroke}25` : undefined,
                borderColor: isEnabled ? `${cfg.stroke}60` : undefined,
                color: isEnabled ? cfg.stroke : undefined
              }}
            >
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: cfg.stroke }}
              />
              <span>{cfg.label}</span>
            </button>
          );
        })}
      </div>

      {/* Recharts LineChart */}
      {chartData.length === 0 ? (
        <div className="h-56 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs p-6 text-center">
          <Calendar className="w-8 h-8 text-slate-600 mb-2" />
          <span>Nessuna valutazione registrata per <b>{formatStudentNameWithPrivacy(currentStudent.name, isPrivacyShieldActive)}</b>.</span>
        </div>
      ) : (
        <div className="w-full h-72 sm:h-80 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 15, left: -20, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1f2937"
                vertical={false}
              />

              <XAxis
                dataKey="date"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={{ stroke: '#334155' }}
              />

              <YAxis
                domain={[2, 10]}
                ticks={[2, 4, 6, 8, 10]}
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={{ stroke: '#334155' }}
              />

              {/* Reference line for sufficiency threshold (6.0) */}
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

              <Tooltip content={<CustomTooltip />} />

              <Legend
                wrapperStyle={{ paddingTop: '10px', fontSize: '11px' }}
                iconType="circle"
              />

              {/* Individual Lines for each evaluation type */}
              {activeTypes.verifica && (
                <Line
                  type="monotone"
                  dataKey="verifica"
                  name="Scritto"
                  stroke={TYPE_COLORS.verifica.stroke}
                  strokeWidth={2.5}
                  connectNulls={true}
                  dot={{ r: 5, fill: TYPE_COLORS.verifica.stroke, strokeWidth: 1.5, stroke: '#030712' }}
                  activeDot={{ r: 7, stroke: '#fff', strokeWidth: 2 }}
                />
              )}

              {activeTypes.orale && (
                <Line
                  type="monotone"
                  dataKey="orale"
                  name="Orale"
                  stroke={TYPE_COLORS.orale.stroke}
                  strokeWidth={2.5}
                  connectNulls={true}
                  dot={{ r: 5, fill: TYPE_COLORS.orale.stroke, strokeWidth: 1.5, stroke: '#030712' }}
                  activeDot={{ r: 7, stroke: '#fff', strokeWidth: 2 }}
                />
              )}

              {activeTypes.disegno && (
                <Line
                  type="monotone"
                  dataKey="disegno"
                  name="Pratico"
                  stroke={TYPE_COLORS.disegno.stroke}
                  strokeWidth={2.5}
                  connectNulls={true}
                  dot={{ r: 5, fill: TYPE_COLORS.disegno.stroke, strokeWidth: 1.5, stroke: '#030712' }}
                  activeDot={{ r: 7, stroke: '#fff', strokeWidth: 2 }}
                />
              )}

              {activeTypes.test && (
                <Line
                  type="monotone"
                  dataKey="test"
                  name="Test / Quiz"
                  stroke={TYPE_COLORS.test.stroke}
                  strokeWidth={2.5}
                  connectNulls={true}
                  dot={{ r: 5, fill: TYPE_COLORS.test.stroke, strokeWidth: 1.5, stroke: '#030712' }}
                  activeDot={{ r: 7, stroke: '#fff', strokeWidth: 2 }}
                />
              )}

              {activeTypes.osserv && (
                <Line
                  type="monotone"
                  dataKey="osserv"
                  name="Osservazione"
                  stroke={TYPE_COLORS.osserv.stroke}
                  strokeWidth={2.5}
                  connectNulls={true}
                  dot={{ r: 5, fill: TYPE_COLORS.osserv.stroke, strokeWidth: 1.5, stroke: '#030712' }}
                  activeDot={{ r: 7, stroke: '#fff', strokeWidth: 2 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
