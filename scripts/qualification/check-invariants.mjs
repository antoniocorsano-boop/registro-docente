import { existsSync, readFileSync } from 'node:fs';

const REGISTRY_PATH = 'qualification/invariants.v1.json';
const ID_PATTERN = /^[A-Z0-9-]+-I\d{2}$/;

function fail(message) {
  console.error(`QUAL_INVARIANT_INVALID: ${message}`);
  process.exitCode = 1;
}

if (!existsSync(REGISTRY_PATH)) {
  fail(`missing registry ${REGISTRY_PATH}`);
} else {
  let registry;
  try {
    registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
  } catch (error) {
    fail(`registry is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (registry) {
    if (registry.schemaVersion !== 1) fail('schemaVersion must be 1');
    if (!Array.isArray(registry.guardedRoots) || registry.guardedRoots.length === 0) {
      fail('guardedRoots must be a non-empty array');
    }
    if (!Array.isArray(registry.invariants) || registry.invariants.length === 0) {
      fail('invariants must be a non-empty array');
    }

    const seenIds = new Set();
    for (const invariant of registry.invariants ?? []) {
      if (typeof invariant.id !== 'string' || !ID_PATTERN.test(invariant.id)) {
        fail(`invalid invariant id ${String(invariant.id)}`);
        continue;
      }
      if (seenIds.has(invariant.id)) fail(`duplicate invariant id ${invariant.id}`);
      seenIds.add(invariant.id);

      if (typeof invariant.owner !== 'string' || invariant.owner.trim() === '') {
        fail(`${invariant.id} has no owner`);
      }
      if (typeof invariant.statement !== 'string' || invariant.statement.trim() === '') {
        fail(`${invariant.id} has no statement`);
      }
      for (const field of ['impactPaths', 'tests']) {
        if (!Array.isArray(invariant[field]) || invariant[field].length === 0) {
          fail(`${invariant.id} ${field} must be non-empty`);
        }
      }

      for (const testPath of invariant.tests ?? []) {
        if (typeof testPath !== 'string' || !existsSync(testPath)) {
          fail(`${invariant.id} references missing test ${String(testPath)}`);
        }
      }
      for (const smokePath of invariant.browserSmoke ?? []) {
        if (typeof smokePath !== 'string' || !existsSync(smokePath)) {
          fail(`${invariant.id} references missing browser smoke ${String(smokePath)}`);
        }
      }
    }

    const roots = registry.guardedRoots ?? [];
    for (const root of roots) {
      if (typeof root !== 'string' || root.trim() === '') fail('guardedRoots contains an invalid path');
    }

    if (!process.exitCode) {
      console.log(`QUAL_INVARIANT_REGISTRY_PASS invariants=${seenIds.size} guardedRoots=${roots.length}`);
    }
  }
}
