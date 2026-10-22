import { describe, expect, test } from 'bun:test';

const viewSource = await Bun.file('src/components/VerificheOnlineView.tsx').text();
const appSource = await Bun.file('src/App.tsx').text();

function sectionBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

function expectPersistenceBeforeSuccess(section: string, successMarker: string): void {
  const awaitIndex = section.indexOf('await commitTestSave(newTest)');
  const successIndex = section.indexOf(successMarker);
  expect(awaitIndex).toBeGreaterThanOrEqual(0);
  expect(successIndex).toBeGreaterThan(awaitIndex);
}

describe('PERSIST-01 online test editor persistence integrity', () => {
  test('the save callback contract is asynchronous end-to-end', () => {
    expect(viewSource).toContain('onSaveNewTest: (test: OnlineTest) => Promise<void>;');
    expect(viewSource).toContain('const commitTestSave = async (test: OnlineTest): Promise<boolean> =>');
    expect(viewSource).toContain('await onSaveNewTest(test);');
    expect(appSource).toContain('const handleSaveNewTest = (newTest: OnlineTest): Promise<void> =>');
    const appHandler = sectionBetween(appSource, '// Save new test', '// Delete submission');
    expect(appHandler).toContain('return commitTestsMutation');
    expect(appHandler).toContain('.then(() => undefined)');
    expect(appHandler).not.toContain('.catch(() => undefined)');
  });

  test('interactive editor waits for durable persistence before closing or reporting success', () => {
    const section = sectionBetween(viewSource, '// Save interactive test', '// Parse questions from DOCX/ZIP text');
    expect(section).toContain('const handleSaveInteractiveTest = async');
    expectPersistenceBeforeSuccess(section, 'setSelectedTestId(testId)');
    expectPersistenceBeforeSuccess(section, 'setIsEditingTest(false)');
    expectPersistenceBeforeSuccess(section, 'salvato con successo!');
  });

  test('file import waits for durable persistence before selection and success alert', () => {
    const section = sectionBetween(viewSource, 'const handleFileUpload = async', 'const handleSaveManualTest');
    expectPersistenceBeforeSuccess(section, 'setSelectedTestId(testId)');
    expectPersistenceBeforeSuccess(section, 'Successo! Creato il test');
    expect(section).toContain('if (!(await commitTestSave(newTest))) return;');
  });

  test('manual editor waits for durable persistence before clearing inputs or reporting success', () => {
    const section = sectionBetween(viewSource, 'const handleSaveManualTest', 'const copyPadletLink');
    expect(section).toContain('const handleSaveManualTest = async');
    expectPersistenceBeforeSuccess(section, 'setSelectedTestId(testId)');
    expectPersistenceBeforeSuccess(section, "setManualTitle('')");
    expectPersistenceBeforeSuccess(section, "setManualRawText('')");
    expectPersistenceBeforeSuccess(section, 'creato con');
  });
});
