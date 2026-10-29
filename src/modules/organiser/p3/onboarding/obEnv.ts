// The onboarding shell's browser glue (no components here, so fast refresh stays happy).
import { useEffect } from 'react';

/** Light by default even on a dark phone (owner); the Settings switch (slice 3) writes this key. */
export const OB_THEME_KEY = 'p3-ob-theme';
export function readObTheme(): 'light' | 'dark' {
  try {
    return window.localStorage.getItem(OB_THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

const isField = (el: Element | null): boolean =>
  !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'file', 'submit'].includes((el as HTMLInputElement).type)));

/**
 * Prototype section 5, the biggest build risk: iOS Safari does not resize the layout viewport for the
 * keyboard. The shell is 100dvh (CSS); while a text field inside it is focused, its height follows
 * visualViewport.height and the page is scrolled back to the top, so the fit steps (container queries
 * on the shell) apply and the field + Continue sit above the keyboard.
 */
export function useVisualViewportShell(ref: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const vv = window.visualViewport;
    const el = ref.current;
    if (!el) return;
    const sync = () => {
      const focused = isField(document.activeElement) && el.contains(document.activeElement);
      if (vv && focused) {
        el.style.height = `${Math.round(vv.height)}px`;
        el.style.top = `${Math.round(vv.offsetTop)}px`;
        if (window.scrollY !== 0) window.scrollTo(0, 0);
      } else {
        el.style.height = '';
        el.style.top = '';
      }
    };
    vv?.addEventListener('resize', sync);
    vv?.addEventListener('scroll', sync);
    el.addEventListener('focusin', sync);
    el.addEventListener('focusout', sync);
    return () => {
      vv?.removeEventListener('resize', sync);
      vv?.removeEventListener('scroll', sync);
      el.removeEventListener('focusin', sync);
      el.removeEventListener('focusout', sync);
    };
  }, [ref]);
}

export const prefersReducedMotion = (): boolean => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};
