// Festival Map -- shared "All Events" list body for both the mobile sheet and
// the desktop rail, so the today-emphasis treatment stays in sync across
// surfaces. Local rows lead (today's group is highlighted); remote festivals
// (dated outside the local 90-day query) follow in their own labelled section
// BELOW the load-more sentinel, so growing the feed window can never displace
// them and the local stream keeps answering "What's on in {city}".
//
// The section is always OPEN -- it is a signpost, not a disclosure. It was a
// collapsed toggle, which hid festivals behind a tap nobody made; a plain
// chronological interleave was tried instead and was worse again (see
// mapListDerivations.windowGroups for why pinning rows past the window
// scrolls the reader backwards).

import { useEffect, useMemo, useRef, useState } from 'react';
import { Globe, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UseMapListResult } from '../useMapList';
import {
  groupByDate,
  collapseFestivals,
  partitionRemote,
  windowGroups,
  INITIAL_FEED_DAYS,
  FEED_DAYS_CHUNK,
} from '../mapListDerivations';
import { distanceMiles } from '../mapTypes';
import { addDaysToKey } from '@/lib/londonDate';
import { EventRow, EmptyState, RemoteFestivalRow } from './cards';
import { focusRing } from './controls';

/** Date-group header. Today's group is dominant (amber TODAY pill + foreground
 *  label + amber rule/count); every later day is muted, so the eye lands on
 *  tonight first and future dates read as "scroll down for more". */
function GroupHeader({
  label,
  count,
  isToday,
  isTomorrow,
  sticky,
}: {
  label: string;
  count: number;
  isToday: boolean;
  isTomorrow?: boolean;
  sticky?: boolean;
}) {
  // Opaque bg + sticky so the day label pins to the top of the long scroll and
  // the user never loses which day they're scanning. Rows below are transparent
  // over the same bg, so nothing bleeds through while it's stuck.
  const base = cn(
    'flex items-center gap-2 px-1 pb-1.5 pt-1',
    // Opaque bg + a pseudo strip directly above it so the sticky header covers
    // the feed's top padding / inter-group gap (no previous row peeks through).
    // The colour is the SHELL's (#11121a), not --background (pure black): the feed
    // has no background of its own and shows .home-map-fill through, so a
    // bg-background header would stick out as a black band against it.
    sticky &&
      "sticky top-0 z-10 bg-[#11121a] before:absolute before:inset-x-0 before:bottom-full before:h-3 before:bg-[#11121a] before:content-['']",
  );
  if (isToday) {
    return (
      <header className={base}>
        <span className="shrink-0 rounded-md bg-primary px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-primary-foreground">
          Today
        </span>
        <span className="truncate text-xs font-bold text-foreground">{label}</span>
        <span className="h-px flex-1 bg-primary/30" />
        <span className="shrink-0 text-[11px] font-extrabold tabular-nums text-primary">{count}</span>
      </header>
    );
  }
  return (
    <header className={base}>
      {isTomorrow && (
        <span className="shrink-0 rounded-md border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Tomorrow
        </span>
      )}
      <span className="truncate text-xs font-bold text-muted-foreground">{label}</span>
      <span className="h-px flex-1 bg-border" />
      <span className="shrink-0 text-[10px] font-bold text-muted-foreground">{count}</span>
    </header>
  );
}

/** "Festivals further afield": the remote festivals, date-grouped, ALWAYS open.
 *  Rendered below the local feed's load-more sentinel, so expanding the window
 *  never moves it. The label and count are load-bearing -- without them the
 *  jump from July to November reads as "nothing is on in between", and
 *  RemoteFestivalRow's only travel signal is a 12px pin. */
