import { describe, expect, test } from 'bun:test';

async function resolverSource(): Promise<string> {
  const moduleUrl = new URL('../library/relevanceResolver.ts', import.meta.url);
  expect(await Bun.file(moduleUrl).exists()).toBe(true);
  return Bun.file(moduleUrl).text();
}

describe('LIB-03B relevance resolver boundary contract', () => {
  test('stays local-only and independent from provider embedding and UI runtime', async () => {
    const source = await resolverSource();

    expect(source).not.toContain('fetch(');
    expect(source).not.toMatch(/embedding/i);
    expect(source).not.toMatch(/gemini/i);
    expect(source).not.toMatch(/providerRuntime/i);
    expect(source).not.toMatch(/components\//i);
  });

  test('does not interpret Arena curriculum content or create activity targets', async () => {
    const source = await resolverSource();

    expect(source).not.toContain('curricoloItems');
    expect(source).not.toMatch(/targetType\s*:\s*['"]activity['"]/);
  });
});
