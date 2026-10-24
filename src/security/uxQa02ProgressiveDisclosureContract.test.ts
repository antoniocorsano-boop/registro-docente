import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeUxEvidence } from '../../scripts/ux-qa/analyzer.mjs';

const root = process.cwd();
const contractPath = resolve(root, 'ux/qa/progressive-disclosure-contract.v1.json');

const expectedIds = [
  'UXPD-001',
  'UXPD-002',
  'UXPD-003',
  'UXPD-004',
  'UXPD-005',
  'UXPD-006',
  'UXPD-007',
  'UXPD-008',
  'UXPD-009',
  'UXPD-010',
  'UXPD-011'
];

const expectedSeverities = [
  'P1', 'P1', 'P1', 'P1', 'P2', 'P2', 'P2', 'P2', 'P2', 'P1', 'P0'
];

describe('UX-QA-02 progressive disclosure contract', () => {
  test('canonical UXPD contract surface and invariant severities exist', () => {
    expect(existsSync(contractPath)).toBe(true);

    const contract = JSON.parse(readFileSync(contractPath, 'utf8')) as {
      schema?: string;
      viewports?: Array<{ width?: number; height?: number }>;
      invariants?: Array<{ id?: string; severity?: string }>;
    };

    expect(contract.schema).toBe('registro.ux-qa-progressive-disclosure/v1');
    expect(contract.viewports).toEqual([
      { width: 390, height: 844 },
      { width: 1280, height: 900 }
    ]);
    expect(contract.invariants?.map(item => item.id)).toEqual(expectedIds);
    expect(contract.invariants?.map(item => item.severity)).toEqual(expectedSeverities);
  });

  test('P1 blocks while P2 remains report-only for UXPD evidence', () => {
    const contract = {
      invariants: [
        { id: 'UXPD-001', severity: 'P1', message: 'Planning read-first' },
        { id: 'UXPD-005', severity: 'P2', message: 'Human library title' }
      ]
    };
    const evidence = {
      observations: [
        { id: 'UXPD-001', status: 'FAIL', node: 'planning', expected: 'read-first', observed: 'full form visible', evidence: ['planning.png'] },
        { id: 'UXPD-005', status: 'FAIL', node: 'library', expected: 'human title', observed: 'technical filename', evidence: ['library.png'] }
      ]
    };

    const result = analyzeUxEvidence(contract, evidence);

    expect(result.result).toBe('FAIL');
    expect(result.findings.map((finding: { id: string }) => finding.id)).toEqual(['UXPD-001', 'UXPD-005']);
    expect(result.blockingFindings.map((finding: { id: string }) => finding.id)).toEqual(['UXPD-001']);
  });

  test('P2-only UXPD evidence is reportable without blocking qualification', () => {
    const contract = {
      invariants: [
        { id: 'UXPD-005', severity: 'P2', message: 'Human library title' }
      ]
    };
    const evidence = {
      observations: [
        { id: 'UXPD-005', status: 'FAIL', node: 'library', expected: 'human title', observed: 'technical filename', evidence: [] }
      ]
    };

    const result = analyzeUxEvidence(contract, evidence);

    expect(result.result).toBe('PASS');
    expect(result.findings.map((finding: { id: string }) => finding.id)).toEqual(['UXPD-005']);
    expect(result.blockingFindings).toEqual([]);
  });
});
