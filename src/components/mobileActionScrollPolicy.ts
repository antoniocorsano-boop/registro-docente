export interface MobileScrollState {
  lastPosition: number;
  displacement: number;
}

export type MobileScrollIntent = 'hide' | 'show' | null;

export function makeMobileScrollState(position: number): MobileScrollState {
  return { lastPosition: position, displacement: 0 };
}

/**
 * Aggregates small increments instead of comparing only adjacent events.
 * A direction reversal discards the displacement from the previous direction.
 * The decision is intentionally stateless with respect to application data.
 */
export function advanceMobileScroll(
  state: MobileScrollState,
  position: number
): { state: MobileScrollState; intent: MobileScrollIntent } {
  if (!Number.isFinite(position)) return { state, intent: null };
  const step = position - state.lastPosition;
  if (position < 60) {
    return { state: makeMobileScrollState(position), intent: 'show' };
  }

  let displacement = state.displacement;
  if (step !== 0) {
    displacement = (displacement !== 0 && Math.sign(step) !== Math.sign(displacement))
      ? step
      : displacement + step;
  }

  if (displacement >= 8) {
    return { state: makeMobileScrollState(position), intent: 'hide' };
  }
  if (displacement <= -8) {
    return { state: makeMobileScrollState(position), intent: 'show' };
  }
  return { state: { lastPosition: position, displacement }, intent: null };
}
