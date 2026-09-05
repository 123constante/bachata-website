// Festival Map home -- the TEASER card.
//
// This module used to carry two full map chromes (mobile: fullscreen + inline
// preview + coach pill; desktop: zoom/locate/reframe stack + native popups +
// pin->feed scroll sync) and was the one place on the homepage where a JS
// viewport branch was legal. Both are GONE, and with them the exception: the
// card is now the same thing at every viewport and the only difference is its
// height, which is CSS (.hm-mapcard). Nothing here branches on the viewport, so
// there is no longer a viewport branch to justify -- see ./viewport for why that
// matters (React #421, and why UA sniffing is not an option).
//
// What the card is now: a real, live, DRAGGABLE Leaflet map -- the pan feel is
// the half worth keeping -- with a hook bar over its foot and exactly one rule
// for interaction. Any tap, on a pin or on empty ground, opens the map page.
// No zoom of any kind, no controls, no preview, no fullscreen. Everything that
// let someone half-use a map inside a 148px card now lives on
// /city/:citySlug/map, where there is room for it.
//
// It stays lazy AND mapMounted-gated by HomeMapShell (Leaflet touches `window`
// at module load), so it is still never imported on the server.

import { useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UseMapListResult } from './useMapList';
import { focusRing } from './cards/controls';
import EventMap from './EventMap';

// Constrain the teaser to Greater London so a fling rubber-bands back rather
// than drifting to empty ocean (EventMap applies maxBoundsViscosity). The card
// cannot zoom out, so without this a hard drag strands it on blank sea with no
// way back except reloading.
const GREATER_LONDON: [[number, number], [number, number]] = [
  [51.25, -0.55],
  [51.72, 0.34],
];

const noop = () => {};

/** Distinct venues among the pins the map is ACTUALLY drawing right now.
 *
 *  The hook's headline number is derived from the same `visible` list the map
 *  is given, never from the whole city, so the title can never claim a count
 *  the card is not showing. That is the entire reason this is computed here
 *  rather than read off `stats.venues`: on the Tonight tab those two numbers
 *  are different, and the one the eye can check is this one. */
function drawnVenueCount(pins: UseMapListResult['pins'], visible: string[]): number {
  const shown = new Set(visible);
  const venues = new Set<string>();
  for (const p of pins) {
    if (!shown.has(p.occurrence_id)) continue;
    // Fall back to the coordinate when a row has no venue name: two unnamed
    // pins at different places are two venues, and collapsing them onto one
    // empty-string key would undercount exactly what the map is drawing.
    venues.add(p.venue_name ?? `@${p.lat},${p.lng}`);
  }
  return venues.size;
}

