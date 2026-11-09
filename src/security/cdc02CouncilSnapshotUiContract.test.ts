import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const ui = readFileSync('src/components/CouncilView.tsx', 'utf8')
  + readFileSync('src/components/CouncilSnapshotSection.tsx', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');

describe('CDC-02/S2b-P3 — RED contratto interfaccia e conferma della fotografia', () => {
  test('anteprima collegata alla seduta esplicita; non attesta salvataggio', () => {
    expect(ui).toContain('onPrepareSnapshot:');
    expect(ui).toContain('Prepara fotografia');
    expect(ui).toContain('Acquisisci nuova versione');
    expect(ui).toContain('Anteprima non salvata');
    expect(ui).toContain('setSnapshotPreview(null)');
    expect(ui).toContain('readCouncilSnapshots(');
    expect(ui).toContain('Data limite delle prove per la fotografia');
  });

  test('solo conferma esplicita inserisce in coda un commit da ref canonici', () => {
    expect(ui).toContain('Conferma e salva fotografia');
    expect(ui).toContain('Annulla anteprima');
    expect(ui).toContain('snapshotWorkingRef.current = value;');
    expect(ui).toContain('onWorkingChange(value);');
    expect(app).toContain('const handlePrepareCouncilSnapshot =');
    expect(app).toContain('const handleConfirmCouncilSnapshot =');
    expect(app).toContain('mutationCoordinator.enqueueTask(async () => {');
    expect(app).toContain('appendConfirmedCouncilSnapshot(');
    expect(app).toContain('await secureStorage.saveAppDataAndMeta(');
    expect(app).toContain('setAppData({ ...candidate, currentClassId: visibleCurrentClassId });');
    expect(app).toContain('onPrepareSnapshot={handlePrepareCouncilSnapshot}');
    expect(app).toContain('onConfirmSnapshot={handleConfirmCouncilSnapshot}');
  });

  test('P5 UX: confronto immediato, dettagli comprimibili e orario locale', () => {
    expect(ui).toContain('Confronto tra fotografia e quadro corrente');
    expect(ui).toContain('Voti salvati nella fotografia');
    expect(ui).toContain('Voti salvati nel quadro corrente');
    expect(ui).toContain('Altri cinque indicatori della fotografia');
    expect(ui).toContain('Dettagli tecnici dell’acquisizione');
    expect(ui).toContain('formatCouncilSnapshotCaptureTime(');
    expect(ui).toContain('currentOverview={evidenceOverview}');
    expect(ui).toContain('open={!hasOpenedSessionSnapshots}');
  });

  test('storico e provenienza distinti dal quadro corrente', () => {
    expect(ui).toContain('Fotografie confermate');
    expect(ui).toContain('non certifica quando i voti furono inseriti');
    expect(ui).toContain('captureLocalDate');
    expect(ui).toContain('requestedCutoff');
    expect(ui).toContain('revision');
    expect(ui).toContain('isPrivacyShieldActive');
    expect(ui).toContain('dirty ||');
  });
});
