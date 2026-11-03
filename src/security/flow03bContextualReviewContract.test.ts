import { describe, expect, test } from 'bun:test';

async function source(path: string) {
  return Bun.file(path).text();
}

describe('FLOW-03B contextual Rivedi contract', () => {
  test('orders existing review destinations from the evidence just recorded', async () => {
    const routingModule = await import('../recording/reviewRouting').catch(() => null);
    expect(routingModule).not.toBeNull();
    if (!routingModule) return;

    const { getRecordReviewOptions } = routingModule;
    const labels = (kind: any) => getRecordReviewOptions(kind).map((option: any) => option.label);

    expect(labels('evaluation')).toEqual(['Tabellone', 'Analisi', 'Storico', 'Scheda alunno']);
    expect(labels('online-outcomes')).toEqual(['Tabellone', 'Storico', 'Analisi', 'Scheda alunno']);
    expect(labels('behaviour')).toEqual(['Scheda alunno', 'Comportamento', 'Analisi', 'Tabellone']);
    expect(labels('lesson-log')).toEqual(['UDA e diario', 'Tabellone', 'Analisi', 'Storico']);
    expect(labels(null)).toEqual(['Tabellone', 'Analisi', 'Storico', 'Scheda alunno']);
  });

  test('carries evidence kind into the session-only ReviewSession handoff and never auto-opens a destination', async () => {
    const app = await source('src/App.tsx');
    const dashboard = await source('src/components/DashboardView.tsx');
    const panel = await source('src/components/ReviewRouterPanel.tsx');

    expect(app).toContain('const [reviewSession, setReviewSession] = useState<ReviewSessionContext | null>(null);');
    expect(app).toContain("origin: 'post-record'");
    expect(app).toContain('evidenceKind: session.evidenceKind ?? null');
    expect(app).toContain('publishRecordSession(null);');
    expect(app).toContain("setTodayAction('review');");
    expect(app).toContain('reviewSession={reviewSession}');
    expect(app).not.toContain('reviewEvidenceKind={reviewSession?.evidenceKind ?? null}');

    expect(dashboard).toContain('reviewSession?: ReviewSessionContext | null;');
    expect(dashboard).toContain('<ReviewRouterPanel');
    expect(panel).toContain('getRecordReviewOptions(session.evidenceKind)');
    expect(panel).toContain("session.origin === 'post-record' && session.evidenceKind");
    expect(panel).toContain('const surface = option.tab;');
    expect(panel).toContain('onNavigateSurface(surface)');
    expect(panel).not.toContain('onNavigateSurface(options[0].tab)');
  });

  test('invalidates contextual review state when the teacher switches class', async () => {
    const app = await source('src/App.tsx');
    const selectClassStart = app.indexOf('const handleSelectClass = (classId: string) => {');
    expect(selectClassStart).toBeGreaterThanOrEqual(0);
    const selectClassEnd = app.indexOf('\n  };', selectClassStart);
    expect(selectClassEnd).toBeGreaterThan(selectClassStart);
    const selectClassBlock = app.slice(selectClassStart, selectClassEnd);

    expect(selectClassBlock).toContain('publishReviewSession(null);');
    expect(selectClassBlock).toContain('reviewSessionRef.current === null');
  });
});
