import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeUxEvidence } from './analyzer.mjs';

const [, , evidenceArg, contractArg, outputDirArg] = process.argv;

if (!evidenceArg || !contractArg || !outputDirArg) {
  console.error('Usage: bun scripts/ux-qa/analyze.mjs <evidence-json> <contract-json> <output-dir>');
  process.exit(2);
}

const evidence = JSON.parse(readFileSync(resolve(evidenceArg), 'utf8'));
const contract = JSON.parse(readFileSync(resolve(contractArg), 'utf8'));
const result = analyzeUxEvidence(contract, evidence);
const outputDir = resolve(outputDirArg);

mkdirSync(outputDir, { recursive: true });

const reportJson = {
  schema: 'registro.ux-qa-report/v1',
  candidateSha: evidence?.candidateSha || process.env.CANDIDATE_SHA || null,
  generatedAt: new Date().toISOString(),
  ...result
};

writeFileSync(
  resolve(outputDir, 'ux-qa-01-report.json'),
  `${JSON.stringify(reportJson, null, 2)}\n`
);

const severityOrder = new Map([['P0', 0], ['P1', 1], ['P2', 2]]);
const orderedFindings = [...result.findings].sort((a, b) =>
  (severityOrder.get(a.severity) ?? 99) - (severityOrder.get(b.severity) ?? 99)
);

const lines = [
  '# UX-QA-01 Report',
  '',
  `- Candidate SHA: ${reportJson.candidateSha || 'unknown'}`,
  `- Result: **${result.result}**`,
  `- Blocking findings: ${result.blockingFindings.length}`,
  `- Total findings: ${result.findings.length}`,
  '',
  '## Findings',
  ''
];

if (orderedFindings.length === 0) {
  lines.push('No findings.');
} else {
  for (const finding of orderedFindings) {
    lines.push(
      `### ${finding.severity} — ${finding.id}`,
      '',
      `- Node: ${finding.node || 'unknown'}`,
      `- Expected: ${finding.expected || 'n/a'}`,
      `- Observed: ${finding.observed || 'n/a'}`,
      `- Evidence: ${finding.evidence.length > 0 ? finding.evidence.join(', ') : 'none'}`,
      '',
      'Suggested remediation boundary: correct the smallest product/navigation boundary that makes this invariant pass without weakening other qualification gates.',
      ''
    );
  }
}

writeFileSync(resolve(outputDir, 'ux-qa-01-report.md'), `${lines.join('\n')}\n`);
process.stdout.write(`${JSON.stringify(reportJson, null, 2)}\n`);
process.exit(result.result === 'PASS' ? 0 : 1);