function FurtherAfield({ remote }: { remote: UseMapListResult['listEvents'] }) {
  // Grouped unconditionally now (no open/closed state to defer behind), but
  // still memoised: this sits inside the feed, so it re-renders whenever a
  // sibling row is hovered.
  const groups = useMemo(() => groupByDate(collapseFestivals(remote)), [remote]);
  if (remote.length === 0) return null;
  return (
    <section className="pt-1">
      <header className="flex items-center gap-2 px-1 py-2">
        <Globe className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-xs font-bold text-foreground">Festivals further afield</h2>
        <span className="text-[11px] font-bold tabular-nums text-muted-foreground">
          {remote.length}
        </span>
        <span className="h-px flex-1 bg-border" />
      </header>
      <div className="space-y-3">
        {groups.map((g) => (
          <section key={g.key}>
            <header className="flex items-center gap-2 px-1 pb-1.5 pt-1">
              <span className="truncate text-xs font-bold text-muted-foreground">{g.label}</span>
              <span className="h-px flex-1 bg-border" />
              <span className="shrink-0 text-[10px] font-bold text-muted-foreground">
                {g.items.length}
              </span>
            </header>
            <div className="space-y-1">
              {g.items.map((e) => (
                <RemoteFestivalRow key={e.occurrence_id} event={e} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

/** Discreet prompt to share location on the default view, so granting it pays
 *  off here (rows gain a distance chip) and the feature is discoverable without
 *  digging into the Tonight tab or the unlabelled map compass. Shown only while
 *  the request hasn't been made; once granted/denied it gives way to distances. */
function LocationStrip({ onUse }: { onUse: () => void }) {
  return (
    <button
      type="button"
      onClick={onUse}
      className={cn(
        'flex w-full items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-left text-sm font-bold text-primary',
        focusRing,
      )}
    >
      <Navigation className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>See what&rsquo;s nearest</span>
      <span className="font-semibold text-primary/70">&middot; use my location</span>
    </button>
  );
}

/** The "All Events" body: date-grouped rows, today highlighted, local and
 *  remote festivals interleaved in one chronological stream. Shared by
 *  mobile + desktop. */
export function AllEventsList({
  state,
  showSearchEmpty,
  stickyHeaders,
}: {
  state: UseMapListResult;
  showSearchEmpty?: boolean;
  /** Pin each day's header to the top of the scroll as you pass it. Safe at every
   *  viewport now: the feed is the one scroller and the tabs/heading sit OUTSIDE
   *  it, so a stuck header has nothing to collide with. */
  stickyHeaders?: boolean;
}) {
  // NOT todayStr(): this list server-renders, and a render-time clock read would
  // let the client derive a different "today" from hour-old cached HTML and
  // discard the server tree. state.today is pinned to the server's day for the
  // first render, then rolls over (see useMapList / homeClock).
  const today = state.today;
  const [nearest, setNearest] = useState(false);
  const coords = state.geo.coords;
  const tomorrow = addDaysToKey(today, 1);
  // Memoised: partitionRemote -> collapseFestivals -> groupByDate is real work
  // over the whole feed (up to ~380 rows), and this component re-renders on
  // every hover/selection change. state.listEvents is already identity-stable
  // (only changes when the query result changes), so keying on it here skips
  // the chain on every hover-driven render.
  const { local, remote } = useMemo(() => partitionRemote(state.listEvents), [state.listEvents]);
  const groups = useMemo(() => groupByDate(collapseFestivals(local)), [local]);

  // Windowed SSR (see mapListDerivations.INITIAL_FEED_DAYS). The server and the
  // client's FIRST render must agree exactly or React #421 blanks the page, so the
  // window starts at the same constant on both and only ever grows in the effect
  // below (post-hydration). Searching shows every match: q is '' on the server and
  // first client render, so this stays hydration-identical -- a query is only ever
  // set by a keystroke, long after hydration.
  const searching = state.q.trim().length > 0;
  const [visibleDays, setVisibleDays] = useState(INITIAL_FEED_DAYS);
  // Memoised so the sort below has a stable input to key on: windowGroups
  // slices, i.e. returns a fresh array every call.
  const { visible: shownGroups, hasMore } = useMemo(
    () =>
      searching
        ? { visible: groups, hasMore: false }
        : windowGroups(groups, visibleDays),
    [searching, groups, visibleDays],
  );

  // Grow the window when the reader reaches the end of it. An IntersectionObserver
  // rooted on the FEED scroller (state.listRef) -- not the viewport: the feed is an
  // overflow-y-auto container, so a viewport-rooted observer would never fire for a
  // sentinel nested inside it. Re-armed on each expansion (the sentinel moves down
  // as rows render), and torn down once every day-group is shown (hasMore false).
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (searching || !hasMore) return;
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleDays((v) => v + FEED_DAYS_CHUNK);
        }
      },
      { root: state.listRef.current ?? null, rootMargin: '600px 0px' },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [searching, hasMore, visibleDays, state.listRef]);
  // When located, optionally re-order each day's rows nearest-first -- kept
  // WITHIN the day so the date timeline is preserved (not a global distance sort).
  //
  // Memoised, and each row's distance is computed ONCE up front rather than
  // twice per comparison: this ran a pair of haversines per compare, for every
  // visible group, on every render -- including the hover-driven re-renders the
  // memos above exist to make cheap.
  //
  // Distances for the rows actually on screen. Keyed on the VISIBLE window, not
  // on the whole local set: only the first INITIAL_FEED_DAYS of day-groups
  // render up front (~25-30 rows of ~380), so haversining everything meant ~92%
  // of the work was for rows nobody had scrolled to yet -- on the first render
  // after coords resolve, which is exactly the path this module tries to keep
  // cheap.
  const distances = useMemo(() => {
    const m = new Map<string, number | null>();
    if (!coords) return m;
    for (const g of shownGroups) {
      for (const e of g.items) m.set(e.occurrence_id, distanceMiles(e, coords));
    }
    return m;
  }, [shownGroups, coords]);

  // Whether "Nearest" could actually reorder anything. Holding coords is not
  // enough: a feed can be entirely coordless (every remote festival is, and a
  // local feed can be), in which case the comparator returns 0 for every pair
  // and the control renders inert -- the dead-sort-control defect an earlier
  // review round already flagged on this component.
  const hasDistances = useMemo(
    () => [...distances.values()].some((mi) => mi != null),
    [distances],
  );

  // The rows each group renders, nearest-first when asked, each carrying the
  // distance its chip needs so EventRow does not recompute the same haversine.
  //
  // Deliberately NOT cached across renders. A per-group-key cache lived here
  // briefly and was wrong twice over: it validated only on the group's items
  // identity, so flipping Nearest/Time -- which changes neither the groups nor
  // their rows -- hit the cache and returned the previous order, making the sort
  // control silently inert; and it wrote to a ref during the render phase, which
  // React can populate from an abandoned concurrent render. It was optimising
  // scroll-expansion work whose cost never showed above the measurement noise on
  // this feed, so the correct trade is to not have it.
  const orderedGroups = useMemo(
    () =>
      shownGroups.map((g) => {
        const items = g.items.map((e) => ({ e, mi: distances.get(e.occurrence_id) ?? null }));
        if (nearest && coords) {
          items.sort((a, b) => {
            if (a.mi == null && b.mi == null) return 0;
            if (a.mi == null) return 1;
            if (b.mi == null) return -1;
            return a.mi - b.mi;
          });
        }
        return { ...g, items };
      }),
    [shownGroups, nearest, coords, distances],
  );

  // Both empty, not just the local stream: a feed carrying only remote
  // festivals still has something to show.
  if (groups.length === 0 && remote.length === 0) {
    return (
      <EmptyState>
        {state.q && showSearchEmpty ? 'No events match your search.' : 'Nothing on right now.'}
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      {state.geo.status === 'idle' && <LocationStrip onUse={state.geo.request} />}
      {coords && hasDistances && (
        <div className="flex items-center justify-end gap-1.5 text-[11px] font-bold">
          <span className="text-muted-foreground">Sort</span>
          <div className="inline-flex overflow-hidden rounded-full border border-border">
            <button
              type="button"
              aria-pressed={!nearest}
              onClick={() => setNearest(false)}
              className={cn('px-2.5 py-1', !nearest ? 'bg-primary text-primary-foreground' : 'text-muted-foreground', focusRing)}
            >
              Time
            </button>
            <button
              type="button"
              aria-pressed={nearest}
              onClick={() => setNearest(true)}
              className={cn('px-2.5 py-1', nearest ? 'bg-primary text-primary-foreground' : 'text-muted-foreground', focusRing)}
            >
              Nearest
            </button>
          </div>
        </div>
      )}
      {orderedGroups.map((g) => (
        <section key={g.key}>
          <GroupHeader label={g.label} count={g.items.length} isToday={g.key === today} isTomorrow={g.key === tomorrow} sticky={stickyHeaders} />
          <div className="space-y-1">
            {g.items.map(({ e, mi }) => (
              <EventRow
                key={e.occurrence_id}
                event={e}
                selected={state.selected === e.occurrence_id}
                onSelect={state.fromCard}
                onHover={state.setHovered}
                showFreshness
                today={today}
                distanceMi={mi}
              />
            ))}
          </div>
        </section>
      ))}
      {hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />}
      {/* AFTER the sentinel deliberately: growing the window appends day-groups
          above this point, so the section never moves under the reader. */}
      <FurtherAfield remote={remote} />
    </div>
  );
}
