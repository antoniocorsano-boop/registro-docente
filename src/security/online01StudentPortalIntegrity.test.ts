import { describe, expect, test } from 'bun:test';

const portalSource = await Bun.file('src/components/StudentPortal.tsx').text();
const appSource = await Bun.file('src/App.tsx').text();

function sourceSection(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe('ONLINE-01 StudentPortal class integrity', () => {
  test('class choices come only from current register classes', () => {
    expect(portalSource).toContain('classNames: string[];');
    expect(portalSource).toContain('classNames.includes(defaultClassName)');
    expect(portalSource).toContain("classNames[0] || ''");
    expect(portalSource).toContain('classNames.map(className =>');

    expect(portalSource).not.toContain('<option value="3ª A">');
    expect(portalSource).not.toContain('<option value="3ª B">');
    expect(portalSource).not.toContain('<option value="3ª C">');
    expect(portalSource).not.toContain('<option value="3ª D">');
    expect(portalSource).not.toContain('<option value="1ª A">');
    expect(portalSource).not.toContain('<option value="2ª A">');

    const wiring = sourceSection(appSource, '<StudentPortal', '/>');
    expect(wiring).toContain('classNames={appData.classes.map(c => c.name)}');
  });

  test('an empty register cannot start a quiz under a fabricated class', () => {
    expect(portalSource).toContain('if (!selectedClass)');
    expect(portalSource).toContain('Nessuna classe disponibile');
    expect(portalSource).toContain('disabled={!selectedClass}');
  });
});

describe('ONLINE-01 durable submission result boundary', () => {
  test('final submit is non-reentrant and success waits for durable persistence', () => {
    expect(portalSource).toContain("import React, { useRef, useState } from 'react';");
    expect(portalSource).toContain('const submissionPendingRef = useRef(false);');
    expect(portalSource).toContain('const pendingSubmissionRef = useRef<OnlineSubmission | null>(null);');
    expect(portalSource).toContain('const [isSubmitting, setIsSubmitting] = useState(false);');

    const finalFlow = sourceSection(portalSource, 'const handleNext = async () =>', 'const currentQ =');
    expect(finalFlow).toContain('if (submissionPendingRef.current) return;');
    expect(finalFlow).toContain('await onSaveSubmission(submission);');
    expect(finalFlow).not.toContain('void onSaveSubmission');

    const awaitIndex = finalFlow.indexOf('await onSaveSubmission(submission);');
    const resultIndex = finalFlow.indexOf("setStep('result');");
    const confettiIndex = finalFlow.indexOf('confetti({');
    expect(awaitIndex).toBeGreaterThanOrEqual(0);
    expect(resultIndex).toBeGreaterThan(awaitIndex);
    expect(confettiIndex).toBeGreaterThan(resultIndex);
  });

  test('failure preserves retry state and the same submission identity until success', () => {
    const finalFlow = sourceSection(portalSource, 'const handleNext = async () =>', 'const currentQ =');

    expect(finalFlow).toContain('pendingSubmissionRef.current ??');
    expect(finalFlow).toContain('pendingSubmissionRef.current = submission;');
    expect(finalFlow).toContain("setSubmissionError('Consegna non salvata. Riprova o avvisa il docente.');");
    expect(finalFlow).toContain('pendingSubmissionRef.current = null;');
    expect(finalFlow).toContain('finally');
    expect(finalFlow).toContain('submissionPendingRef.current = false;');
    expect(finalFlow).toContain('setIsSubmitting(false);');

    const catchIndex = finalFlow.indexOf('catch');
    const resultIndex = finalFlow.indexOf("setStep('result');");
    expect(resultIndex).toBeGreaterThanOrEqual(0);
    expect(catchIndex).toBeGreaterThan(resultIndex);

    expect(portalSource).toContain('const [submissionError, setSubmissionError] = useState<string | null>(null);');
    expect(portalSource).toContain('{submissionError && (');
    expect(portalSource).toContain('pendingSubmissionRef.current = null;');

    const startQuiz = sourceSection(portalSource, 'const startQuiz = () =>', 'const handleSelectOption');
    expect(startQuiz).toContain('pendingSubmissionRef.current = null;');
    expect(startQuiz).toContain('setSubmissionError(null);');
  });

  test('final submit control exposes pending state and cannot be clicked again', () => {
    expect(portalSource).toContain('disabled={isSubmitting}');
    expect(portalSource).toContain("isSubmitting ? 'Salvataggio...' :");
  });
});
