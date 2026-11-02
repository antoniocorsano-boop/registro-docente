import fs from 'node:fs';

const path = 'qualification/invariants.v1.json';
const registry = JSON.parse(fs.readFileSync(path, 'utf8'));
const invariant = registry.invariants.find(entry => entry.id === 'FLOW-03-I01');
if (!invariant) throw new Error('FLOW-03-I01_NOT_FOUND');

const requiredImpactPaths = [
  '.github/workflows/flow-03-contract-qualification.yml',
  'src/security/homeNavigationDuringSaveIntegrity.test.ts',
  'src/security/persist01hTeacherUiContract.test.ts'
];
const requiredTests = [
  'src/security/homeNavigationDuringSaveIntegrity.test.ts',
  'src/security/persist01hTeacherUiContract.test.ts'
];

for (const required of requiredImpactPaths) {
  if (!invariant.impactPaths.includes(required)) invariant.impactPaths.push(required);
}
for (const required of requiredTests) {
  if (!invariant.tests.includes(required)) invariant.tests.push(required);
}

for (const required of requiredImpactPaths) {
  if (!invariant.impactPaths.includes(required)) throw new Error(`IMPACT_PATH_NOT_ADDED:${required}`);
}
for (const required of requiredTests) {
  if (!invariant.tests.includes(required)) throw new Error(`TEST_NOT_ADDED:${required}`);
}

fs.writeFileSync(path, `${JSON.stringify(registry, null, 2)}\n`);
console.log('FLOW-03 invariant coverage updated');
