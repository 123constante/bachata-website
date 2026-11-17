import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { EventsScreen } from '../screens/EventsScreen';
import { AccountEntry } from '../shell/P3Shell';
import { P3_PATHS } from '../shell/paths';
import { TicketsEntry } from '../tickets/TicketsEntry';
import { GuestListRow, GuestListSheet } from '../guestlist/GuestListSheet';
import { RaffleRow } from '../events/raffle/RaffleParts';
import { RaffleSheet } from '../events/raffle/RaffleSheet';
import { buildEvents, type Night, type Seat } from '../events/eventsModel';
import { useEventChoice, type EventChoice } from './V2Shell';
import { vibrate } from './feedback';

const TAP = { minHeight: 44, minWidth: 44 } as const;

/** One sentence and one next-step button: every empty, loading and error state of the V2 shell. */
export function V2State({ testId, sentence, children }: { testId: string; sentence: ReactNode; children: ReactNode }) {
  return (
    <div className="p3-card p3-stack-s" data-testid={testId} role={testId.endsWith('error') ? 'alert' : undefined}>
      <p className="p3-note v2-state-line">{sentence}</p>
      {children}
    </div>
  );
}

const linkBtn = 'p3-btn p3-btn-line p3-btn-link';

/** The shared gate of the tabs that act on the chosen event: loading, error, no page, no events. */
function Gate({ c, what, children }: { c: EventChoice; what: string; children: () => ReactNode }) {
  if (c.loading) {
    return (
      <V2State testId={`v2-${what}-loading`} sentence={<>Loading your events&hellip;</>}>
        <button type="button" className="p3-btn p3-btn-line" style={TAP} onClick={c.retry}>Load again</button>
      </V2State>
    );
  }
  if (c.error) {
    return (
      <V2State testId={`v2-${what}-error`} sentence="We couldn&rsquo;t load your events. Check your connection, then try again.">
        <button type="button" className="p3-btn p3-btn-line" style={TAP} onClick={() => { vibrate('error'); c.retry(); }}>Try again</button>
      </V2State>
    );
  }
  if (c.noPage) {
    return (
      <V2State testId={`v2-${what}-nopage`} sentence="You don&rsquo;t have an organiser page yet.">
        <Link className={linkBtn} style={TAP} to={P3_PATHS.start}>Find or create a page</Link>
      </V2State>
    );
  }
  if (!c.event) {
    return (
      <V2State testId={`v2-${what}-empty`} sentence="This page has no events yet.">
        <Link className={linkBtn} style={TAP} to={P3_PATHS.create}>Add an event</Link>
      </V2State>
    );
  }
  return <>{children()}</>;
}

/** Events + Team: today's Events screen, then the way to Team and to Account. */
export function V2EventsTab() {
  const c = useEventChoice();
  return (
    <div className="p3-stack" data-testid="v2-events-tab">
      <EventsScreen />
      <section className="p3-card p3-stack-s" aria-label="Team" data-testid="v2-team">
        <strong>Team</strong>
        <p className="p3-note">See who runs this page with you.</p>
        <Link className={linkBtn} style={TAP} to={P3_PATHS.youTeam} data-testid="v2-team-open">Open the team</Link>
        <div className="v2-account-row"><AccountEntry organiserId={c.page?.id ?? null} pageName={c.page?.name ?? ''} /></div>
      </section>
    </div>
  );
}

/** Tickets for the chosen event: the existing Tickets entry (it keeps money to the owner). */
export function V2TicketsTab() {
  const c = useEventChoice();
  return (
    <Gate c={c} what="tickets">
      {() => (
        <div className="p3-stack" data-testid="v2-tickets-tab">
          <p className="p3-note">Tickets for <strong className="v2-inline">{c.event!.name}</strong>.</p>
          <TicketsEntry seriesId={c.event!.id} />
          <Link className={linkBtn} style={TAP} to={P3_PATHS.event(c.event!.id)}>Open the event</Link>
        </div>
      )}
    </Gate>
  );
}

const seatOf = (page: EventChoice['page']): Seat => (page?.role === 'owner' || page?.role === 'manager' ? page.role : 'contributor');

/** The chosen event's coming dated nights (soonest first), as the Events tab builds them. */
export function nightsOfChoice(c: EventChoice): Night[] {
  if (!c.event) return [];
  const m = buildEvents({ rows: [c.event], today: c.today, seat: seatOf(c.page), query: '', filter: 'all', shown: 1000, showPast: false });
  return m.nights.filter((n) => n.date && (n.status === 'live' || n.status === 'cancelled'));
}

function NightsTab({ what, row, sheet }: {
  what: 'guests' | 'raffle';
  row: (night: Night, open: () => void) => ReactNode;
  sheet: (night: Night, close: () => void) => ReactNode;
}) {
  const c = useEventChoice();
  const [open, setOpen] = useState<Night | null>(null);
  const nights = useMemo(() => nightsOfChoice(c), [c]);
  return (
    <Gate c={c} what={what}>
      {() => nights.length === 0 ? (
        <V2State testId={`v2-${what}-nonights`} sentence={`${c.event!.name} has no coming dates.`}>
          <Link className={linkBtn} style={TAP} to={P3_PATHS.eventDates(c.event!.id)}>Add dates</Link>
        </V2State>
      ) : (
        <div className="p3-stack" data-testid={`v2-${what}-tab`}>
          {nights.map((n) => (
            <section key={n.key} className="p3-stack-s" aria-label={n.dayLabel}>
              <h2 className="p3-h2">{n.dayLabel}</h2>
              {row(n, () => { vibrate('tap'); setOpen(n); })}
            </section>
          ))}
          {open && sheet(open, () => setOpen(null))}
        </div>
      )}
    </Gate>
  );
}

/** Guest list: the chosen event's nights, each opening the existing guest list sheet. */
export function V2GuestsTab() {
  return <NightsTab what="guests" row={(n, o) => <GuestListRow night={n} onOpen={o} />} sheet={(n, x) => <GuestListSheet night={n} onClose={x} />} />;
}

/** Raffle: the chosen event's nights, each opening the existing raffle sheet (open / close stays its own confirm). */
export function V2RaffleTab() {
  return <NightsTab what="raffle" row={(n, o) => <RaffleRow night={n} onOpen={o} />} sheet={(n, x) => <RaffleSheet night={n} onClose={x} />} />;
}
