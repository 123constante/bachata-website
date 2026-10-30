// The A1 gate (plan Appendix A1, scope slice 4 / D8): every P3 event write that the server refuses with
// `onboarding_incomplete` opens ONE "A few details first" sheet, from the P3 frame's GateHost, instead of an
// error line with no way to act on it. No React here: a tiny store P3Shell's host subscribes to, so the
// sheet itself (GateSheet) loads only when a refusal happens.
import { isOnboardingRefusal } from '../../shared/selfServeErrors';

/** What opened the gate: the page the server named (DETAIL.organiser_id), or null when it named none. */
export type GateAsk = { organiserId: string | null; seq: number };

let current: GateAsk | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const getGate = (): GateAsk | null => current;
export function subscribeGate(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function openGate(organiserId: string | null): void {
  seq += 1;
  current = { organiserId, seq };
  emit();
}
export function closeGate(): void {
  if (!current) return;
  current = null;
  emit();
}

/**
 * The page a refusal names. _require_onboarding_complete_v1 (read on prod 2026-10-30) raises
 * DETAIL = {"missing":[...],"organiser_id":"<the first target page still missing something>"}; PostgREST
 * passes it through as `details`. Anything unreadable is null (the sheet then picks the page itself).
 */
export function refusalOrganiser(error: unknown): string | null {
  const details = error && typeof error === 'object' ? (error as { details?: unknown }).details : null;
  if (typeof details !== 'string') return null;
  try {
    const d = JSON.parse(details) as { organiser_id?: unknown } | null;
    return d && typeof d.organiser_id === 'string' && d.organiser_id ? d.organiser_id : null;
  } catch {
    return null;
  }
}

/**
 * THE one routing rule for every P3 write's failure: an onboarding refusal opens the gate and shows NO error
 * line (null: the sheet is the answer, and its Continue is the control the words would point at); anything
 * else gets `copy(error)`, unchanged.
 */
export function gatedCopy(error: unknown, copy: (e: unknown) => string): string | null {
  if (isOnboardingRefusal(error)) {
    openGate(refusalOrganiser(error));
    return null;
  }
  return copy(error);
}
