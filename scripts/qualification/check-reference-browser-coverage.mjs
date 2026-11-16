// BETA2-QUAL-01: match actual explicit Playwright invocations, not copy/setup lines.
// Fail if an invariant browser suite has no owning invocation or if a suite
// is run twice across the explicitly owned reference workflows. No external packages.
import { readFileSync, existsSync } from 'node:fs';
const registry = JSON.parse(readFileSync('qualification/invariants.v1.json','utf8'));
const registered = new Set(registry.invariants.flatMap(i=>i.browserSmoke||[]));
const workflows = ['.github/workflows/beta2-reference-qualification.yml','.github/workflows/browser-qualification.yml','.github/workflows/beta2-archive-compatibility.yml','.github/workflows/val01-historical-v7-compatibility.yml'];
const seen = new Map();
const coverage = [];
for (const workflow of workflows) {
  const text = readFileSync(workflow,'utf8');
  // The reference workflows list each explicitly executed spec on a separate
  // continued line. If the command format changes, update this checker with it.
  const specs = [...text.matchAll(/^\s+([\w-]+\.spec\.cjs)\s+\\\s*$/gm)].map(m=>m[1]);
  if (!specs.length) throw Error('No explicit browser invocations: '+workflow);
  for (const spec of specs) {
    const path = 'tests/browser/'+spec;
    if (!existsSync(path)) throw Error('Missing browser spec: '+path);
    if (seen.has(path)) throw Error('Duplicate browser invocation: '+path+' in '+seen.get(path)+' and '+workflow);
    seen.set(path,workflow);
  }
  coverage.push({workflow,count:specs.length});
}
for (const path of registered) if (!seen.has(path)) throw Error('Unmapped registered browser suite: '+path);
console.log(JSON.stringify({status:'REFERENCE_BROWSER_COVERAGE_PASS',registered:registered.size,mapped:registered.size,totalDistinct:seen.size,coverage},null,2));
