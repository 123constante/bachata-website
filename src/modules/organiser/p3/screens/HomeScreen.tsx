import { Link, Navigate, useLocation } from 'react-router-dom';
import { ClaimNotice } from '../../home/ClaimNotice';
import { needsOf, nextUpView, rowsOf, type P3Row } from '../data/home';
import { viewsTotal } from '../data/stats';
import { useP3Home, useP3Views } from '../data/useP3Data';
import { L, nextUpAdviceOf } from '../model';
import { P3_PATHS } from '../shell/paths';
import { flags } from '@/lib/featureFlags';
import { GetPaidPrompt, TicketsSoldTile } from '../tickets/GetPaid';
import { GraceBanner } from './GraceBanner';
import { P3NightGoing } from './P3Going';
import { AddEventLink, EventList, P3Link, GoingTile, KindChip, RetryButton, StateCard, StatusTag, Thumb } from './parts';

/** Why there is no Next up, and the one control that works for it (F-16: model/status.ts nextUpAdviceOf). */
function NoNextUp({ rows }: { rows: readonly P3Row[] }) {
  const advice = nextUpAdviceOf(rows);
  return (
    <StateCard title="Nothing coming up" testId="p3-nextup-none">
      <p>{advice.copy}</p>
      {advice.action === 'new' ? <AddEventLink /> : <P3Link to={P3_PATHS.events} testId="p3-nextup-events">Open your events</P3Link>}
    </StateCard>
  );
}

/** Welcome's claim / create line, carried in the router state (P3 W4b). */
function confirmationOf(state: unknown): string | null {
  const c = (state as { confirmation?: unknown } | null)?.confirmation;
  return typeof c === 'string' && c.trim() ? c : null;
}

/** C3 Home: Next up, Needs you, the last 30 days' views, the first four events. Reads only. */
export function HomeScreen() {
  const home = useP3Home();
  const views = useP3Views();
  const confirmation = confirmationOf(useLocation().state);

  if (home.isPending) {
    return (
      <StateCard title="Loading your events&hellip;" testId="p3-home-loading">
        This takes a second. Your tabs below work while it loads.
      </StateCard>
    );
  }
  if (home.isError) {
    return (
      <StateCard title="We couldn&rsquo;t load your events" testId="p3-home-error">
        <p>Check your connection, then try again.</p>
        <RetryButton onClick={() => void home.refetch()} />
      </StateCard>
    );
  }

  // W4b: no page yet is P3's Welcome (find, claim or create), not an empty Home.
  if (home.data.organisers.length === 0) {
    // A claim or create lands here while the home read is still refetching: wait for it, or the
    // stale "no page" answer would send the person straight back to Welcome (walk, W4b).
    if (confirmation && home.isFetching) {
      return <StateCard title="Loading your events&hellip;" testId="p3-home-loading">This takes a second.</StateCard>;
    }
    return <Navigate to={P3_PATHS.start} replace />;
  }

  // A claim or a create that just landed here says so (W4b), and so do pages claimed at sign-in.
  const said = (
    <>
      {confirmation && <p className="p3-ok" role="status" data-testid="p3-home-confirmation">{confirmation}</p>}
      <ClaimNotice />
      <GraceBanner />
    </>
  );

  const rows = rowsOf(home.data);
  if (!rows.length) {
    return (
      <div className="p3-stack">
        {said}
        <StateCard title="No events here yet" testId="p3-home-empty">
          <p>When you run an event on Bachata Calendar it shows here. You can add one now.</p>
          <AddEventLink />
        </StateCard>
      </div>
    );
  }

  const next = nextUpView(rows, home.data);
  const needs = needsOf(rows);
  // the same current / past split as Events (seriesLife via statusOf)
  const listed = rows.filter((r) => !r.status.past);
  const total = views.data ? viewsTotal(views.data) : null;

  return (
    <div className="p3-stack" data-testid="p3-home">
      {said}
      {next ? (
        <section className="p3-card p3-hero" data-testid="p3-nextup" aria-label="Next up">
          <div className="p3-hero-top">
            <Thumb row={next.row} />
            <div className="p3-row-tags">
              <KindChip row={next.row} />
              <StatusTag row={next.row} />
            </div>
          </div>
          <div className="p3-when">{next.when}</div>
          <div className="p3-hero-name">{next.row.name}</div>
          {next.row.place && <div className="p3-row-s">{next.row.place}</div>}
          {next.different && <div className="p3-row-s" data-testid="p3-different">This date is different from usual.</div>}
          {next.row.next && (
            <P3NightGoing seriesId={next.row.id} seriesName={next.row.name} nightKey={{ date: next.row.next.date }} testId="p3-nextup-going" />
          )}
        </section>
      ) : (
        <NoNextUp rows={rows} />
      )}

      {flags.organiserTicketing && <GetPaidPrompt />}

      {needs.length > 0 && (
        <section aria-label="Needs you">
          <h2 className="p3-h2">
            Needs you <span className="p3-count">{needs.length}</span>
          </h2>
          <ul className="p3-card p3-list" data-testid="p3-needs">
            {needs.map((n) => (
              <li key={n.key} className="p3-todo" data-key={n.key}>
                <div className="p3-row-t">{n.title}</div>
                <div className="p3-row-s">{n.detail}</div>
              </li>
            ))}
          </ul>
          <p className="p3-note">
            <P3Link to={P3_PATHS.events} testId="p3-needs-events">Sort these in Events</P3Link>
          </p>
        </section>
      )}

      <section aria-label="Last 30 days">
        <h2 className="p3-h2">Last 30 days</h2>
        <div className="p3-pair">
          {views.isError ? (
            <StateCard title="Views didn&rsquo;t load" testId="p3-views-error">
              <RetryButton onClick={() => void views.refetch()} />
            </StateCard>
          ) : total === null ? (
            <StateCard title="Loading views&hellip;" testId="p3-views-loading">Counting the last 30 days.</StateCard>
          ) : total > 0 ? (
            <Link to={P3_PATHS.stats} className="p3-card p3-stat p3-tap" data-testid="p3-views">
              <span className="p3-stat-n">{total}</span>
              <span className="p3-stat-l">{L.views} of your events &middot; see Stats</span>
            </Link>
          ) : (
            <StateCard title="No views yet" testId="p3-views-none">
              Views show up as soon as dancers start opening your event. Sharing the link on Instagram or WhatsApp helps.
            </StateCard>
          )}
          <GoingTile />
          {flags.organiserTicketing && <TicketsSoldTile />}
        </div>
      </section>

      <section aria-label="All your events">
        <h2 className="p3-h2 p3-h2-row">
          <span>All your events</span>
          {rows.length > Math.min(4, listed.length) && (
            <Link className="p3-link" to={P3_PATHS.events}>
              See all {rows.length}
            </Link>
          )}
        </h2>
        {listed.length ? (
          <EventList rows={listed.slice(0, 4)} label="Your first events" />
        ) : (
          <StateCard title="Nothing current" testId="p3-home-allended">
            <p>Your events have finished or have nothing coming up.</p>
            <Link className="p3-link" to={P3_PATHS.events}>See them in Events</Link>
          </StateCard>
        )}
      </section>
    </div>
  );
}
