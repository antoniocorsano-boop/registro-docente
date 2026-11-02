import { describe, expect, test } from 'bun:test';

async function source(path: string) {
  return Bun.file(path).text();
}

describe('FLOW-03 explicit handoff from Conduci', () => {
  test('passes the rapid note only when the teacher explicitly chooses Vai a Registra', async () => {
    const panel = await source('src/components/ConductLessonPanel.tsx');

    expect(panel).toContain('onGoToRecord: (stagedNote?: string) => void;');
    expect(panel).toContain('onClick={() => onGoToRecord(rapidNote.trim() || undefined)}');
    expect(panel).toContain('Temporanea — non ancora registrata');
  });

  test('keeps the rapid note session-only inside Conduci', async () => {
    const panel = await source('src/components/ConductLessonPanel.tsx');

    expect(panel).toContain("const [rapidNote, setRapidNote] = useState('');");
    expect(panel).not.toContain('secureStorage');
    expect(panel).not.toContain('localStorage');
    expect(panel).not.toContain('sessionStorage');
    expect(panel).not.toContain('onSaveRapidNote');
  });

  test('Dashboard forwards the optional staged note without changing class-key remount semantics', async () => {
    const dashboard = await source('src/components/DashboardView.tsx');

    expect(dashboard).toContain('onGoToRecord?: (stagedNote?: string) => void;');
    expect(dashboard).toContain('key={currentClass.id}');
    expect(dashboard).toContain('onGoToRecord={(stagedNote) => onGoToRecord?.(stagedNote)}');
  });
});
