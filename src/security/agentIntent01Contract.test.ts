import { describe, expect, test } from 'bun:test';

const CONTRACT = new URL('../library/agentIntent.ts', import.meta.url);
const SERVICE = new URL('../services/agentIntentService.ts', import.meta.url);
const ROUTING = new URL('../library/agentIntentRouting.ts', import.meta.url);
const ROUTE = new URL('../server/agentIntentRoute.ts', import.meta.url);
const PROVIDER = new URL('../server/geminiAgentIntentProvider.ts', import.meta.url);
const COMPOSER = new URL('../components/LibraryCopilotComposer.tsx', import.meta.url);
const SERVER = new URL('../../server.ts', import.meta.url);

describe('AGENT-INTENT-01 architecture contract', () => {
  test('materializes the agent-first boundary without removing the local fallback', async () => {
    for (const file of [CONTRACT, SERVICE, ROUTING, ROUTE, PROVIDER]) {
      expect(await Bun.file(file).exists()).toBe(true);
    }

    const composer = await Bun.file(COMPOSER).text();
    expect(composer).toContain('interpretCopilotIntent');
    expect(composer).toContain('discoverLibraryCopilotIntent');
    expect(composer.indexOf('interpretCopilotIntent')).toBeLessThan(composer.indexOf('discoverLibraryCopilotIntent'));
  });

  test('keeps remote interpretation on one dedicated server route, clean availability preflight and existing server secret', async () => {
    const server = await Bun.file(SERVER).text();
    const service = await Bun.file(SERVICE).text();
    expect(server).toContain("'/api/copilot/intent/provider'");
    expect(server).toContain("'/api/copilot/intent'");
    expect(service.indexOf("fetch('/api/copilot/intent/provider'")).toBeLessThan(
      service.indexOf("fetch('/api/copilot/intent',")
    );
    expect(server).toContain('GEMINI_API_KEY');
    expect(server).not.toContain('AGENT_INTENT_API_KEY');
    expect(server).not.toContain('OPENAI_API_KEY');
  });

  test('does not send source content or student data through the intent service contract', async () => {
    if (!await Bun.file(SERVICE).exists()) {
      expect(await Bun.file(SERVICE).exists()).toBe(true);
      return;
    }
    const service = await Bun.file(SERVICE).text();
    for (const forbidden of [
      'source.extractedText',
      'source.payload',
      'dataBase64',
      'studentName',
      'students:',
      'grades:',
      'uda.description'
    ]) {
      expect(service).not.toContain(forbidden);
    }
  });

  test('preserves Core authority and existing human gates', async () => {
    if (!await Bun.file(ROUTING).exists()) {
      expect(await Bun.file(ROUTING).exists()).toBe(true);
      return;
    }
    const routing = await Bun.file(ROUTING).text();
    const composer = await Bun.file(COMPOSER).text();

    expect(routing).toContain('resolveLibraryContextActions');
    expect(routing).not.toContain('onLink(');
    expect(routing).not.toContain('dispatchLibraryContextAction');
    expect(composer).toContain('dispatchLibraryContextAction');
    expect(composer).toContain('humanConfirmed: true');
    expect(composer).toContain('LibraryProposalPanel');
  });
});
