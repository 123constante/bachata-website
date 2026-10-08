import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { MOTION_MS, MOTION_TRANSITION, usePrefersReducedMotion } from '../motion';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export interface CollapseProps {
  /** false: fade AND collapse height to exactly 0 over 0.3s, then unmount. */
  show: boolean;
  children: ReactNode;
  /** Fires once the content has unmounted. */
  onExited?: () => void;
  testId?: string;
}

/**
 * Removal that leaves no gap. The wrapper animates opacity and height to 0,
 * then the content UNMOUNTS (so flex/grid gaps and margins vanish too).
 * Under reduced motion it unmounts at once. Showing again expands back.
 *
 * Rule for lists: separate items with borders (Card's dividers) or put the
 * spacing INSIDE the collapsing child, never as a parent `gap`.
 */
export function Collapse({ show, children, onExited, testId }: CollapseProps) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(show);
  const expandOnMount = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const exitedRef = useRef(onExited);
  // A layout effect declared before the one below, so a new onExited is in
  // place before a same-commit unmount (reduced motion) calls it.
  useIsoLayoutEffect(() => {
    exitedRef.current = onExited;
  }, [onExited]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const animateTo = (el: HTMLDivElement, target: 'open' | 'closed', done: () => void) => {
    clearTimeout(timer.current);
    const from = el.getBoundingClientRect().height;
    el.style.overflow = 'hidden';
    el.style.transition = 'none';
    el.style.height = `${from}px`;
    el.style.opacity = target === 'open' && from === 0 ? '0' : getComputedStyle(el).opacity;
    void el.offsetHeight; // commit the start frame
    el.style.transition = `height ${MOTION_TRANSITION}, opacity ${MOTION_TRANSITION}, border-width ${MOTION_TRANSITION}`;
    el.style.height = target === 'open' ? `${el.scrollHeight}px` : '0px';
    // border-box: a divider border (Card's divide-y) would hold the box at 1px.
    el.style.borderTopWidth = target === 'open' ? '' : '0px';
    el.style.borderBottomWidth = target === 'open' ? '' : '0px';
    el.style.opacity = target === 'open' ? '1' : '0';
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      el.removeEventListener('transitionend', onEnd);
      clearTimeout(timer.current);
      done();
    };
    const onEnd = (e: TransitionEvent) => {
      if (e.target === el && e.propertyName === 'height') finish();
    };
    el.addEventListener('transitionend', onEnd);
    // Safety net: transitionend can be skipped (tab hidden, jsdom).
    timer.current = setTimeout(finish, MOTION_MS + 80);
  };

  useIsoLayoutEffect(() => {
    if (show) {
      if (!rendered) {
        expandOnMount.current = !reduced;
        setRendered(true);
      } else if (ref.current && ref.current.style.height !== '') {
        // Re-shown mid-collapse: grow back from where it is.
        const el = ref.current;
        animateTo(el, 'open', () => {
          el.style.height = '';
          el.style.overflow = '';
          el.style.transition = '';
        });
      }
      return;
    }
    if (!rendered) return;
    const el = ref.current;
    const unmount = () => {
      setRendered(false);
      exitedRef.current?.();
    };
    if (reduced || !el) {
      unmount();
      return;
    }
    animateTo(el, 'closed', unmount);
  }, [show]);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!rendered || !el || !expandOnMount.current) return;
    expandOnMount.current = false;
    el.style.height = '0px';
    el.style.opacity = '0';
    animateTo(el, 'open', () => {
      el.style.height = '';
      el.style.overflow = '';
      el.style.transition = '';
    });
  }, [rendered]);

  if (!rendered) return null;
  return (
    <div ref={ref} data-testid={testId} data-state={show ? 'open' : 'closing'} style={{ display: 'flow-root' }}>
      {children}
    </div>
  );
}
