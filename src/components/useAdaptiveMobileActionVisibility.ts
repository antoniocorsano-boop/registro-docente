import { useEffect, useState } from 'react';

interface MobileActionVisibility {
  hiddenOnMobile: boolean;
}

/**
 * Reduce the persistent footprint of the contextual action on mobile.
 * No persistence, professional context, Copilota state or navigation is read.
 * The direct Vault lock control is intentionally outside this hook.
 */
export function useAdaptiveMobileActionVisibility(): MobileActionVisibility {
  const [scrollingDown, setScrollingDown] = useState(false);
  const [editingField, setEditingField] = useState(false);

  useEffect(() => {
    const positions = new WeakMap<Element, number>();
    let lastWindowY = window.scrollY;

    const onScroll = (event: Event) => {
      if (!window.matchMedia('(max-width: 767px)').matches) return;
      const element = event.target instanceof Element ? event.target : null;
      const next = element ? element.scrollTop : window.scrollY;
      const previous = element ? (positions.get(element) ?? next) : lastWindowY;
      if (element) positions.set(element, next);
      else lastWindowY = next;

      if (next < 60) {
        setScrollingDown(false);
      } else if (next - previous > 5) {
        setScrollingDown(true);
      } else if (previous - next > 5) {
        setScrollingDown(false);
      }
    };

    const isEditable = (target: EventTarget | null): boolean => target instanceof HTMLElement
      && Boolean(target.closest('input:not([type="button"]):not([type="submit"]), textarea, select, [contenteditable="true"]'));

    const onFocusIn = (event: FocusEvent) => {
      if (isEditable(event.target)) setEditingField(true);
    };

    const onFocusOut = () => {
      // Wait until the new active element is established, including focus
      // transfers between two inputs in the same form.
      queueMicrotask(() => setEditingField(isEditable(document.activeElement)));
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

  return { hiddenOnMobile: scrollingDown || editingField };
}
