import { Link } from 'react-router-dom';
import { londonTodayKey } from '@/lib/londonDate';
import { wallClockDateKey, wallClockTimeKey, type WallClock } from '@/lib/time/wallClock';
import { longDate } from './ticketCheckoutModel';

/**
 * The night list inside the Tickets page (S1a fix round 1, docs/design/ticket-night-aware-website.md).
 * Every night control (sticky bar "Choose a night", the block's quiet bar, the five night refusals)
 * lands here, because the event page's Dates tile only renders for multi-date courses and the
 * series that sell tickets today are a festival and a weekly party.
 */

/** The fields of a snapshot occurrence the list reads (EventPageSnapshotOccurrence fits). */
export interface NightSource {
  occurrenceId: string;
  /** London wall clock stamped as UTC ("2026-11-14T21:00:00+00:00"), or a bare date. */
  localDate: WallClock | null;
  startsAt: WallClock | null;
  isCancelled: boolean;
  isPast: boolean;
  /** false = no timed session on that night: show no start time. */
  hasTimedSession?: boolean | null;
}

export interface NightOption {
  id: string;
  /** "Saturday 14 November 2026" (full weekday, the same on every ICU). */
  label: string;
  /** "21:00" from the wall clock, or null when the night has no start time. */
  time: string | null;
}

/** At most this many nights are listed (the soonest). Later nights are not reachable from this
 *  list yet -- follow-up in docs/handover/ticket-night-aware-website-fix1.md. */
export const MAX_NIGHTS = 8;


/**
 * Future, non-cancelled nights other than `excludeId` (the night just refused or on screen),
 * soonest first, capped at MAX_NIGHTS. Pure.
 */
export function nightOptions(occurrences: readonly NightSource[] | null | undefined, excludeId: string | null, now: Date): NightOption[] {
  const today = londonTodayKey(now);
  const out: Array<NightOption & { ymd: string }> = [];
  for (const o of occurrences ?? []) {
    if (!o || o.isCancelled || o.isPast || o.occurrenceId === excludeId) continue;
    const ymd = wallClockDateKey(o.localDate) ?? wallClockDateKey(o.startsAt);
    if (!ymd || ymd < today) continue;
    const d = longDate(ymd);
    if (!d) continue;
    // A bare-date start carries no time; wallClockTimeKey reads it as midnight, so skip it.
    const timed = o.hasTimedSession !== false && typeof o.startsAt === 'string' && (o.startsAt as string).length > 10;
    out.push({ id: o.occurrenceId, label: d.text, time: timed ? wallClockTimeKey(o.startsAt) : null, ymd });
  }
  out.sort((a, b) => (a.ymd < b.ymd ? -1 : a.ymd > b.ymd ? 1 : 0));
  return out.slice(0, MAX_NIGHTS).map((n) => ({ id: n.id, label: n.label, time: n.time }));
}

export const NIGHTS_ID = 'tickets-nights';

/** Brings the night list into view (the target of every "Choose a night" control). */
export function scrollToNights() {
  const el = typeof document !== 'undefined' ? document.getElementById(NIGHTS_ID) : null;
  if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function NightPicker({ nights, onPick, organiserId }: { nights: readonly NightOption[]; onPick: (id: string) => void; organiserId: string | null }) {
  return (
    <div id={NIGHTS_ID} data-testid="tickets-nights" className="mt-2 scroll-mt-16">
      {nights.length > 0 && <h3 className="mb-1 text-[13px] font-semibold">Choose a night to buy tickets</h3>}
      {nights.length === 0 ? (
        <p className="text-[13px]" style={{ color: 'hsl(var(--bento-fg-muted))' }} data-testid="tickets-nights-empty">
          No other nights are listed for this event.{' '}
          {organiserId ? (
            <Link to={`/organisers/${organiserId}`} className="inline-flex min-h-[44px] items-center underline">
              Contact the organiser
            </Link>
          ) : (
            'Check back later.'
          )}
        </p>
      ) : (
        <ul className="space-y-1" aria-label="Nights">
          {nights.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                data-night-id={n.id}
                onClick={() => onPick(n.id)}
                className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-md px-3 text-left text-[14px]"
                style={{ background: 'hsl(var(--bento-surface))', border: '1px solid var(--bento-hairline)' }}
              >
                <span className="min-w-0 break-words font-medium">{n.label}</span>
                {n.time && <span className="shrink-0 text-[13px]" style={{ color: 'hsl(var(--bento-fg-muted))' }}>{n.time}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default NightPicker;
