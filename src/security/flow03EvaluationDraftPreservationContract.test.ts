import { describe, expect, test } from 'bun:test';

async function source(path: string) {
  return Bun.file(path).text();
}

function sectionBetween(text: string, start: string, end: string) {
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return text.slice(startIndex, endIndex);
}

describe('FLOW-03 evaluation draft preservation contract', () => {
  test('initializes evaluation prefill once per stable evaluation context instead of resetting on unrelated UDA collection changes', async () => {
    const evaluations = await source('src/components/EvaluationsView.tsx');
    const initialization = sectionBetween(evaluations, 'useEffect(() => {', 'const handleInputChange');

    expect(evaluations).toContain("import React, { useState, useEffect, useRef } from 'react';");
    expect(evaluations).toContain('const evaluationInitializationSignatureRef = useRef<string | null>(null);');
    expect(initialization).toContain('const safeInitialUdaId =');
    expect(initialization).toContain('const signature = JSON.stringify([');
    expect(initialization).toContain('currentClass.id');
    expect(initialization).toContain('editingBatchId');
    expect(initialization).toContain('safeInitialUdaId');
    expect(initialization).toContain('isIsoDate(initialDate) ? initialDate : null');
    expect(initialization).toContain('if (evaluationInitializationSignatureRef.current === signature) return;');
    expect(initialization).toContain('evaluationInitializationSignatureRef.current = signature;');
    expect(initialization.indexOf('if (evaluationInitializationSignatureRef.current === signature) return;')).toBeLessThan(
      initialization.indexOf("setTitle('');")
    );
  });
});
