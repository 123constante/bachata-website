import { groupsOf, rowsOf } from '../data/home';
import { useP3Home } from '../data/useP3Data';
import { L } from '../model';
import { AddEventLink, EventList, RetryButton, StateCard } from './parts';

const PAST = 'Past and nothing coming up';

/** C3 Events: every event, soonest first. Reads only. */
export function EventsScreen() {
  const home = useP3Home();
  if (home.isPending) {
    return <StateCard title="Loading your events&hellip;" testId="p3-events-loading">This takes a second.</StateCard>;
  }
  if (home.isError) {
    return (
      <StateCard title="We couldn&rsquo;t load your events" testId="p3-events-error">
        <p>Check your connection, then try again.</p>
        <RetryButton onClick={() => void home.refetch()} />
      </StateCard>
    );
  }
  const rows = rowsOf(home.data);
  if (!rows.length) {
    return (
      <StateCard title="No events here yet" testId="p3-events-empty">
        <p>Events you run show up here.</p>
        <AddEventLink />
      </StateCard>
    );
  }
  const g = groupsOf(rows);
  return (
    <div className="p3-stack" data-testid="p3-events">
      {g.on.length > 0 && <EventList rows={g.on} label="Your events" />}
      {g.hidden.length > 0 && (
        <section aria-label={L.hidden}>
          <h2 className="p3-h2">{L.hidden}</h2>
          <EventList rows={g.hidden} label={L.hidden} />
        </section>
      )}
      {g.finished.length > 0 && (
        <section aria-label={PAST}>
          <h2 className="p3-h2">{PAST}</h2>
          <EventList rows={g.finished} label={PAST} />
        </section>
      )}
      <p className="p3-note">
        Tap an event to open and change it, or <AddEventLink>add an event</AddEventLink>.
      </p>
    </div>
  );
}
