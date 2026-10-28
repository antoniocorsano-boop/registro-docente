import { describe, expect, test } from 'bun:test';

const COMPOSER = new URL('../components/LibraryCopilotComposer.tsx', import.meta.url);

async function composerSource(): Promise<string> {
  return Bun.file(COMPOSER).text();
}

describe('A4-R1 teacher-first Composer contract', () => {
  test('ordinary Copilot entry starts from teacher goal before source and context plumbing', async () => {
    const source = await composerSource();

    expect(source).toContain("from '../copilot/teacherFirstRequest'");
    expect(source).toContain('Cosa vuoi fare?');
    expect(source).toContain('Descrivi ciò che vuoi ottenere');
    expect(source).toContain('Per quale classe?');

    const goalIndex = source.indexOf('Cosa vuoi fare?');
    const sourceIndex = source.indexOf('Fonte della Biblioteca');
    const contextIndex = source.indexOf('Contesto didattico');

    expect(goalIndex).toBeGreaterThanOrEqual(0);
    expect(sourceIndex).toBeGreaterThan(goalIndex);
    expect(contextIndex).toBeGreaterThan(goalIndex);
  });

  test('teacher-facing fallback no longer exposes REVIEW LINK PREPARE implementation taxonomy', async () => {
    const source = await composerSource();

    expect(source).not.toContain('Non ho riconosciuto una richiesta tra revisione, collegamento e preparazione');
    expect(source).toContain('Dimmi cosa vuoi ottenere');
  });

  test('existing governed agent and mission boundaries remain present behind the new entry flow', async () => {
    const source = await composerSource();

    expect(source).toContain('interpretCopilotIntent');
    expect(source).toContain('CopilotMissionBridge');
    expect(source).toContain('assertMissionRuntimeExecutionAuthorized');
    expect(source).toContain('LibraryProposalPanel');
  });
});
