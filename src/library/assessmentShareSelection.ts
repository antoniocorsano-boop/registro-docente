/**
 * INT-02/S2a: a Padlet/student simulation target is a teacher choice, not
 * the first class/test in the shared catalog. This pure resolver grants no
 * authority to store tests, import submissions or create grades.
 */
export interface AssessmentShareSelectionInput {
  className: string;
  testId: string;
  classes: readonly { id: string; name: string }[];
  tests: Readonly<Record<string, { id: string }>>;
}

export type AssessmentShareTargetResolution =
  | { status: 'needs-selection' }
  | { status: 'unavailable'; reason: 'CLASS_UNAVAILABLE' | 'TEST_UNAVAILABLE' }
  | { status: 'ready'; target: { className: string; testId: string } };

export function resolveAssessmentShareTarget({
  className, testId, classes, tests
}: AssessmentShareSelectionInput): AssessmentShareTargetResolution {
  if (!className || !testId) return { status: 'needs-selection' };

  const matchingClasses = classes.filter(item =>
    item.name === className && Boolean(item.id.trim())
  );
  if (matchingClasses.length !== 1) {
    return { status: 'unavailable', reason: 'CLASS_UNAVAILABLE' };
  }

  if (!Object.prototype.hasOwnProperty.call(tests, testId) || tests[testId]?.id !== testId) {
    return { status: 'unavailable', reason: 'TEST_UNAVAILABLE' };
  }

  return { status: 'ready', target: { className: matchingClasses[0].name, testId } };
}
