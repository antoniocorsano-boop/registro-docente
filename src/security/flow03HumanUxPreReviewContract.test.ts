import { describe, expect, test } from 'bun:test';

async function source(path: string) {
  return Bun.file(path).text();
}

describe('FLOW-03 Human Product/UX pre-review contract', () => {
  test('does not repeat the same UDA context twice in Registra', async () => {
    const panel = await source('src/components/RecordLessonPanel.tsx');

    expect(panel).toContain('const udaTitle = session.context.udaTitle?.trim();');
    expect(panel).toContain('const activityLabel = session.context.activityLabel?.trim();');
    expect(panel).toContain('activityLabel !== udaTitle');
    expect(panel).toContain('secondaryActivityLabel');
  });

  test('brings the authoritative UDA lesson form into the viewport after a safe FLOW-03 handoff', async () => {
    const uda = await source('src/components/UdaGanttView.tsx');

    expect(uda).toContain('recordLessonFormRef');
    expect(uda).toContain('scrollIntoView');
    expect(uda).toContain("block: 'center'");
    expect(uda).toContain('preventScroll: true');
    expect(uda).toContain('ref={recordLessonFormRef}');
  });
});
