import { describe, expect, test } from 'bun:test';

const composerUrl = new URL('../components/LibraryCopilotComposer.tsx', import.meta.url);
const reviewUrl = new URL('../library/contextualDidacticReview.ts', import.meta.url);

describe('AIC-03 REVIEW v2 presentation contract', () => {
  test('Composer derives the pure contextual didactic review after Core authorizes REVIEW', async () => {
    const composer = await Bun.file(composerUrl).text();

    expect(composer).toContain("from '../library/contextualDidacticReview'");
    expect(composer).toContain('resolveContextualDidacticReview');
    expect(composer).toContain('useMemo');
    expect(composer).toContain("action.id === 'review-source'");
  });

  test('renders the approved teacher-facing sections and removes metadata-only REVIEW', async () => {
    const composer = await Bun.file(composerUrl).text();

    for (const label of [
      'Quanto è pertinente',
      'Perché',
      'Allineamento alla programmazione',
      'Cosa manca o va verificato',
      'Possibili riusi',
      'Affidabilità e limiti'
    ]) {
      expect(composer).toContain(label);
    }

    expect(composer).not.toContain('Contenuto leggibile:');
    expect(composer).not.toContain('Collegamenti già presenti:');
  });

  test('keeps REVIEW local/read-only and does not expose numeric relevance scores', async () => {
    const review = await Bun.file(reviewUrl).text();
    const composer = await Bun.file(composerUrl).text();

    expect(review).not.toContain('fetch(');
    expect(review).not.toContain('onLink');
    expect(review).not.toContain('onUpdateSource');
    expect(review).not.toContain('onAdoptProposalToUda');
    expect(composer).not.toContain('contextualReview.review.relevance.score');
    expect(composer).not.toContain('review.score');
  });

  test('unavailable REVIEW remains an explanatory state inside the same review panel', async () => {
    const composer = await Bun.file(composerUrl).text();

    expect(composer).toContain('SOURCE_NOT_PROFESSIONAL');
    expect(composer).toContain('SOURCE_NOT_USABLE');
    expect(composer).toContain('TEACHING_CONTEXT_MISSING');
    expect(composer).toContain('library-copilot-review-panel');
  });

  test('reuse suggestions stay informational and LINK/PREPARE keep their existing separate controls', async () => {
    const composer = await Bun.file(composerUrl).text();

    expect(composer).toContain('reuseSuggestions');
    expect(composer).toContain('library-copilot-link-action');
    expect(composer).toContain('library-copilot-prepare-disclosure');
    expect(composer).toContain('handleBeginLink');
    expect(composer).toContain('handleConfirmLink');
  });
});