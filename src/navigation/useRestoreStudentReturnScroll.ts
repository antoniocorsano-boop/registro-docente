import { useEffect } from 'react';

/**
 * Restore the scroll anchor only on a real browser Back to the report's origin.
 * Never force a scroll when the user visits a section through the normal menu.
 */
export function useRestoreStudentReturnScroll(
  scrollY: number | null,
  restoreKey: string | null
): void {
  useEffect(() => {
    if (scrollY === null || restoreKey === null || typeof window === 'undefined') return;
    if (window.matchMedia && !window.matchMedia('(max-width: 767px)').matches) return;
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        window.scrollTo({ top: Math.max(0, scrollY), behavior: 'auto' });
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [scrollY, restoreKey]);
}
