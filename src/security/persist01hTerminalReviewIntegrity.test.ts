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
    const startEditor = sectionBetween(bacheca, 'onClick={handleStartNewInteractiveTest}', '</button>');
    expect(startEditor).toContain('disabled={isParsingFile || isSavingTest}');
  });
});
