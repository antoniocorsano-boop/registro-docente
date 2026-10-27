import React, { useEffect, useRef, useState } from 'react';
import { AppSettings, ClassData, OnlineTest, UdaActivityType, UdaLesson, UdaRecord } from '../types';
import { MONTHS_LABELS, calcAvg, formatGrade, getCompetenceLevel, today, uid } from '../utils';
import {
  CalendarDays,
  Plus,
  Trash2,
  Clock,
  Layers,
  X,
  Check,
  BookOpen,
  Award,
  Printer,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  FileText,
  Calendar,
  Filter,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Activity,
  Target,
  CheckCircle,
  BarChart3,
  ExternalLink,
  AlertTriangle,
  ShieldAlert,
  Zap,
  ArrowRight,
  ListChecks,
  CheckSquare,
  GraduationCap,
  HelpCircle,
  Calculator,
  GitFork,
  Link2,
  Workflow,
  ArrowDownRight,
  RefreshCw,
  SlidersHorizontal,
  Cpu,
  Search,
  Brain
} from 'lucide-react';
import { DEFAULT_EMBEDDING_CONFIG } from '../utils';
import {
  rankBySemanticSimilarity,
  getEmbedding,
  cosineSimilarity,
  MINISTERIAL_COMPETENCY_DESCRIPTORS
} from '../services/embeddingService';
import { createUdaSnapshotMutation } from '../persistence/udaSnapshotMutation';
import { getSchoolMonthIndex, getUdaGapSeverity, getUdaRemediationCopy } from '../analytics/udaSemantics';

interface UdaGanttViewProps {
  classes: ClassData[];
  udas: UdaRecord[];
  settings?: AppSettings;
  tests?: Record<string, OnlineTest>;
  onSaveUdas: (udas: UdaRecord[]) => Promise<void>;
  onNavigateTab?: (tab: any) => void;
}

// Internal planning coefficients for the UDA activity index; not a normative scale
export const ACTIVITY_TYPE_CONFIG: Record<
  UdaActivityType,
  {
    label: string;
    short: string;
    weight: number;
    color: string;
    bg: string;
    border: string;
    badgeClass: string;
    icon: string;
    description: string;
  }
> = {
  compito_realta: {
    label: 'Compito di Realtà & Prodotto Autentico',
    short: 'Compito di Realtà',
    weight: 1.3,
    color: 'text-amber-300',
    bg: 'bg-amber-950/70',
    border: 'border-amber-500/60',
    badgeClass: 'bg-amber-950 text-amber-300 border border-amber-600',
    icon: '🎯',
    description: 'Progettazione complessa, risoluzione di problemi autentici e valutazione con rubrica a livelli.'
  },
  laboratorio: {
    label: 'Laboratorio & Prototipazione Grafico-Pratica',
    short: 'Laboratorio & Pratica',
    weight: 1.25,
    color: 'text-cyan-300',
    bg: 'bg-cyan-950/70',
    border: 'border-cyan-500/60',
    badgeClass: 'bg-cyan-950 text-cyan-300 border border-cyan-600',
    icon: '🔬',
    description: 'Attività hands-on, disegno tecnico su tavola, lavorazione materiali e costruzioni tridimensionali.'
  },
  civica: {
    label: 'Educazione Civica & Sostenibilità (L. 92/2019)',
    short: 'Educazione Civica',
    weight: 1.2,
    color: 'text-emerald-300',
    bg: 'bg-emerald-950/70',
    border: 'border-emerald-500/60',
    badgeClass: 'bg-emerald-950 text-emerald-300 border border-emerald-600',
    icon: '🌿',
    description: 'Moduli di sostenibilità (Agenda 2030), transizione ecologica, legalità e cittadinanza attiva.'
  },
  digitale: {
    label: 'Competenze Digitali & Test Online / CAD',
    short: 'Digitale & Online',
    weight: 1.15,
    color: 'text-purple-300',
    bg: 'bg-purple-950/70',
    border: 'border-purple-500/60',
    badgeClass: 'bg-purple-950 text-purple-300 border border-purple-600',
    icon: '💻',
    description: 'Modellazione 3D/CAD, fogli di calcolo, simulazioni interattive e verifiche online strutturate.'
  },
  teoria: {
    label: 'Lezione Teorica & Metodo Disciplinare',
    short: 'Teoria & Metodo',
    weight: 1.0,
    color: 'text-slate-300',
    bg: 'bg-slate-900',
    border: 'border-slate-700',
    badgeClass: 'bg-slate-800 text-slate-300 border border-slate-700',
    icon: '📖',
    description: 'Analisi concettuale, studio dei principi scientifici e tecnologici, spiegazione frontale.'
  }
};

// Automatic inferencing of activity type from topic/notes when not explicitly chosen
export function inferLessonActivityType(lesson: UdaLesson, uda?: UdaRecord): UdaActivityType {
  if (lesson.activityType) return lesson.activityType;

  const t = (lesson.topic || '').toLowerCase();
  const n = (lesson.notes || '').toLowerCase();
  const corpus = `${t} ${n}`;

  if (
    corpus.includes('compito') ||
    corpus.includes('realtà') ||
    corpus.includes('prodotto autentico') ||
    corpus.includes('presentazione') ||
    corpus.includes('progetto finale') ||
    corpus.includes('prototipo')
  ) {
    return 'compito_realta';
  }

  if (
    corpus.includes('laboratorio') ||
    corpus.includes('tavola') ||
    corpus.includes('disegno') ||
    corpus.includes('costruzione') ||
    corpus.includes('modello') ||
    corpus.includes('squadratura') ||
    corpus.includes('assonometr') ||
    corpus.includes('proiezion')
  ) {
    return 'laboratorio';
  }

  if (
    corpus.includes('civica') ||
    corpus.includes('cittadinanz') ||
    corpus.includes('sostenibil') ||
    corpus.includes('agenda 2030') ||
    corpus.includes('ambiente') ||
    corpus.includes('ecolog') ||
    corpus.includes('energia pulita') ||
    corpus.includes('riciclo') ||
    (uda?.civicEducation && (corpus.includes('clima') || corpus.includes('risorse')))
  ) {
    return 'civica';
  }

  if (
    corpus.includes('online') ||
    corpus.includes('digitale') ||
    corpus.includes('quiz') ||
    corpus.includes('test') ||
    corpus.includes('flashcard') ||
    corpus.includes('computer') ||
    corpus.includes('cad') ||
    corpus.includes('foglio di calcolo')
  ) {
    return 'digitale';
  }

  return 'teoria';
}

// Calculate hours and credits for an UDA
export function calcUdaCompetenceCredits(
  uda: UdaRecord,
  classes: ClassData[]
): {
  totalRawHours: number;
  totalWeightedHours: number;
  earnedCredits: number;
  plannedHours: number;
  potentialCredits: number;
  breakdown: Record<UdaActivityType, { rawHours: number; weightedHours: number; count: number }>;
  evalCount: number;
  evalBonus: number;
} {
  const lessons = uda.lessons || [];

  const breakdown: Record<UdaActivityType, { rawHours: number; weightedHours: number; count: number }> = {
    compito_realta: { rawHours: 0, weightedHours: 0, count: 0 },
    laboratorio: { rawHours: 0, weightedHours: 0, count: 0 },
    civica: { rawHours: 0, weightedHours: 0, count: 0 },
    digitale: { rawHours: 0, weightedHours: 0, count: 0 },
    teoria: { rawHours: 0, weightedHours: 0, count: 0 }
  };

  lessons.forEach(les => {
    const actType = inferLessonActivityType(les, uda);
    const conf = ACTIVITY_TYPE_CONFIG[actType];
    const raw = Number(les.hours) || 1;
    const weighted = raw * conf.weight;

    breakdown[actType].rawHours += raw;
    breakdown[actType].weightedHours += weighted;
    breakdown[actType].count += 1;
  });

  const totalRawHours = Object.values(breakdown).reduce((a, b) => a + b.rawHours, 0);
  let totalWeightedHours = Object.values(breakdown).reduce((a, b) => a + b.weightedHours, 0);

  // Internal activity-index bonus: 1 point per linked evaluation batch
  const udaGrades = classes.flatMap(c => c.grades || []).filter(g => g.udaId === uda.id);
  const uniqueBatches = new Set(udaGrades.map(g => g.batchId || g.id)).size;
  const evalBonus = uniqueBatches * 1.0;
  totalWeightedHours += evalBonus;

  // Indice Attività UDA: indice interno basato su ore ponderate; non è un credito scolastico o una certificazione
  const earnedCredits = Math.round((totalWeightedHours / 10) * 10) / 10;
  const plannedHours = uda.hours || 10;
  const potentialCredits = Math.round(((plannedHours * (uda.civicEducation ? 1.25 : 1.15)) / 10) * 10) / 10;

  return {
    totalRawHours,
    totalWeightedHours: Math.round(totalWeightedHours * 10) / 10,
    earnedCredits,
    plannedHours,
    potentialCredits,
    breakdown,
    evalCount: uniqueBatches,
    evalBonus
  };
}

// -----------------------------------------------------------------------------
// DEPENDENCY & CASCADE SHIFT HELPERS
// -----------------------------------------------------------------------------

// Check circular dependency: would making candidateParentId a predecessor of targetUdaId cause a cycle?
export function wouldCauseCircularDependency(
  targetUdaId: string,
  candidateParentId: string,
  allUdas: UdaRecord[]
): boolean {
  if (targetUdaId === candidateParentId) return true;

  const visited = new Set<string>();
  const queue = [candidateParentId];

  while (queue.length > 0) {
    const currId = queue.shift()!;
    if (currId === targetUdaId) return true;
    if (visited.has(currId)) continue;
    visited.add(currId);

    const currUda = allUdas.find(u => u.id === currId);
    if (currUda?.dependencies) {
      queue.push(...currUda.dependencies);
    }
  }

  return false;
}

// Get direct predecessors of an UDA
export function getUdaPredecessors(uda: UdaRecord, allUdas: UdaRecord[]): UdaRecord[] {
  if (!uda.dependencies || uda.dependencies.length === 0) return [];
  return uda.dependencies.map(id => allUdas.find(u => u.id === id)).filter((u): u is UdaRecord => Boolean(u));
}

// Get direct successors (child UDAs) of an UDA
export function getUdaSuccessors(udaId: string, allUdas: UdaRecord[]): UdaRecord[] {
  return allUdas.filter(u => u.dependencies?.includes(udaId));
}

// Check if an UDA has conflicts with any of its predecessors
export function checkUdaDependencyConflict(uda: UdaRecord, allUdas: UdaRecord[]): {
  hasConflict: boolean;
  conflictingPredecessors: Array<{ predecessor: UdaRecord; requiredStartMonth: number }>;
} {
  const predecessors = getUdaPredecessors(uda, allUdas);
  const conflictingPredecessors: Array<{ predecessor: UdaRecord; requiredStartMonth: number }> = [];

  predecessors.forEach(pred => {
    const predEndMonth = (pred.startMonth || 0) + (pred.durationMonths || 1) - 1;
    // Sequential rule: child should start after the month the predecessor ends
    if ((uda.startMonth || 0) <= predEndMonth) {
      conflictingPredecessors.push({
        predecessor: pred,
        requiredStartMonth: Math.min(9, predEndMonth + 1)
      });
    }
  });

  return {
    hasConflict: conflictingPredecessors.length > 0,
    conflictingPredecessors
  };
}

export interface CascadeShiftItem {
  childUda: UdaRecord;
  currentStart: number;
  suggestedStart: number;
  currentDuration: number;
  suggestedDuration: number;
  currentEnd: number;
  suggestedEnd: number;
  delta: number;
  conflictBefore: boolean;
  selected: boolean;
}

export interface CascadeProposal {
  parentUda: UdaRecord;
  oldStartMonth: number;
  newStartMonth: number;
  oldDuration: number;
  newDuration: number;
  shifts: CascadeShiftItem[];
}

export function computeCascadeShifts(
  parentUdaId: string,
  newStartMonth: number,
  newDurationMonths: number,
  allUdas: UdaRecord[]
): CascadeShiftItem[] {
  const parent = allUdas.find(u => u.id === parentUdaId);
  if (!parent) return [];

  const oldStart = parent.startMonth || 0;
  const delta = newStartMonth - oldStart;
  const newParentEnd = newStartMonth + newDurationMonths - 1;

  const directChildren = getUdaSuccessors(parentUdaId, allUdas);
  if (directChildren.length === 0) return [];

  const results: CascadeShiftItem[] = [];

  directChildren.forEach(child => {
    const childCurrentStart = child.startMonth || 0;
    const childDuration = child.durationMonths || 1;
    const childCurrentEnd = childCurrentStart + childDuration - 1;

    let suggestedStart = childCurrentStart;

    if (delta !== 0) {
      suggestedStart = childCurrentStart + delta;
    }

    // Ensure child doesn't start before or during parent active period
    if (suggestedStart <= newParentEnd) {
      suggestedStart = newParentEnd + 1;
    }

    // Clamp to valid school calendar (0=Set to 9=Giu)
    suggestedStart = Math.max(0, Math.min(9, suggestedStart));

    // Clamp duration if exceeds June
    const maxAllowedDuration = 10 - suggestedStart;
    const suggestedDuration = Math.max(1, Math.min(childDuration, maxAllowedDuration));
    const suggestedEnd = suggestedStart + suggestedDuration - 1;

    const conflictBefore = childCurrentStart <= (oldStart + (parent.durationMonths || 1) - 1);

    if (suggestedStart !== childCurrentStart || suggestedDuration !== childDuration || conflictBefore) {
      results.push({
        childUda: child,
        currentStart: childCurrentStart,
        suggestedStart,
        currentDuration: childDuration,
        suggestedDuration,
        currentEnd: childCurrentEnd,
        suggestedEnd,
        delta: suggestedStart - childCurrentStart,
        conflictBefore,
        selected: true
      });
    }
  });

  return results;
}

