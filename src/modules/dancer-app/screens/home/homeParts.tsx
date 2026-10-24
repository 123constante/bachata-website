import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { TEXT_ACTION, TILE_CLASS } from '../blocks';
import { DANCER_TABS } from '../../shell/routes';
import { FIND_A_NIGHT } from '../../copy/sharedCopy';
import type { Night } from '../nights/nightsModel';

/**
 * Home's going-shaped VIEWS, with no going import: the hero and the "Upcoming nights"
 * tile render here in every state, and the going words and numbers come in as a
 * HomeGoing value from homeGoing.tsx, which HomeScreen lazy-loads only while the going
 * switch is on (the CalendarGoingFeed pattern). Switch off, /app/* loads none of the
 * going module (perf-budgets.json, dancer-app row).
 */

const NIGHTS_TAB = DANCER_TABS.find((t) => t.id === 'nights')?.path ?? '/app';

/** The hero's night, already in words (homeGoing.tsx maps it from the going list). */
export type HeroNight = { name: string; inDays: string; place: string; tag: string; href: string | null };

/**
 * Everything Home shows from the going list (get_my_going_v1 through useMyNights), already
 * in the going module's words. Built ONLY by homeGoing.tsx. The words are null while the
 * feed is still loading (HomeScreen's HOME_GOING_LOADING), when nothing that needs them is on screen.
 */
export type HomeGoing = {
  isLoading: boolean;
  isError: boolean;
  retry: () => void;
  /** The next night going ahead, or null (empty hero). */
  hero: HeroNight | null;
  /** The module's "how a night gets here" line under the empty hero. */
  how: string | null;
  /** Rate-nudge candidates (nudgeCandidates over the past list). */
  nudge: Night[];
  todayKey: string;
  /** THE upcoming going count (tile and strip); null until the list has loaded. */
  goingCount: number | null;
  /** Past nights the person went to (mapMyGoing's past list, the strip's Went); null until loaded. */
  wentCount: number | null;
  /** The strip's Going cell label (the module's tag). */
  tagGoing: string | null;
  /** The words under the tile's number. */
  tileHelp: string | null;
};


/**
 * `night` null = the empty hero ("No upcoming night yet."), which also covers loading and
 * failed. `how` = the going module's "how a night gets here" line, shown only while the
 * switch is on; off, the empty hero says only how to find a night.
 */
export const HomeHero = ({
  night,
  isLoading = false,
  isError = false,
  retry,
  how = null,
}: {
  night: HeroNight | null;
  isLoading?: boolean;
  isError?: boolean;
  retry?: () => void;
  how?: string | null;
}) => (
  <section data-testid="home-hero" className={night ? 'da-hero' : `${TILE_CLASS} p-[16px]`}>
    {night ? (
      <>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Your next night &middot; {night.inDays}</div>
        <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.15, margin: '4px 0', overflowWrap: 'anywhere' }}>{night.name}</div>
        <div style={{ fontSize: 14, marginBottom: 10 }}>
          {night.place} &middot; {night.tag}
        </div>
        {/* Review S4: full width, 52px+, light fill and dark text from the tokens (the one primary on Home). */}
        {night.href && <a href={night.href} className="da-tap da-hero-cta">See event</a>}
      </>
    ) : (
      <>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Your next night</div>
        <div style={{ fontSize: 20, fontWeight: 800, margin: '4px 0 8px' }}>
          {isLoading ? 'Loading\u2026' : isError ? 'We couldn\u2019t load your nights.' : 'No upcoming night yet.'}
        </div>
        {!isLoading && !isError && (
          <p className="da-muted" style={{ margin: 0, fontSize: 14 }}>
            {how ? `${how} ${FIND_A_NIGHT}` : FIND_A_NIGHT}
          </p>
        )}
        {/* Review S2: a failure state always has one action. */}
        {isError && (
          <button type="button" className={TEXT_ACTION} onClick={retry}>Try again</button>
        )}
      </>
    )}
  </section>
);

const tile: CSSProperties = { minHeight: 112, borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--da-text)', textDecoration: 'none' };

/** The "Upcoming nights" tile (switch on only). `help` null while its words are still loading. */
export const GoingTileView = ({ value, isNumber, help }: { value: string; isNumber: boolean; help: string | null }) => (
  <Link to={NIGHTS_TAB} data-testid="tile-going" className={TILE_CLASS} style={{ ...tile }}>
    <b style={{ fontSize: 14 }}>Upcoming nights</b>
    {/* A number is big; the loading / failed words are body size so they fit the tile. */}
    <span style={{ fontSize: isNumber ? 28 : 14, fontWeight: 800, overflowWrap: 'anywhere' }} data-testid="tile-going-count">{value}</span>
    <span className="da-muted" style={{ fontSize: 13 }}>{help}</span>
  </Link>
);
