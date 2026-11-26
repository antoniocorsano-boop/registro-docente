import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const spec = 'r1-tec-bfcache.spec.cjs';
const script = 'scripts/qualification/r1-tec-bfcache.mjs';
const evidence = 'browser-evidence/r1-tec-bfcache';
const workflow = '.github/workflows/browser-qualification.yml';

export function checkBfcacheWorkflow(source) {
  const steps = source.split(/^      - name: /m).slice(1)
    .map(step => step.split('\n').filter(line => !line.trimStart().startsWith('#')).join('\n'));
  const requireStep = (name, fragments, always = false) => {
    const index = steps.findIndex(step => step.startsWith(name + '\n'));
    assert.ok(index >= 0, `Missing step: ${name}`);
    if (!always) assert.doesNotMatch(steps[index], /^        (?:if|continue-on-error):/m);
    for (const fragment of fragments) assert.ok(steps[index].includes(fragment), `${name}: missing ${fragment}`);
    return index;
  };
  const contract = requireStep('Require R1-TEC-01b browser coverage', [`node ${script} contract`]);
  const copy = requireStep('Install isolated Playwright toolchain', [`cp tests/browser/${spec} .browser-tools/${spec}`]);
  const build = requireStep('Build production application', ['run: bun run build']);
  const start = requireStep('Start production server and wait for readiness', ['NODE_ENV=production PORT="${PORT}" bun run start']);
  const run = requireStep('Run mandatory R1-TEC-01b production lifecycle regressions', [
    'set -euo pipefail',
    `test -f .browser-tools/${spec}`,
    "find dist -iname '*r1-tec-bfcache*'",
    './node_modules/.bin/playwright test \\',
    `${spec} \\`,
    `PLAYWRIGHT_JSON_OUTPUT_FILE="../${evidence}/report.json"`,
    '--reporter=line,json',
    `node ${script} report ${evidence}/report.json`,
  ]);
  const upload = requireStep('Upload browser qualification evidence', ['if: always()', 'path: browser-evidence/'], true);
  assert.ok(contract < build && build < start && copy < run && start < run && run < upload, 'Production gate step order');
}

export function validateBfcacheReport(data) {
  assert.deepEqual(data.errors, []);
  const { expected, skipped, unexpected, flaky } = data.stats;
  assert.deepEqual({ expected, skipped, unexpected, flaky }, { expected: 6, skipped: 0, unexpected: 0, flaky: 0 });
  const cases = [];
  function visit(suite) {
    cases.push(...(suite.specs ?? []));
    for (const child of suite.suites ?? []) visit(child);
  }
  for (const suite of data.suites) visit(suite);
  assert.equal(cases.length, 6);
  const names = new Set([
    'persisted return reopens embeddings on the same authenticated production root',
    'older replies stay revoked; duplicate and ordinary events do not rotate the new session',
    'expired auto-lock is enforced before any semantic request on return',
    'manual lock and completed reset cannot be revived by persisted returns',
    'Android persisted return requires existing suspension authentication',
    'real browser history attests persisted return or records a reload',
  ]);
  for (const scenario of cases) {
    assert.equal(scenario.file, spec);
    assert.ok(names.delete(scenario.title), scenario.title);
    assert.equal(scenario.tests.length, 1);
    const { results, expectedStatus } = scenario.tests[0];
    assert.equal(expectedStatus, 'passed');
    assert.deepEqual(results.map(result => result.status), ['passed']);
  }
  const last = cases.find(scenario => scenario.title.startsWith('real browser history'));
  const event = last.tests[0].results[0].attachments.find(item => item.name === 'real-history');
  const { sameDocument, persisted } = JSON.parse(Buffer.from(event.body, 'base64'));
  assert.equal(typeof persisted, 'boolean');
  assert.equal(sameDocument, persisted);
  return { executed: cases.length, skipped, realHistory: persisted ? 'persisted' : 'reload', scenarios: cases.map(item => item.title) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, path] = process.argv.slice(2);
  if (command === 'contract') {
    checkBfcacheWorkflow(readFileSync(path ?? workflow, 'utf8'));
    console.log('R1_TEC_BFCACHE_WORKFLOW_PASS');
  } else if (command === 'report') {
    const candidateSha = process.env.CANDIDATE_SHA;
    assert.match(candidateSha ?? '', /^[a-f0-9]{40}$/);
    const summary = JSON.stringify({ candidateSha, ...validateBfcacheReport(JSON.parse(readFileSync(path, 'utf8'))) }, null, 2);
    writeFileSync(join(dirname(path), 'summary.json'), summary + '\n');
    console.log(summary);
  } else throw Error('Expected contract or report');
}
