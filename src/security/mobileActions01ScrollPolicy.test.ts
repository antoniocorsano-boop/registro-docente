import { describe, expect, test } from 'bun:test';
import { advanceMobileScroll, makeMobileScrollState } from '../components/mobileActionScrollPolicy';

describe('MOBILE-ACTIONS-01 — slow scrolling and reversal', () => {
  test('many 4px downward movements hide the trigger beyond the threshold', () => {
    let state = makeMobileScrollState(0);
    let visibility: 'hide' | 'show' | null = null;
    for (let y = 4; y <= 400; y += 4) {
      const step = advanceMobileScroll(state, y);
      state = step.state;
      if (step.intent !== null) visibility = step.intent;
    }
    expect(visibility).toBe('hide');
  });

  test('many 4px upward movements restore the trigger without a large single event', () => {
    let state = makeMobileScrollState(400);
    let visibility: 'hide' | 'show' | null = null;
    for (let y = 396; y >= 100; y -= 4) {
      const step = advanceMobileScroll(state, y);
      state = step.state;
      if (step.intent !== null) visibility = step.intent;
    }
    expect(visibility).toBe('show');
  });

  test('direction reversal resets an incomplete displacement instead of hiding from residual scroll', () => {
    const first = advanceMobileScroll(makeMobileScrollState(150), 154);
    expect(first.intent).toBeNull();
    const reversed = advanceMobileScroll(first.state, 150);
    expect(reversed.intent).toBeNull();
    expect(advanceMobileScroll(reversed.state, 144).intent).toBe('show');
  });

  test('returning to top always reveals, even after mixed-direction scrolling', () => {
    const start = advanceMobileScroll(makeMobileScrollState(120), 200);
    expect(start.intent).toBe('hide');
    expect(advanceMobileScroll(start.state, 20).intent).toBe('show');
  });
});
