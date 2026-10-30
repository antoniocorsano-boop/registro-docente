import { describe, expect, test } from 'bun:test';

const APP = new URL('../App.tsx', import.meta.url);
const VIEW = new URL('../components/LibraryView.tsx', import.meta.url);
const CARD = new URL('../components/LibrarySourceCard.tsx', import.meta.url);

describe('A4-R2B Biblioteca projected UDA integration', () => {
  test('LibraryView receives canonical classes and builds the same unified teaching UDA catalog used by Copilot', async () => {
    const app = await Bun.file(APP).text();
    const view = await Bun.file(VIEW).text();

    expect(app).toContain('classes={appData.classes}');
    expect(view).toContain("from '../teaching/teachingUdaCatalog'");
    expect(view).toContain('classes: ClassData[]');
    expect(view).toContain('buildTeachingUdaClassReconciliationIndex(planning.docenteOsProjections)');
    expect(view).toContain('buildTeachingUdaCatalog({');
    expect(view).toContain('acceptedProjections: planning.docenteOsProjections');
    expect(view).toContain('teachingUdaCatalog={teachingUdaCatalog}');
  });

  test('Library source context selection resolves against the unified catalog and discloses Docente OS provenance', async () => {
    const card = await Bun.file(CARD).text();

    expect(card).toContain('teachingUdaCatalog: readonly TeachingUdaCandidate[]');
    expect(card).toContain('resolveLibraryTeachingContextFromCatalog');
    expect(card).toContain('teachingUdaCatalog.find(candidate => candidate.id === contextUdaId)');
    expect(card).toContain('teachingUdaCatalog.map(candidate =>');
    expect(card).toContain('Da Docente OS');
  });

  test('manual Library linking can target a projected UDA ref without turning it into a Registro UDA mutation', async () => {
    const card = await Bun.file(CARD).text();

    expect(card).toContain("await onLink(source.id, { targetType: 'uda', targetId: targetUdaId })");
    expect(card).toContain('teachingUdaCatalog.map(candidate =>');
    expect(card).not.toContain('onAdoptProposalToUda');
  });
});
