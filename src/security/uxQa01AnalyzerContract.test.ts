import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const contractPath = resolve(root, 'ux/qa/navigation-contract.v1.json');
const analyzerPath = resolve(root, 'scripts/ux-qa/analyzer.mjs');
const cliPath = resolve(root, 'scripts/ux-qa/analyze.mjs');

describe('UX-QA-01 analyzer contract', () => {
  test('canonical UX-QA surfaces and invariant IDs exist', () => {
    expect(existsSync(contractPath)).toBe(true);
    expect(existsSync(analyzerPath)).toBe(true);
    expect(existsSync(cliPath)).toBe(true);

    const contract = JSON.parse(readFileSync(contractPath, 'utf8')) as {
      schema?: string;
      invariants?: Array<{ id?: string }>;
    };

    expect(contract.schema).toBe('registro.ux-qa-navigation/v1');
    expect(contract.invariants?.map(item => item.id)).toEqual([
      'UXNAV-001',
      'UXNAV-002',
      'UXNAV-003',
      'UXNAV-004',
      'UXNAV-005',
      'UXNAV-006',
      'UXNAV-007',
      'UXNAV-008',
      'UXNAV-009'
    ]);
  });
});
