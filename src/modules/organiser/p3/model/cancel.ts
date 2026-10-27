import { parseUtcIso } from '@/lib/londonDate';
import type { IsoDate, P3Kind } from './types';

/** One stored date, as the rule reads it. */
export interface CancelDate {
  date: IsoDate;
  cancelled: boolean;
  /** event_occurrence_p5.materialised_start_utc: the instant the server compares with now. */
  startUtc: string | null;
}

export interface CancelInput {
  kind: P3Kind;
  lifecycle: string;
  dates: CancelDate[];
}

/** Why "Cancel the event" is greyed. Each one says what to do instead (never hidden silently). */
export const CANCEL_WHY = {
  started: 'It has already started, so it can\u2019t be cancelled. If it didn\u2019t happen, use End it tomorrow.',
  passed: 'Its date has passed, so it can\u2019t be cancelled. Use End it instead.',
  cancelled: 'It is already cancelled. To bring it back, put its date back in the current organiser area.',
  hidden: 'It is hidden. Show it again first, then cancel it.',
  dates: 'It doesn\u2019t have exactly one date, so it can\u2019t be cancelled here. Ask the Bachata Calendar team.',
} as const;

/** `reason` null = it can be cancelled now. */
export interface CancelRule {
  ok: boolean;
  reason: string | null;
}

const no = (reason: string): CancelRule => ({ ok: false, reason });

/**
 * THE rule for "Cancel the event" (series.cancel_one_off, ER AD4), mirroring the server
 * (_cmd_series_cancel_one_off_p5, read on prod 2026-10-26): a live one-off with exactly
 * one date, not cancelled, after London today, or today with its start still to come. A
 * date today with no start cannot be shown to be still to come, so it counts as started.
 * `null` = no Cancel row at all (not a one-off, or not live / hidden: draft and the
 * finished states have their own rows).
 */
export function canCancelOneOff(ev: CancelInput, today: IsoDate, now: Date): CancelRule | null {
  if (ev.kind !== 'oneoff') return null;
  if (ev.lifecycle !== 'live' && ev.lifecycle !== 'paused') return null;
  if (ev.dates.length !== 1) return no(CANCEL_WHY.dates);
  const [d] = ev.dates;
  if (d.cancelled) return no(CANCEL_WHY.cancelled);
  if (d.date < today) return no(CANCEL_WHY.passed);
  if (d.date === today) {
    const start = parseUtcIso(d.startUtc);
    if (!start || now.getTime() >= start.getTime()) return no(CANCEL_WHY.started);
  }
  if (ev.lifecycle !== 'live') return no(CANCEL_WHY.hidden);
  return { ok: true, reason: null };
}
