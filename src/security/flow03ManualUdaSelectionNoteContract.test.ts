import { expect, test } from 'bun:test';

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

test('manual same-class UDA selection receives the pending FLOW-03 lesson draft exactly once', async () => {
  const uda = await source('src/components/UdaGanttView.tsx');
  const handoff = sectionBetween(
    uda,
    'useEffect(() => {\n    if (!recordLessonPrefill) return;',
    '// Months full Italian naming'
  );

  expect(handoff).toContain('pendingRecordLessonFocusRef.current = !recordLessonPrefill.udaId;');
  expect(handoff).toContain('selectedUdaForDetail.className !== recordLessonPrefill.className');
  expect(handoff).toContain('recordLessonPrefill.udaId && selectedUdaForDetail.id !== recordLessonPrefill.udaId');
  expect(handoff).toContain('if (!recordLessonPrefill.udaId) {');
  expect(handoff).toContain('setNewLessonDate(recordLessonPrefill.date);');
  expect(handoff).toContain("setNewLessonTopic(recordLessonPrefill.topic?.trim() || '');");
  expect(handoff).toContain("setNewLessonNotes(recordLessonPrefill.notes?.trim() || '');");

  const pendingAssignment = handoff.indexOf('pendingRecordLessonFocusRef.current = !recordLessonPrefill.udaId;');
  const explicitSelectionApplication = handoff.lastIndexOf('if (!recordLessonPrefill.udaId) {');
  expect(pendingAssignment).toBeLessThan(explicitSelectionApplication);
});
