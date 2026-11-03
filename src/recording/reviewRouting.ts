import type { TodayContinuationOption } from '../today/todayRouter';
import type { RecordEvidenceKind } from './recordSession';

const GENERIC_REVIEW_OPTIONS: readonly TodayContinuationOption[] = [
  { tab: 'tabellone', label: 'Tabellone' },
  { tab: 'analytics', label: 'Analisi' },
  { tab: 'storico', label: 'Storico' },
  { tab: 'report', label: 'Scheda alunno' }
];

const REVIEW_OPTIONS_BY_EVIDENCE: Record<RecordEvidenceKind, readonly TodayContinuationOption[]> = {
  evaluation: GENERIC_REVIEW_OPTIONS,
  'online-outcomes': [
    { tab: 'tabellone', label: 'Tabellone' },
    { tab: 'storico', label: 'Storico' },
    { tab: 'analytics', label: 'Analisi' },
    { tab: 'report', label: 'Scheda alunno' }
  ],
  behaviour: [
    { tab: 'report', label: 'Scheda alunno' },
    { tab: 'comportamenti', label: 'Comportamento' },
    { tab: 'analytics', label: 'Analisi' },
    { tab: 'tabellone', label: 'Tabellone' }
  ],
  'lesson-log': [
    { tab: 'uda-gantt', label: 'UDA e diario' },
    { tab: 'tabellone', label: 'Tabellone' },
    { tab: 'analytics', label: 'Analisi' },
    { tab: 'storico', label: 'Storico' }
  ]
};

export function getRecordReviewOptions(
  evidenceKind?: RecordEvidenceKind | null
): readonly TodayContinuationOption[] {
  return evidenceKind ? REVIEW_OPTIONS_BY_EVIDENCE[evidenceKind] : GENERIC_REVIEW_OPTIONS;
}
