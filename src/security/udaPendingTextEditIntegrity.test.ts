import { describe, expect, test } from 'bun:test';

function sectionBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe('PERSIST-01H UDA pending text-edit integrity', () => {
  test('text edits queue behind pending persistence while destructive UDA actions keep the reentrancy guard', async () => {
    const source = await Bun.file('src/components/UdaGanttView.tsx').text();
    const boundary = sectionBetween(source, '// Quick toast message inside UdaGanttView', '// Embedding configuration');
    const fieldUpdate = sectionBetween(source, '// Save changes to detailed UDA dossier', '// Update rubric level');
    const rubricUpdate = sectionBetween(source, '// Update rubric level', '// Filtered and Semantically Ranked UDAs');

    expect(boundary).toContain('udaTextMutationTailRef');
    expect(boundary).toContain('udaTextMutationDepthRef');
    expect(boundary).toContain('queueUdaTextMutation');
    expect(boundary).toContain('if (udaMutationPendingRef.current) return false;');
    expect(boundary).toContain('udaTextMutationDepthRef.current === 0');

    expect(fieldUpdate).toContain('queueUdaTextMutation(nextUdas);');
    expect(fieldUpdate).not.toContain('commitUdaViewMutation(nextUdas);');
    expect(rubricUpdate).toContain('queueUdaTextMutation(nextUdas);');
    expect(rubricUpdate).not.toContain('commitUdaViewMutation(nextUdas);');
  });
});
