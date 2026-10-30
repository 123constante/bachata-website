// The A1 gate (plan Appendix A1, scope slice 4 / D8): every P3 event write that the server refuses with
// `onboarding_incomplete` opens ONE "A few details first" sheet, from the P3 frame's GateHost, instead of an
// error line with no way to act on it. A tiny store P3Shell's host subscribes to, so the sheet itself
// (GateSheet) loads only when a refusal happens.
import { useCallback, useContext, useEffect, useRef } from 'react';
import { UNSAFE_LocationContext } from 'react-router-dom';
import { isOnboardingRefusal } from '../../shared/selfServeErrors';

/** What the refusal said: the page it named and the codes it listed (both from DETAIL). */
export type RefusalFacts = { organiserId: string | null; missing: string[] };

/** An open gate: the refusal's facts, the screen (pathname) whose write was refused, and a sequence number. */
export type GateAsk = RefusalFacts & { at: string | null; seq: number };

let current: GateAsk | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const getGate = (): GateAsk | null => current;
export function subscribeGate(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/**
 * Opens the gate for the screen at `at`. With no GateHost listening (the person has left the P3 frame), it does
 * nothing: a late refusal must never surface later over another screen.
 */
export function openGate(facts: RefusalFacts, at: string | null = null): void {
  if (listeners.size === 0) return;
  seq += 1;
  current = { ...facts, at, seq };
  emit();
}
export function closeGate(): void {
  if (!current) return;
  current = null;
  emit();
}

/**
 * The refusal's facts. _require_onboarding_complete_v1 (read on prod 2026-10-30) raises
 * DETAIL = {"missing":[...],"organiser_id":"<the first target page still missing something>"}; PostgREST
 * passes it through as `details`. Anything unreadable is null / [] (the sheet then works from the status read).
 */
export function refusalFacts(error: unknown): RefusalFacts {
  const details = error && typeof error === 'object' ? (error as { details?: unknown }).details : null;
  const none: RefusalFacts = { organiserId: null, missing: [] };
  if (typeof details !== 'string') return none;
  try {
    const d = JSON.parse(details) as { organiser_id?: unknown; missing?: unknown } | null;
    if (!d || typeof d !== 'object') return none;
    return {
      organiserId: typeof d.organiser_id === 'string' && d.organiser_id ? d.organiser_id : null,
      missing: Array.isArray(d.missing) ? [...new Set(d.missing.filter((x): x is string => typeof x === 'string' && x !== ''))] : [],
    };
  } catch {
    return none;
  }
}

/**
 * THE one routing rule for every P3 write's failure: an onboarding refusal opens the gate (for screen `at`) and
 * shows NO error line (null: the sheet is the answer, its Continue the control the words would point at);
 * anything else gets `copy(error)`, unchanged.
 */
export function gatedCopy(error: unknown, copy: (e: unknown) => string, at: string | null = null): string | null {
  if (isOnboardingRefusal(error)) {
    openGate(refusalFacts(error), at);
    return null;
  }
  return copy(error);
}

/**
 * gatedCopy for a screen: the gate opens only while the screen that sent the write is still mounted, and is
 * tagged with that screen's pathname (GateHost drops an ask for another screen). `once`: at most one opening per
 * mount (Repeat's dry-run preview re-asks the server on every change; Save still opens it every time).
 */
export function useGatedCopy({ once = false }: { once?: boolean } = {}): (error: unknown, copy: (e: unknown) => string) => string | null {
  // The location context, not useLocation(): this hook also runs in screens rendered outside a router in tests.
  const pathname = useContext(UNSAFE_LocationContext)?.location?.pathname ?? null;
  const at = useRef(pathname);
  useEffect(() => { at.current = pathname; }, [pathname]);
  const mounted = useRef(true);
  const opened = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  return useCallback((error: unknown, copy: (e: unknown) => string) => {
    if (!isOnboardingRefusal(error)) return copy(error);
    if (mounted.current && !(once && opened.current)) {
      opened.current = true;
      openGate(refusalFacts(error), at.current);
    }
    return null;
  }, [once]);
}
