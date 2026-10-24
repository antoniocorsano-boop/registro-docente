import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeUxEvidence } from '../../scripts/ux-qa/analyzer.mjs';

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

  test('P0 and P1 findings block while P2 remains report-only', () => {
    const contract = {
      invariants: [
        { id: 'UXNAV-001', severity: 'P0', message: 'Neutral entry' },
        { id: 'UXNAV-005', severity: 'P1', message: 'Teacher-first home' },
        { id: 'UXNAV-099', severity: 'P2', message: 'Polish' }
      ]
    };
    const evidence = {
      observations: [
        { id: 'UXNAV-001', status: 'FAIL', node: 'home.classes', expected: 'neutral', observed: 'class active', evidence: ['home.png'] },
        { id: 'UXNAV-005', status: 'PASS', node: 'home.classes', expected: 'classes first', observed: 'classes first', evidence: [] },
        { id: 'UXNAV-099', status: 'FAIL', node: 'home.classes', expected: 'compact', observed: 'dense', evidence: ['dense.png'] }
      ]
    };

    const result = analyzeUxEvidence(contract, evidence);

    expect(result.result).toBe('FAIL');
    expect(result.findings.map((finding: { id: string }) => finding.id)).toEqual(['UXNAV-001', 'UXNAV-099']);
    expect(result.blockingFindings.map((finding: { id: string }) => finding.id)).toEqual(['UXNAV-001']);
  });

  test('fully passing evidence returns PASS', () => {
    const contract = {
      invariants: [
        { id: 'UXNAV-001', severity: 'P0', message: 'Neutral entry' },
        { id: 'UXNAV-005', severity: 'P1', message: 'Teacher-first home' }
      ]
    };
    const evidence = {
      observations: [
        { id: 'UXNAV-001', status: 'PASS', node: 'home.classes', expected: 'neutral', observed: 'neutral', evidence: [] },
        { id: 'UXNAV-005', status: 'PASS', node: 'home.classes', expected: 'classes first', observed: 'classes first', evidence: [] }
      ]
    };

    const result = analyzeUxEvidence(contract, evidence);

    expect(result.result).toBe('PASS');
    expect(result.findings).toEqual([]);
    expect(result.blockingFindings).toEqual([]);
  });
});
