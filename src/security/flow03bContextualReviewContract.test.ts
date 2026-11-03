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

  test('captures evidence kind only for the session-only Rivedi handoff and never auto-opens a destination', async () => {
    const app = await source('src/App.tsx');
    const dashboard = await source('src/components/DashboardView.tsx');

    expect(app).toContain('const [reviewEvidenceKind, setReviewEvidenceKind] = useState<RecordEvidenceKind | null>(null);');
    expect(app).toContain('setReviewEvidenceKind(session.evidenceKind ?? null);');
    expect(app).toContain('publishRecordSession(null);');
    expect(app).toContain("setTodayAction('review');");
    expect(app).toContain('reviewEvidenceKind={reviewEvidenceKind}');

    expect(dashboard).toContain('reviewEvidenceKind?: RecordEvidenceKind | null;');
    expect(dashboard).toContain('getRecordReviewOptions(reviewEvidenceKind)');
    expect(dashboard).toContain('Prima destinazione consigliata');
    expect(dashboard).toContain('onClick={() => onContinueToday?.(option.tab)}');
  });
});
