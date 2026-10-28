import { describe, expect, test } from 'bun:test';

const BROWSER_WORKFLOW = new URL('../../.github/workflows/browser-qualification.yml', import.meta.url);
const PREDEPLOY_WORKFLOW = new URL('../../.github/workflows/predeploy-security-qualification.yml', import.meta.url);

describe('AIC-07 qualification workflow governance', () => {
  test('runs the dedicated AIC-07 browser gate first and keeps both browser phases serial', async () => {
    const workflow = await Bun.file(BROWSER_WORKFLOW).text();
    const dedicated = workflow.indexOf('- name: Run dedicated AIC-07 Chromium qualification');
    const historical = workflow.indexOf('- name: Run historical Chromium qualification');
    expect(dedicated).toBeGreaterThan(-1);
    expect(historical).toBeGreaterThan(-1);
    expect(dedicated).toBeLessThan(historical);

    const dedicatedBlock = workflow.slice(dedicated, historical);
    const historicalEnd = workflow.indexOf('- name: Analyze UX navigation evidence', historical);
    const historicalBlock = workflow.slice(historical, historicalEnd);
    expect(dedicatedBlock).toContain('--workers=1');
    expect(historicalBlock).toContain('--workers=1');
  });

  test('PREDEPLOY checks out and verifies the exact pull-request head SHA', async () => {
    const workflow = await Bun.file(PREDEPLOY_WORKFLOW).text();
    expect(workflow).toContain('CANDIDATE_SHA: ${{ github.event.pull_request.head.sha || github.sha }}');
    expect(workflow).toContain('- name: Checkout exact candidate');
    expect(workflow).toContain('ref: ${{ env.CANDIDATE_SHA }}');
    expect(workflow).toContain('- name: Verify exact candidate checkout');
    expect(workflow).toContain('test "${actual_sha}" = "${CANDIDATE_SHA}"');
  });
});
