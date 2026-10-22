import { describe, expect, test } from 'bun:test';

function sectionBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe('PERSIST-01 durable UDA success sequencing', () => {
  test('App exposes the durable UDA save promise instead of swallowing it', async () => {
    const source = await Bun.file('src/App.tsx').text();
    const section = sectionBetween(source, '// Save UDAs', '// Save Settings');

    expect(section).toContain('const handleSaveUdas = (newUdas: UdaRecord[]): Promise<void> =>');
    expect(section).toContain('return commitUdasMutation(mutation).then(() => undefined);');
    expect(section).not.toContain('void commitUdasMutation');
  });

  test('UdaGanttView has one asynchronous persistence boundary', async () => {
    const source = await Bun.file('src/components/UdaGanttView.tsx').text();

    expect(source).toContain('onSaveUdas: (udas: UdaRecord[]) => Promise<void>;');
    expect(source).toContain('const commitUdaViewMutation = async');
    expect(source).toContain('await onSaveUdas(nextUdas);');
    expect(source).toContain('afterCommit?.();');
    expect((source.match(/onSaveUdas\(/g) || []).length).toBe(1);
  });

  test('new UDA form clears and closes only in the post-commit callback', async () => {
    const source = await Bun.file('src/components/UdaGanttView.tsx').text();
    const section = sectionBetween(source, '// Add new UDA', 'const handleDelete');
    const commitIndex = section.indexOf('commitUdaViewMutation');

    expect(commitIndex).toBeGreaterThanOrEqual(0);
    expect(section.indexOf("setNewTitle('')")).toBeGreaterThan(commitIndex);
    expect(section.indexOf('setIsModalOpen(false)')).toBeGreaterThan(commitIndex);
    expect(section.indexOf('creata con successo')).toBeGreaterThan(commitIndex);
  });

  test('destructive/detail UDA actions route success-only UI through the durable boundary', async () => {
    const source = await Bun.file('src/components/UdaGanttView.tsx').text();
    const deleteSection = sectionBetween(source, 'const handleDelete', '// Add lesson to current UDA');
    const addLessonSection = sectionBetween(source, '// Add lesson to current UDA', '// Remove lesson from UDA');

    expect(deleteSection).toContain('commitUdaViewMutation');
    expect(deleteSection).toContain("showStatus('UDA eliminata')");
    expect(addLessonSection).toContain('commitUdaViewMutation');
    expect(addLessonSection).toContain("showStatus('Attività registrata nel diario')");
  });
});
