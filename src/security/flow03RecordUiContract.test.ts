import { describe, expect, test } from 'bun:test';

async function source(path: string) {
  return Bun.file(path).text();
}

describe('FLOW-03 dedicated Registra UI contract', () => {
  test('renders one dedicated session-only Registra panel', async () => {
    const panel = await source('src/components/RecordLessonPanel.tsx');

    expect(panel).toContain('Oggi · Registra');
    expect(panel).toContain('Registra per {session.context.className}');
    expect(panel).toContain('Bozza temporanea — non ancora registrata');
    expect(panel).toContain('session.context.udaTitle');
    expect(panel).toContain('session.context.activityLabel');
    expect(panel).toContain('min-h-[44px]');
  });

  test('offers exactly the four authoritative evidence routes without durable writes', async () => {
    const panel = await source('src/components/RecordLessonPanel.tsx');

    expect(panel).toContain("onChooseEvidence('evaluation')");
    expect(panel).toContain("onChooseEvidence('behaviour')");
    expect(panel).toContain("onChooseEvidence('online-outcomes')");
    expect(panel).toContain("onChooseEvidence('lesson-log')");
    expect(panel).toContain('Valutazione');
    expect(panel).toContain('Comportamento');
    expect(panel).toContain('Esiti verifica online');
    expect(panel).toContain('Attività / nota UDA');
    expect(panel).not.toContain('secureStorage');
    expect(panel).not.toContain('onSave');
  });

  test('shows completion only after session status becomes saved and keeps review optional', async () => {
    const panel = await source('src/components/RecordLessonPanel.tsx');

    expect(panel).toContain("session.status === 'saved'");
    expect(panel).toContain('Registrazione completata');
    expect(panel).toContain('onReview');
    expect(panel).toContain('Rivedi');
    expect(panel).toContain('onRecordAnother');
    expect(panel).toContain('Registra altro');
  });

  test('TODAY keeps only Rivedi in the generic continuation map', async () => {
    const router = await source('src/today/todayRouter.ts');

    expect(router).toContain("export type TodayContinuationAction = Extract<TodayAction, 'review'>;");
    expect(router).not.toMatch(/CONTINUATION_OPTIONS[\s\S]*?record:\s*\[/);
    expect(router).toContain('review: [');
  });

  test('Dashboard delegates record to RecordLessonPanel instead of the generic continuation', async () => {
    const dashboard = await source('src/components/DashboardView.tsx');

    expect(dashboard).toContain("import { RecordLessonPanel } from './RecordLessonPanel';");
    expect(dashboard).toContain("todayAction === 'record' && recordSession");
    expect(dashboard).toContain('<RecordLessonPanel');
    expect(dashboard).toContain("todayAction === 'review'");
    expect(dashboard).not.toContain("todayAction && todayAction !== 'prepare' && todayAction !== 'conduct'");
  });
});
