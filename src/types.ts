import type { AiBudgetProfile } from './copilot/aiBudgetGovernor';
import type { CopilotProactivityProfile } from './copilot/proactivity';

export type EvaluationType = 'test' | 'verifica' | 'orale' | 'disegno' | 'osserv';

export interface Student {
  id: string;
  name: string;
}

export interface Grade {
  id: string;
  batchId?: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  type: EvaluationType;
  period: 'Q1' | 'Q2';
  title: string;
  value: string; // e.g. "8.5", "7+", "6-", "6½", "A", "NC", "G"
  delayed?: boolean; // ritardo / prova di recupero
  udaId?: string; // collegamento opzionale all'UDA
}

export interface BehaviorRecord {
  id: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  status: 'Ottimale 🌟' | 'Costruttivo 👍' | 'Distratto ⚠️' | 'Disattento ❌';
  note?: string;
}

export type CouncilMoment = 'ingresso' | 'intermedia' | 'finale';

export interface CouncilAssessment {
  studentId: string;
  schoolYear: string;
  moment: CouncilMoment;
  value: string;
  updatedAt: string;
}

export type CouncilSessionKind = 'ingresso' | 'intermedia' | 'monitoraggio' | 'finale' | 'altro';

export interface CouncilSession {
  /** Stable identity; multiple sessions can share the same date and kind. */
  id: string;
  schoolYear: string;
  kind: CouncilSessionKind;
  /** The teacher-selected, actual or scheduled date, not inferred from kind. */
  date: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * CDC-02/S2b v1: six frozen class totals only; no student names or per-pupil marks.
 * This is a teacher-confirmed projection, NOT an official council decision.
 */
export interface CouncilEvidenceAggregatesV1 {
  totalStudents: number;
  withNumericEvidence: number;
  withoutNumericEvidence: number;
  numericEvidenceCount: number;
  withSavedTeacherProposal: number;
  withoutSavedTeacherProposal: number;
}

export interface CouncilEvidenceSnapshotV1 {
  schemaVersion: 1;
  id: string;
  classId: string;
  schoolYear: string;
  sessionId: string;
  sessionDate: string;
  sessionKind: CouncilSessionKind;
  revision: number;
  supersedesSnapshotId?: string;
  /** ISO UTC, sampled with the fields below from one local Date at commit. */
  capturedAt: string;
  /** Original civil day of acquisition, preserved across restores/timezones. */
  captureLocalDate: string;
  /** JavaScript Date.getTimezoneOffset: UTC minus original local time, minutes. */
  captureUtcOffsetMinutes: number;
  confirmedByTeacher: true;
  requestedCutoff: string;
  effectiveCutoff: string;
  cutoffClampedToSchoolYear: boolean;
  calculationContract: 'council-evidence-overview-v1';
  aggregates: CouncilEvidenceAggregatesV1;
  /** Internal encrypted integrity hints, never anonymization or a digital signature. */
  rosterFingerprint: string;
  sourceFingerprint: string;
  contentDigest: string;
}

export interface ClassData {
  id: string;
  name: string;
  students: Student[];
  grades: Grade[];
  behaviors: BehaviorRecord[];
  /** Independent teacher-assigned council judgements, never part of grades/averages. */
  councilAssessments?: CouncilAssessment[];
  /** Private, dated council-session index; independent from proposals and source grades. */
  councilSessions?: CouncilSession[];
  /** Optional append-only teacher-confirmed aggregate photographs (CDC-02/S2b). */
  councilEvidenceSnapshots?: CouncilEvidenceSnapshotV1[];
}

export type UdaActivityType = 'teoria' | 'laboratorio' | 'compito_realta' | 'digitale' | 'civica';

export interface UdaLesson {
  id: string;
  date: string;
  topic: string;
  hours: number;
  notes?: string;
  activityType?: UdaActivityType;
}

export interface UdaRecord {
  id: string;
  title: string;
  className: string;
  hours: number;
  period: 'Q1' | 'Q2';
  startMonth: number; // 0=Set, 1=Ott, 2=Nov, 3=Dic, 4=Gen, 5=Feb, 6=Mar, 7=Apr, 8=Mag, 9=Giu
  durationMonths: number;
  description?: string;
  competencies?: string;
  civicEducation?: boolean; // Educazione Civica (trasversale)
  authenticTask?: string;
  rubricLevels?: {
    av?: string;
    in?: string;
    ba?: string;
    pa?: string;
  };
  lessons?: UdaLesson[];
  dependencies?: string[]; // IDs of prerequisite/parent UDAs
}

export type QuestionType = 'multiple_choice' | 'true_false' | 'open_short';

export interface Question {
  q: string;
  options: string[];
  correct: number;
  explanation?: string; // Spiegazione didattica formativa (rationale)
  type?: QuestionType;
}

/** Permanent, minimal teacher-confirmed Biblioteca source reference (INT-02/S2b). */
export interface AssessmentProvenanceV1 {
  version: 1;
  kind: 'library-source';
  sourceId: string;
  confirmedByTeacher: true;
}

export interface OnlineTest {
  id: string;
  title: string;
  questions: Question[];
  category?: string;
  udaId?: string; // Collegamento all'UDA di riferimento
  description?: string;
  durationMinutes?: number;
  provenance?: AssessmentProvenanceV1; // Docente-only: never expose to student/public projections
}

export interface OnlineSubmission {
  id: string;
  name: string;
  class: string;
  testTitle: string;
  testId?: string;
  score: number;
  total: number;
  date: string;
  answers?: { questionIndex: number; selected: number; isCorrect: boolean }[];
}


export type AppTheme = 'cyan' | 'matrix' | 'purple' | 'amber' | 'mixed';

export type EmbeddingProvider = 'local' | 'gemini';

export interface LocalEmbeddingConfig {
  provider: EmbeddingProvider;
  endpointUrl: string; // e.g. "http://127.0.0.1:8080" (llama-server) or "http://localhost:11434" (Ollama)
  modelName: string; // e.g. "models/embeddinggemma-2.gguf"
  apiType: 'llama.cpp' | 'ollama' | 'openai-compatible';
  apiKey?: string;
  enabled: boolean;
}

export interface AppSettings {
  /** Explicit new archive mode; absent on historical archives. */
  archiveMode?: 'professional' | 'demo';
  school: string;
  year: string;
  teacher: string;
  subject: string;
  theme: AppTheme;
  evaluationWeights?: Record<EvaluationType, number>; // Pesi in percentuale (es. 100, 80, 50)
  useWeightedAverage?: boolean; // Se abilitare la media ponderata come calcolo predefinito
  embeddingConfig?: LocalEmbeddingConfig; // Configurazione motore vettoriale / embedding locale
  aiBudgetProfile?: AiBudgetProfile; // Profilo base durevole; le autorizzazioni temporanee non vengono persistite
  copilotProactivity?: CopilotProactivityProfile; // Quanto il Copilota propone; non modifica autorità o budget IA
}


export interface AppData {
  classes: ClassData[];
  currentClassId: string | null;
}

export interface CompetenceLevel {
  id: 'AV' | 'IN' | 'BA' | 'PA';
  label: string;
  desc: string;
  min: number;
  color: string;
  badgeClass: string;
}

export type ActiveTab =
  | 'home'
  | 'dashboard'
  | 'voti'
  | 'comportamenti'
  | 'analytics'
  | 'tabellone'
  | 'consigli'
  | 'storico'
  | 'report'
  | 'dati'
  | 'verifiche-online'
  | 'uda-gantt'
  | 'programmazione'
  | 'biblioteca'
  | 'impostazioni'
  | 'privacy';
