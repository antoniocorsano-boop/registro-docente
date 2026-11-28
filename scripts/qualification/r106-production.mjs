import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const workflowFile = '.github/workflows/browser-qualification.yml';
const script = 'scripts/qualification/r106-production.mjs';
const spec = 'r106-student-import.spec.cjs';
const fixture = 'tests/browser/fixtures/r106-student-import.html';
const evidence = 'browser-evidence/r106-production';
const report = `${evidence}/report.json`;
const output = '"$RUNNER_TEMP/r106-production"';

export function checkR106Workflow(workflow) {
  const steps = workflow.split(/^      - name: /m).slice(1);
  const requireStep = (name, parts, always = false) => {
    const index = steps.findIndex(step => step.startsWith(name + '\n'));
    assert.ok(index >= 0, `Missing required step: ${name}`);
    const step = steps[index].split('\n').filter(line => !line.trimStart().startsWith('#')).join('\n');
    if (!always) assert.doesNotMatch(step, /^        (?:if|continue-on-error):/m, name);
    for (const part of parts) assert.ok(step.includes(part), `${name}: missing ${part}`);
    return index;
  };
  const guard = requireStep('Require R106 production browser coverage', [`node ${script} contract`]);
  const copy = requireStep('Install isolated Playwright toolchain', [
    `cp tests/browser/${spec} .browser-tools/${spec}`,
  ]);
  const start = requireStep('Build and start isolated R106 production fixture', [
    `node ${script} build ${output}`,
    `vite preview --mode production --outDir ${output} --host 127.0.0.1 --port 4186 --strictPort`,
    `http://127.0.0.1:4186/${fixture}`,
    'set -euo pipefail',
  ]);
  const run = requireStep('Run mandatory R106 production Chromium regressions', [
    `test -f .browser-tools/${spec}`,
    './node_modules/.bin/playwright test \\',
    `${spec} \\`,
    '--reporter=line,json',
    `PLAYWRIGHT_JSON_OUTPUT_FILE="../${report}"`,
    `--output=../${evidence}/results`,
    `node ${script} report ${report}`,
    'set -euo pipefail',
  ]);
  const upload = requireStep('Upload browser qualification evidence', [
    'if: always()', 'uses: actions/upload-artifact@v4', 'path: browser-evidence/',
  ], true);
  assert.ok(guard < copy && copy < start && start < run && run < upload, 'R106 qualification step order');
}

export function checkR106Report(data) {
  assert.deepEqual(data.errors, [], 'Playwright suite errors');
  const { expected, unexpected, flaky, skipped } = data.stats;
  assert.deepEqual({ expected, unexpected, flaky, skipped }, { expected: 3, unexpected: 0, flaky: 0, skipped: 0 });
  const collected = [];
  const walk = suite => {
    collected.push(...(suite.specs ?? []));
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const suite of data.suites) walk(suite);
  assert.equal(collected.length, 3, 'Exactly three R106 scenarios must be collected');
  const titles = [
    'annullare la conferma non tenta il salvataggio',
    'il rifiuto del commit non aggiunge alunni e non annuncia un successo',
    'la conferma importa una sola volta ed esclude i nominativi già presenti',
  ];
  assert.deepEqual(collected.map(item => item.title).sort(), titles.sort());
  for (const item of collected) {
    assert.equal(item.file, spec);
    assert.equal(item.tests.length, 1);
    assert.equal(item.tests[0].expectedStatus, 'passed');
    assert.deepEqual(item.tests[0].results.map(result => result.status), ['passed']);
  }
  return collected.map(item => ({ title: item.title, status: 'passed' }));
}

async function buildR106(outDir) {
  const pathFromRepo = relative(process.cwd(), resolve(outDir));
  assert.ok(isAbsolute(outDir) && pathFromRepo.startsWith('../'), 'Use a temporary output directory outside the checkout');
  const normalBuild = readdirSync('dist', { recursive: true });
  assert.ok(normalBuild.includes('index.html'), 'The normal production build must be present');
  assert.ok(!normalBuild.some(path => /r106-student-import/i.test(path)), 'Ordinary build contains the R106 fixture');
  const { build } = await import('vite');
  await build({
    configFile: false,
    mode: 'production',
    publicDir: false,
    build: { outDir, emptyOutDir: true, rollupOptions: { input: fixture } },
  });
  const compiled = readFileSync(resolve(outDir, fixture), 'utf8');
  assert.match(compiled, /src="\/assets\/[^"]+\.js"/);
  assert.doesNotMatch(compiled, /\.tsx|\/src\/main|\/@vite/);
  assert.ok(readdirSync(resolve(outDir, 'assets')).some(path => /^studentImport\.worker-.*\.js$/.test(path)), 'Compiled worker missing');
  console.log('R106 production fixture and worker built separately; fixture absent from dist');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, path] = process.argv.slice(2);
  switch (command) {
    case 'contract':
      checkR106Workflow(readFileSync(path ?? workflowFile, 'utf8'));
      console.log('R106_WORKFLOW_CONTRACT_PASS');
      break;
    case 'build':
      await buildR106(path);
      break;
    case 'report': {
      const results = checkR106Report(JSON.parse(readFileSync(path, 'utf8')));
      const candidateSha = process.env.CANDIDATE_SHA;
      assert.match(candidateSha ?? '', /^[a-f0-9]{40}$/, 'Exact candidate SHA required');
      const summary = { candidateSha, status: 'PASS', executed: 3, skipped: 0, results };
      writeFileSync(resolve(path, '../summary.json'), JSON.stringify(summary, null, 2) + '\n');
      console.log(JSON.stringify(summary, null, 2));
      break;
    }
    default:
      throw Error('Expected contract, build or report');
  }
}
