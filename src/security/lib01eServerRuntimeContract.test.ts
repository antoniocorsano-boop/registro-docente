import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dir, '../..');

async function read(relativePath: string): Promise<string> {
  return readFile(path.join(ROOT, relativePath), 'utf8');
}

describe('LIB-01E server runtime wiring contract', () => {
  test('constructs the governed proposal provider and runtime once outside the POST handler', async () => {
    const server = await read('server.ts');

    expect(server).toContain("from './src/server/geminiTeachingProposalProvider.ts'");
    expect(server).toContain("from './src/server/teachingProposalRuntime.ts'");
    expect(server).toMatch(/const libraryProposalProvider\s*=\s*createGeminiTeachingProposalProvider\(/);
    expect(server).toMatch(/const libraryProposalRuntime\s*=\s*createTeachingProposalRuntime\(/);

    const routeStart = server.indexOf("'/api/copilot/library-proposal'");
    const nextJsonMiddleware = server.indexOf('app.use(express.json())', routeStart);
    const routeSource = server.slice(routeStart, nextJsonMiddleware);
    expect(routeSource).toContain('libraryProposalRuntime');
    expect(routeSource).not.toContain('createGeminiTeachingProposalProvider(');
    expect(routeSource).not.toContain('createTeachingProposalRuntime(');
  });

  test('exposes only non-sensitive provider availability metadata', async () => {
    const server = await read('server.ts');

    expect(server).toContain("app.get('/api/copilot/library-proposal/provider'");
    expect(server).toContain("provider: libraryProposalProvider.descriptor.displayName");
    expect(server).toContain("model: libraryProposalProvider.descriptor.model");
    expect(server).toContain('available: Boolean(process.env.GEMINI_API_KEY?.trim())');

    const metadataStart = server.indexOf("app.get('/api/copilot/library-proposal/provider'");
    const metadataEnd = server.indexOf(');', metadataStart) + 2;
    const metadataRoute = server.slice(metadataStart, metadataEnd);
    expect(metadataRoute).not.toContain('apiKey');
    expect(metadataRoute).not.toContain('quota');
    expect(metadataRoute).not.toContain('billing');
  });

  test('binds HTTP lifecycle cancellation to the governed runtime without introducing retries', async () => {
    const server = await read('server.ts');

    const routeStart = server.indexOf("'/api/copilot/library-proposal'");
    const nextJsonMiddleware = server.indexOf('app.use(express.json())', routeStart);
    const routeSource = server.slice(routeStart, nextJsonMiddleware);
    expect(routeSource).toContain('new AbortController()');
    expect(routeSource).toMatch(/req\.(once|on)\(['"]aborted['"]/);
    expect(routeSource).toMatch(/res\.(once|on)\(['"]close['"]/);
    expect(routeSource).toContain('signal: requestController.signal');
    expect(routeSource).not.toMatch(/retry|attempt\s*\+\+|for\s*\(/i);
  });

  test('documents the optional governed proposal timeout without exposing a model override', async () => {
    const env = await read('.env.example');
    expect(env).toContain('LIBRARY_PROPOSAL_TIMEOUT_MS=45000');
    expect(env).not.toContain('LIBRARY_PROPOSAL_MODEL=');
  });
});