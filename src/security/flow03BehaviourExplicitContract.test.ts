import { describe, expect, test } from 'bun:test';

async function source(path: string) {
  return Bun.file(path).text();
}

describe('FLOW-03 explicit behaviour contract', () => {
  test('offers a FLOW-03 mode that does not infer a behaviour state', async () => {
    const view = await source('src/components/BehaviorsView.tsx');

    expect(view).toContain('requireExplicitSelection?: boolean;');
    expect(view).toContain('requireExplicitSelection = false');
    expect(view).toContain("init[s.id] = match ? match.status : requireExplicitSelection ? undefined : 'Ottimale 🌟';");
    expect(view).toContain('const currentStatus = statusMap[student.id];');
    expect(view).toContain('const isSelected = currentStatus === opt.label;');
  });

  test('FLOW-03 saves only statuses explicitly chosen by the teacher', async () => {
    const view = await source('src/components/BehaviorsView.tsx');

    expect(view).toContain('const selectedStudents = requireExplicitSelection');
    expect(view).toContain('.filter(s => Boolean(statusMap[s.id]))');
    expect(view).toContain('if (requireExplicitSelection && selectedStudents.length === 0) {');
    expect(view).toContain("alert('Seleziona almeno uno stato di comportamento prima di salvare.');");
    expect(view).toContain('const newRecords: BehaviorRecord[] = selectedStudents.map(s => ({');
    expect(view).toContain("status: statusMap[s.id] || 'Ottimale 🌟'");
  });

  test('App enables explicit-only behaviour semantics only for the matching FLOW-03 session', async () => {
    const app = await source('src/App.tsx');

    expect(app).toContain("requireExplicitSelection={recordSession?.status === 'editing'");
    expect(app).toContain("&& recordSession.evidenceKind === 'behaviour'");
    expect(app).toContain('&& recordSession.context.classId === currentClass.id}');
  });
});
