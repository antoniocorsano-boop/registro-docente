import { describe, expect, test } from 'bun:test';

async function source(path: string) {
  return Bun.file(path).text();
}

describe('FLOW-04 review mission UI contract', () => {
  test('uses a dedicated ReviewRouterPanel as an orchestrator, not a new analytic dashboard', async () => {
    expect(await Bun.file('src/components/ReviewRouterPanel.tsx').exists()).toBe(true);
    const panel = await source('src/components/ReviewRouterPanel.tsx');

    expect(panel).toContain("import { getRecordReviewOptions } from '../recording/reviewRouting';");
    expect(panel).toContain('getRecordReviewOptions(session.evidenceKind)');
    expect(panel).toContain('Che cosa vuoi controllare o approfondire?');
    expect(panel).toContain('Sintesi matematica delle valutazioni registrate.');
    expect(panel).toContain("Indicatori e trend per leggere l'andamento.");
    expect(panel).toContain('Traccia delle registrazioni e delle correzioni.');
    expect(panel).toContain('Dossier individuale delle evidenze disponibili.');
    expect(panel).toContain('Progressione didattica e diario della classe.');
    expect(panel).toContain('Evidenze comportamentali registrate.');
    expect(panel).toContain("session.origin === 'post-record' && session.evidenceKind");
    expect(panel).toContain('isReviewSurface(option.tab)');
    expect(panel).toContain('onNavigateSurface(option.tab)');
    expect(panel).toContain('min-h-[44px]');
    expect(panel).not.toMatch(/assegna voto|promuovi|boccia|devi correggere|correggi automaticamente/i);
  });

  test('uses a small mission banner inside review surfaces without KPI or recommendations', async () => {
    expect(await Bun.file('src/components/ReviewMissionBanner.tsx').exists()).toBe(true);
    const banner = await source('src/components/ReviewMissionBanner.tsx');

    expect(banner).toContain('Rivedi ·');
    expect(banner).toContain('Torna a Rivedi');
    expect(banner).toContain('Chiudi');
    expect(banner).toContain('min-h-[44px]');
    expect(banner).not.toMatch(/media sezione|tasso sufficienze|voti registrati|raccomand|consiglia/i);
  });

  test('replaces the inline review router and subordinates the class overview during an active review', async () => {
    const dashboard = await source('src/components/DashboardView.tsx');

    expect(dashboard).toContain("import { ReviewRouterPanel } from './ReviewRouterPanel';");
    expect(dashboard).toContain("import type { ReviewSessionContext, ReviewSurface } from '../review/reviewSession';");
    expect(dashboard).toContain('reviewSession?: ReviewSessionContext | null;');
    expect(dashboard).toContain('onOpenReviewSurface?: (surface: ReviewSurface) => void;');
    expect(dashboard).toContain('onCloseReview?: () => void;');
    expect(dashboard).toContain('<ReviewRouterPanel');
    expect(dashboard).toContain('session={reviewSession}');
    expect(dashboard).toContain('const isActiveReviewFocus =');
    expect(dashboard).toContain('const isActiveMissionFocus = isActiveRecordFocus || isActiveReviewFocus;');
    expect(dashboard).toContain("todayAction === 'review' && reviewSession?.classId === currentClass.id");
    expect(dashboard).toContain("open={!isActiveMissionFocus}");
    expect(dashboard).not.toContain('Scegli una superficie già esistente');
    expect(dashboard).not.toContain('Prima destinazione consigliata');
  });

  test('mounts the review banner once above specialist views and wires dedicated review handlers', async () => {
    const app = await source('src/App.tsx');

    expect(app).toContain("import { ReviewMissionBanner } from './components/ReviewMissionBanner';");
    expect(app).toContain('<ReviewMissionBanner');
    expect(app).toContain('reviewSession={reviewSession}');
    expect(app).toContain('onOpenReviewSurface={handleOpenReviewSurface}');
    expect(app).toContain('onCloseReview={handleCloseReview}');
    expect(app).toContain('onReturn={handleReturnToReview}');
    expect(app).toContain('onDismiss={handleCloseReview}');
    expect(app).toContain('reviewSession.classId === currentClass.id');
    expect(app).toContain('isReviewSurface(activeTab)');
    expect(app).toContain('reviewSession.currentSurface === activeTab');
  });
});