export function reconcileOpenUdaRecord(current: UdaRecord | null, udas: UdaRecord[]): UdaRecord | null {
  if (!current) return null;
  return udas.find(uda => uda.id === current.id) || null;
}

export function rebaseOpenUdaPatch(
  currentUdas: UdaRecord[],
  openDossier: Pick<UdaRecord, 'id'>,
  patch: Partial<UdaRecord>
): UdaRecord[] {
  return currentUdas.map(uda =>
    uda.id === openDossier.id ? { ...uda, ...patch } : uda
  );
}

export function rebaseOpenUdaFieldEdit(
  currentUdas: UdaRecord[],
  openDossier: UdaRecord,
  field: keyof UdaRecord,
  value: unknown
): UdaRecord[] {
  return rebaseOpenUdaPatch(
    currentUdas,
    openDossier,
    { [field]: value } as Partial<UdaRecord>
  );
}

export const UdaGanttView: React.FC<UdaGanttViewProps> = ({
  classes,
  udas,
  settings,
  tests = {},
  onSaveUdas,
  onNavigateTab
}) => {
  // Master class filter at the top bar that keeps all views aligned
  const [selectedMasterClass, setSelectedMasterClass] = useState<string>('all');

  // Modal for new/quick UDA
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newClass, setNewClass] = useState(classes[0]?.name || '3ª A');
  const [newHours, setNewHours] = useState(14);
  const [newPeriod, setNewPeriod] = useState<'Q1' | 'Q2'>('Q1');
  const [newStartMonth, setNewStartMonth] = useState(0); // 0=Set
  const [newDuration, setNewDuration] = useState(2);
  const [newIsCivic, setNewIsCivic] = useState(false);
  const [newPredecessorId, setNewPredecessorId] = useState<string>('');

  // Active view mode in UdaGanttView: Gantt Cronoprogramma, Gap Analysis, Riepilogo, or All
  const [activeViewMode, setActiveViewMode] = useState<'gantt' | 'gap-analysis' | 'riepilogo' | 'all'>('gantt');

  // Filter state for summary & Gantt
  const [summaryClassFilter, setSummaryClassFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'Q1' | 'Q2'>('all');

  // Filters specific to Gap Analysis
  const [gapStatusFilter, setGapStatusFilter] = useState<'all' | 'with_gaps' | 'critical' | 'covered'>('all');
  const [gapClassFilter, setGapClassFilter] = useState<string>('all');
  const [gapPeriodFilter, setGapPeriodFilter] = useState<'all' | 'Q1' | 'Q2'>('all');

  // Detailed UDA Project Dossier Modal
  const [selectedUdaForDetail, setSelectedUdaForDetail] = useState<UdaRecord | null>(null);

  // Dedicated Gantt Bar Click Modal (Activity Detail, Objectives & Key Competencies)
  const [ganttSelectedUda, setGanttSelectedUda] = useState<UdaRecord | null>(null);

  // Modal explanation for Formative Credits Calculation
  const [isCreditsInfoOpen, setIsCreditsInfoOpen] = useState(false);

  // Cascade Shift Proposal Modal state
  const [cascadeProposal, setCascadeProposal] = useState<CascadeProposal | null>(null);

  // Highlighted dependency on hover in Gantt
  const [hoveredDependencyUdaId, setHoveredDependencyUdaId] = useState<string | null>(null);

  // AI generation state
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [newDescription, setNewDescription] = useState('');

  // Quick toast message inside UdaGanttView
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSavingUda, setIsSavingUda] = useState(false);
  const udaMutationPendingRef = useRef(false);
  const udaActionMutationDepthRef = useRef(0);
  const udaTextMutationTailRef = useRef<Promise<void>>(Promise.resolve());
  const udaTextMutationDepthRef = useRef(0);
  const udaCommittedSnapshotRef = useRef(udas);
  const udaLatestSnapshotRef = useRef(udas);
  udaLatestSnapshotRef.current = udas;

  useEffect(() => {
    if (udaTextMutationDepthRef.current > 0 || udaActionMutationDepthRef.current > 0) return;
    setSelectedUdaForDetail(current => reconcileOpenUdaRecord(current, udas));
    setGanttSelectedUda(current => reconcileOpenUdaRecord(current, udas));
  }, [udas]);

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const queueUdaTextMutation = (nextUdas: UdaRecord[]) => {
    if (udaTextMutationDepthRef.current === 0 && !udaMutationPendingRef.current) {
      udaCommittedSnapshotRef.current = udaLatestSnapshotRef.current;
    }
    const mutation = createUdaSnapshotMutation(udas, nextUdas);
    udaTextMutationDepthRef.current += 1;
    setIsSavingUda(true);

    const task = udaTextMutationTailRef.current
      .catch(() => undefined)
      .then(() => {
        nextUdas = mutation(udaCommittedSnapshotRef.current);
      })
      .then(() => onSaveUdas(nextUdas));

    udaTextMutationTailRef.current = task.catch(() => undefined);

    const settle = () => {
      udaTextMutationDepthRef.current = Math.max(0, udaTextMutationDepthRef.current - 1);
      if (udaTextMutationDepthRef.current === 0 && !udaMutationPendingRef.current) {
        setIsSavingUda(false);
      }
    };

    void task.then(
      () => {
        udaCommittedSnapshotRef.current = nextUdas;
        settle();
      },
      settle
    );
  };

  const commitUdaViewMutation = async (
    nextUdas: UdaRecord[],
    afterCommit?: () => void,
    validateAtExecution?: (currentUdas: UdaRecord[]) => boolean
  ): Promise<boolean> => {
    if (udaTextMutationDepthRef.current === 0 && udaActionMutationDepthRef.current === 0) {
      udaCommittedSnapshotRef.current = udaLatestSnapshotRef.current;
    }
    const mutation = createUdaSnapshotMutation(udas, nextUdas);
    udaActionMutationDepthRef.current += 1;
    udaMutationPendingRef.current = true;
    setIsSavingUda(true);

    const actionTask = udaTextMutationTailRef.current
      .catch(() => undefined)
      .then(async () => {
        if (validateAtExecution && !validateAtExecution(udaCommittedSnapshotRef.current)) {
          throw new Error('UDA_MUTATION_VALIDATION_REJECTED');
        }
        nextUdas = mutation(udaCommittedSnapshotRef.current);
        await onSaveUdas(nextUdas);
        udaCommittedSnapshotRef.current = nextUdas;
      });
    udaTextMutationTailRef.current = actionTask.catch(() => undefined);

    try {
      await actionTask;
      afterCommit?.();
      return true;
    } catch {
      return false;
    } finally {
      udaActionMutationDepthRef.current = Math.max(0, udaActionMutationDepthRef.current - 1);
      udaMutationPendingRef.current = udaActionMutationDepthRef.current > 0;
      if (udaTextMutationDepthRef.current === 0 && udaActionMutationDepthRef.current === 0) {
        setIsSavingUda(false);
      }
    }
  };

  // Embedding configuration from settings or default
  const embeddingConfig = settings?.embeddingConfig || DEFAULT_EMBEDDING_CONFIG;

  // Search & Semantic Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSemanticSearch, setIsSemanticSearch] = useState(false);
  const [semanticScores, setSemanticScores] = useState<Record<string, number>>({});
  const [isSearchingSemantic, setIsSearchingSemantic] = useState(false);

  // Semantic dependency suggestion state inside Dossier modal
  const [suggestedPredecessors, setSuggestedPredecessors] = useState<Array<{ uda: UdaRecord; score: number }>>([]);
  const [isAnalyzingDependenciesSemantic, setIsAnalyzingDependenciesSemantic] = useState(false);

  // Semantic Ministerial Competency Alignment state
  const [competencyAlignment, setCompetencyAlignment] = useState<
    Array<{ id: string; name: string; code: string; score: number }> | null
  >(null);
  const [isAnalyzingCompetenciesSemantic, setIsAnalyzingCompetenciesSemantic] = useState(false);

  // Run semantic search across UDAs using local or cloud embedding
  const handleExecuteSemanticSearch = async (query: string) => {
    if (!query.trim()) {
      setSemanticScores({});
      return;
    }
    setIsSearchingSemantic(true);
    try {
      const candidates = udas.map(u => ({
        id: u.id,
        text: `${u.title}. ${u.description || ''} ${u.competencies || ''} ${u.authenticTask || ''}`
      }));
      const ranked = await rankBySemanticSimilarity(query, candidates, embeddingConfig);
      const scoresMap: Record<string, number> = {};
      ranked.forEach(r => {
        scoresMap[r.item.id] = Math.round(r.similarity * 100);
      });
      setSemanticScores(scoresMap);
      showStatus('⚡ Ricerca semantica completata');
    } catch (err: any) {
      console.error('Semantic search error:', err);
      showStatus('⚠️ Ricerca semantica non riuscita. Verifica le impostazioni avanzate.');
    } finally {
      setIsSearchingSemantic(false);
    }
  };

  // Suggest prerequisite dependencies using local embeddings
  const handleSuggestDependenciesSemantic = async (currentUda: UdaRecord) => {
    const candidateUdas = udas.filter(u => u.id !== currentUda.id);
    if (candidateUdas.length === 0) return;

    setIsAnalyzingDependenciesSemantic(true);
    try {
      const currentText = `${currentUda.title}. ${currentUda.description || ''} ${currentUda.competencies || ''}`;
      const candidates = candidateUdas.map(u => ({
        id: u.id,
        text: `${u.title}. ${u.description || ''} ${u.competencies || ''}`,
        uda: u
      }));
      const ranked = await rankBySemanticSimilarity(currentText, candidates, embeddingConfig);
      const topSuggestions = ranked
        .filter(r => r.similarity > 0.3)
        .slice(0, 4)
        .map(r => ({ uda: r.item.uda, score: Math.round(r.similarity * 100) }));
      setSuggestedPredecessors(topSuggestions);
      showStatus(`✨ Trovate ${topSuggestions.length} UDA correlate`);
    } catch (err: any) {
      console.error('Suggest dependencies error:', err);
      showStatus('⚠️ Analisi propedeuticità non riuscita. Verifica le impostazioni avanzate.');
    } finally {
      setIsAnalyzingDependenciesSemantic(false);
    }
  };

  // Analyze ministerial key competency alignment with local embedding
  const handleAnalyzeCompetenciesSemantic = async (targetUda: UdaRecord) => {
    setIsAnalyzingCompetenciesSemantic(true);
    try {
      const targetText = `${targetUda.title}. ${targetUda.description || ''} ${targetUda.competencies || ''} ${targetUda.authenticTask || ''}`;
      const targetVec = await getEmbedding(targetText, embeddingConfig);

      const scored = await Promise.all(
        MINISTERIAL_COMPETENCY_DESCRIPTORS.map(async desc => {
          const descVec = await getEmbedding(desc.description, embeddingConfig);
          const sim = cosineSimilarity(targetVec, descVec);
          return {
            id: desc.id,
            name: desc.name,
            code: desc.code,
            score: Math.max(0, Math.round(sim * 100))
          };
        })
      );

      scored.sort((a, b) => b.score - a.score);
      setCompetencyAlignment(scored);
      showStatus(`📊 Mappatura semantica competenze D.M. 221/2025 calcolata`);
    } catch (err: any) {
      console.error('Competency alignment error:', err);
      showStatus('⚠️ Mappatura semantica non riuscita. Verifica le impostazioni avanzate.');
    } finally {
      setIsAnalyzingCompetenciesSemantic(false);
    }
  };

  // Generate complete UDA description using Gemini API based on title and Gantt duration
  const handleGenerateUdaDescription = async (targetUda: {
    title: string;
    durationMonths: number;
    hours: number;
    className: string;
    period: 'Q1' | 'Q2';
    civicEducation?: boolean;
    competencies?: string;
    authenticTask?: string;
    id?: string;
  }) => {
    if (!targetUda.title.trim()) {
      showStatus('⚠️ Inserisci prima il titolo dell\'UDA');
      return;
    }

    setIsGeneratingAi(true);
    showStatus('🤖 Generazione traccia UDA con assistenza AI in corso...');

    try {
      const res = await fetch('/api/gemini/generate-uda-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: targetUda.title,
          durationMonths: targetUda.durationMonths,
          hours: targetUda.hours,
          className: targetUda.className,
          period: targetUda.period,
          civicEducation: targetUda.civicEducation,
          competencies: targetUda.competencies,
          authenticTask: targetUda.authenticTask,
          classification: 'TEACHER_PROFESSIONAL',
          explicitTeacherOptIn: true
        })
      });

      const data = await res.json();
      if (!res.ok) {
        const serverConfigurationMissing =
          res.status === 500 &&
          typeof data.error === 'string' &&
          data.error.includes('non è configurata nel server');
        throw new Error(serverConfigurationMissing ? 'AI_SERVER_CONFIGURATION_MISSING' : 'AI_GENERATION_FAILED');
      }

      if (data.description) {
        if (targetUda.id) {
          const updatedUda = { ...targetUda, description: data.description };
          const nextUdas = udas.map(u => (u.id === targetUda.id ? (updatedUda as UdaRecord) : u));
          const committed = await commitUdaViewMutation(nextUdas, () => {
            setSelectedUdaForDetail(current =>
              current && current.id === targetUda.id ? { ...current, description: data.description } : current
            );
            setGanttSelectedUda(current =>
              current && current.id === targetUda.id ? { ...current, description: data.description } : current
            );
            showStatus('✨ Descrizione UDA generata con successo con assistenza AI!');
          });
          if (!committed) return;
        } else {
          setNewDescription(data.description);
          showStatus('✨ Descrizione UDA generata con successo con assistenza AI!');
        }
      }
    } catch (err: any) {
      console.error('AI generation error:', err);
      const serverConfigurationMissing = err instanceof Error && err.message === 'AI_SERVER_CONFIGURATION_MISSING';
      showStatus(
        serverConfigurationMissing
          ? "⚠️ Servizio AI non configurato sul server. Contatta l'amministratore."
          : '⚠️ Generazione non riuscita. Riprova.'
      );
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Synchronize master class filter
  const handleMasterClassChange = (className: string) => {
    setSelectedMasterClass(className);
    setClassFilter(className);
    setGapClassFilter(className);
    setSummaryClassFilter(className);
  };

  // New lesson form inside detail modal
  const [newLessonDate, setNewLessonDate] = useState(today());
  const [newLessonTopic, setNewLessonTopic] = useState('');
  const [newLessonHours, setNewLessonHours] = useState(2);
  const [newLessonNotes, setNewLessonNotes] = useState('');
  const [newLessonType, setNewLessonType] = useState<UdaActivityType>('teoria');

  // Months full Italian naming
  const MONTHS_FULL_NAMES = [
    'Settembre',
    'Ottobre',
    'Novembre',
    'Dicembre',
    'Gennaio',
    'Febbraio',
    'Marzo',
    'Aprile',
    'Maggio',
    'Giugno'
  ];

  // Global dependency audit: check if there are timing conflicts in the entire curriculum
  const allConflicts = udas.map(u => ({
    uda: u,
    ...checkUdaDependencyConflict(u, udas)
  })).filter(c => c.hasConflict);

  // Request a date or duration change with automatic cascade detection
  const handleRequestDateChange = (
    udaId: string,
    targetStartMonth: number,
    targetDurationMonths: number
  ) => {
    const parent = udas.find(u => u.id === udaId);
    if (!parent) return;

    // Bounds checking
    const clampedStart = Math.max(0, Math.min(9, targetStartMonth));
    const maxAllowedDur = 10 - clampedStart;
    const clampedDuration = Math.max(1, Math.min(maxAllowedDur, targetDurationMonths));

    const oldStart = parent.startMonth || 0;
    const oldDuration = parent.durationMonths || 1;

    // If no real change, return
    if (clampedStart === oldStart && clampedDuration === oldDuration) return;

    // Compute potential cascade shifts
    const suggestedShifts = computeCascadeShifts(udaId, clampedStart, clampedDuration, udas);

    if (suggestedShifts.length > 0) {
      // Open cascade proposal modal so teacher can inspect and confirm
      setCascadeProposal({
        parentUda: parent,
        oldStartMonth: oldStart,
        newStartMonth: clampedStart,
        oldDuration: oldDuration,
        newDuration: clampedDuration,
        shifts: suggestedShifts
      });
    } else {
      // Direct apply without cascade
      const updatedParent = {
        ...parent,
        startMonth: clampedStart,
        durationMonths: clampedDuration
      };

      const nextUdas = udas.map(u => (u.id === parent.id ? updatedParent : u));
      void commitUdaViewMutation(nextUdas, () => {
        setSelectedUdaForDetail(current =>
          current?.id === parent.id
            ? { ...current, startMonth: clampedStart, durationMonths: clampedDuration }
            : current
        );
        setGanttSelectedUda(current =>
          current?.id === parent.id
            ? { ...current, startMonth: clampedStart, durationMonths: clampedDuration }
            : current
        );
        showStatus(`Date aggiornate per "${parent.title}"`);
      });
    }
  };

  // Apply cascade shift proposal
  const handleApplyCascade = (applyToChildren: boolean) => {
    if (!cascadeProposal) return;

    const { parentUda, newStartMonth, newDuration, shifts } = cascadeProposal;

    // Build map of changes
    const updatesMap = new Map<string, { startMonth: number; durationMonths: number }>();
    updatesMap.set(parentUda.id, { startMonth: newStartMonth, durationMonths: newDuration });

    if (applyToChildren) {
      shifts.forEach(s => {
        if (s.selected) {
          updatesMap.set(s.childUda.id, {
            startMonth: s.suggestedStart,
            durationMonths: s.suggestedDuration
          });
        }
      });
    }

    const nextUdas = udas.map(u => {
      const upd = updatesMap.get(u.id);
      return upd ? { ...u, ...upd } : u;
    });

    void commitUdaViewMutation(nextUdas, () => {
      // Update active modal references only after durable persistence, rebased on live UI state.
      setSelectedUdaForDetail(current => {
        if (!current) return current;
        const upd = updatesMap.get(current.id);
        return upd ? { ...current, ...upd } : current;
      });
      setGanttSelectedUda(current => {
        if (!current) return current;
        const upd = updatesMap.get(current.id);
        return upd ? { ...current, ...upd } : current;
      });

      setCascadeProposal(null);
      showStatus(
        applyToChildren
          ? `Slittamento a cascata applicato con successo a ${updatesMap.size} UDA`
          : `Aggiornata solo l'UDA "${parentUda.title}"`
      );
    });
  };

  // Automatic level / align all conflicts in 1 click
  const handleAutoAlignAllDependencies = () => {
    if (allConflicts.length === 0) return;

    let updatedUdas = [...udas];

    // Iteratively resolve conflicts
    allConflicts.forEach(conf => {
      const maxRequired = Math.max(
        ...conf.conflictingPredecessors.map(p => p.requiredStartMonth)
      );
      const child = updatedUdas.find(u => u.id === conf.uda.id);
      if (child) {
        const newStart = Math.min(9, Math.max(child.startMonth || 0, maxRequired));
        const maxDur = 10 - newStart;
        const newDur = Math.min(child.durationMonths || 1, maxDur);
        updatedUdas = updatedUdas.map(u => (u.id === child.id ? { ...u, startMonth: newStart, durationMonths: newDur } : u));
      }
    });

    void commitUdaViewMutation(updatedUdas, () => {
      showStatus(`Risolti ${allConflicts.length} conflitti di propedeuticità con allineamento temporale`);
    });
  };

  // Toggle dependency on an UDA
  const handleToggleDependency = (udaId: string, predecessorId: string) => {
    const targetUda = udas.find(u => u.id === udaId);
    if (!targetUda) return;

    const currentDeps = targetUda.dependencies || [];
    const isAlreadyDep = currentDeps.includes(predecessorId);

    if (isAlreadyDep) {
      // Remove dependency
      const nextDeps = currentDeps.filter(id => id !== predecessorId);
      const updatedUda = { ...targetUda, dependencies: nextDeps };
      const nextUdas = udas.map(u => (u.id === udaId ? updatedUda : u));
      void commitUdaViewMutation(nextUdas, () => {
        setSelectedUdaForDetail(current =>
          current?.id === udaId
            ? { ...current, dependencies: (current.dependencies || []).filter(id => id !== predecessorId) }
            : current
        );
        showStatus('Dipendenza rimossa');
      });
    } else {
      // Check for cycles both now and again when queued persistence actually executes.
      const validateDependencyAtExecution = (currentUdas: UdaRecord[]) => {
        if (wouldCauseCircularDependency(udaId, predecessorId, currentUdas)) {
          alert('Impossibile aggiungere questa propedeuticità: creerebbe una dipendenza ciclica/chiusa tra le UDA.');
          return false;
        }
        return true;
      };
      if (!validateDependencyAtExecution(udas)) return;

      const nextDeps = [...currentDeps, predecessorId];
      const updatedUda = { ...targetUda, dependencies: nextDeps };

      // Check if new dependency causes conflict immediately
      const pred = udas.find(u => u.id === predecessorId);
      const predEnd = pred ? (pred.startMonth || 0) + (pred.durationMonths || 1) - 1 : 0;
      let nextUdas = udas.map(u => (u.id === udaId ? updatedUda : u));

      if (pred && (targetUda.startMonth || 0) <= predEnd) {
        if (confirm(`Il predecessore "${pred.title}" termina a ${MONTHS_LABELS[predEnd]}. Vuoi allineare la data di inizio di questa UDA a ${MONTHS_LABELS[Math.min(9, predEnd + 1)]}?`)) {
          const newStart = Math.min(9, predEnd + 1);
          const maxDur = 10 - newStart;
          const newDur = Math.min(targetUda.durationMonths || 1, maxDur);
          const alignedUda = { ...updatedUda, startMonth: newStart, durationMonths: newDur };
          nextUdas = udas.map(u => (u.id === udaId ? alignedUda : u));
          void commitUdaViewMutation(nextUdas, () => {
            setSelectedUdaForDetail(current =>
              current?.id === udaId
                ? {
                    ...current,
                    dependencies: (current.dependencies || []).includes(predecessorId)
                      ? (current.dependencies || [])
                      : [...(current.dependencies || []), predecessorId],
                    startMonth: newStart,
                    durationMonths: newDur
                  }
                : current
            );
            showStatus('Dipendenza aggiunta e date allineate');
          }, validateDependencyAtExecution);
          return;
        }
      }

      void commitUdaViewMutation(nextUdas, () => {
        setSelectedUdaForDetail(current =>
          current?.id === udaId
            ? {
                ...current,
                dependencies: (current.dependencies || []).includes(predecessorId)
                  ? (current.dependencies || [])
                  : [...(current.dependencies || []), predecessorId]
              }
            : current
        );
        showStatus('Dipendenza aggiunta con successo');
      }, validateDependencyAtExecution);
    }
  };

  // Add new UDA
  const handleAddUda = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newRecord: UdaRecord = {
      id: uid(),
      title: newTitle.trim(),
      className: newClass,
      hours: Number(newHours) || 10,
      period: newPeriod,
      startMonth: Number(newStartMonth),
      durationMonths: Math.max(1, Math.min(10 - Number(newStartMonth), Number(newDuration))),
      civicEducation: newIsCivic,
      description: newDescription.trim() || 'Progettazione per competenze disciplinari e trasversali.',
      competencies: 'Competenze scientifiche e tecnologiche applicate, cittadinanza attiva.',
      authenticTask: 'Realizzazione di un elaborato/prodotto finale e presentazione orale.',
      rubricLevels: {
        av: 'Piena autonomia nell\'applicazione di concetti e procedure complesse con spirito critico.',
        in: 'Applicazione corretta e consapevole dei concetti in situazioni note.',
        ba: 'Applicazione delle nozioni essenziali con la guida del docente.',
        pa: 'Conoscenze frammentarie, necessita di supporto continuativo.'
      },
      lessons: [],
      dependencies: newPredecessorId ? [newPredecessorId] : []
    };

    void commitUdaViewMutation([...udas, newRecord], () => {
      setNewTitle('');
      setNewDescription('');
      setNewIsCivic(false);
      setNewPredecessorId('');
      setIsModalOpen(false);
      showStatus(`Nuova UDA "${newRecord.title}" creata con successo`);
    });
  };

  const handleDelete = (id: string) => {
    const hasChildren = getUdaSuccessors(id, udas);
    let promptMsg = 'Eliminare questa Unità Didattica (UDA)?';
    if (hasChildren.length > 0) {
      promptMsg = `Attenzione: ci sono ${hasChildren.length} UDA dipendenti da questa. Eliminando l'UDA padre, il collegamento di propedeuticità verrà rimosso. Confermi l'eliminazione?`;
    }

    if (confirm(promptMsg)) {
      // Remove this ID from dependencies of any other UDA
      const nextUdas = udas
        .filter(u => u.id !== id)
        .map(u => ({
          ...u,
          dependencies: (u.dependencies || []).filter(depId => depId !== id)
        }));

      void commitUdaViewMutation(nextUdas, () => {
        if (selectedUdaForDetail?.id === id) {
          setSelectedUdaForDetail(null);
        }
        if (ganttSelectedUda?.id === id) {
          setGanttSelectedUda(null);
        }
        showStatus('UDA eliminata');
      });
    }
  };

  // Add lesson to current UDA
  const handleAddLesson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUdaForDetail || !newLessonTopic.trim()) return;

    const newLesson: UdaLesson = {
      id: uid(),
      date: newLessonDate,
      topic: newLessonTopic.trim(),
      hours: Number(newLessonHours) || 1,
      notes: newLessonNotes.trim() || undefined,
      activityType: newLessonType
    };

    const updatedUda: UdaRecord = {
      ...selectedUdaForDetail,
      lessons: [...(selectedUdaForDetail.lessons || []), newLesson]
    };

    const nextUdas = udas.map(u => (u.id === updatedUda.id ? updatedUda : u));
    void commitUdaViewMutation(nextUdas, () => {
      setSelectedUdaForDetail(current =>
        current?.id === updatedUda.id
          ? { ...current, lessons: [...(current.lessons || []), newLesson] }
          : current
      );
      setNewLessonTopic('');
      setNewLessonNotes('');
      showStatus('Attività registrata nel diario');
    });
  };

  // Remove lesson from UDA
  const handleRemoveLesson = (lessonId: string) => {
    if (!selectedUdaForDetail) return;
    const updatedUda: UdaRecord = {
      ...selectedUdaForDetail,
      lessons: (selectedUdaForDetail.lessons || []).filter(l => l.id !== lessonId)
    };
    const nextUdas = udas.map(u => (u.id === updatedUda.id ? updatedUda : u));
    void commitUdaViewMutation(nextUdas, () => {
      setSelectedUdaForDetail(current =>
        current?.id === updatedUda.id
          ? { ...current, lessons: (current.lessons || []).filter(l => l.id !== lessonId) }
          : current
      );
    });
  };

  // Save changes to detailed UDA dossier
  const handleUpdateUdaField = (field: keyof UdaRecord, value: any) => {
    if (!selectedUdaForDetail) return;
    const updatedUda = { ...selectedUdaForDetail, [field]: value };
    setSelectedUdaForDetail(updatedUda);
    const nextUdas = rebaseOpenUdaFieldEdit(udas, selectedUdaForDetail, field, value);
    queueUdaTextMutation(nextUdas);
  };

  // Update rubric level
  const handleUpdateRubric = (levelKey: 'av' | 'in' | 'ba' | 'pa', text: string) => {
    if (!selectedUdaForDetail) return;
    const updatedRubric = {
      ...(selectedUdaForDetail.rubricLevels || {}),
      [levelKey]: text
    };
    const updatedUda = { ...selectedUdaForDetail, rubricLevels: updatedRubric };
    setSelectedUdaForDetail(updatedUda);
    const nextUdas = rebaseOpenUdaPatch(udas, selectedUdaForDetail, { rubricLevels: updatedRubric });
    queueUdaTextMutation(nextUdas);
  };

  // Filtered and Semantically Ranked UDAs for Gantt
  const filteredUdas = udas
    .filter(u => {
      if (classFilter !== 'all' && u.className !== classFilter) return false;
      if (periodFilter !== 'all' && u.period !== periodFilter) return false;
      if (searchQuery.trim()) {
        if (isSemanticSearch) {
          const score = semanticScores[u.id];
          if (score !== undefined && score < 20) return false;
        } else {
          const q = searchQuery.toLowerCase();
          const matchTitle = u.title.toLowerCase().includes(q);
          const matchDesc = (u.description || '').toLowerCase().includes(q);
          const matchComp = (u.competencies || '').toLowerCase().includes(q);
          if (!matchTitle && !matchDesc && !matchComp) return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      if (searchQuery.trim() && isSemanticSearch) {
        const scoreA = semanticScores[a.id] ?? 0;
        const scoreB = semanticScores[b.id] ?? 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
      }
      return (a.startMonth || 0) - (b.startMonth || 0);
    });

  // Calculate base stats
  const totalPlannedHours = udas.reduce((acc, u) => acc + (u.hours || 0), 0);
  const totalDoneHours = udas.reduce((acc, u) => {
    const lesSum = (u.lessons || []).reduce((lAcc, l) => lAcc + (l.hours || 0), 0);
    return acc + lesSum;
  }, 0);
  const civicCount = udas.filter(u => u.civicEducation).length;

  // Crediti formativi engine
  const creditsBreakdownByUda = udas.map(u => {
    const creditStats = calcUdaCompetenceCredits(u, classes);
    return {
      uda: u,
      ...creditStats
    };
  });

  const totalEarnedCredits = Math.round(creditsBreakdownByUda.reduce((acc, u) => acc + u.earnedCredits, 0) * 10) / 10;
  const totalPotentialCredits = Math.round(creditsBreakdownByUda.reduce((acc, u) => acc + u.potentialCredits, 0) * 10) / 10;
  const totalWeightedCompetenceHours = Math.round(creditsBreakdownByUda.reduce((acc, u) => acc + u.totalWeightedHours, 0) * 10) / 10;

  // Breakdown by activity category
  const globalActivityHours: Record<UdaActivityType, { raw: number; weighted: number; credits: number; count: number }> = {
    compito_realta: { raw: 0, weighted: 0, credits: 0, count: 0 },
    laboratorio: { raw: 0, weighted: 0, credits: 0, count: 0 },
    civica: { raw: 0, weighted: 0, credits: 0, count: 0 },
    digitale: { raw: 0, weighted: 0, credits: 0, count: 0 },
    teoria: { raw: 0, weighted: 0, credits: 0, count: 0 }
  };

  creditsBreakdownByUda.forEach(u => {
    (Object.keys(u.breakdown) as UdaActivityType[]).forEach(act => {
      globalActivityHours[act].raw += u.breakdown[act].rawHours;
      globalActivityHours[act].weighted += u.breakdown[act].weightedHours;
      globalActivityHours[act].count += u.breakdown[act].count;
      globalActivityHours[act].credits = Math.round((globalActivityHours[act].weighted / 10) * 10) / 10;
    });
  });

  const civicHours = globalActivityHours.civica.raw;
  const civicCredits = globalActivityHours.civica.credits;
  const practicalHours = Math.round((globalActivityHours.compito_realta.raw + globalActivityHours.laboratorio.raw) * 10) / 10;
  const practicalCredits = Math.round((globalActivityHours.compito_realta.credits + globalActivityHours.laboratorio.credits) * 10) / 10;
  const practicalCount = globalActivityHours.compito_realta.count + globalActivityHours.laboratorio.count;
  const overallMultiplier = totalDoneHours > 0 ? (totalWeightedCompetenceHours / totalDoneHours).toFixed(2) : '1.20';

  // Gap Analysis Data
  const currentSchoolMonthIndex = getSchoolMonthIndex(new Date());

  const gapAnalysisData = udas.map(u => {
    const startM = u.startMonth || 0;
    const duration = u.durationMonths || 1;
    const endM = Math.min(9, startM + duration - 1);

    const startMonthName = MONTHS_FULL_NAMES[startM] || MONTHS_LABELS[startM];
    const endMonthName = MONTHS_FULL_NAMES[endM] || MONTHS_LABELS[endM];

    const currentYear = new Date().getFullYear();
    const endYear = endM >= 4 ? currentYear + 1 : currentYear;
    const endDateEstimated = `Fine ${endMonthName} ${endYear}`;

    const udaGrades = classes.flatMap(c => c.grades || []).filter(g => g.udaId === u.id);
    const formalGrades = udaGrades.filter(g => g.value !== 'P' && g.value !== 'A');

    const testBatches = Array.from(new Set(formalGrades.map(g => g.batchId || g.id)));
    const formalTestSessions = testBatches.map(bId => {
      const gList = formalGrades.filter(g => (g.batchId || g.id) === bId);
      const rep = gList[0];
      const validGrades = gList.map(g => Number(g.value)).filter(n => !isNaN(n) && n > 0);
      const avg = validGrades.length > 0 ? validGrades.reduce((a, b) => a + b, 0) / validGrades.length : null;
      return {
        batchId: bId,
        date: rep.date || '',
        title: rep.title || 'Verifica Formale',
        type: rep.type || 'test',
        count: gList.length,
        avgGrade: avg
      };
    });

    const isEnded = currentSchoolMonthIndex > endM;
    const isEndingNow = currentSchoolMonthIndex === endM;
    const isUpcoming = currentSchoolMonthIndex < startM;

    let timelineStatus: 'aligned' | 'warning' | 'critical' = 'aligned';
    let timelineLabel = 'Verifiche Allineate';
    let timelineMessage = '';

    if (formalTestSessions.length === 0) {
      if (isEnded) {
        timelineStatus = 'critical';
        timelineLabel = 'UDA Terminata Senza Verifiche';
        timelineMessage = `L'UDA è formalmente conclusa a ${endMonthName}, ma non risulta inserita alcuna prova formale a registro.`;
      } else if (isEndingNow) {
        timelineStatus = 'critical';
        timelineLabel = 'Termine Imminente - Verifica Mancante';
        timelineMessage = `L'UDA termina questo mese (${endMonthName}). È urgente calendarizzare la verifica sommativa di fine modulo.`;
      } else {
        timelineStatus = 'warning';
        timelineLabel = 'Pianificazione in Corso';
        timelineMessage = `L'UDA è attiva fino a ${endMonthName}. Nessuna verifica sommativa ancora registrata.`;
      }
    } else {
      timelineStatus = 'aligned';
      timelineLabel = `${formalTestSessions.length} Prova/e Registrata/e`;
      timelineMessage = `Verifiche programmate e inserite coerentemente con il calendario didattico.`;
    }

    const textCorpus = `${u.title} ${u.description || ''} ${u.competencies || ''} ${u.authenticTask || ''}`.toLowerCase();

    // Key Competencies Checklist
    const isStemTargeted = true;
    const hasStemFormalTest = formalGrades.some(g => g.type === 'verifica' || g.type === 'test');
    const stemEvidence = hasStemFormalTest
      ? formalTestSessions.find(s => s.type === 'verifica' || s.type === 'test')?.title || 'Verifica formale registrata'
      : null;

    const isDigitalTargeted =
      textCorpus.includes('digital') ||
      textCorpus.includes('online') ||
      textCorpus.includes('cad') ||
      textCorpus.includes('software');
    const hasDigitalFormalTest =
      formalGrades.some(g => g.type === 'test') ||
      (formalGrades.some(g => g.title.toLowerCase().includes('online') || g.title.toLowerCase().includes('flashcard')));
    const digitalEvidence = hasDigitalFormalTest
      ? formalTestSessions.find(s => s.type === 'test')?.title || 'Test online interattivo'
      : null;

    const isCivicTargeted = Boolean(u.civicEducation) || textCorpus.includes('civica') || textCorpus.includes('agenda 2030');
    const hasCivicFormalTest = formalGrades.some(g => {
      const t = g.title.toLowerCase();
      return t.includes('civica') || t.includes('sostenibil') || t.includes('agenda');
    });
    const civicEvidence = hasCivicFormalTest
      ? formalTestSessions.find(s => s.title.toLowerCase().includes('civica'))?.title || 'Verifica Ed. Civica registrata'
      : null;

    const isGraphicsTargeted =
      textCorpus.includes('disegno') ||
      textCorpus.includes('tavola') ||
      textCorpus.includes('assonometr') ||
      textCorpus.includes('proiezion');
    const hasGraphicsFormalTest = formalGrades.some(g => g.type === 'disegno');
    const graphicsEvidence = hasGraphicsFormalTest
      ? formalTestSessions.find(s => s.type === 'disegno')?.title || 'Tavola di disegno tecnico registrata'
      : null;

    const isTaskTargeted =
      Boolean(u.authenticTask) ||
      textCorpus.includes('compito di realtà') ||
      textCorpus.includes('imprenditorial') ||
      textCorpus.includes('prodotto autentico');
    const hasTaskFormalTest = formalGrades.some(g => {
      const t = g.title.toLowerCase();
      return (
        t.includes('compito') ||
        t.includes('realtà') ||
        t.includes('progetto') ||
        t.includes('tavola') ||
        t.includes('modello') ||
        t.includes('presentazione')
      );
    });
    const taskEvidence = hasTaskFormalTest
      ? formalTestSessions.find(s => s.title.toLowerCase().includes('compito'))?.title || 'Compito autentico valutato'
      : null;

    const isCommTargeted = textCorpus.includes('comunicaz') || textCorpus.includes('orale') || textCorpus.includes('argomentaz');
    const hasCommFormalTest = formalGrades.some(g => g.type === 'orale');
    const commEvidence = hasCommFormalTest
      ? formalTestSessions.find(s => s.type === 'orale')?.title || 'Colloquio orale registrato'
      : null;

    const competenciesList = [
      {
        id: 'stem',
        title: 'Competenza Matematica, Scientifica e Tecnologica (STEM)',
        category: 'Competenze Disciplinari e Metodologiche',
        isTargeted: isStemTargeted,
        isEvaluated: hasStemFormalTest,
        evidence: stemEvidence,
        gapNote: 'Richiede almeno una verifica scritta o test oggettivo sui principi scientifici e tecnologici trattati.',
        recommendedAction: 'Pianifica la prova attesa o collega un\'evidenza coerente già disponibile.',
        actionType: 'test' as const
      },
      {
        id: 'digital',
        title: 'Competenza Digitale & Nuove Tecnologie',
        category: 'Uso critico e consapevole delle tecnologie (UE 2018)',
        isTargeted: isDigitalTargeted,
        isEvaluated: hasDigitalFormalTest,
        evidence: digitalEvidence,
        gapNote: 'Nessun test online interattivo o prova con strumenti digitali registrata per questa UDA.',
        recommendedAction: 'Pianifica o collega un\'evidenza digitale coerente con l\'UDA.',
        actionType: 'test' as const
      },
      {
        id: 'civic',
        title: 'Cittadinanza Attiva & Educazione Civica (L. 92/2019)',
        category: 'Sostenibilità, Agenda 2030 ed Etica Ambientale',
        isTargeted: isCivicTargeted,
        isEvaluated: hasCivicFormalTest,
        evidence: civicEvidence,
        gapNote: 'Il modulo di Educazione Civica previsto non ha ancora una valutazione formale specifica a registro.',
        recommendedAction: 'Pianifica o collega un\'evidenza dedicata alle competenze di cittadinanza.',
        actionType: 'voti' as const
      },
      {
        id: 'graphics',
        title: 'Consapevolezza ed Espressione Culturale / Grafica',
        category: 'Linguaggio Grafico, Disegno Tecnico e Spazialità',
        isTargeted: isGraphicsTargeted,
        isEvaluated: hasGraphicsFormalTest,
        evidence: graphicsEvidence,
        gapNote: 'Prevista produzione grafica/disegno, ma nessuna tavola o prova pratica risulta inserita a registro.',
        recommendedAction: 'Collega una tavola o prova pratica già disponibile, oppure pianifica la raccolta dell\'evidenza.',
        actionType: 'voti' as const
      },
      {
        id: 'authentic_task',
        title: 'Competenza Imprenditoriale & Compito di Realtà',
        category: 'Spirito di Iniziativa, Realizzazione Prodotti Autentici',
        isTargeted: isTaskTargeted,
        isEvaluated: hasTaskFormalTest,
        evidence: taskEvidence,
        gapNote: 'Il compito di realtà autentico previsto non risulta formalmente valutato con rubrica a registro.',
        recommendedAction: 'Collega il prodotto autentico o la rubrica già disponibile, oppure pianifica l\'evidenza attesa.',
        actionType: 'voti' as const
      },
      {
        id: 'communication',
        title: 'Comunicazione Alfabetica Funzionale & Orale',
        category: 'Argomentazione Tecnica e Proprietà di Linguaggio',
        isTargeted: isCommTargeted,
        isEvaluated: hasCommFormalTest,
        evidence: commEvidence,
        gapNote: 'Prevista argomentazione orale, ma nessun colloquio orale formale risulta registrato.',
        recommendedAction: 'Collega un\'evidenza orale già disponibile, oppure pianifica il momento di osservazione.',
        actionType: 'voti' as const
      }
    ].filter(c => c.isTargeted);

    const totalTargeted = competenciesList.length;
    const totalEvaluated = competenciesList.filter(c => c.isEvaluated).length;
    const gapCount = totalTargeted - totalEvaluated;
    const coveragePct = totalTargeted > 0 ? Math.round((totalEvaluated / totalTargeted) * 100) : 100;

    const gapSeverity = getUdaGapSeverity({
      currentMonthIndex: currentSchoolMonthIndex,
      startMonthIndex: startM,
      endMonthIndex: endM,
      gapCount,
      formalEvidenceCount: formalTestSessions.length
    });
    const remediationCopy = getUdaRemediationCopy(gapSeverity);
    const hasCriticalGap = gapSeverity === 'critical';
    const hasAnyGap = gapSeverity !== 'clear';

    return {
      uda: u,
      startM,
      endM,
      startMonthName,
      endMonthName,
      endDateEstimated,
      formalGrades,
      formalTestSessions,
      isEnded,
      isEndingNow,
      isUpcoming,
      timelineStatus,
      timelineLabel,
      timelineMessage,
      competenciesList,
      totalTargeted,
      totalEvaluated,
      gapCount,
      coveragePct,
      gapSeverity,
      remediationCopy,
      hasCriticalGap,
      hasAnyGap
    };
  });

  const filteredGapData = gapAnalysisData.filter(item => {
    if (gapClassFilter !== 'all' && item.uda.className !== gapClassFilter) return false;
    if (gapPeriodFilter !== 'all' && item.uda.period !== gapPeriodFilter) return false;
    if (gapStatusFilter === 'with_gaps') return item.hasAnyGap;
    if (gapStatusFilter === 'critical') return item.hasCriticalGap;
    if (gapStatusFilter === 'covered') return !item.hasAnyGap;
    return true;
  });

  const totalAnalyzedUdas = gapAnalysisData.length;
  const udasWithGapsCount = gapAnalysisData.filter(d => d.hasAnyGap).length;

  return (
    <div className="space-y-4">
      {/* ============================================================== */}
      {/* TOAST / STATUS FEEDBACK BAR */}
      {/* ============================================================== */}
      {statusMessage && (
        <div className="p-2.5 rounded-lg bg-cyan-950/90 border border-cyan-500/80 text-cyan-200 text-xs flex items-center justify-between shadow-lg animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="font-semibold">{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="p-1 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* TOP UNIFIED WORKFLOW BAR: MASTER CLASS SELECTOR & ACTIONS */}
      {/* ============================================================== */}
      <div className="neon-card p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
            <Filter className="w-4 h-4 text-cyan-400" />
            <span>Classe di Lavoro:</span>
          </div>

          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => handleMasterClassChange('all')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                selectedMasterClass === 'all'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Tutte le Classi
            </button>
            {classes.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleMasterClassChange(c.name)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  selectedMasterClass === c.name
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Conflict status indicator */}
          {allConflicts.length > 0 ? (
            <button
              type="button"
              onClick={handleAutoAlignAllDependencies}
              className="px-2.5 py-1 rounded-lg bg-amber-950/80 border border-amber-500/80 text-amber-300 text-xs font-semibold flex items-center gap-1.5 hover:bg-amber-900 transition-colors cursor-pointer shadow-sm"
              title="Clicca per riallineare tutte le UDA in sequenza temporale corretta"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>{allConflicts.length} Conflitto/i Propedeuticità</span>
              <span className="text-[10px] underline font-bold ml-1">Risolvi ora</span>
            </button>
          ) : (
            <div className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium pl-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Propedeuticità allineate</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setIsCreditsInfoOpen(true)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Info indice attività</span>
          </button>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg neon-btn-primary text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Nuova UDA</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* TOP KPI BAR (6 STREAMLINED CARDS, ZERO-PILL DISCIPLINE) */}
      {/* ============================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: Indice Attività UDA */}
        <div className="neon-card p-3 border-l-4 border-l-purple-400 bg-gradient-to-br from-purple-950/20 to-transparent">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
            <span>Indice Attività UDA</span>
            <span className="text-[10px] font-mono font-bold text-purple-400">pt</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-purple-300 mt-1 font-mono flex items-baseline gap-1">
            {totalEarnedCredits.toFixed(1)}
            <span className="text-xs font-normal text-slate-500">/ {totalPotentialCredits.toFixed(1)}</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
            indice interno su ore ponderate
          </div>
        </div>

        {/* Card 2: Punti attività interni */}
        <div className="neon-card p-3 border-l-4 border-l-cyan-400 bg-gradient-to-br from-cyan-950/20 to-transparent">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
            <span>Punti attività interni</span>
            <Activity className="w-3 h-3 text-cyan-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-cyan-300 mt-1 font-mono">
            {totalWeightedCompetenceHours.toFixed(1)} pt
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
            indice composito interno
          </div>
        </div>

        {/* Card 3: Avanzamento Gantt */}
        <div className="neon-card p-3 border-l-4 border-l-emerald-400">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
            <span>Avanzamento ore nel diario</span>
            <Clock className="w-3 h-3 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1 font-mono">
            {totalDoneHours} <span className="text-xs text-slate-500 font-normal">/ {totalPlannedHours}h</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {totalPlannedHours > 0 ? `${Math.round((totalDoneHours / totalPlannedHours) * 100)}% del monte ore` : '0%'}
          </div>
        </div>

        {/* Card 4: Educazione Civica */}
        <div className="neon-card p-3 border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-950/20 to-transparent">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
            <span>Educazione Civica</span>
            <span className="text-[11px]">🌿</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-300 mt-1 font-mono">
            {civicHours}h <span className="text-xs text-slate-500 font-normal">/ 33h</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
            {civicCredits.toFixed(1)} pt · {civicCount} moduli
          </div>
        </div>

        {/* Card 5: Compiti & Lab */}
        <div className="neon-card p-3 border-l-4 border-l-amber-400 bg-gradient-to-br from-amber-950/20 to-transparent">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
            <span>Compiti & Lab</span>
            <Award className="w-3 h-3 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-300 mt-1 font-mono">
            {practicalHours}h
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
            {practicalCredits.toFixed(1)} pt · {practicalCount} fasi
          </div>
        </div>

        {/* Card 6: UDA & Classi */}
        <div className="neon-card p-3 border-l-4 border-l-cyan-500">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
            <span>UDA Curricolari</span>
            <Layers className="w-3 h-3 text-cyan-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-white mt-1 font-mono">
            {udas.length}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {classes.length} classi attive
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SUB-NAVIGATION BAR: CRONOPROGRAMMA GANTT, GAP ANALYSIS, RIEPILOGO */}
      {/* ============================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 rounded-xl bg-slate-900/90 border border-slate-800">
        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
          {/* 1. Cronoprogramma Gantt & Dipendenze */}
          <button
            type="button"
            onClick={() => setActiveViewMode('gantt')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeViewMode === 'gantt'
                ? 'neon-btn-primary shadow-[0_0_12px_var(--primary)]'
                : 'text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700'
            }`}
          >
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>Cronoprogramma Gantt & Dipendenze</span>
            {allConflicts.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                {allConflicts.length}
              </span>
            )}
          </button>

          {/* 2. Gap Analysis Competenze */}
          <button
            type="button"
            onClick={() => setActiveViewMode('gap-analysis')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeViewMode === 'gap-analysis'
                ? 'neon-btn-primary shadow-[0_0_12px_var(--primary)]'
                : 'text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span>Gap Analysis Competenze</span>
            {udasWithGapsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-600 text-white animate-pulse">
                {udasWithGapsCount} Gap
              </span>
            )}
          </button>

          {/* 3. Riepilogo Avanzamento & pt */}
          <button
            type="button"
            onClick={() => setActiveViewMode('riepilogo')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeViewMode === 'riepilogo'
                ? 'neon-btn-primary shadow-[0_0_12px_var(--primary)]'
                : 'text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700'
            }`}
          >
            <Target className="w-4 h-4 text-emerald-400" />
            <span>Riepilogo avanzamento interno</span>
          </button>

          {/* 4. Tutte le Viste */}
          <button
            type="button"
            onClick={() => setActiveViewMode('all')}
            className={`px-2.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeViewMode === 'all'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Mostra tutte le sezioni su una sola pagina"
          >
            Tutte le Viste
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 pr-1">
          <span>Contesto curricolare: D.M. 221/2025</span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* VISTA 1: CRONOPROGRAMMA GANTT & DIPENDENZE TRA UDA */}
      {/* ============================================================== */}
      {(activeViewMode === 'gantt' || activeViewMode === 'all') && (
        <div className="space-y-4">
          {/* Gantt Interactive Table Card */}
          <div className="neon-card p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[var(--border)]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[var(--primary)]" />
                  Cronoprogramma Gantt con Propedeuticità & Slittamento a Cascata
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Usa i pulsanti ◀ e ▶ per spostare i mesi; se un'UDA padre viene posticipata, il sistema suggerisce automaticamente l'allineamento dei task dipendenti.
                </p>
              </div>

              {/* View Filters & Semantic Search Bar */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {/* Search Bar with Semantic AI Embedding Toggle */}
                <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                  <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => {
                      const val = e.target.value;
                      setSearchQuery(val);
                      if (isSemanticSearch && val.trim()) {
                        handleExecuteSemanticSearch(val);
                      }
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && isSemanticSearch && searchQuery.trim()) {
                        handleExecuteSemanticSearch(searchQuery);
                      }
                    }}
                    placeholder={
                      isSemanticSearch
                        ? 'Cerca per concetto (es. "energie pulite", "3D")...'
                        : 'Filtra UDA per titolo o argomento...'
                    }
                    className="bg-transparent text-white text-xs w-44 sm:w-56 focus:outline-none placeholder:text-slate-500 font-sans"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSemanticScores({});
                      }}
                      className="text-slate-500 hover:text-white p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const next = !isSemanticSearch;
                      setIsSemanticSearch(next);
                      if (next && searchQuery.trim()) {
                        handleExecuteSemanticSearch(searchQuery);
                      } else if (!next) {
                        setSemanticScores({});
                      }
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      isSemanticSearch
                        ? 'bg-cyan-500 text-slate-950 shadow-[0_0_8px_rgba(6,182,212,0.6)]'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                    title={
                      isSemanticSearch
                        ? 'Ricerca semantica attiva'
                        : 'Attiva la ricerca concettuale'
                    }
                  >
                    <Cpu className={`w-3 h-3 ${isSearchingSemantic ? 'animate-spin' : ''}`} />
                    <span>{isSearchingSemantic ? 'Ricerca...' : 'Semantica AI'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800">
                  <Filter className="w-3 h-3 text-slate-400" />
                  <select
                    value={classFilter}
                    onChange={e => setClassFilter(e.target.value)}
                    className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
                  >
                    <option value="all">Tutte le Classi</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.name} className="bg-slate-900">
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800">
                  <select
                    value={periodFilter}
                    onChange={e => setPeriodFilter(e.target.value as any)}
                    className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
                  >
                    <option value="all">Tutto l'Anno</option>
                    <option value="Q1" className="bg-slate-900">Solo Q1</option>
                    <option value="Q2" className="bg-slate-900">Solo Q2</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Gantt Table */}
            <div className="overflow-x-auto border border-[var(--border)] rounded-lg">
              <table className="w-full text-xs text-center border-collapse">
                <thead>
                  <tr className="bg-[var(--surface-variant)] text-slate-400 uppercase tracking-wider text-[10px] font-semibold">
                    <th className="p-2.5 text-left sticky left-0 z-10 bg-[var(--surface-variant)] border-r border-[var(--border)] min-w-[240px]">
                      Unità Didattica & Propedeuticità
                    </th>
                    <th className="p-2.5 border-r border-[var(--border)] min-w-[65px]">Classe</th>
                    <th className="p-2.5 border-r border-[var(--border)] min-w-[65px]">Ore</th>
                    <th title="Punti interni: ore ponderate più contributo dei batch di valutazione collegati" className="p-2.5 border-r border-[var(--border)] min-w-[70px]">Indice attività</th>
                    <th className="p-2.5 border-r border-[var(--border)] min-w-[85px]">Sposta</th>
                    {MONTHS_LABELS.map(m => (
                      <th key={m} className="p-2 border-r border-[var(--border)] min-w-[48px] font-mono">
                        {m}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredUdas.length === 0 ? (
                    <tr>
                      <td colSpan={15} className="p-6 text-slate-500">
                        Nessuna UDA corrispondente ai filtri selezionati.
                      </td>
                    </tr>
                  ) : (
                    filteredUdas.map(u => {
                      const start = u.startMonth || 0;
                      const duration = u.durationMonths || 1;
                      const creditStats = calcUdaCompetenceCredits(u, classes);
                      const doneHours = creditStats.totalRawHours;

                      const predecessors = getUdaPredecessors(u, udas);
                      const successors = getUdaSuccessors(u.id, udas);
                      const conflictInfo = checkUdaDependencyConflict(u, udas);

                      const isHighlighted = hoveredDependencyUdaId === u.id || (u.dependencies || []).includes(hoveredDependencyUdaId || '');

                      return (
                        <tr
                          key={u.id}
                          className={`transition-colors ${
                            isHighlighted ? 'bg-cyan-950/40 ring-1 ring-cyan-500/50' : 'hover:bg-slate-800/40'
                          }`}
                          onMouseEnter={() => setHoveredDependencyUdaId(u.id)}
                          onMouseLeave={() => setHoveredDependencyUdaId(null)}
                        >
                          {/* Title & Dependencies Column */}
                          <td className="p-2.5 text-left sticky left-0 z-10 bg-[var(--surface)] border-r border-[var(--border)] max-w-[280px]">
                            <div className="space-y-1">
                              <div
                                onClick={() => setGanttSelectedUda(u)}
                                className="font-semibold text-slate-200 hover:text-[var(--primary)] cursor-pointer flex items-center justify-between gap-1 transition-colors"
                                title={`Clicca per aprire la scheda di "${u.title}"`}
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className="truncate">{u.title}</span>
                                  {isSemanticSearch && searchQuery.trim() && semanticScores[u.id] !== undefined && (
                                    <span
                                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold font-mono shrink-0 border ${
                                        semanticScores[u.id] >= 70
                                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600'
                                          : semanticScores[u.id] >= 45
                                          ? 'bg-cyan-950/80 text-cyan-300 border-cyan-600'
                                          : 'bg-slate-800 text-slate-300 border-slate-700'
                                      }`}
                                      title="Punteggio di affinità concettuale"
                                    >
                                      ⚡ {semanticScores[u.id]}%
                                    </span>
                                  )}
                                </div>
                                {u.civicEducation && (
                                  <span className="text-[10px] shrink-0" title="Educazione Civica">🌿</span>
                                )}
                              </div>

                              {/* Dependencies & Conflict Indicators */}
                              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                {predecessors.length > 0 && (
                                  <div className="flex items-center gap-1 text-slate-400">
                                    <GitFork className="w-3 h-3 text-cyan-400 shrink-0" />
                                    <span>Dipende da:</span>
                                    {predecessors.map(p => (
                                      <button
                                        key={p.id}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setGanttSelectedUda(p);
                                        }}
                                        className="font-mono text-cyan-300 hover:underline truncate max-w-[120px]"
                                        title={`Predecessore: ${p.title} (${MONTHS_LABELS[p.startMonth]} - ${MONTHS_LABELS[Math.min(9, p.startMonth + p.durationMonths - 1)]})`}
                                      >
                                        {p.title.replace(/^UDA\s*\d+:\s*/i, '')}
                                      </button>
                                    ))}
                                  </div>
                                )}

                                {successors.length > 0 && (
                                  <span className="text-slate-500 font-mono text-[9px]" title={`${successors.length} UDA dipendenti collegate a valle`}>
                                    ↳ {successors.length} a valle
                                  </span>
                                )}

                                {conflictInfo.hasConflict && (
                                  <button
                                    type="button"
                                    disabled={isSavingUda}
                                    onClick={() => handleRequestDateChange(u.id, conflictInfo.conflictingPredecessors[0].requiredStartMonth, u.durationMonths)}
                                    className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-950 text-amber-300 border border-amber-600 flex items-center gap-1 hover:bg-amber-900 transition-colors cursor-pointer"
                                    title="Conflitto temporale: inizia prima che il predecessore termini. Clicca per allineare."
                                  >
                                    <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                                    <span>Allinea date</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Class */}
                          <td className="p-2.5 border-r border-[var(--border)] text-cyan-400 font-mono font-bold">
                            {u.className}
                          </td>

                          {/* Hours */}
                          <td className="p-2.5 border-r border-[var(--border)] font-mono text-[11px] text-slate-300">
                            {doneHours}/{u.hours}h
                          </td>

                          {/* Credits */}
                          <td title="Indice interno di attività, non ore certificate" className="p-2.5 border-r border-[var(--border)] font-mono text-[11px] text-purple-300 font-bold">
                            +{creditStats.earnedCredits.toFixed(1)} pt
                          </td>

                          {/* Quick Shift Stepper */}
                          <td className="p-1 border-r border-[var(--border)]">
                            <div className="flex items-center justify-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => handleRequestDateChange(u.id, start - 1, duration)}
                                disabled={start <= 0 || isSavingUda}
                                className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent cursor-pointer"
                                title="Anticipa inizio di 1 mese"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                              <span className="font-mono text-[10px] text-slate-400 w-5">
                                {MONTHS_LABELS[start]}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRequestDateChange(u.id, start + 1, duration)}
                                disabled={start + duration >= 10 || isSavingUda}
                                className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent cursor-pointer"
                                title="Posticipa inizio di 1 mese (suggerisce slittamento a cascata)"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>

                          {/* Months Timeline Columns */}
                          {MONTHS_LABELS.map((_, mIdx) => {
                            const isActive = mIdx >= start && mIdx < start + duration;
                            const isStart = mIdx === start;
                            const isEnd = mIdx === start + duration - 1;

                            return (
                              <td
                                key={mIdx}
                                onClick={() => isActive && setGanttSelectedUda(u)}
                                className={`p-1.5 border-r border-[var(--border)] ${
                                  isActive
                                    ? 'bg-[var(--primary)]/20 text-[var(--primary)] font-bold cursor-pointer hover:bg-[var(--primary)]/35 transition-colors'
                                    : 'text-slate-700'
                                }`}
                                title={isActive ? `Clicca per aprire la scheda di "${u.title}"` : undefined}
                              >
                                {isActive ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setGanttSelectedUda(u);
                                    }}
                                    className={`w-full h-6 rounded flex items-center justify-center text-[10px] uppercase font-bold text-[var(--primary-text)] bg-[var(--primary)] shadow-[0_0_8px_var(--primary)] hover:brightness-110 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer ${
                                      isStart ? 'rounded-l-md' : 'rounded-l-none'
                                    } ${isEnd ? 'rounded-r-md' : 'rounded-r-none'}`}
                                  >
                                    {isStart ? `${u.hours}h` : '•'}
                                  </button>
                                ) : (
                                  '·'
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* VISTA 2: GAP ANALYSIS: INCROCIO FINE UDA VS VERIFICHE PROGRAMMATE */}
      {/* ============================================================== */}
      {(activeViewMode === 'gap-analysis' || activeViewMode === 'all') && (
        <div className="neon-card neon-card-highlight p-5 space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                Gap Analysis Competenze & Verifiche Oggettive (D.M. 221/2025)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Incrocio tra date di fine UDA e verifiche registrate: individua le competenze chiave non ancora valutate formalmente.
              </p>
            </div>

            {/* Severity Filter */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setGapStatusFilter('all')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold ${
                    gapStatusFilter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Tutte ({gapAnalysisData.length})
                </button>
                <button
                  type="button"
                  onClick={() => setGapStatusFilter('with_gaps')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold ${
                    gapStatusFilter === 'with_gaps' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Con Gap ({gapAnalysisData.filter(d => d.hasAnyGap).length})
                </button>
                <button
                  type="button"
                  onClick={() => setGapStatusFilter('critical')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold ${
                    gapStatusFilter === 'critical' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Critiche ({gapAnalysisData.filter(d => d.hasCriticalGap).length})
                </button>
              </div>
            </div>
          </div>

          {/* Cards List */}
          {filteredGapData.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-slate-800">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-white">Nessuna criticità rilevata</p>
              <p className="text-xs text-slate-400 mt-1">Tutte le unità didattiche selezionate risultano coperte o prive di gap aperti.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredGapData.map(item => {
                const u = item.uda;
                const creditInfo = calcUdaCompetenceCredits(u, classes);

                return (
                  <div
                    key={u.id}
                    className={`rounded-xl border p-4 sm:p-5 transition-all space-y-3.5 ${
                      item.hasCriticalGap
                        ? 'bg-slate-900/90 border-rose-500/60'
                        : item.hasAnyGap
                        ? 'bg-slate-900/90 border-amber-500/50'
                        : 'bg-slate-900/60 border-emerald-500/40'
                    }`}
                  >
                    {/* Header: Title, Class, Dates, Status */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-white text-base">{u.title}</span>
                          <span className="text-xs text-slate-400">·</span>
                          <span className="font-mono text-cyan-300 font-bold text-xs">{u.className}</span>
                          <span className="text-xs text-slate-400">·</span>
                          <span className="text-xs text-slate-300">{u.period}</span>
                          <span className="text-xs text-slate-400">·</span>
                          <span className="font-mono text-purple-300 font-semibold text-xs">+{creditInfo.earnedCredits.toFixed(1)} pt</span>
                        </div>
                        <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
                          <span>{item.startMonthName} – {item.endMonthName}</span>
                          <span>·</span>
                          <span className="text-amber-300">Termine stimato: <b>{item.endDateEstimated}</b></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.gapSeverity === 'critical' ? (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-950 text-rose-300 border border-rose-500 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>CRITICO · {item.gapCount} GAP</span>
                          </span>
                        ) : item.gapSeverity === 'due' ? (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-orange-950 text-orange-300 border border-orange-500 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>IN SCADENZA</span>
                          </span>
                        ) : item.gapSeverity === 'planning' ? (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-950 text-sky-300 border border-sky-500 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>DA PIANIFICARE</span>
                          </span>
                        ) : item.gapSeverity === 'watch' ? (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-950 text-amber-300 border border-amber-500 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>DA MONITORARE</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-500 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>PIENA COPERTURA</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Timeline Diagnostics */}
                    <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs flex items-start gap-2">
                      <Calendar className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-slate-200">{item.timelineMessage}</p>
                        {item.hasAnyGap && (
                          <p className="text-[11px] text-cyan-300 mt-1">Prossimo passo: {item.remediationCopy}</p>
                        )}
                        {item.formalTestSessions.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-400">
                            <span>Verifiche registrate:</span>
                            {item.formalTestSessions.map((ts, idx) => (
                              <span key={idx} className="font-mono text-slate-200">
                                {ts.date} · {ts.title} {ts.avgGrade !== null ? `(Media ${formatGrade(ts.avgGrade)})` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Competency Gap Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {item.competenciesList.map(comp => (
                        <div
                          key={comp.id}
                          className={`p-3 rounded-lg border flex flex-col justify-between gap-2 ${
                            comp.isEvaluated
                              ? 'bg-slate-900/60 border-emerald-500/30'
                              : 'bg-rose-950/20 border-rose-500/50'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-white text-xs">{comp.title}</span>
                              {comp.isEvaluated ? (
                                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Valutata
                                </span>
                              ) : (
                                <span className="text-[10px] text-rose-400 font-bold flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" /> Mancante
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">
                              {comp.isEvaluated ? comp.evidence : comp.recommendedAction}
                            </p>
                          </div>

                          {!comp.isEvaluated && onNavigateTab && (
                            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                              <span className="text-[10px] text-slate-400">Azione:</span>
                              <button
                                type="button"
                                onClick={() => onNavigateTab(comp.actionType === 'test' ? 'verifiche-online' : 'voti')}
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <Zap className="w-3 h-3" />
                                <span>{comp.actionType === 'test' ? 'Pianifica / collega prova' : 'Collega evidenza'}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Card Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                      <span className="text-slate-400 text-[11px]">
                        ID: <span className="font-mono">{u.id}</span> · Lezioni registrate: <b>{(u.lessons || []).length}</b>
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedUdaForDetail(u)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Dossier & Rubrica</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* VISTA 3: RIEPILOGO AVANZAMENTO PERCENTUALE (60% + 40%) */}
      {/* ============================================================== */}
      {(activeViewMode === 'riepilogo' || activeViewMode === 'all') && (
        <div className="neon-card neon-card-highlight p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-400" />
                Indice di avanzamento didattico (interno) & Indice Attività UDA
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Indicatore interno di pianificazione: 60% copertura delle ore registrate nel diario + 40% valutazioni collegate. È un criterio interno del prodotto, non una regola di valutazione prescritta. Non determina voti o livelli.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {udas.map(u => {
              const creditInfo = calcUdaCompetenceCredits(u, classes);
              const doneHours = creditInfo.totalRawHours;
              const plannedHours = u.hours || 10;
              const hoursRatio = plannedHours > 0 ? Math.min(1, doneHours / plannedHours) : 0;

              const udaGrades = classes.flatMap(c => c.grades || []).filter(g => g.udaId === u.id);
              const targetEvals = 2; // Minimo 2 valutazioni per UDA
              const evalRatio = Math.min(1, creditInfo.evalCount / targetEvals);

              const completionPct = Math.round((hoursRatio * 0.6 + evalRatio * 0.4) * 100);

              return (
                <div key={u.id} className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-sm">{u.title}</h4>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-cyan-300 font-bold">{u.className}</span>
                        <span>·</span>
                        <span>{u.period}</span>
                        <span>·</span>
                        <span className="text-purple-300 font-mono">+{creditInfo.earnedCredits.toFixed(1)} pt</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xl font-black font-mono text-cyan-300">{completionPct}%</span>
                      <span className="text-[10px] text-slate-400 block">Indice interno</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
                      style={{ width: `${completionPct}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-400 pt-0.5">
                    <span>Quota diario: <b>{doneHours}/{plannedHours}h</b> ({(hoursRatio * 60).toFixed(0)}/60 pt)</span>
                    <span>Quota valutazioni: <b>{creditInfo.evalCount}/{targetEvals}</b> collegate ({(evalRatio * 40).toFixed(0)}/40 pt)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* CASCADE SHIFT PROPOSAL MODAL */}
      {/* ============================================================== */}
      {cascadeProposal && (
        <div className="fixed inset-0 z-50 bg-[#030712]/85 backdrop-blur-sm flex justify-center items-center p-3 sm:p-4">
          <div className="w-full max-w-xl neon-card neon-card-highlight p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Workflow className="w-5 h-5 text-cyan-400 shrink-0" />
                <div>
                  <h3 className="text-base font-bold text-white">
                    Riallineamento a Cascata Dipendenze UDA
                  </h3>
                  <p className="text-xs text-slate-400">
                    Propedeuticità curricolare rilevata (D.M. 221/2025)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCascadeProposal(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Change explanation */}
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-1">
              <p>
                Hai modificato il periodo di <b className="text-white">{cascadeProposal.parentUda.title}</b>:
              </p>
              <div className="font-mono text-cyan-300 flex items-center gap-2 pt-0.5">
                <span>Da: {MONTHS_LABELS[cascadeProposal.oldStartMonth]} – {MONTHS_LABELS[Math.min(9, cascadeProposal.oldStartMonth + cascadeProposal.oldDuration - 1)]}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-bold text-white">A: {MONTHS_LABELS[cascadeProposal.newStartMonth]} – {MONTHS_LABELS[Math.min(9, cascadeProposal.newStartMonth + cascadeProposal.newDuration - 1)]}</span>
              </div>
            </div>

            {/* Affected children list */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>UDA dipendenti collegate da aggiornare:</span>
                <span className="text-[11px] text-slate-500 font-normal">Seleziona quali spostare</span>
              </label>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {cascadeProposal.shifts.map((s, idx) => (
                  <label
                    key={s.childUda.id}
                    className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-3 cursor-pointer transition-all ${
                      s.selected ? 'bg-slate-900/90 border-cyan-500/60' : 'bg-slate-950 border-slate-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <input
                        type="checkbox"
                        checked={s.selected}
                        onChange={e => {
                          const nextShifts = [...cascadeProposal.shifts];
                          nextShifts[idx].selected = e.target.checked;
                          setCascadeProposal({ ...cascadeProposal, shifts: nextShifts });
                        }}
                        className="accent-cyan-400 w-4 h-4 cursor-pointer"
                      />
                      <div className="truncate">
                        <div className="font-semibold text-white truncate">{s.childUda.title}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {MONTHS_LABELS[s.currentStart]} ➔ <b className="text-cyan-300">{MONTHS_LABELS[s.suggestedStart]}</b> ({s.delta > 0 ? `+${s.delta}` : s.delta} mesi)
                        </div>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
                      Termine: {MONTHS_LABELS[s.suggestedEnd]}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setCascadeProposal(null)}
                className="w-full sm:w-auto px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Annulla
              </button>

              <button
                type="button"
                onClick={() => handleApplyCascade(false)}
                className="w-full sm:w-auto px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
                title="Modifica solo l'UDA padre senza toccare le UDA dipendenti"
              >
                Modifica Solo UDA Padre
              </button>

              <button
                type="button"
                onClick={() => handleApplyCascade(true)}
                className="w-full sm:w-auto px-4 py-2 rounded-lg neon-btn-primary text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              >
                <Check className="w-4 h-4" />
                <span>Applica Slittamento a Cascata</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* GANTT BAR CLICK MODAL: ATTIVITÀ, OBIETTIVI, COMPETENZE & CRONO */}
      {/* ============================================================== */}
      {ganttSelectedUda && (() => {
        const u = ganttSelectedUda;
        const creditStats = calcUdaCompetenceCredits(u, classes);
        const doneHours = creditStats.totalRawHours;
        const plannedHours = u.hours || 10;
        const hoursPct = plannedHours > 0 ? Math.min(100, Math.round((doneHours / plannedHours) * 100)) : 0;

        const predecessors = getUdaPredecessors(u, udas);
        const successors = getUdaSuccessors(u.id, udas);
        const conflictInfo = checkUdaDependencyConflict(u, udas);

        const startMonthName = MONTHS_LABELS[u.startMonth] || 'Settembre';
        const endMonthName = MONTHS_LABELS[Math.min(9, u.startMonth + u.durationMonths - 1)] || 'Novembre';

        return (
          <div className="fixed inset-0 z-50 bg-[#030712]/85 backdrop-blur-sm flex justify-center items-start p-3 sm:p-6 overflow-y-auto">
            <div className="w-full max-w-3xl neon-card neon-card-highlight p-5 sm:p-7 my-6 space-y-5 animate-in fade-in duration-200">
              {/* Header */}
              <div className="flex items-start justify-between pb-4 border-b border-[var(--border)]">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5 text-xs">
                    <span className="font-mono font-bold text-cyan-300">{u.className}</span>
                    <span>·</span>
                    <span className="text-slate-300">{u.period}</span>
                    <span>·</span>
                    <span className="text-slate-300">{startMonthName} – {endMonthName} ({u.durationMonths} mesi)</span>
                    <span>·</span>
                    <span className="font-mono text-purple-300 font-bold">+{creditStats.earnedCredits.toFixed(1)} pt</span>
                  </div>

                  <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                    {u.title}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setGanttSelectedUda(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Quick Stepper Controls right inside Gantt Modal */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  Regola Calendario UDA:
                </span>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[11px] mr-1">Inizio:</span>
                    <button
                      type="button"
                      onClick={() => handleRequestDateChange(u.id, (u.startMonth || 0) - 1, u.durationMonths)}
                      disabled={(u.startMonth || 0) <= 0 || isSavingUda}
                      className="p-1 rounded hover:bg-slate-800 text-slate-300 disabled:opacity-30"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono font-bold text-cyan-300">{startMonthName}</span>
                    <button
                      type="button"
                      onClick={() => handleRequestDateChange(u.id, (u.startMonth || 0) + 1, u.durationMonths)}
                      disabled={(u.startMonth || 0) + u.durationMonths >= 10 || isSavingUda}
                      className="p-1 rounded hover:bg-slate-800 text-slate-300 disabled:opacity-30"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[11px] mr-1">Durata:</span>
                    <button
                      type="button"
                      onClick={() => handleRequestDateChange(u.id, u.startMonth, u.durationMonths - 1)}
                      disabled={u.durationMonths <= 1 || isSavingUda}
                      className="p-1 rounded hover:bg-slate-800 text-slate-300 disabled:opacity-30 font-bold"
                    >
                      -
                    </button>
                    <span className="font-mono font-bold text-white">{u.durationMonths}m</span>
                    <button
                      type="button"
                      onClick={() => handleRequestDateChange(u.id, u.startMonth, u.durationMonths + 1)}
                      disabled={(u.startMonth || 0) + u.durationMonths >= 10 || isSavingUda}
                      className="p-1 rounded hover:bg-slate-800 text-slate-300 disabled:opacity-30 font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Dependencies section in Gantt Modal */}
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <GitFork className="w-4 h-4 text-cyan-400" />
                    Propedeuticità & Dipendenze Collegate
                  </span>
                  {conflictInfo.hasConflict && (
                    <span className="text-amber-400 font-bold flex items-center gap-1 text-[11px]">
                      <AlertTriangle className="w-3.5 h-3.5" /> Conflitto temporale
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1">Predecessori (Dipende da):</span>
                    {predecessors.length === 0 ? (
                      <span className="text-slate-500 italic text-[11px]">Nessuna UDA propedeutica a monte</span>
                    ) : (
                      <div className="space-y-1">
                        {predecessors.map(p => (
                          <div key={p.id} className="p-1.5 rounded bg-slate-950 border border-slate-800 flex items-center justify-between">
                            <span className="font-semibold text-white truncate text-[11px]">{p.title}</span>
                            <span className="text-[10px] text-cyan-300 font-mono shrink-0">
                              {MONTHS_LABELS[p.startMonth]} - {MONTHS_LABELS[Math.min(9, p.startMonth + p.durationMonths - 1)]}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1">UDA Dipendenti a valle:</span>
                    {successors.length === 0 ? (
                      <span className="text-slate-500 italic text-[11px]">Nessuna UDA dipendente a valle</span>
                    ) : (
                      <div className="space-y-1">
                        {successors.map(s => (
                          <div key={s.id} className="p-1.5 rounded bg-slate-950 border border-slate-800 flex items-center justify-between">
                            <span className="font-semibold text-white truncate text-[11px]">{s.title}</span>
                            <span className="text-[10px] text-purple-300 font-mono shrink-0">
                              {MONTHS_LABELS[s.startMonth]} - {MONTHS_LABELS[Math.min(9, s.startMonth + s.durationMonths - 1)]}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Description & Competencies */}
              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Descrizione UDA</span>
                    <button
                      type="button"
                      onClick={() => handleGenerateUdaDescription(u)}
                      disabled={isGeneratingAi}
                      className="px-2.5 py-1 rounded-lg neon-btn-primary text-[11px] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all shadow-sm"
                      title="Genera traccia testuale completa dell'UDA con assistenza AI in base a titolo e durata"
                    >
                      <Sparkles className={`w-3 h-3 text-cyan-300 ${isGeneratingAi ? 'animate-spin' : ''}`} />
                      <span>{isGeneratingAi ? 'Generazione...' : 'Genera Descrizione UDA'}</span>
                    </button>
                  </div>
                  <p className="text-slate-200 leading-relaxed whitespace-pre-line text-xs">{u.description || 'Nessuna descrizione inserita.'}</p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-amber-400 block">Competenze Chiave Europee</span>
                  <p className="text-slate-200 leading-relaxed">{u.competencies || 'Competenze scientifiche e tecnologiche applicate.'}</p>
                </div>

                {u.authenticTask && (
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-emerald-400 block">Compito di Realtà Atteso</span>
                    <p className="text-slate-200 leading-relaxed">{u.authenticTask}</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => {
                    setGanttSelectedUda(null);
                    setSelectedUdaForDetail(u);
                  }}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Apri Fascicolo Completo & Diario</span>
                </button>

                <button
                  type="button"
                  onClick={() => setGanttSelectedUda(null)}
                  className="px-4 py-2 rounded-lg neon-btn-primary text-xs font-semibold cursor-pointer"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============================================================== */}
      {/* DETAILED UDA PROJECT DOSSIER MODAL WITH DEPENDENCY MANAGER */}
      {/* ============================================================== */}
      {selectedUdaForDetail && (() => {
        const creditStats = calcUdaCompetenceCredits(selectedUdaForDetail, classes);
        const otherUdas = udas.filter(u => u.id !== selectedUdaForDetail.id);

        return (
          <div className="fixed inset-0 z-50 bg-[#030712]/85 backdrop-blur-sm flex justify-center items-start p-3 sm:p-6 overflow-y-auto">
            <div className="w-full max-w-4xl neon-card neon-card-highlight p-5 sm:p-7 my-6 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between pb-4 border-b border-[var(--border)]">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5 text-xs">
                    <span className="font-mono text-cyan-300 font-bold">{selectedUdaForDetail.className}</span>
                    <span>·</span>
                    <span className="text-slate-300">Periodo {selectedUdaForDetail.period}</span>
                    <span>·</span>
                    <span className="text-purple-300 font-mono font-bold">+{creditStats.earnedCredits.toFixed(1)} pt</span>
                  </div>

                  <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                    {selectedUdaForDetail.title}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Fascicolo Progettuale, Diario di Bordo & Propedeuticità Curricolare
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="hidden sm:inline">Stampa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedUdaForDetail(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Section: Propedeuticità & Dipendenze tra UDA */}
              <div className="p-4 rounded-xl bg-[var(--surface-variant)] border border-[var(--border)] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Workflow className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Propedeuticità & Dipendenze tra UDA
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSuggestDependenciesSemantic(selectedUdaForDetail)}
                    disabled={isAnalyzingDependenciesSemantic}
                    className="self-start sm:self-auto px-2.5 py-1 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    title="Analizza le somiglianze concettuali con le altre UDA per suggerire propedeuticità coerenti"
                  >
                    <Cpu className={`w-3.5 h-3.5 text-cyan-400 ${isAnalyzingDependenciesSemantic ? 'animate-spin' : ''}`} />
                    <span>{isAnalyzingDependenciesSemantic ? 'Analisi...' : '⚡ Suggerisci propedeuticità'}</span>
                  </button>
                </div>

                {/* Suggested Predecessors from Local Embedding */}
                {suggestedPredecessors.length > 0 && (
                  <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-700/70 space-y-2">
                    <div className="flex items-center justify-between text-xs text-cyan-300 font-semibold">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        UDA correlate suggerite:
                      </span>
                      <button
                        type="button"
                        onClick={() => setSuggestedPredecessors([])}
                        className="text-slate-400 hover:text-white text-[11px]"
                      >
                        Chiudi
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {suggestedPredecessors.map(s => {
                        const isDep = (selectedUdaForDetail.dependencies || []).includes(s.uda.id);
                        return (
                          <div
                            key={s.uda.id}
                            className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="truncate">
                              <span className="font-semibold text-white block truncate">{s.uda.title}</span>
                              <span className="text-[10px] text-cyan-400 font-mono">
                                Affinità concettuale: <b>{s.score}%</b> · {s.uda.className}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleDependency(selectedUdaForDetail.id, s.uda.id)}
                              className={`px-2 py-1 rounded text-[10px] font-bold shrink-0 transition-colors ${
                                isDep
                                  ? 'bg-cyan-500 text-slate-950'
                                  : 'bg-cyan-950 text-cyan-300 border border-cyan-700 hover:bg-cyan-900'
                              }`}
                            >
                              {isDep ? '✓ Collegata' : '+ Collega'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-xs text-slate-300">
                    Seleziona le Unità Didattiche che devono precedere questa UDA nel curricolo. Lo spostamento dell'UDA padre suggerirà automaticamente lo slittamento di questa attività:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {otherUdas.length === 0 ? (
                      <p className="text-xs text-slate-500 italic col-span-2">Nessun'altra UDA presente.</p>
                    ) : (
                      otherUdas.map(cand => {
                        const isDep = (selectedUdaForDetail.dependencies || []).includes(cand.id);
                        const isSameClass = cand.className === selectedUdaForDetail.className;

                        return (
                          <button
                            key={cand.id}
                            type="button"
                            onClick={() => handleToggleDependency(selectedUdaForDetail.id, cand.id)}
                            className={`p-2.5 rounded-lg border text-left text-xs flex items-center justify-between gap-2 transition-all cursor-pointer ${
                              isDep
                                ? 'bg-cyan-950/70 border-cyan-500 text-white shadow-sm'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                            }`}
                          >
                            <div className="truncate">
                              <div className="font-semibold truncate">{cand.title}</div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                {cand.className} · {MONTHS_LABELS[cand.startMonth]} - {MONTHS_LABELS[Math.min(9, cand.startMonth + cand.durationMonths - 1)]}
                              </div>
                            </div>

                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isDep ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {isDep ? '✓ Predecessore' : '+ Collega'}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Section 1: Descrizione */}
              <div className="p-4 rounded-xl bg-[var(--surface-variant)] border border-[var(--border)] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      1. Descrizione dell'Attività & Motivazione Didattica
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleGenerateUdaDescription(selectedUdaForDetail)}
                    disabled={isGeneratingAi}
                    className="self-start sm:self-auto px-3 py-1.5 rounded-lg neon-btn-primary text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-60"
                    title="Genera traccia testuale completa dell'attività con assistenza AI basandoti su titolo e durata nel Gantt"
                  >
                    <Sparkles className={`w-3.5 h-3.5 text-cyan-300 ${isGeneratingAi ? 'animate-spin' : ''}`} />
                    <span>{isGeneratingAi ? 'Generazione in corso...' : 'Genera Descrizione UDA'}</span>
                  </button>
                </div>

                <textarea
                  rows={6}
                  value={selectedUdaForDetail.description || ''}
                  onChange={e => handleUpdateUdaField('description', e.target.value)}
                  placeholder="Descrivi la motivazione dell'UDA, i contenuti chiave e il percorso formativo (o clicca su 'Genera Descrizione UDA' per creare la traccia completa con assistenza AI)..."
                  className="w-full p-3 rounded-lg neon-input text-white text-xs sm:text-sm resize-y leading-relaxed font-sans"
                />
              </div>

              {/* Section 2: Competenze & Compito di Realtà */}
              <div className="p-4 rounded-xl bg-[var(--surface-variant)] border border-[var(--border)] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      2. Competenze Chiave Europee & Compito di Realtà
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAnalyzeCompetenciesSemantic(selectedUdaForDetail)}
                    disabled={isAnalyzingCompetenciesSemantic}
                    className="self-start sm:self-auto px-2.5 py-1 rounded bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-700/60 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    title="Confronta il testo dell'UDA con i descrittori ministeriali D.M. 221/2025 tramite analisi semantica"
                  >
                    <Brain className={`w-3.5 h-3.5 text-amber-400 ${isAnalyzingCompetenciesSemantic ? 'animate-spin' : ''}`} />
                    <span>{isAnalyzingCompetenciesSemantic ? 'Analisi semantica...' : '🧠 Mappatura Semantica D.M. 221/2025'}</span>
                  </button>
                </div>

                {/* Semantic Competency Alignment Breakdown */}
                {competencyAlignment && (
                  <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-700/60 space-y-2">
                    <div className="flex items-center justify-between text-xs text-amber-300 font-semibold">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        Grado di Allineamento Semantico alle Competenze Chiave (D.M. 221/2025):
                      </span>
                      <button
                        type="button"
                        onClick={() => setCompetencyAlignment(null)}
                        className="text-slate-400 hover:text-white text-[11px]"
                      >
                        Chiudi
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {competencyAlignment.map(c => (
                        <div key={c.id} className="p-2 rounded bg-slate-900 border border-slate-800 text-xs">
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-semibold text-slate-200 truncate">{c.name}</span>
                            <span className="font-mono font-bold text-amber-300 text-[11px] shrink-0">
                              {c.score}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, Math.max(0, c.score))}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Competenze Chiave Europee (Raccomandazione UE 2018):
                    </label>
                    <input
                      type="text"
                      value={selectedUdaForDetail.competencies || ''}
                      onChange={e => handleUpdateUdaField('competencies', e.target.value)}
                      placeholder="es. Competenza matematica e competenze in STEM, Digitale, Cittadinanza attiva"
                      className="w-full p-2.5 rounded-lg neon-input text-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Compito di Realtà / Prodotto Autentico Finale Atteso:
                    </label>
                    <textarea
                      rows={2}
                      value={selectedUdaForDetail.authenticTask || ''}
                      onChange={e => handleUpdateUdaField('authenticTask', e.target.value)}
                      placeholder="es. Realizzazione tavola tecnica quotata, modello 3D, presentazione con foglio di calcolo..."
                      className="w-full p-2.5 rounded-lg neon-input text-white text-xs resize-y"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Diario di Bordo delle Lezioni */}
              <div className="p-4 rounded-xl bg-[var(--surface-variant)] border border-[var(--border)] space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      3. Diario delle Lezioni & Tipologie di Attività
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    Indice attività interno: <b className="text-purple-300">{creditStats.totalWeightedHours} pt</b> · Diario: {creditStats.totalRawHours}/{selectedUdaForDetail.hours}h
                  </span>
                </div>

                {/* Add lesson form */}
                <form onSubmit={handleAddLesson} className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-2.5 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <input
                      type="date"
                      value={newLessonDate}
                      onChange={e => setNewLessonDate(e.target.value)}
                      className="sm:col-span-3 p-2 rounded bg-slate-950 border border-slate-800 text-white font-mono"
                    />

                    <input
                      type="text"
                      placeholder="Argomento o fase operativa svolta..."
                      value={newLessonTopic}
                      onChange={e => setNewLessonTopic(e.target.value)}
                      className="sm:col-span-4 p-2 rounded bg-slate-950 border border-slate-800 text-white"
                      required
                    />

                    <select
                      value={newLessonType}
                      onChange={e => setNewLessonType(e.target.value as UdaActivityType)}
                      className="sm:col-span-3 p-2 rounded bg-slate-950 border border-slate-800 text-white font-semibold cursor-pointer"
                    >
                      <option value="teoria">📖 Teoria & Metodo (1.0x)</option>
                      <option value="laboratorio">🔬 Laboratorio & Pratica (1.25x)</option>
                      <option value="compito_realta">🎯 Compito di Realtà (1.30x)</option>
                      <option value="civica">🌿 Educazione Civica (1.20x)</option>
                      <option value="digitale">💻 Digitale & Online (1.15x)</option>
                    </select>

                    <div className="sm:col-span-2 flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0.5}
                        max={10}
                        step={0.5}
                        value={newLessonHours}
                        onChange={e => setNewLessonHours(Number(e.target.value))}
                        className="w-14 p-2 rounded bg-slate-950 border border-slate-800 text-white font-mono"
                      />
                      <button
                        type="submit"
                        className="flex-1 py-2 rounded-lg neon-btn-primary font-bold text-xs cursor-pointer"
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                </form>

                {/* Lessons list */}
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {(selectedUdaForDetail.lessons || []).length === 0 ? (
                    <p className="text-xs text-slate-500 py-3 text-center italic">
                      Nessuna lezione ancora registrata.
                    </p>
                  ) : (
                    (selectedUdaForDetail.lessons || []).map(les => {
                      const conf = ACTIVITY_TYPE_CONFIG[inferLessonActivityType(les, selectedUdaForDetail)];
                      return (
                        <div key={les.id} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-mono text-slate-400 text-[10px]">{les.date}</span>
                            <span>{conf.icon}</span>
                            <span className="font-semibold text-white truncate">{les.topic}</span>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-mono text-cyan-300 font-bold">{les.hours}h</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveLesson(les.id)}
                              className="text-slate-500 hover:text-rose-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end pt-4 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setSelectedUdaForDetail(null)}
                  className="px-5 py-2.5 rounded-lg neon-btn-primary font-semibold text-xs cursor-pointer"
                >
                  Chiudi Fascicolo
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============================================================== */}
      {/* MODAL: INFO INDICE ATTIVITÀ UDA */}
      {/* ============================================================== */}
      {isCreditsInfoOpen && (
        <div className="fixed inset-0 z-50 bg-[#030712]/85 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="w-full max-w-lg neon-card neon-card-highlight p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">
                  Criteri dell’Indice Attività UDA
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreditsInfoOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p>
                Come indice interno di pianificazione, le ore delle attività possono essere ponderate in base alla tipologia didattica scelta dal docente:
              </p>

              <div className="space-y-1.5">
                {(Object.keys(ACTIVITY_TYPE_CONFIG) as UdaActivityType[]).map(key => {
                  const c = ACTIVITY_TYPE_CONFIG[key];
                  return (
                    <div key={key} className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{c.icon}</span>
                        <span className="font-semibold text-white">{c.label}</span>
                      </div>
                      <span className="font-mono font-bold text-cyan-300">{c.weight}x</span>
                    </div>
                  );
                })}
              </div>

              <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-400 font-mono">
                Punteggio interno: ore registrate × coefficiente attività + 1 pt per valutazione collegata (conteggiata una volta per batch).
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCreditsInfoOpen(false)}
                className="px-4 py-2 rounded-lg neon-btn-primary text-xs font-semibold"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: NUOVA UDA RAPIDA CON SCELTA PROPEDEUTICITÀ */}
      {/* ============================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#030712]/80 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="w-full max-w-lg neon-card neon-card-highlight p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-[var(--primary)]" />
                Nuova Unità Didattica (UDA)
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddUda} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Titolo UDA
                </label>
                <input
                  type="text"
                  required
                  placeholder="es. UDA 4: Energie Rinnovabili e Sostenibilità"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full p-2.5 neon-input text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Classe
                  </label>
                  <select
                    value={newClass}
                    onChange={e => setNewClass(e.target.value)}
                    className="w-full p-2.5 neon-input text-white bg-slate-900 cursor-pointer"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Monte Ore
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={newHours}
                    onChange={e => setNewHours(Number(e.target.value))}
                    className="w-full p-2.5 neon-input text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Periodo
                  </label>
                  <select
                    value={newPeriod}
                    onChange={e => setNewPeriod(e.target.value as any)}
                    className="w-full p-2.5 neon-input text-white bg-slate-900 cursor-pointer"
                  >
                    <option value="Q1">Q1</option>
                    <option value="Q2">Q2</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Mese Inizio
                  </label>
                  <select
                    value={newStartMonth}
                    onChange={e => setNewStartMonth(Number(e.target.value))}
                    className="w-full p-2.5 neon-input text-white bg-slate-900 cursor-pointer"
                  >
                    {MONTHS_LABELS.map((m, idx) => (
                      <option key={m} value={idx}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Durata Mesi
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={newDuration}
                    onChange={e => setNewDuration(Number(e.target.value))}
                    className="w-full p-2.5 neon-input text-white font-mono"
                  />
                </div>
              </div>

              {/* Predecessor dependency selection */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Propedeuticità (Dipende da):
                </label>
                <select
                  value={newPredecessorId}
                  onChange={e => setNewPredecessorId(e.target.value)}
                  className="w-full p-2.5 neon-input text-white bg-slate-900 cursor-pointer"
                >
                  <option value="">Nessun predecessore (UDA iniziale)</option>
                  {udas.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.title} ({u.className} · {MONTHS_LABELS[u.startMonth]})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={newIsCivic}
                    onChange={e => setNewIsCivic(e.target.checked)}
                    className="accent-[var(--primary)] w-4 h-4 cursor-pointer"
                  />
                  <span>Include modulo di <b>Educazione Civica</b> (L. 92/2019)</span>
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Descrizione Didattica / Traccia
                  </label>
                  <button
                    type="button"
                    onClick={() => handleGenerateUdaDescription({
                      title: newTitle,
                      durationMonths: newDuration,
                      hours: newHours,
                      className: newClass,
                      period: newPeriod,
                      civicEducation: newIsCivic
                    })}
                    disabled={isGeneratingAi || !newTitle.trim()}
                    className="px-2 py-0.5 rounded text-[10px] font-bold text-cyan-300 bg-cyan-950 border border-cyan-800 hover:bg-cyan-900 disabled:opacity-40 flex items-center gap-1 cursor-pointer transition-all"
                    title="Genera traccia testuale completa dell'UDA con assistenza AI"
                  >
                    <Sparkles className={`w-3 h-3 text-cyan-300 ${isGeneratingAi ? 'animate-spin' : ''}`} />
                    <span>{isGeneratingAi ? 'Generazione...' : 'Genera con AI'}</span>
                  </button>
                </div>
                <textarea
                  rows={3}
                  placeholder="Inserisci la descrizione oppure clicca su 'Genera con AI'..."
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  className="w-full p-2.5 neon-input text-white text-xs resize-y leading-relaxed font-sans"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSavingUda}
                  className="flex-1 py-2.5 rounded-lg neon-btn-primary font-semibold cursor-pointer"
                >
                  Crea UDA
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSavingUda}
                  className="px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 cursor-pointer"
                >
                  Annulla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
