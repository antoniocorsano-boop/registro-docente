import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeUxEvidence } from './analyzer.mjs';

const [, , evidenceArg, contractArg] = process.argv;

if (!evidenceArg || !contractArg) {
  console.error('Usage: bun scripts/ux-qa/analyze.mjs <evidence-json> <contract-json> <output-dir>');
  process.exit(2);
}

const evidence = JSON.parse(readFileSync(resolve(evidenceArg), 'utf8'));
const contract = JSON.parse(readFileSync(resolve(contractArg), 'utf8'));
const result = analyzeUxEvidence(contract, evidence);

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
