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

export interface ClassData {
  id: string;
  name: string;
  students: Student[];
  grades: Grade[];
  behaviors: BehaviorRecord[];
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

export interface OnlineTest {
  id: string;
  title: string;
  questions: Question[];
  category?: string;
  udaId?: string; // Collegamento all'UDA di riferimento
  description?: string;
  durationMinutes?: number;
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
  school: string;
  year: string;
  teacher: string;
  subject: string;
  theme: AppTheme;
  evaluationWeights?: Record<EvaluationType, number>; // Pesi in percentuale (es. 100, 80, 50)
  useWeightedAverage?: boolean; // Se abilitare la media ponderata come calcolo predefinito
  embeddingConfig?: LocalEmbeddingConfig; // Configurazione motore vettoriale / embedding locale
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
  | 'storico'
  | 'report'
  | 'dati'
  | 'verifiche-online'
  | 'uda-gantt'
  | 'programmazione'
  | 'biblioteca'
  | 'impostazioni'
  | 'privacy';

