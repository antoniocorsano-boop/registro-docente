import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolveServerBindHost } from '../server/runtimeHost';

describe('LOCAL-REG-01 server bind host contract', () => {
  it('preserves the hosted default when TRAMA_BIND_HOST is absent or blank', () => {
    expect(resolveServerBindHost({})).toBe('0.0.0.0');
    expect(resolveServerBindHost({ TRAMA_BIND_HOST: '' })).toBe('0.0.0.0');
    expect(resolveServerBindHost({ TRAMA_BIND_HOST: '   ' })).toBe('0.0.0.0');
  });

  it('accepts an explicit loopback host and trims surrounding whitespace', () => {
    expect(resolveServerBindHost({ TRAMA_BIND_HOST: '127.0.0.1' })).toBe('127.0.0.1');
    expect(resolveServerBindHost({ TRAMA_BIND_HOST: ' 127.0.0.1 ' })).toBe('127.0.0.1');
  });

  it('wires server.ts through the resolver instead of a literal listen host', () => {
    const source = readFileSync(new URL('../../server.ts', import.meta.url), 'utf8');
    expect(source).toContain("import { resolveServerBindHost } from './src/server/runtimeHost.ts';");
    expect(source).toContain('const BIND_HOST = resolveServerBindHost(process.env);');
    expect(source).toContain('app.listen(PORT, BIND_HOST, () => {');
    expect(source).not.toContain("app.listen(PORT, '0.0.0.0'");
  });
});