export default function HomeMapCard({
  state,
  cityName,
  citySlug,
}: {
  state: UseMapListResult;
  cityName: string;
  citySlug: string;
}) {
  const navigate = useNavigate();

  // TONIGHT, WITH NOTHING ON. Some weeknights the tab's filter is empty, and an
  // empty map with no message is indistinguishable from a broken one -- which is
  // this arc's founding defect one layer up (a watermarked basemap served at
  // HTTP 200 that nothing could see). So the card falls back to every venue and
  // the title says why, rather than painting a blank fenced view of London.
  const tonightIsEmpty = state.tab === 'tonight' && state.mapVisible.length === 0;
  const allOccIds = useMemo(() => state.pins.map((p) => p.occurrence_id), [state.pins]);
  const visible = tonightIsEmpty ? allOccIds : state.mapVisible;

  const drawn = useMemo(() => drawnVenueCount(state.pins, visible), [state.pins, visible]);

  // THE HANDOFF. Opening from the Tonight tab carries that filter to the map
  // page, which shows it as a REMOVABLE chip -- arriving at a near-empty map
  // with no way to see or drop a filter you did not set is indistinguishable
  // from a map that is simply missing venues.
  // Not carried when tonight is empty: the card is drawing every venue in that
  // state and saying so, and handing over a filter that yields nothing would
  // make the map page contradict the card that opened it.
  const mapHref =
    state.tab === 'tonight' && !tonightIsEmpty
      ? `/city/${citySlug}/map?from=tonight`
      : `/city/${citySlug}/map`;

  const title = tonightIsEmpty
    ? `Nothing on tonight \u2014 ${drawn} venues on the map`
    : state.tab === 'tonight'
      ? `${drawn} venues tonight`
      : `${drawn} venues on the map`;

  // THE LADDER, and why Tonight normally has no chips. Measured over 28 days,
  // the event count equalled the venue count on 25 of them -- so a "N tonight"
  // chip beside a title that already says "N venues tonight" repeats the
  // title's own number. Dropping it takes the overlay from 76px to 58px, which
  // is 19 more pixels of visible map in a 148px card.
  // The empty-Tonight case is the exception and gets the ladder back: when the
  // answer is "nothing", "13 in the next 3 days" is the useful next thing to
  // say, and a dead end is the one outcome this card must not produce.
  const showLadder = state.tab !== 'tonight' || tonightIsEmpty;

  const openMap = useCallback(() => navigate(mapHref), [navigate, mapHref]);

  return (
    // Full-bleed layer inside .hm-mapcard. Positioned so EventMap's absolutely
    // positioned canvas fills it, and it creates no stacking context of its own,
    // so the hook below still resolves against Leaflet's panes.
    <div className="absolute inset-0">
      <EventMap
        events={state.pins}
        visible={visible}
        glow={state.glow}
        // Nothing on the teaser is selectable, so nothing is selected or
        // hovered. Passing state.mapSelected here would paint a selected-pin
        // ring for a selection made in the FEED, on a pin that cannot be
        // tapped -- an affordance pointing at nothing.
        selected={null}
        hovered={null}
        onSelect={noop}
        onHover={noop}
        onReady={state.onMapReady}
        teaser
        onTeaserTap={openMap}
        popupMode="none"
        compact
        maxBounds={GREATER_LONDON}
        minZoom={10}
      />

      {/* The hook: a gradient bar over the FOOT of the map, not a strip below it
          and not a badge. pointer-events:none on the bar itself, so the gradient
          never eats a drag that starts low in the card -- only the CTA inside it
          takes pointer events. */}
      <div className="hm-hook pointer-events-none absolute inset-x-0 bottom-0 z-[500] px-3 pb-2 pt-7">
        <p className="truncate text-[13.5px] font-bold tracking-tight text-white">{title}</p>
        <div className="mt-1.5 flex items-center gap-1.5">
          {showLadder && (
            <>
              <Chip n={state.stats.tonight} label="tonight" />
              <Chip n={state.stats.next3} label="next 3 days" />
              <Chip n={state.stats.month30} label="this month" />
            </>
          )}
          {/* The ONE focusable control in the card, and the only one that needs
              to be: a real <a>, so it is crawlable, middle-clickable and
              openable in a new tab, and so keyboard and screen-reader users
              reach the map page without the map itself pretending to be a
              button. A tap anywhere else on the card is handled by Leaflet and
              routed through onTeaserTap -- the same destination by a different
              road, which is why this link must not also cover the card. */}
          <Link
            to={mapHref}
            aria-label={`Open the full map: ${drawn} venues in ${cityName}`}
            className={cn(
              'pointer-events-auto ml-auto inline-flex items-center gap-0.5 rounded-full bg-primary px-2.5 py-1',
              'text-[11.5px] font-bold text-primary-foreground',
              focusRing,
            )}
          >
            Open map
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}

/** One ladder chip. Zero is still worth showing: "0 tonight" beside "13 next 3
 *  days" is information, and hiding it would make the row's width jump around
 *  by day of week. */
function Chip({ n, label }: { n: number; label: string }) {
  return (
    <span className="rounded-full border border-white/15 bg-white/10 px-2 py-[2.5px] text-[10.5px] font-semibold text-[#cfd5e4]">
      <b className="font-bold text-white">{n}</b> {label}
    </span>
  );
}
