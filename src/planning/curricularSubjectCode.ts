/**
 * Resolves the professional settings label to the curriculum subject code.
 *
 * The settings label remains untouched and is intended for display. A mapping
 * must be explicit: unknown disciplines are not silently reassigned to
 * Tecnologia (nor are their hours granted by assumption).
 */
export function resolveCurricularSubjectCode(displayLabel: string): string {
  const normalized = displayLabel.trim().replace(/\s+/g, ' ').toLocaleLowerCase('it');

  // Existing Registro default: the label includes its practical drawing work,
  // but the DPR 89/2009 allocation uses the single subject 'tecnologia'.
  if (normalized === 'tecnologia & disegno tecnico') return 'tecnologia';

  return normalized;
}
