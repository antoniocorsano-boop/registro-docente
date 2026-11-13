import { describe, expect, test } from 'bun:test';

async function source(path: string) {
  return Bun.file(path).text();
}

describe('FLOW-03B active recording focus contract', () => {
  test('keeps unsaved same-class Registra inside the shared mission-focus hierarchy', async () => {
    const dashboard = await source('src/components/DashboardView.tsx');

    expect(dashboard).toContain("const isActiveRecordFocus = todayAction === 'record' && recordSession !== null && recordSession.status !== 'saved' && recordSession.context.classId === currentClass.id;");
    expect(dashboard).toContain('const isActiveMissionFocus = isActiveRecordFocus || isActiveReviewFocus;');
    expect(dashboard).toContain('data-testid="flow03b-class-overview"');
    expect(dashboard).toContain('open={!isActiveMissionFocus}');
    expect(dashboard).toContain('Panoramica Sezione: {currentClass.name}');
  });

  test('uses inline Copilota during choose/editing and restores the ambient trigger after save', async () => {
    const app = await source('src/App.tsx');
    const panel = await source('src/components/RecordLessonPanel.tsx');
    const banner = await source('src/components/RecordMissionBanner.tsx');
    const dashboard = await source('src/components/DashboardView.tsx');

    expect(app).toContain("const isActiveRecordFocus = todayAction === 'record' && recordSession !== null && recordSession.status !== 'saved' && recordSession.context.classId === currentClass?.id;");
    expect(app).toContain("showClosedTrigger={todayAction !== 'conduct' && !isActiveRecordFocus && activeTab !== 'report'}");
    expect(app).toContain('onOpenRecordCopilot={reopenLibraryCopilot}');
    expect(app).toContain('onOpenCopilot={reopenLibraryCopilot}');

    expect(dashboard).toContain('onOpenRecordCopilot?: () => void;');
    expect(dashboard).toContain('onOpenCopilot={() => onOpenRecordCopilot?.()}');

    expect(panel).toContain('onOpenCopilot: () => void;');
    expect(panel).toContain("session.status !== 'saved' && (");
    expect(panel).toContain('onClick={onOpenCopilot}');
    expect(panel).toContain('Copilota');
    expect(panel).toContain('min-h-[44px]');

    expect(banner).toContain('onOpenCopilot: () => void;');
    expect(banner).toContain('onClick={onOpenCopilot}');
    expect(banner).toContain('Copilota');
    expect(banner).toContain('Torna a Registra');
  });
});
