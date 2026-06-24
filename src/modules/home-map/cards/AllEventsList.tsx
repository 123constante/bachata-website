// Festival Map -- shared "All Events" list body for both the mobile sheet and
// the desktop rail, so the today-emphasis + "further afield" treatment stays in
// sync across surfaces. Local London rows lead (today's group is highlighted);
// remote festivals abroad are partitioned into a collapsed section at the bottom
// so the default chronological stream keeps its promise ("What's on in London")
// and has a real floor instead of trailing into next-year events on another
// continent.

import { useState } from 'react';
import { ChevronDown, Globe, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UseMapListResult } from '../useMapList';
import { groupByDate, collapseFestivals, partitionRemote } from '../mapListDerivations';
import { todayStr, distanceMiles } from '../mapTypes';
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
    sticky && 'sticky top-0 z-10 bg-background',
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

/** Collapsed "Festivals further afield" disclosure: the remote (other-city)
 *  festivals, date-grouped, hidden by default behind a counted toggle so the
 *  local list bottoms out cleanly. */
function FurtherAfield({ remote }: { remote: UseMapListResult['listEvents'] }) {
  const [open, setOpen] = useState(false);
  if (remote.length === 0) return null;
  const groups = groupByDate(collapseFestivals(remote));
  return (
    <section className="pt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn('flex w-full items-center gap-2 rounded-lg px-1 py-2 text-left', focusRing)}
      >
        <Globe className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="text-xs font-bold text-foreground">Festivals further afield</span>
        <span className="text-[11px] font-bold tabular-nums text-muted-foreground">{remote.length}</span>
        <span className="h-px flex-1 bg-border" />
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="space-y-3 pt-2">
          {groups.map((g) => (
            <section key={g.key}>
              <header className="flex items-center gap-2 px-1 pb-1.5 pt-1">
                <span className="truncate text-xs font-bold text-muted-foreground">{g.label}</span>
                <span className="h-px flex-1 bg-border" />
                <span className="shrink-0 text-[10px] font-bold text-muted-foreground">{g.items.length}</span>
              </header>
              <div className="space-y-1">
                {g.items.map((e) => (
                  <RemoteFestivalRow key={e.occurrence_id} event={e} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
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

/** The "All Events" body: local date-grouped rows (today highlighted) followed
 *  by the collapsed remote-festivals section. Shared by mobile + desktop. */
export function AllEventsList({
  state,
  showSearchEmpty,
  stickyHeaders,
}: {
  state: UseMapListResult;
  showSearchEmpty?: boolean;
  /** Pin each day's header to the top of the scroll as you pass it (mobile feed,
   *  one tall scroller). Off on desktop, whose rail header would collide. */
  stickyHeaders?: boolean;
}) {
  const today = todayStr();
  const [nearest, setNearest] = useState(false);
  const coords = state.geo.coords;
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = todayStr(tomorrowDate);
  const { local, remote } = partitionRemote(state.listEvents);
  const groups = groupByDate(collapseFestivals(local));
  // When located, optionally re-order each day's rows nearest-first -- kept
  // WITHIN the day so the date timeline is preserved (not a global distance sort).
  const orderItems = (items: typeof local) =>
    nearest && coords
      ? [...items].sort((a, b) => {
          const da = distanceMiles(a, coords);
          const db = distanceMiles(b, coords);
          if (da == null && db == null) return 0;
          if (da == null) return 1;
          if (db == null) return -1;
          return da - db;
        })
      : items;

  if (groups.length === 0 && remote.length === 0) {
    return (
      <EmptyState>
        {state.q && showSearchEmpty
          ? 'No events match your search.'
          : state.filter !== 'all'
            ? 'No events match this filter.'
            : 'Nothing on right now.'}
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      {state.geo.status === 'idle' && <LocationStrip onUse={state.geo.request} />}
      {coords && groups.length > 0 && (
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
      {groups.map((g) => (
        <section key={g.key}>
          <GroupHeader label={g.label} count={g.items.length} isToday={g.key === today} isTomorrow={g.key === tomorrow} sticky={stickyHeaders} />
          <div className="space-y-1">
            {orderItems(g.items).map((e) => (
              <EventRow
                key={e.occurrence_id}
                event={e}
                selected={state.selected === e.occurrence_id}
                onSelect={state.fromCard}
                onHover={state.setHovered}
                showFreshness
                user={state.geo.coords}
              />
            ))}
          </div>
        </section>
      ))}
      <FurtherAfield remote={remote} />
    </div>
  );
}
