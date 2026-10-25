import { describe, expect, test } from 'bun:test';

const APP = new URL('../App.tsx', import.meta.url);
const LIBRARY_VIEW = new URL('../components/LibraryView.tsx', import.meta.url);
const SOURCE_CARD = new URL('../components/LibrarySourceCard.tsx', import.meta.url);
const RELEVANCE_PANEL = new URL('../components/LibraryRelevancePanel.tsx', import.meta.url);
const PRESENTATION = new URL('../library/relevancePresentation.ts', import.meta.url);

describe('LIB-03C progressive relevance contract', () => {
  test('wires annual planning state to the Library relevance surface without inventing a parallel store', async () => {
    const app = await Bun.file(APP).text();
    const view = await Bun.file(LIBRARY_VIEW).text();
    const card = await Bun.file(SOURCE_CARD).text();

    expect(app).toContain('planning={planning}');
    expect(view).toContain("import type { PlanningStateV1 } from '../planning/types'");
    expect(view).toContain('planning: PlanningStateV1');
    expect(view).toContain('planning={planning}');
    expect(card).toContain('planning?: PlanningStateV1 | null');
    expect(card).toContain('planning={planning}');
  });

  test('keeps ranking local, explainable and inside progressive disclosure', async () => {
    const card = await Bun.file(SOURCE_CARD).text();
    const panel = await Bun.file(RELEVANCE_PANEL).text();
    const presentation = await Bun.file(PRESENTATION).text();

    expect(card).toContain('isSelected &&');
    expect(card).toContain('<LibraryRelevancePanel');
    expect(panel).toContain('Trova dove può servire');
    expect(panel).toContain('Mostra altri risultati');
    expect(panel).toContain('resolveLibraryRelevance');
    expect(panel).toContain('dispatchLibraryContextAction');
    expect(panel).toContain('humanConfirmed: true');
    expect(panel).toContain('presented.slice(0, 3)');
    expect(presentation).toContain('matchedTerms');

    for (const source of [panel, presentation]) {
      expect(source).not.toContain('curricoloItems');
      expect(source).not.toContain('embeddingService');
      expect(source).not.toContain('fetch(');
      expect(source).not.toContain('MasterProgram');
      expect(source).not.toContain('planning.resources');
    }
  });

  test('does not hard-code the current school year or subject to make planning relevance pass', async () => {
    const panel = await Bun.file(RELEVANCE_PANEL).text();
    const presentation = await Bun.file(PRESENTATION).text();

    expect(panel).not.toContain("'2026/27'");
    expect(panel).not.toContain("'tecnologia'");
    expect(presentation).not.toContain("'2026/27'");
    expect(presentation).not.toContain("'tecnologia'");
  });
});
