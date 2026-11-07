import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

describe('DEPLOY-GUARD-01 / Vercel temporary HPR projects', () => {
  test('automatic Git deployments are explicitly disabled on all branches', () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
    expect(config.git).toEqual({ deploymentEnabled: false });
  });
});
