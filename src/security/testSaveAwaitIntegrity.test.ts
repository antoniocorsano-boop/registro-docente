import { describe, expect, test } from 'bun:test';

function sectionBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe('PERSIST-01 durable test-save success sequencing', () => {
  test('test-save callback exposes a durable promise through App and VerificheOnlineView', async () => {
    const appSource = await Bun.file('src/App.tsx').text();
    const viewSource = await Bun.file('src/components/VerificheOnlineView.tsx').text();
    const appSave = sectionBetween(appSource, '// Save new test', '// Delete submission');

    expect(viewSource).toContain('onSaveNewTest: (test: OnlineTest) => Promise<void>;');
    expect(appSave).toContain('return commitTestsMutation');
    expect(appSave).not.toContain('void commitTestsMutation');
  });

  test('interactive editor publishes success only after durable persistence', async () => {
    const source = await Bun.file('src/components/VerificheOnlineView.tsx').text();
    const section = sectionBetween(source, 'const handleSaveInteractiveTest', 'const handleEditExistingTest');
    const awaitIndex = section.indexOf('await onSaveNewTest(newTest)');

    expect(section).toContain('const handleSaveInteractiveTest = async');
    expect(awaitIndex).toBeGreaterThanOrEqual(0);
    expect(section.indexOf('setSelectedTestId(testId)')).toBeGreaterThan(awaitIndex);
    expect(section.indexOf('setIsEditingTest(false)')).toBeGreaterThan(awaitIndex);
    expect(section.indexOf('salvato con successo')).toBeGreaterThan(awaitIndex);
  });

  test('file import publishes selection and success only after durable persistence', async () => {
    const source = await Bun.file('src/components/VerificheOnlineView.tsx').text();
    const section = sectionBetween(source, 'const handleFileUpload', 'const handleSaveManualTest');
    const awaitIndex = section.indexOf('await onSaveNewTest(newTest)');

    expect(awaitIndex).toBeGreaterThanOrEqual(0);
    expect(section.indexOf('setSelectedTestId(testId)')).toBeGreaterThan(awaitIndex);
    expect(section.indexOf('Successo! Creato il test')).toBeGreaterThan(awaitIndex);
  });

  test('manual editor clears form and reports success only after durable persistence', async () => {
    const source = await Bun.file('src/components/VerificheOnlineView.tsx').text();
    const section = sectionBetween(source, 'const handleSaveManualTest', 'const copyPadletLink');
    const awaitIndex = section.indexOf('await onSaveNewTest(newTest)');

    expect(section).toContain('const handleSaveManualTest = async');
    expect(awaitIndex).toBeGreaterThanOrEqual(0);
    expect(section.indexOf('setSelectedTestId(testId)')).toBeGreaterThan(awaitIndex);
    expect(section.indexOf("setManualTitle('')")).toBeGreaterThan(awaitIndex);
    expect(section.indexOf('creato con')).toBeGreaterThan(awaitIndex);
  });
});
