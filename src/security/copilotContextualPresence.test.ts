import { describe, expect, test } from 'bun:test';
import { shouldOfferAmbientCopilot } from '../copilot/contextualPresence';
import type { ActiveTab } from '../types';

const base = { hasClass: true, drawerOpen: false, assessmentEditorFocused: false, conductActive: false, recordingActive: false };
describe('COPILOT-PRESENCE-01 — presentation is not authority', () => {
  test('only supported professional workspaces expose the general entry', () => {
    const allowed: ActiveTab[] = ['home','dashboard','biblioteca','uda-gantt','programmazione','verifiche-online'];
    const excluded: ActiveTab[] = ['voti','comportamenti','analytics','tabellone','consigli','storico','report','dati','impostazioni','privacy'];
    for (const tab of allowed) expect(shouldOfferAmbientCopilot({...base,tab})).toBe(true);
    for (const tab of excluded) expect(shouldOfferAmbientCopilot({...base,tab})).toBe(false);
    expect(shouldOfferAmbientCopilot({...base,tab:'dashboard',hasClass:false})).toBe(false);
  });
  test('drawer, editing, conduct and recording always suppress generic entry', () => {
    for (const blocker of ['drawerOpen','assessmentEditorFocused','conductActive','recordingActive'] as const) {
      expect(shouldOfferAmbientCopilot({...base,tab:'biblioteca',[blocker]:true})).toBe(false);
    }
  });
  test('production uses in-flow entry and retains explicit source and teaching actions', async () => {
    const app = await Bun.file('src/App.tsx').text();
    const deck = await Bun.file('src/components/CopilotDeck.tsx').text();
    expect(app).toContain('showClosedTrigger={ambientCopilotAllowed}');
    expect(app).toContain('inlineMobileTrigger={true}');
    expect(app).toContain('surfaceMode={visibleCopilotMode}');
    expect(app).toContain('copilotOrigin.version === copilotRenderVersion');
    expect(app).toContain('copilotOrigin.classId === copilotRenderClassId');
    expect(app).toContain("copilotOrigin.kind === 'explicit' || ambientCopilotAllowed");
    expect(app).toContain('!isCurrentCopilotRender()');
    expect(app).toContain('copilotOriginRef.current !== launchOrigin');
    expect(app).toContain('handleMissionInterrupted({ missionId: interruptedMissionId })');
    expect(app.indexOf('missionExecutionGrantsRef.current.delete(interruptedMissionId)')).toBeLessThan(app.indexOf('handleMissionInterrupted({ missionId: interruptedMissionId })'));
    const workspace = await Bun.file('src/components/UdaWorkspaceView.tsx').text();
    const dossier = await Bun.file('src/components/UdaGanttView.tsx').text();
    expect(app).toContain('onOpenRecordCopilot={reopenLibraryCopilot}');
    expect(workspace).toContain('onOpenRecordCopilot={onOpenRecordCopilot}');
    expect(dossier).toContain('onClick={onOpenRecordCopilot}');
    expect(dossier).toContain('inert={focusedRecordMode && recordCopilotOpen ? true : undefined}');
    expect(app).toContain('onOpenCopilot={openLibraryCopilot}');
    expect(app).toContain('onOpenPreparationCopilot={handleOpenPreparationCopilot}');
    expect(app).toContain('onOpenConductCopilot={handleOpenConductCopilot}');
    const inline = deck.match(/inlineMobileTrigger \? '([^']+)' : 'fixed left-3/);
    expect(inline?.[1]).toContain('relative');
    expect(inline?.[1]).not.toContain('fixed');
  });
});
