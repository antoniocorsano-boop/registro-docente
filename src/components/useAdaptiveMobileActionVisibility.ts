import { useEffect, useState } from 'react';
import { advanceMobileScroll, makeMobileScrollState } from './mobileActionScrollPolicy';

type CopilotSurfaceMode = 'closed' | 'home' | 'compose';

interface MobileActionVisibility {
  hiddenOnMobile: boolean;
}

const isCopilotSurface = (target: EventTarget | null): boolean =>
  target instanceof Element
  && Boolean(target.closest('[data-testid="copilot-deck"], [data-testid="library-copilot-composer"]'));

const isEditable = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement
  && Boolean(target.closest('input:not([type="button"]):not([type="submit"]), textarea, select, [contenteditable="true"]'));

/**
 * Reduce only the Copilota trigger's visual occupation on mobile.
 * Vault locking, teacher context, persisted data and route state are untouched.
 */
export function useAdaptiveMobileActionVisibility(surfaceMode: CopilotSurfaceMode): MobileActionVisibility {
  const [scrollingDown, setScrollingDown] = useState(false);
  const [editingField, setEditingField] = useState(false);

  useEffect(() => {
    const positions = new WeakMap<Element, ReturnType<typeof makeMobileScrollState>>();
    let windowPosition = makeMobileScrollState(window.scrollY);

    const onScroll = (event: Event) => {
      if (!window.matchMedia('(max-width: 767px)').matches || isCopilotSurface(event.target)) return;
      const element = event.target instanceof Element ? event.target : null;
      const position = element ? element.scrollTop : window.scrollY;
      const state = element
        ? (positions.get(element) ?? makeMobileScrollState(position))
        : windowPosition;
      const next = advanceMobileScroll(state, position);
      if (element) positions.set(element, next.state);
      else windowPosition = next.state;

      if (next.intent === 'hide') setScrollingDown(true);
      else if (next.intent === 'show') setScrollingDown(false);
    };

    const onFocusIn = (event: FocusEvent) => {
      if (!isCopilotSurface(event.target) && isEditable(event.target)) setEditingField(true);
    };

    const onFocusOut = () => {
      // A field-to-field focus transfer must retain protection of the editor.
      queueMicrotask(() => setEditingField(
        isEditable(document.activeElement) && !isCopilotSurface(document.activeElement)
      ));
    };

    document.addEventListener('scroll', onScroll, true);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);

    return () => {
      document.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  useEffect(() => {
    // Closing an overlay must not inherit the overlay's scroll state. Otherwise
    // the only closed Copilota launcher could remain invisible after use.
    if (surfaceMode === 'closed') {
      setScrollingDown(false);
      setEditingField(isEditable(document.activeElement) && !isCopilotSurface(document.activeElement));
    }
  }, [surfaceMode]);

  return { hiddenOnMobile: scrollingDown || editingField };
}
