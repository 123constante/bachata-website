import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

/**
 * The single clipboard path for promo codes.
 *
 * Before this hook the same block -- clipboard write, toast, navigator.vibrate,
 * timed flash -- was duplicated across four promo components and eleven other
 * call sites, with no shared util anywhere in the repo.
 *
 * The phase machine and its timings come from design 1b's own `tapB` handler:
 * tear for 330ms, hold the torn state until 3600ms, then reset. Callers render
 * against `phase`; because the torn/tearing branches mount and unmount their
 * subtrees, every CSS animation restarts on each copy (this is what the design
 * canvas's `sc-if` did, and reproducing it is why the states must be
 * conditionally rendered rather than toggled with opacity).
 */
export type PromoCopyPhase = 'idle' | 'tearing' | 'torn';

const TEAR_MS = 330;
const RESET_MS = 3600;

/**
 * Legacy path for browsers that reject navigator.clipboard on a non-secure
 * origin or without a user-activation token. Mirrors the fallback the design
 * ships and the one already in src/pages/PromoCodes.tsx.
 */
const writeViaTextarea = (text: string): boolean => {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
};

export const useCopyCode = (text: string) => {
  const [phase, setPhase] = useState<PromoCopyPhase>('idle');
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const copy = useCallback(async () => {
    // Ignore taps mid-sequence so a double tap cannot strand the stub in a
    // half-torn state.
    if (phase !== 'idle') return;

    let ok = false;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) ok = writeViaTextarea(text);
    if (!ok) {
      toast.error('Could not copy, try long-press');
      return;
    }

    // iOS Safari usually ignores vibrate; Android honours it. Guarded because
    // some browsers throw rather than no-op.
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(40);
      }
    } catch {
      /* noop */
    }

    // No success toast: the card confirms three ways on its own (check mark,
    // the IN YOUR CLIPBOARD panel, and the shine sweep).
    clearTimers();
    setPhase('tearing');
    timers.current.push(window.setTimeout(() => setPhase('torn'), TEAR_MS));
    timers.current.push(window.setTimeout(() => setPhase('idle'), RESET_MS));
  }, [clearTimers, phase, text]);

  return { phase, copy };
};
