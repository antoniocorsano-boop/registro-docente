export type UdaGapSeverity = 'planning' | 'watch' | 'due' | 'critical' | 'clear';

export interface UdaGapSeverityInput {
  currentMonthIndex: number;
  startMonthIndex: number;
  endMonthIndex: number;
  gapCount: number;
  formalEvidenceCount: number;
}

export function getSchoolMonthIndex(date: Date): number {
  const month = date.getMonth();
  if (month >= 8) return month - 8;
  if (month <= 5) return month + 4;
  return 10;
}

export function getUdaGapSeverity({
  currentMonthIndex,
  startMonthIndex,
  endMonthIndex,
  gapCount,
  formalEvidenceCount,
}: UdaGapSeverityInput): UdaGapSeverity {
  const hasUnresolvedEvidence = gapCount > 0 || formalEvidenceCount === 0;
  if (!hasUnresolvedEvidence) return 'clear';
  if (currentMonthIndex < startMonthIndex) return 'planning';
  if (currentMonthIndex > endMonthIndex) return 'critical';
  if (currentMonthIndex === endMonthIndex) return 'due';
  return 'watch';
}

export function getUdaRemediationCopy(severity: UdaGapSeverity): string {
  switch (severity) {
    case 'planning':
      return "Pianifica le evidenze attese e collega quelle già disponibili all'UDA.";
    case 'watch':
      return 'Monitora la copertura e collega evidenze coerenti man mano che emergono.';
    case 'due':
      return 'Completa il piano delle evidenze mancanti e collega quelle già raccolte prima della chiusura.';
    case 'critical':
      return "Rivedi le evidenze mancanti e collega quelle già disponibili all'UDA conclusa.";
    case 'clear':
      return 'Copertura delle evidenze allineata al piano UDA.';
  }
}
