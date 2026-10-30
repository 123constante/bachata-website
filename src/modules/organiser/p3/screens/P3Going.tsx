import { useState } from 'react';
import { GOING_CHECKIN_ENABLED } from '@/lib/goingCheckin';
import { flags } from '@/lib/featureFlags';
import {
  GOING_COPY, GoingLoadState, GoingNightSummary, GoingPeopleSheet, useMyEventGoing,
  type MyEventGoingNight, type OrganiserGoingView,
} from '@/modules/going';
import { Sheet } from './Sheet';

/** The ONE gate for every P3 "Who is going" mount: P3 on AND the going switch on. */
export const p3GoingOn = (): boolean => flags.organiserP3 && GOING_CHECKIN_ENABLED;

/** What a slot shows for a read state (one mapping for Home, the date sheet and Stats). */
export type P3GoingSlot = 'none' | 'state' | 'night';

/**
 * 'none': switch off, or a contributor (not_organiser) -- they are not told about a list they cannot have.
 * 'state': loading / error / sign-in / not found -- GoingLoadState says what to do.
 * 'night': the read is ready.
 */
export const p3GoingSlot = (view: OrganiserGoingView): P3GoingSlot =>
  view.state === 'off' || view.state === 'not_organiser' ? 'none' : view.state === 'ready' ? 'night' : 'state';

/** The upcoming night a slot is about: by occurrence id (date sheet) or by day (Home's Next up). */
export type P3NightKey = { occurrenceId: string } | { date: string };

export const p3NightOf = (nights: readonly MyEventGoingNight[], key: P3NightKey): MyEventGoingNight | null =>
  nights.find((n) => ('occurrenceId' in key ? n.occurrence_id === key.occurrenceId : n.occurrence_date === key.date)) ?? null;

/** One night's "N going", opening the people list in a sheet. Reads by the SERIES id. */
export function P3NightGoing(props: { seriesId: string; seriesName: string; nightKey: P3NightKey; testId: string }) {
  // gated OUTSIDE the hook: switch off / P3 off runs no query and needs no provider
  return p3GoingOn() ? <NightGoing {...props} /> : null;
}

function NightGoing({ seriesId, seriesName, nightKey, testId }: { seriesId: string; seriesName: string; nightKey: P3NightKey; testId: string }) {
  const g = useMyEventGoing(seriesId, { bySeries: true });
  const [open, setOpen] = useState<MyEventGoingNight | null>(null);
  const slot = p3GoingSlot(g.view);
  if (slot === 'none') return null;
  if (slot === 'state') {
    return (
      <div data-testid={`${testId}-state`} data-state={g.view.state}>
        <GoingLoadState view={g.view} onRetry={g.retry} busy={g.fetching} />
      </div>
    );
  }
  const night = p3NightOf(g.nights, nightKey);
  // a date the read does not list (past, or beyond it): no row rather than a wrong "nobody"
  if (!night) return null;
  return (
    <div data-testid={testId} data-kind="night">
      <GoingNightSummary night={night} onOpen={setOpen} />
      {g.refreshFailed && <p className="p3-note" data-testid={`${testId}-stale`}>{GOING_COPY.peopleLoadFailed}</p>}
      {open && (
        <Sheet title={seriesName} onClose={() => setOpen(null)}>
          <GoingPeopleSheet night={open} eventId={seriesId} />
        </Sheet>
      )}
    </div>
  );
}

/** Stats "By event": going across the event's upcoming, not-cancelled nights. */
export const p3SeriesGoingText = (nights: readonly MyEventGoingNight[]): string => {
  const total = nights.filter((n) => !n.is_cancelled).reduce((sum, n) => sum + n.going_count, 0);
  return total > 0 ? `${total} going` : GOING_COPY.orgNobody;
};

export function P3SeriesGoing(props: { seriesId: string; testId: string }) {
  return p3GoingOn() ? <SeriesGoing {...props} /> : null;
}

function SeriesGoing({ seriesId, testId }: { seriesId: string; testId: string }) {
  const g = useMyEventGoing(seriesId, { bySeries: true });
  const slot = p3GoingSlot(g.view);
  if (slot === 'none') return null;
  if (slot === 'state') {
    return (
      <div data-testid={`${testId}-state`} data-state={g.view.state}>
        <GoingLoadState view={g.view} onRetry={g.retry} busy={g.fetching} />
      </div>
    );
  }
  return <p className="p3-row-s" data-testid={testId}>{p3SeriesGoingText(g.nights)}</p>;
}
