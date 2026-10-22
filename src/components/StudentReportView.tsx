import React, { useState } from 'react';
import { AppSettings, ClassData, EvaluationType, UdaRecord, Grade } from '../types';
import {
  calcAvg,
  calcWeightedAvg,
  DEFAULT_EVALUATION_WEIGHTS,
  formatGrade,
  formatStudentNameWithPrivacy,
  getCompetenceLevel,
  TYPES_LABEL
} from '../utils';
import { Sparkline } from './Sparkline';
import {
  UserCheck,
  Award,
  Calendar,
  BookOpen,
  Clock,
  Sparkles,
  Scale,
  Target,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Layers,
  Activity,
  Check,
  TrendingUp,
  FileText,
  AlertTriangle,
  Compass,
  BarChart3,
  ShieldCheck,
  HelpCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  Legend
} from 'recharts';
import { ACTIVITY_TYPE_CONFIG, inferLessonActivityType, calcUdaCompetenceCredits } from './UdaGanttView';

interface StudentReportViewProps {
  currentClass: ClassData;
  selectedStudentId: string | null;
  onSelectStudent: (id: string) => void;
  settings?: AppSettings;
  udas?: UdaRecord[];
  isPrivacyShieldActive?: boolean;
}

// Custom Tooltip for Recharts Radar
const CustomRadarTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const studentVal = payload.find((p: any) => p.dataKey === 'studentScore')?.value;
    const classVal = payload.find((p: any) => p.dataKey === 'classScore')?.value;
    const levelInfo = data.level || (studentVal ? getCompetenceLevel(studentVal) : null);

    return (
      <div className="p-3 rounded-lg bg-slate-950/95 border border-slate-700 shadow-xl text-xs space-y-1.5 min-w-[210px] z-50">
        <div className="font-bold text-white flex items-center gap-1.5 pb-1 border-b border-slate-800">
          <span>{data.icon || '🎯'}</span>
          <span>{data.fullName || data.axis}</span>
        </div>
        <div className="flex items-center justify-between text-slate-300">
          <span>Punteggio Alunno:</span>
          <b className="font-mono text-cyan-300 text-sm">{formatGrade(studentVal)}/10</b>
        </div>
        {levelInfo && (
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Livello D.M. 221:</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${levelInfo.badgeClass}`}>
              {levelInfo.label}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between text-slate-400 text-[11px]">
          <span>Media di Classe:</span>
          <span className="font-mono text-purple-300">{formatGrade(classVal)}</span>
        </div>
        <div className="flex items-center justify-between text-slate-400 text-[11px]">
          <span>Soglia Base Ministeriale:</span>
          <span className="font-mono text-amber-400">6.0 (Base)</span>
        </div>
        {data.completedHours !== undefined && (
          <div className="flex items-center justify-between text-slate-400 text-[11px] pt-1 border-t border-slate-800">
            <span>Ore di Attività:</span>
            <span className="font-mono text-slate-200">{data.completedHours}h</span>
          </div>
        )}
      </div>
    );
  }
  return null;
};

// Calculate 6 key European competency dimensions from student and class grades
function calcStudentCompetencyProfile(
  studentGrades: Grade[],
  classGrades: Grade[],
  classUdas: UdaRecord[]
) {
  const roundScore = (score: number | null): number | null =>
    score === null ? null : Math.round(score * 10) / 10;

  // 1. STEM & Metodo Tecnologico
  const stemStudentGrades = studentGrades.filter(g => g.type === 'verifica' || g.type === 'test');
  const stemClassGrades = classGrades.filter(g => g.type === 'verifica' || g.type === 'test');
  const stemStudentScore = roundScore(stemStudentGrades.length > 0 ? calcAvg(stemStudentGrades) : null);
  const stemClassScore = roundScore(stemClassGrades.length > 0 ? calcAvg(stemClassGrades) : null);

  // 2. Competenze Digitali & CAD
  const digitalUdaIds = new Set(
    classUdas
      .filter(u => {
        const searchable = `${u.title} ${u.description || ''} ${u.competencies || ''}`.toLowerCase();
        return (
          searchable.includes('digital') ||
          searchable.includes('cad') ||
          u.lessons?.some(l => l.activityType === 'digitale') === true
        );
      })
      .map(u => u.id)
  );
  const isDigitalEvidence = (g: Grade) => {
    const title = g.title.toLowerCase();
    return (
      Boolean(g.udaId && digitalUdaIds.has(g.udaId)) ||
      title.includes('cad') ||
      title.includes('digital') ||
      title.includes('online') ||
      title.includes('flashcard')
    );
  };
  const digiStudentGrades = studentGrades.filter(isDigitalEvidence);
  const digiClassGrades = classGrades.filter(isDigitalEvidence);
  const digiStudentScore = roundScore(digiStudentGrades.length > 0 ? calcAvg(digiStudentGrades) : null);
  const digiClassScore = roundScore(digiClassGrades.length > 0 ? calcAvg(digiClassGrades) : null);

  // 3. Educazione Civica & Sostenibilità
  const civicUdaIds = new Set(classUdas.filter(u => u.civicEducation).map(u => u.id));
  const civicStudentGrades = studentGrades.filter(g =>
    (g.udaId && civicUdaIds.has(g.udaId)) ||
    g.title.toLowerCase().includes('civica') ||
    g.title.toLowerCase().includes('sostenibil') ||
    g.title.toLowerCase().includes('agenda')
  );
  const civicClassGrades = classGrades.filter(g =>
    (g.udaId && civicUdaIds.has(g.udaId)) ||
    g.title.toLowerCase().includes('civica') ||
    g.title.toLowerCase().includes('sostenibil') ||
    g.title.toLowerCase().includes('agenda')
  );
  const civicStudentScore = roundScore(civicStudentGrades.length > 0 ? calcAvg(civicStudentGrades) : null);
  const civicClassScore = roundScore(civicClassGrades.length > 0 ? calcAvg(civicClassGrades) : null);

  // 4. Linguaggio Grafico & Disegno Tecnico
  const graphStudentGrades = studentGrades.filter(g =>
    g.type === 'disegno' ||
    g.title.toLowerCase().includes('tavola') ||
    g.title.toLowerCase().includes('assonometr') ||
    g.title.toLowerCase().includes('proiezion')
  );
  const graphClassGrades = classGrades.filter(g =>
    g.type === 'disegno' ||
    g.title.toLowerCase().includes('tavola') ||
    g.title.toLowerCase().includes('assonometr') ||
    g.title.toLowerCase().includes('proiezion')
  );
  const graphStudentScore = roundScore(graphStudentGrades.length > 0 ? calcAvg(graphStudentGrades) : null);
  const graphClassScore = roundScore(graphClassGrades.length > 0 ? calcAvg(graphClassGrades) : null);

  // 5. Compito di Realtà & Spirito di Iniziativa
  const taskStudentGrades = studentGrades.filter(g => {
    const t = g.title.toLowerCase();
    return t.includes('compito') || t.includes('realtà') || t.includes('progetto') || t.includes('modello') || t.includes('prototipo');
  });
  const taskClassGrades = classGrades.filter(g => {
    const t = g.title.toLowerCase();
    return t.includes('compito') || t.includes('realtà') || t.includes('progetto') || t.includes('modello') || t.includes('prototipo');
  });
  const taskStudentScore = roundScore(taskStudentGrades.length > 0 ? calcAvg(taskStudentGrades) : null);
  const taskClassScore = roundScore(taskClassGrades.length > 0 ? calcAvg(taskClassGrades) : null);

  // 6. Comunicazione Alfabetica & Orale
  const commStudentGrades = studentGrades.filter(g => g.type === 'orale' || g.title.toLowerCase().includes('colloquio'));
  const commClassGrades = classGrades.filter(g => g.type === 'orale' || g.title.toLowerCase().includes('colloquio'));
  const commStudentScore = roundScore(commStudentGrades.length > 0 ? calcAvg(commStudentGrades) : null);
  const commClassScore = roundScore(commClassGrades.length > 0 ? calcAvg(commClassGrades) : null);

  return [
    {
      axis: 'STEM & Metodo',
      fullName: 'Matematica, Scienze e Tecnologia (STEM)',
      icon: '🔬',
      studentScore: stemStudentScore,
      classScore: stemClassScore,
      baseThreshold: 6.0,
      evaluatedCount: stemStudentGrades.length,
      level: stemStudentScore !== null ? getCompetenceLevel(stemStudentScore) : null
    },
    {
      axis: 'Digitale & CAD',
      fullName: 'Competenza Digitale, CAD e Simulazioni Online',
      icon: '💻',
      studentScore: digiStudentScore,
      classScore: digiClassScore,
      baseThreshold: 6.0,
      evaluatedCount: digiStudentGrades.length,
      level: digiStudentScore !== null ? getCompetenceLevel(digiStudentScore) : null
    },
    {
      axis: 'Educazione Civica',
      fullName: 'Cittadinanza Attiva, Sostenibilità e Agenda 2030',
      icon: '🌿',
      studentScore: civicStudentScore,
      classScore: civicClassScore,
      baseThreshold: 6.0,
      evaluatedCount: civicStudentGrades.length,
      level: civicStudentScore !== null ? getCompetenceLevel(civicStudentScore) : null
    },
    {
      axis: 'Grafica & 3D',
      fullName: 'Consapevolezza Culturale, Disegno Tecnico e Spazialità',
      icon: '📐',
      studentScore: graphStudentScore,
      classScore: graphClassScore,
      baseThreshold: 6.0,
      evaluatedCount: graphStudentGrades.length,
      level: graphStudentScore !== null ? getCompetenceLevel(graphStudentScore) : null
    },
    {
      axis: 'Compito Realtà',
      fullName: 'Competenza Imprenditoriale e Prodotti Autentici',
      icon: '🎯',
      studentScore: taskStudentScore,
      classScore: taskClassScore,
      baseThreshold: 6.0,
      evaluatedCount: taskStudentGrades.length,
      level: taskStudentScore !== null ? getCompetenceLevel(taskStudentScore) : null
    },
    {
      axis: 'Comunicazione',
      fullName: 'Argomentazione Orale e Proprietà del Lessico Tecnico',
      icon: '🗣️',
      studentScore: commStudentScore,
      classScore: commClassScore,
      baseThreshold: 6.0,
      evaluatedCount: commStudentGrades.length,
      level: commStudentScore !== null ? getCompetenceLevel(commStudentScore) : null
    }
  ];
}

export const StudentReportView: React.FC<StudentReportViewProps> = ({
  currentClass,
  selectedStudentId,
  onSelectStudent,
  settings,
  udas = [],
  isPrivacyShieldActive = true
}) => {
  const [radarMode, setRadarMode] = useState<'competencies' | 'udas'>('competencies');

  const students = currentClass.students || [];
  const currentStudent = students.find(s => s.id === selectedStudentId) || students[0];

  if (!currentStudent) {
    return (
      <div className="neon-card p-6 text-center text-slate-400">
        Nessun alunno presente nella classe.
      </div>
    );
  }

  const displayStudentName = formatStudentNameWithPrivacy(currentStudent.name, isPrivacyShieldActive);

  const weights: Record<EvaluationType, number> = settings?.evaluationWeights || DEFAULT_EVALUATION_WEIGHTS;
  const grades = (currentClass.grades || []).filter(g => g.studentId === currentStudent.id);
  const q1Grades = grades.filter(g => g.period === 'Q1');
  const q2Grades = grades.filter(g => g.period === 'Q2');

  const totalWeightedAvg = calcWeightedAvg(grades, weights);
  const totalSimpleAvg = calcAvg(grades);
  const q1WeightedAvg = calcWeightedAvg(q1Grades, weights);
  const q2WeightedAvg = calcWeightedAvg(q2Grades, weights);
  const level = getCompetenceLevel(totalWeightedAvg);

  const studentBehaviors = (currentClass.behaviors || [])
    .filter(b => b.studentId === currentStudent.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Filter UDAs matching the current class
  const classUdas = udas.filter(u => {
    if (!u.className) return false;
    if (u.className === currentClass.name) return true;
    if (currentClass.name.includes(u.className)) return true;
    if (u.className.includes(currentClass.name.split(' - ')[0])) return true;
    return false;
  });

  // Calculate detailed student contribution and competence level in each UDA
  const studentUdaDossier = classUdas.map(u => {
    const udaGrades = grades.filter(g => g.udaId === u.id);
    const udaAvg = udaGrades.length > 0 ? calcAvg(udaGrades) : null;
    const udaWeightedAvg = udaGrades.length > 0 ? calcWeightedAvg(udaGrades, weights) : null;
    const udaLevel = udaAvg !== null ? getCompetenceLevel(udaAvg) : null;

    const levelKey = udaLevel ? (udaLevel.id.toLowerCase() as 'av' | 'in' | 'ba' | 'pa') : null;
    const rubricDescription = levelKey && u.rubricLevels ? u.rubricLevels[levelKey] : null;

    const lessons = u.lessons || [];
    const completedHours = lessons.reduce((acc, l) => acc + (l.hours || 0), 0);
    const creditStats = calcUdaCompetenceCredits(u, [currentClass]);

    return {
      uda: u,
      udaGrades,
      udaAvg,
      udaWeightedAvg,
      udaLevel,
      rubricDescription,
      lessons,
      completedHours,
      creditStats
    };
  });

  // Summary statistics for the student's UDA portfolio
  const totalUdas = classUdas.length;
  const participatedUdasCount = studentUdaDossier.filter(d => d.udaGrades.length > 0 || d.lessons.length > 0).length;
  const allStudentUdaGrades = grades.filter(g => Boolean(g.udaId));
  const overallUdaAvg = allStudentUdaGrades.length > 0 ? calcAvg(allStudentUdaGrades) : null;
  const overallUdaLevel = overallUdaAvg !== null ? getCompetenceLevel(overallUdaAvg) : null;
  const totalStudentUdaCredits = Math.round(
    studentUdaDossier.reduce((acc, d) => acc + d.creditStats.earnedCredits, 0) * 10
  ) / 10;

  // ---------------------------------------------------------------------------
  // RADAR CHART DATA PREPARATION (D.M. 221/2025)
  // ---------------------------------------------------------------------------

  // 1. Key Competency Dimensions (6 European Axes)
  const competencyRadarData = calcStudentCompetencyProfile(
    grades,
    currentClass.grades || [],
    classUdas
  );

  // 2. Per-UDA Radar Data
  const udaRadarData = studentUdaDossier.map(d => {
    const u = d.uda;
    const udaClassGrades = (currentClass.grades || []).filter(g => g.udaId === u.id);
    const classAvg = udaClassGrades.length > 0 ? calcAvg(udaClassGrades) : null;
    const studentScore = d.udaAvg;

    const axisLabel = u.title.replace(/^UDA\s*\d+:\s*/i, '');
    const shortLabel = axisLabel.length > 18 ? axisLabel.slice(0, 16) + '…' : axisLabel;

    return {
      axis: shortLabel,
      fullName: u.title,
      icon: u.civicEducation ? '🌿' : '📚',
      studentScore: studentScore !== null ? Math.round(studentScore * 10) / 10 : null,
      classScore: classAvg !== null ? Math.round(classAvg * 10) / 10 : null,
      baseThreshold: 6.0,
      evaluatedCount: d.udaGrades.length,
      level: studentScore !== null ? getCompetenceLevel(studentScore) : null,
      completedHours: d.completedHours,
      earnedCredits: d.creditStats.earnedCredits
    };
  });

  const evaluatedCompetencyData = competencyRadarData.filter(c => c.studentScore !== null);
  const hasReliableCompetencyProfile = evaluatedCompetencyData.length >= 3;
  const evaluatedUdaData = udaRadarData.filter(c => c.studentScore !== null);
  const hasReliableUdaProfile = evaluatedUdaData.length >= 3;
  const activeRadarData = radarMode === 'competencies' ? evaluatedCompetencyData : evaluatedUdaData;
  const hasReliableActiveProfile = radarMode === 'competencies'
    ? hasReliableCompetencyProfile
    : hasReliableUdaProfile;

  // Diagnostic strengths and areas of growth
  const sortedStrengths = [...evaluatedCompetencyData].sort((a, b) => b.studentScore! - a.studentScore!);
  const bestCompetency = hasReliableCompetencyProfile ? sortedStrengths[0] : null;
  const growthCompetency = hasReliableCompetencyProfile ? sortedStrengths[sortedStrengths.length - 1] : null;
  const advancedCount = evaluatedCompetencyData.filter(c => c.studentScore !== null && c.studentScore >= 8.5).length;
  const intermediateCount = evaluatedCompetencyData.filter(c => c.studentScore !== null && c.studentScore >= 7.0 && c.studentScore < 8.5).length;
  const baseCount = evaluatedCompetencyData.filter(c => c.studentScore !== null && c.studentScore >= 6.0 && c.studentScore < 7.0).length;
  const underBaseCount = evaluatedCompetencyData.filter(c => c.studentScore !== null && c.studentScore < 6.0).length;

  return (
    <div className="space-y-4">
      {/* Student Selector Card */}
      <div className="neon-card p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-[var(--primary)]" /> Scheda Alunno & Profilo delle Competenze
            </h3>
            <p className="text-xs text-slate-400">
              Certificazione curricolare per competenze (D.M. 221/2025), andamento per UDA e quadro sintetico.
            </p>
          </div>

          <div className="w-full sm:w-64">
            <select
              value={currentStudent.id}
              onChange={e => onSelectStudent(e.target.value)}
              className="w-full p-2 neon-input text-xs sm:text-sm font-semibold text-white bg-slate-900 cursor-pointer"
            >
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {formatStudentNameWithPrivacy(s.name, isPrivacyShieldActive)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Student KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="p-3.5 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] text-center">
            <b className={`text-2xl font-bold block ${totalWeightedAvg !== null && totalWeightedAvg < 6 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {formatGrade(totalWeightedAvg)}
            </b>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
              Media Ponderata (D.M. 221)
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Semplice: {formatGrade(totalSimpleAvg)}
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] text-center">
            <b className="text-2xl font-bold block text-white drop-shadow-sm">
              {grades.length}
            </b>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
              Prove Svolte
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {allStudentUdaGrades.length} collegate a UDA
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] text-center">
            <div className="text-sm font-bold text-slate-100 flex items-center justify-center gap-2 pt-1 font-mono">
              <span>Q1: <b>{formatGrade(q1WeightedAvg)}</b></span>
              <span>·</span>
              <span>Q2: <b>{formatGrade(q2WeightedAvg)}</b></span>
            </div>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mt-2 block">
              Medie Quadrimestri (Pond.)
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] text-center flex flex-col justify-center items-center">
            {level ? (
              <span className={`px-2.5 py-1 rounded text-xs font-bold ${level.badgeClass}`}>
                {level.label.split(' ')[0]} ({level.id})
              </span>
            ) : (
              <span className="text-slate-500 font-bold text-sm">–</span>
            )}
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mt-1.5 block">
              Livello D.M. 221/2025
            </span>
          </div>
        </div>

        {/* Trend Sparkline banner */}
        <div className="p-3 rounded-lg bg-slate-900/60 border border-[var(--border)] flex items-center justify-between">
          <span className="text-xs text-slate-300 font-semibold">Andamento cronologico voti:</span>
          <Sparkline grades={grades} width={120} height={24} />
        </div>
      </div>

      {/* ============================================================== */}
      {/* GRAFICO A RAGGIO (RADAR CHART): RAGGIUNGIMENTO LIVELLI DI COMPETENZA */}
      {/* ============================================================== */}
      <div className="neon-card neon-card-highlight p-5 space-y-4">
        {/* Radar Card Header & View Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(0,216,214,0.6)]" />
              <h3 className="text-base sm:text-lg font-bold text-white">
                Grafico a Raggio (Radar) · Profilo di Padronanza D.M. 221/2025
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Rappresentazione multidimensionale del raggiungimento dei livelli di competenza per <b>{displayStudentName}</b> in base alle UDA curricolari.
            </p>
          </div>

          {/* Radar Dimension Switcher */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setRadarMode('competencies')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                radarMode === 'competencies'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🎯 6 Competenze Chiave
            </button>
            <button
              type="button"
              onClick={() => setRadarMode('udas')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                radarMode === 'udas'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              📚 Traguardi per UDA
            </button>
          </div>
        </div>

        {/* Radar Chart + Diagnostic Synthesis Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          {/* Radar Chart Area */}
          <div className="lg:col-span-7 bg-slate-950/60 rounded-xl border border-slate-800/80 p-3 pt-4 flex flex-col items-center justify-center relative min-h-[340px]">
            {hasReliableActiveProfile ? (
              <>
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart cx="50%" cy="50%" outerRadius="72%" data={activeRadarData}>
                <PolarGrid stroke="#334155" strokeDasharray="3 3" />
                <PolarAngleAxis
                  dataKey="axis"
                  tick={{ fill: '#cbd5e1', fontSize: 11, fontWeight: 600 }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 10]}
                  ticks={[2, 4, 6, 8, 10]}
                  tick={{ fill: '#64748b', fontSize: 9 }}
                  stroke="#334155"
                />
                {/* 1. Student Score Polygon */}
                <Radar
                  name={displayStudentName}
                  dataKey="studentScore"
                  stroke="#00d8d6"
                  fill="#00d8d6"
                  fillOpacity={0.35}
                  strokeWidth={2.5}
                />
                {/* 2. Class Average Polygon */}
                <Radar
                  name="Media di Classe"
                  dataKey="classScore"
                  stroke="#a855f7"
                  fill="#a855f7"
                  fillOpacity={0.12}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                />
                {/* 3. Baseline Target Line */}
                <Radar
                  name="Soglia Minima Base (6.0)"
                  dataKey="baseThreshold"
                  stroke="#f59e0b"
                  fill="none"
                  strokeWidth={1.2}
                  strokeDasharray="2 2"
                />
                <Tooltip content={<CustomRadarTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  iconType="circle"
                />
              </RadarChart>
            </ResponsiveContainer>

            {/* Quick legend tip */}
            <div className="text-[10px] text-slate-500 text-center mt-1">
              Scala 0-10: <b className="text-emerald-400">≥8.5 Avanzato</b> · <b className="text-cyan-400">7-8.4 Intermedio</b> · <b className="text-amber-400">6-6.9 Base</b> · <b className="text-rose-400">&lt;6 Prima Acquisizione</b>
            </div>
              </>
            ) : (
              <div className="min-h-[260px] flex flex-col items-center justify-center text-center px-6">
                <AlertCircle className="w-7 h-7 text-slate-500 mb-2" />
                <p className="text-sm font-semibold text-slate-300">Dati insufficienti per costruire un profilo attendibile</p>
                <p className="text-xs text-slate-500 mt-1">Servono almeno 3 dimensioni con evidenze valutative reali.</p>
              </div>
            )}
          </div>

          {/* Diagnostic Synthesis Panel */}
          <div className="lg:col-span-5 space-y-3">
            {hasReliableCompetencyProfile && bestCompetency && growthCompetency ? (
              <>
            {/* Prevailing Competence Level Card */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  Livello di Padronanza Globale
                </span>
                {level && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${level.badgeClass}`}>
                    {level.label}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-200 leading-relaxed italic">
                "{level ? level.desc : 'Valutazione in itinere durante il percorso curricolare.'}"
              </p>
            </div>

            {/* Competency Mastery Breakdown Badges */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30 space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-emerald-400 block">Livello Avanzato</span>
                <div className="text-lg font-black font-mono text-emerald-300">
                  {advancedCount} <span className="text-xs font-normal text-slate-400">dimensioni</span>
                </div>
                <div className="text-[10px] text-slate-400">Piena autonomia critica</div>
              </div>

              <div className="p-2.5 rounded-lg bg-cyan-950/20 border border-cyan-500/30 space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-cyan-400 block">Livello Intermedio</span>
                <div className="text-lg font-black font-mono text-cyan-300">
                  {intermediateCount} <span className="text-xs font-normal text-slate-400">dimensioni</span>
                </div>
                <div className="text-[10px] text-slate-400">Consapevole in compiti noti</div>
              </div>

              <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/30 space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-amber-400 block">Livello Base</span>
                <div className="text-lg font-black font-mono text-amber-300">
                  {baseCount} <span className="text-xs font-normal text-slate-400">dimensioni</span>
                </div>
                <div className="text-[10px] text-slate-400">Con guida del docente</div>
              </div>

              <div className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-500/30 space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-rose-400 block">Prima Acquisizione</span>
                <div className="text-lg font-black font-mono text-rose-300">
                  {underBaseCount} <span className="text-xs font-normal text-slate-400">dimensioni</span>
                </div>
                <div className="text-[10px] text-slate-400">Richiede supporto continuo</div>
              </div>
            </div>

            {/* Strengths & Growth Areas */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <Award className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">
                    Punto di Forza Principale:
                  </span>
                  <span className="font-semibold text-white">
                    {bestCompetency.icon} {bestCompetency.fullName}
                  </span>
                  <span className="text-slate-400 block text-[11px] mt-0.5">
                    Punteggio conseguito: <b className="text-emerald-300 font-mono">{bestCompetency.studentScore}/10</b> ({bestCompetency.level ? bestCompetency.level.label.split(' ')[0] : '–'})
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-start gap-2">
                <TrendingUp className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-amber-400 block tracking-wider">
                    Area da Consolidare:
                  </span>
                  <span className="font-semibold text-white">
                    {growthCompetency.icon} {growthCompetency.fullName}
                  </span>
                  <span className="text-slate-400 block text-[11px] mt-0.5">
                    Punteggio: <b className="text-amber-300 font-mono">{growthCompetency.studentScore}/10</b> · Attività mirate di rinforzo consigliate
                  </span>
                </div>
              </div>
            </div>
              </>
            ) : (
              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 text-center">
                <p className="text-sm font-semibold text-slate-300">Dati insufficienti per costruire un profilo attendibile</p>
                <p className="text-xs text-slate-500 mt-1">Conteggi di livello, punto di forza e area da consolidare saranno disponibili con almeno 3 dimensioni valutate.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SEZIONE: CONTRIBUTO DELLO STUDENTE NELLE SINGOLE UDA */}
      {/* ============================================================== */}
      <div className="neon-card neon-card-highlight p-5 space-y-4">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(0,216,214,0.6)]" />
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Dossier Valutativo per Unità Didattica (UDA)
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Rendiconto delle attività svolte nel diario, delle valutazioni collegate e delle rubriche di livello D.M. 221/2025.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 font-semibold flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-purple-400" />
              Crediti Maturati: <b className="text-purple-300 font-mono">+{totalStudentUdaCredits.toFixed(1)} CFS</b>
            </span>

            {overallUdaLevel && (
              <span className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${overallUdaLevel.badgeClass}`}>
                <Award className="w-4 h-4" />
                <span>Competenza UDA: {overallUdaLevel.id}</span>
              </span>
            )}
          </div>
        </div>

        {/* UDA List with Details */}
        {studentUdaDossier.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-slate-900/40 border border-slate-800 text-slate-400 text-xs">
            <Layers className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <p className="font-semibold text-slate-300">Nessuna Unità Didattica configurata per questa classe.</p>
            <p className="text-slate-500 mt-1">Vai alla sezione "UDA & Gantt" per pianificare le unità curricolari.</p>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {studentUdaDossier.map(item => {
              const u = item.uda;
              const hasGrades = item.udaGrades.length > 0;
              const hasLessons = item.lessons.length > 0;

              return (
                <div
                  key={u.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-variant)] p-4 sm:p-5 space-y-4 transition-all hover:border-[var(--primary)]/60"
                >
                  {/* Top Bar of UDA Card */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-white text-sm sm:text-base">{u.title}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          {u.period}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-700/60 flex items-center gap-1">
                          <GraduationCap className="w-3 h-3 text-purple-400" />
                          +{item.creditStats.earnedCredits.toFixed(1)} CFS
                        </span>
                        {u.civicEducation && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-emerald-400" /> Educazione Civica
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
                        <span>Monte ore: <b>{u.hours}h</b></span>
                        <span>·</span>
                        <span>Svolte: <b className="text-cyan-300 font-mono">{item.completedHours}h</b> ({item.creditStats.totalWeightedHours}h certificate)</span>
                        <span>·</span>
                        <span>Traguardo: <i>{u.competencies || 'Competenze tecnologiche applicate'}</i></span>
                      </div>
                    </div>

                    {/* Right Competence Level Badge */}
                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                      {hasGrades && item.udaLevel ? (
                        <div className="flex items-center gap-2 p-1.5 px-3 rounded-lg bg-slate-900 border border-slate-800">
                          <div className="text-right">
                            <span className="text-[10px] uppercase font-semibold text-slate-400 block">Esito UDA</span>
                            <span className="text-xs font-mono font-black text-white">Media: {formatGrade(item.udaAvg)}</span>
                          </div>
                          <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${item.udaLevel.badgeClass} shadow-sm`}>
                            {item.udaLevel.id} · {item.udaLevel.label.split(' ')[0]}
                          </span>
                        </div>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800/80 text-amber-300 border border-amber-600/40 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>In corso di valutazione</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 2-Columns Grid: Activities vs Evaluations */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                    {/* Column 1: Attività & Fasi Completate */}
                    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
                        <span className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                          <Activity className="w-3.5 h-3.5 text-cyan-400" />
                          Attività & Fasi Completate ({item.lessons.length} lezioni · {item.completedHours}h)
                        </span>
                        <span className="text-[10px] text-cyan-300 font-mono">
                          {u.hours > 0 ? `${Math.min(100, Math.round((item.completedHours / u.hours) * 100))}% svolto` : ''}
                        </span>
                      </div>

                      {!hasLessons ? (
                        <p className="text-slate-500 italic py-2">
                          Nessuna lezione o attività ancora registrata nel diario per questa UDA.
                        </p>
                      ) : (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {item.lessons.map((les, lIdx) => {
                            const actType = inferLessonActivityType(les, u);
                            const conf = ACTIVITY_TYPE_CONFIG[actType];

                            return (
                              <div
                                key={les.id || lIdx}
                                className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-center justify-between gap-2"
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 shrink-0">
                                    {les.date}
                                  </span>
                                  <span className="text-xs">{conf.icon}</span>
                                  <span className="font-medium text-slate-200 truncate" title={les.topic}>
                                    {les.topic}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${conf.badgeClass}`}>
                                    {conf.short}
                                  </span>
                                  <span className="font-mono text-cyan-300 font-bold text-[11px]">
                                    {les.hours}h
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {u.authenticTask && (
                        <div className="p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-950/20 text-[11px] text-emerald-200/90 flex items-start gap-1.5 mt-2">
                          <Target className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <div>
                            <b className="text-emerald-300">Compito di Realtà di questa UDA:</b> {u.authenticTask}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Column 2: Prove di Verifica & Rubrica */}
                    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
                        <span className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                          <Award className="w-3.5 h-3.5 text-amber-400" />
                          Prove di Verifica dello Studente ({item.udaGrades.length} voti)
                        </span>
                        {hasGrades && (
                          <span className="text-[11px] font-mono font-bold text-white">
                            Media UDA: <b className="text-emerald-400">{formatGrade(item.udaAvg)}</b>
                          </span>
                        )}
                      </div>

                      {!hasGrades ? (
                        <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/30 text-amber-200/90 text-[11px] space-y-1">
                          <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Nessuna prova formalmente collegata</span>
                          </div>
                          <p className="text-slate-400 text-[10px]">
                            Le valutazioni registrate con indicazione di questa UDA compariranno automaticamente qui.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {item.udaGrades.map(g => (
                            <div
                              key={g.id}
                              className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 shrink-0">
                                  {g.date.split('-').reverse().join('/')}
                                </span>
                                <span className="text-cyan-400 font-semibold shrink-0 text-[11px]">
                                  {TYPES_LABEL[g.type] || g.type}:
                                </span>
                                <span className="font-medium text-slate-200 truncate" title={g.title}>
                                  {g.title}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="font-mono text-sm px-2 py-0.5 rounded bg-slate-800 text-white font-bold border border-slate-700">
                                  {g.value}
                                  {g.delayed && <span className="text-[10px] text-amber-400 ml-1 font-bold">R</span>}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Rubrica di Livello Raggiunto */}
                      {hasGrades && item.udaLevel && (
                        <div className="p-2.5 rounded-lg border border-purple-500/30 bg-purple-950/20 text-[11px] space-y-1 mt-2">
                          <div className="flex items-center justify-between text-purple-300 font-bold">
                            <span className="flex items-center gap-1">
                              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                              Profilo di Padronanza (D.M. 221/2025):
                            </span>
                            <span className={`px-2 py-0.2 rounded text-[10px] ${item.udaLevel.badgeClass}`}>
                              {item.udaLevel.label}
                            </span>
                          </div>
                          <p className="text-slate-300 text-[11px] leading-relaxed italic">
                            "{item.rubricDescription || item.udaLevel.desc}"
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Breakdown Grades Table */}
      <div className="neon-card p-4">
        <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[var(--primary)]" /> Elenco Valutazioni Ricevute
        </h4>

        {grades.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">
            Nessuna valutazione registrata per questo alunno.
          </p>
        ) : (
          <div className="overflow-x-auto border border-[var(--border)] rounded-lg">
            <table className="w-full text-xs text-center border-collapse">
              <thead>
                <tr className="bg-[var(--surface-variant)] text-slate-400 uppercase tracking-wider text-[10px] font-semibold">
                  <th className="p-2.5 text-left border-r border-[var(--border)]">Data</th>
                  <th className="p-2.5 border-r border-[var(--border)]">Periodo</th>
                  <th className="p-2.5 border-r border-[var(--border)]">Tipologia</th>
                  <th className="p-2.5 text-left border-r border-[var(--border)]">Titolo / Argomento</th>
                  <th className="p-2.5 border-r border-[var(--border)]">UDA Collegata</th>
                  <th className="p-2.5">Voto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {grades.map(g => {
                  const linkedUda = udas.find(u => u.id === g.udaId);

                  return (
                    <tr key={g.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-2.5 text-left font-mono border-r border-[var(--border)]">
                        {g.date.split('-').reverse().join('/')}
                      </td>
                      <td className="p-2.5 border-r border-[var(--border)] font-semibold text-slate-300">
                        {g.period}
                      </td>
                      <td className="p-2.5 border-r border-[var(--border)] text-cyan-400 font-semibold">
                        {TYPES_LABEL[g.type] || g.type}
                      </td>
                      <td className="p-2.5 text-left border-r border-[var(--border)] font-medium text-slate-200">
                        {g.title || '–'}
                      </td>
                      <td className="p-2.5 border-r border-[var(--border)] text-left">
                        {linkedUda ? (
                          <span className="font-semibold text-purple-300 truncate block max-w-[150px]" title={linkedUda.title}>
                            {linkedUda.title}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">–</span>
                        )}
                      </td>
                      <td className="p-2.5 font-bold">
                        <span className="font-mono text-sm px-2 py-0.5 rounded bg-slate-800 text-white border border-slate-700">
                          {g.value}
                          {g.delayed && <span className="text-[10px] text-amber-400 ml-1 font-bold">R</span>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Student Behavior Notes */}
      <div className="neon-card p-4">
        <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" /> Registro Comportamenti & Partecipazione
        </h4>

        {studentBehaviors.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">
            Nessuna nota comportamentale registrata.
          </p>
        ) : (
          <div className="space-y-2">
            {studentBehaviors.map(b => (
              <div
                key={b.id}
                className="p-2.5 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-mono text-slate-300">{b.date.split('-').reverse().join('/')}</span>
                </div>
                <span className="font-semibold text-slate-100">{b.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
