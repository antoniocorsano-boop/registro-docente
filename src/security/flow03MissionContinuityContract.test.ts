import { describe, expect, test } from 'bun:test';

async function source(path: string) {
  return Bun.file(path).text();
}

function sectionBetween(text: string, start: string, end: string) {
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return text.slice(startIndex, endIndex);
}

describe('FLOW-03 recording mission continuity contract', () => {
  test('provides a focused mission banner with explicit return to Registra', async () => {
    const banner = await source('src/components/RecordMissionBanner.tsx');

    expect(banner).toContain('interface RecordMissionBannerProps');
    expect(banner).toContain('evidenceKind: RecordEvidenceKind');
    expect(banner).toContain('onReturn: () => void');
    expect(banner).toContain('Stai registrando ·');
    expect(banner).toContain('Torna a Registra');
    expect(banner).toContain('min-h-[44px]');
    expect(banner).not.toContain('onSave');
    expect(banner).not.toContain('secureStorage');
  });

  test('shows the mission only for the matching editing specialist route and class', async () => {
    const app = await source('src/App.tsx');

    expect(app).toContain("import { RecordMissionBanner } from './components/RecordMissionBanner';");
    expect(app).toContain('const activeRecordMission =');
    expect(app).toContain("recordSession?.status === 'editing'");
    expect(app).toContain('recordSession.context.classId === currentClass?.id');
    expect(app).toContain('routeForRecordEvidence(recordSession.evidenceKind).tab === activeTab');
    expect(app).toContain('<RecordMissionBanner');
    expect(app).toContain('evidenceKind={activeRecordMission.evidenceKind}');
    expect(app).toContain('onReturn={handleReturnToRecord}');
  });

  test('returns to dashboard without invalidating the current recording session', async () => {
    const app = await source('src/App.tsx');
    const handler = sectionBetween(app, 'const handleReturnToRecord', 'const handleUpdateRecordStagedNote');

    expect(handler).toContain("setTodayAction('record')");
    expect(handler).toContain("setActiveTab('dashboard')");
    expect(handler).not.toContain('publishRecordSession(null)');
    expect(handler).not.toContain('handleNavigateTab(');
  });
});
