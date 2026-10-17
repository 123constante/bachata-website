import type { NavigateFunction } from 'react-router-dom';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';

/**
 * What the shared Done screen shows (plan 4.3 #4 as amended by D49/D51): the
 * D29 confirmation line and "Back to Home"; `next` adds ONE second button
 * (D61: Cancel's Done passes the put-back route). There is no Undo.
 */
export interface DoneState {
  title: string;
  message: string;
  seriesId: string | null;
  next?: string;
  /** The `next` button's words; defaults to NEXT_LABEL (Team's removal says "Add them back", C26b). */
  nextLabel?: string;
}

/** The second button's words. R1 has one `next` (D61, Cancel -> put it back). */
export const NEXT_LABEL = 'Put it back';

export function goDone(navigate: NavigateFunction | ((to: string, opts: { state: DoneState }) => void), state: DoneState): void {
  navigate(ORG_PATHS.done, { state });
}

/** Router state -> DoneState, or null (a reload, a stale link): the screen then goes Home. */
export function readDoneState(raw: unknown): DoneState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.title !== 'string' || typeof s.message !== 'string') return null;
  return {
    title: s.title,
    message: s.message,
    seriesId: typeof s.seriesId === 'string' ? s.seriesId : null,
    ...(typeof s.next === 'string' && s.next ? { next: s.next } : {}),
    ...(typeof s.nextLabel === 'string' && s.nextLabel ? { nextLabel: s.nextLabel } : {}),
  };
}
