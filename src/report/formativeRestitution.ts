import type { AppSettings, ClassData, EvaluationType, Grade, UdaRecord } from '../types';
import { calcAvg, calcWeightedAvg, DEFAULT_EVALUATION_WEIGHTS, parseGrade, TYPES_LABEL } from '../utils';

export type RestitutionPeriod = 'all' | 'Q1' | 'Q2';
export const RESTITUTION_FIELDS = [
  ['learning', 'Apprendimenti e competenze'],
  ['participation', 'Partecipazione e metodo di lavoro'],
  ['strength', 'Punti di forza'],
  ['goal1', 'Primo obiettivo di miglioramento'],
  ['goal2', 'Secondo obiettivo (facoltativo)'],
  ['support', 'Come sostenere il percorso'],
  ['reflection', 'Domanda di autovalutazione per l’alunno']
] as const;
export type RestitutionField = typeof RESTITUTION_FIELDS[number][0];
export type RestitutionDraft = Record<RestitutionField, string>;
export const emptyRestitutionDraft = (): RestitutionDraft => ({
  learning: '', participation: '', strength: '', goal1: '', goal2: '', support: '', reflection: ''
});

const specialLabels: Record<string, string> = { A: 'Assente (A)', NC: 'Non classificato (NC)', G: 'Giustificato (G)' };
const typeOrder = Object.keys(TYPES_LABEL) as EvaluationType[];
const escapeRegex = (value: string) => value.replace(/[.*+?^$\x7b\x7d()|[\]\\]/g, '\\$&');

// Known roster names are suppressed from source labels. This is not anonymization:
// free text can contain other identifying details; explicit teacher review is required.
function rosterPattern(name: string): RegExp | null {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  return new RegExp('(?:^|[^\\p{L}\\p{N}])(' + words.map(escapeRegex).join('\\s+') + ')(?=$|[^\\p{L}\\p{N}])', 'giu');
}

export function containsRosterName(text: string, names: readonly string[]): boolean {
  return names.some(name => rosterPattern(name)?.test(text) === true);
}

function protectedText(text: string, names: readonly string[]): string {
  return [...names].sort((a,b) => b.length-a.length).reduce((result, name) => {
    const pattern = rosterPattern(name);
    return pattern ? result.replace(pattern, (whole, matched: string) => whole.slice(0, whole.length - matched.length) + '[nominativo protetto]') : result;
  }, text);
}

export function buildFormativeRestitution(
  cls: ClassData, studentId: string, period: RestitutionPeriod,
  settings: AppSettings | undefined, udas: readonly UdaRecord[]
) {
  if (cls.students.filter(s => s.id === studentId).length !== 1) return null;
  if (period !== 'all' && period !== 'Q1' && period !== 'Q2') return null;
  const names = cls.students.map(s => s.name).filter(Boolean);
  const grades = cls.grades.filter(g => g.studentId === studentId && (period === 'all' || g.period === period))
    .slice().sort((a,b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const weighted = settings?.useWeightedAverage === true;
  const weights = settings?.evaluationWeights || DEFAULT_EVALUATION_WEIGHTS;
  const weight = (type: EvaluationType) => weights[type] !== undefined ? weights[type] : 100;
  const numeric = (g: Grade) => parseGrade(g.value) !== null;
  const included = (g: Grade) => numeric(g) && (!weighted || weight(g.type) > 0);
  const summarize = (rows: Grade[]) => ({
    count: rows.length,
    numericCount: rows.filter(numeric).length,
    includedCount: rows.filter(included).length,
    mean: weighted ? calcWeightedAvg(rows, weights) : calcAvg(rows)
  });
  return {
    version: 1 as const,
    subject: protectedText(settings?.subject?.trim() || 'Disciplina non impostata', names),
    schoolYear: protectedText(settings?.year?.trim() || 'Anno scolastico non impostato', names),
    classLabel: protectedText(cls.name, names),
    period,
    weighted,
    summary: summarize(grades),
    byType: typeOrder.filter(type => grades.some(g => g.type === type)).map(type => ({
      type, label: TYPES_LABEL[type], weight: weighted ? weight(type) : null,
      ...summarize(grades.filter(g => g.type === type))
    })),
    rows: grades.map(g => {
      const linked = g.udaId ? udas.filter(u => u.id === g.udaId && u.className === cls.name) : [];
      const value = g.value.trim().toUpperCase();
      return {
        date: g.date, period: g.period, type: TYPES_LABEL[g.type] || 'Tipologia non riconosciuta',
        title: protectedText(g.title?.trim() || 'Attività senza titolo', names),
        uda: linked.length === 1 ? protectedText(linked[0].title, names) : g.udaId ? 'Collegamento UDA non verificato' : null,
        value: numeric(g) ? protectedText(g.value, names) : specialLabels[value] || 'Registrazione non numerica',
        numeric: numeric(g), included: included(g), delayed: Boolean(g.delayed)
      };
    })
  };
}

export type FormativeRestitution = NonNullable<ReturnType<typeof buildFormativeRestitution>>;

export function checkedRestitutionDraft(draft: RestitutionDraft, names: readonly string[]): RestitutionDraft | null {
  const result = emptyRestitutionDraft();
  for (const [field] of RESTITUTION_FIELDS) {
    const value = draft[field].trim();
    if (value.length > 1200 || containsRosterName(value, names)) return null;
    result[field] = value;
  }
  return result;
}
