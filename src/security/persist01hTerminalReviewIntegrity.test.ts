import { describe, expect, test } from 'bun:test';

async function source(path: string) {
  return Bun.file(path).text();
}

function sectionBetween(text: string, start: string, end: string): string {
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`Missing source delimiters: ${start} -> ${end}`);
  }
  return text.slice(startIndex, endIndex);
}

describe('PERSIST-01H terminal review intent integrity', () => {
  test('lesson success rebases onto the latest visible UDA modal state instead of restoring a stale snapshot', async () => {
    const text = await source('src/components/UdaGanttView.tsx');
    const addLesson = sectionBetween(text, '// Add lesson to current UDA', '// Remove lesson from UDA');

    expect(addLesson).toContain('setSelectedUdaForDetail(current =>');
    expect(addLesson).toContain("current?.id === updatedUda.id");
    expect(addLesson).toContain("lessons: [...(current.lessons || []), newLesson]");
    expect(addLesson).not.toContain('setSelectedUdaForDetail(updatedUda);');
  });

  test('file parsing freezes test-creation navigation until the parsed test can claim the durable save boundary', async () => {
    const text = await source('src/components/VerificheOnlineView.tsx');
    const tabs = sectionBetween(text, '{/* Tab pills */}', '{/* ============================================================== */}\n      {/* SUB-TAB 1: BACHECA & CONDIVISIONE PADLET */}');
    const bacheca = sectionBetween(text, '{/* SUB-TAB 1: BACHECA & CONDIVISIONE PADLET */}', '{/* SUB-TAB 2: EDITOR VISUALE TEST & COLLEGAMENTO UDA */}');

    expect(tabs.match(/disabled=\{isSavingTest \|\| isParsingFile\}/g)?.length ?? 0).toBe(4);
    expect(bacheca).toContain('disabled={isParsingFile || isSavingTest}\n                onClick={handleStartNewInteractiveTest}');
  });

  test('lesson removal rebases onto the latest visible UDA modal state instead of restoring a stale snapshot', async () => {
    const text = await source('src/components/UdaGanttView.tsx');
    const removeLesson = sectionBetween(text, '// Remove lesson from UDA', '// Save changes to detailed UDA dossier');

    expect(removeLesson).toContain('setSelectedUdaForDetail(current =>');
    expect(removeLesson).toContain("current?.id === updatedUda.id");
    expect(removeLesson).toContain("lessons: (current.lessons || []).filter(l => l.id !== lessonId)");
    expect(removeLesson).not.toContain('setSelectedUdaForDetail(updatedUda);');
  });

  test('dependency updates rebase modal dependency and date fields onto the latest visible UDA state', async () => {
    const text = await source('src/components/UdaGanttView.tsx');
    const dependency = sectionBetween(text, '// Toggle dependency on an UDA', '// Add new UDA');

    expect(dependency).not.toContain('setSelectedUdaForDetail(updatedUda);');
    expect(dependency).not.toContain('setSelectedUdaForDetail(alignedUda);');
    expect(dependency.match(/setSelectedUdaForDetail\(current =>/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  test('spreadsheet import clears the file input after a failed durable save so the same file can be selected again', async () => {
    const text = await source('src/components/StudentsManagementView.tsx');
    const importHandler = sectionBetween(text, 'const handleExcelImport', '  return (');
    const outerFinallyIndex = importHandler.lastIndexOf('} finally {');
    const resetIndex = importHandler.lastIndexOf("e.target.value = '';");

    expect(outerFinallyIndex).toBeGreaterThan(-1);
    expect(resetIndex).toBeGreaterThan(outerFinallyIndex);
  });

  test('spreadsheet parsing excludes add, invert, and delete student mutations until import settles', async () => {
    const text = await source('src/components/StudentsManagementView.tsx');

    expect(text).toContain('if (isImporting || isStudentMutationPending || !newStudentName.trim()) return;');
    expect(text.match(/if \(isImporting \|\| isStudentMutationPending\) return;/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(text.match(/disabled=\{isImporting \|\| isStudentMutationPending\}/g)?.length ?? 0).toBeGreaterThanOrEqual(5);
  });

  test('AI results patch only generated description onto the current visible UDA state', async () => {
    const text = await source('src/components/UdaGanttView.tsx');
    const ai = sectionBetween(text, 'const handleGenerateUdaDescription = async', '// Synchronize master class filter');

    expect(ai).toContain('setSelectedUdaForDetail(current =>');
    expect(ai).toContain('setGanttSelectedUda(current =>');
    expect(ai).not.toContain('setSelectedUdaForDetail(updatedUda as UdaRecord);');
    expect(ai).not.toContain('setGanttSelectedUda(updatedUda as UdaRecord);');
  });

  test('queued dependency callbacks apply their delta to current modal dependencies instead of captured nextDeps', async () => {
    const text = await source('src/components/UdaGanttView.tsx');
    const dependency = sectionBetween(text, '// Toggle dependency on an UDA', '// Add new UDA');
    const callbacks = [...dependency.matchAll(/setSelectedUdaForDetail\(current =>([\s\S]*?)\n\s*\);/g)].map(match => match[1]);

    expect(callbacks.length).toBe(3);
    callbacks.forEach(callback => {
      expect(callback).toContain('current.dependencies');
      expect(callback).not.toContain('dependencies: nextDeps');
    });
  });

  test('date and cascade success callbacks patch current modal state instead of restoring captured UDA snapshots', async () => {
    const text = await source('src/components/UdaGanttView.tsx');
    const dates = sectionBetween(text, '// Request a date or duration change', '// Automatic level / align all conflicts in 1 click');

    expect(dates).not.toContain('setSelectedUdaForDetail(updatedParent);');
    expect(dates).not.toContain('setSelectedUdaForDetail({ ...selectedUdaForDetail, ...upd });');
    expect(dates.match(/setSelectedUdaForDetail\(current =>/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  test('DOCX and ZIP import clears the file input after a failed durable save so the same file can be selected again', async () => {
    const text = await source('src/components/VerificheOnlineView.tsx');
    const importHandler = sectionBetween(text, 'const handleFileUpload', '  const handleSaveManualTest');
    const outerFinallyIndex = importHandler.lastIndexOf('} finally {');
    const resetIndex = importHandler.lastIndexOf("e.target.value = '';");

    expect(outerFinallyIndex).toBeGreaterThan(-1);
    expect(resetIndex).toBeGreaterThan(outerFinallyIndex);
  });

  test('queued dependency additions revalidate cycles against the latest committed UDA snapshot before persistence', async () => {
    const text = await source('src/components/UdaGanttView.tsx');
    const commit = sectionBetween(text, 'const commitUdaViewMutation = async', '  const handleRequestDateChange');
    const dependency = sectionBetween(text, '// Toggle dependency on an UDA', '// Add new UDA');

    expect(commit).toContain('validateAtExecution?: (currentUdas: UdaRecord[]) => boolean');
    expect(commit).toContain('if (validateAtExecution && !validateAtExecution(udaCommittedSnapshotRef.current))');
    expect(dependency).toContain('const validateDependencyAtExecution = (currentUdas: UdaRecord[]) =>');
    expect(dependency.match(/validateDependencyAtExecution\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  test('bulk student import deduplicates against the latest committed class roster when queued work executes', async () => {
    const text = await source('src/App.tsx');
    const bulk = sectionBetween(text, '// Bulk add students from Excel', '// Invert student names');

    expect(bulk).toContain('const existingNames = new Set(targetClass.students.map(student => student.name.toLowerCase()));');
    expect(bulk).toContain('const appendableStudents = newStudents.filter(student => {');
    expect(bulk).toContain('if (existingNames.has(normalizedName)) return false;');
    expect(bulk).toContain('students: sortStudents([...targetClass.students, ...appendableStudents])');
  });

  test('Bacheca existing-test editor entry is blocked while file parsing owns the save boundary', async () => {
    const text = await source('src/components/VerificheOnlineView.tsx');
    const bacheca = sectionBetween(text, '{/* SUB-TAB 1: BACHECA & CONDIVISIONE PADLET */}', '{/* SUB-TAB 2: EDITOR VISUALE TEST & COLLEGAMENTO UDA */}');
    const marker = 'onClick={() => handleEditExistingTest(currentSelectedTest)}';
    const markerIndex = bacheca.indexOf(marker);
    expect(markerIndex).toBeGreaterThan(-1);
    const buttonWindow = bacheca.slice(Math.max(0, markerIndex - 220), markerIndex + marker.length + 220);
    expect(buttonWindow).toContain('disabled={isParsingFile || isSavingTest}');
  });

});
