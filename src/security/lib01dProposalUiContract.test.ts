import { describe, expect, test } from 'bun:test';

const CARD = new URL('../components/LibrarySourceCard.tsx', import.meta.url);
const PANEL = new URL('../components/LibraryProposalPanel.tsx', import.meta.url);
const SERVICE = new URL('../services/libraryProposalService.ts', import.meta.url);

async function readIfExists(url: URL): Promise<string> {
  if (!await Bun.file(url).exists()) return '';
  return Bun.file(url).text();
}

describe('LIB-01D governed proposal UI contract', () => {
  test('materializes an isolated proposal panel and client service', async () => {
    expect(await Bun.file(PANEL).exists()).toBe(true);
    expect(await Bun.file(SERVICE).exists()).toBe(true);
  });

  test('reveals remote generation only inside the selected source with a valid teaching context', async () => {
    const card = await Bun.file(CARD).text();
    expect(card).toContain('LibraryProposalPanel');
    expect(card).toContain('resolvedTeachingContext');
    expect(card).toContain('selectedContextUda');
    expect(card).toContain('isSelected &&');
  });

  test('keeps unknown and student-personal sources behind explicit privacy boundaries', async () => {
    const panel = await readIfExists(PANEL);
    expect(panel).toContain('Classifica come materiale professionale');
    expect(panel).toContain('La generazione remota non è disponibile');
    expect(panel).toContain("source.privacy === 'unknown'");
    expect(panel).toContain("source.privacy === 'student-personal'");
  });

  test('keeps remote consent one-shot and local to React state', async () => {
    const panel = await readIfExists(PANEL);
    expect(panel).toContain('remoteConsent');
    expect(panel).toContain('setRemoteConsent(false)');
    expect(panel).toContain('Consenti per questa richiesta');
    expect(panel).not.toContain('localStorage');
    expect(panel).not.toContain('sessionStorage');
  });

  test('renders PREPARE only after shared-Core remote resolution and never exposes SUMMARIZE', async () => {
    const panel = await readIfExists(PANEL);
    expect(panel).toContain('resolveLibraryRemoteProposalActions');
    expect(panel).toContain("action.id === 'prepare-from-source'");
    expect(panel).not.toContain("action.id === 'summarize-source'");
    expect(panel).not.toContain('Sintetizza la fonte');
  });

  test('generation is non-reentrant and a context/source change clears consent and stale proposal', async () => {
    const panel = await readIfExists(PANEL);
    expect(panel).toContain('isGenerating');
    expect(panel).toContain('disabled={isPending || isGenerating}');
    expect(panel).toContain('setProposal(null)');
    expect(panel).toContain('source.id');
    expect(panel).toContain('teachingContext.udaId');
    expect(panel).toContain('teachingContext.lessonId');
  });

  test('uses the governed proposal endpoint and validates a full structured proposal before rendering', async () => {
    const service = await readIfExists(SERVICE);
    const panel = await readIfExists(PANEL);
    expect(service).toContain('/api/copilot/library-proposal');
    expect(service).toContain('parseTeachingProposalV1');
    expect(panel).toContain('proposal.objective');
    expect(panel).toContain('proposal.teacherSetup');
    expect(panel).toContain('proposal.studentTask');
    expect(panel).toContain('proposal.steps');
    expect(panel).toContain('proposal.questions');
    expect(panel).toContain('proposal.adaptationHint');
  });
});
