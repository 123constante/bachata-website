import { useEffect, useMemo } from 'react';
import { GOING_COPY } from '@/modules/going';
import { inDaysLabel, nextNight, nudgeCandidates, placeAndTime, statusLabel } from '../nights/nightsModel';
import { useMyNights } from '../nights/useMyNights';
import type { HomeGoing } from './homeParts';

/**
 * Home's going FEED: the one place on Home that reads the going module (get_my_going_v1
 * through useMyNights, the module's words). HomeScreen lazy-loads it only while the going
 * switch is on and it renders nothing: it hands the values back through `onGoing`, the
 * CalendarGoingFeed pattern. With the switch off (production) the /app/* first load
 * carries no going code (perf-budgets.json, dancer-app row).
 *
 * DATA only, on purpose: the views stay in HomeScreen / homeParts, so this chunk imports
 * nothing from the dancer-app chunk. A lazy chunk that imports from the dancer-app chunk
 * turns it into a non-facade chunk, its manifest key stops being
 * src/modules/dancer-app/dancer-app.tsx, and check:bundle-budget cannot find the /app/*
 * row (measured). A feed (not a Suspense swap) also keeps Home mounted while it loads.
 *
 * F7 (owner decision): the tile and the strip read ONE number from ONE source, the
 * count over get_my_going_v1 (goingUpcomingCount: every upcoming night not cancelled),
 * the same list the Nights screen shows.
 */

/** Under the tile's number: what it counts (the strip's "Going" cell is the same number). */
const GOING_TILE_HELP = GOING_COPY.myUpcomingTitle;

const HomeGoingFeed = ({ onGoing }: { onGoing: (going: HomeGoing) => void }) => {
  const { nights, todayKey, isError, isLoading, retry, goingCount } = useMyNights();
  const going = useMemo<HomeGoing>(() => {
    const hero = nextNight(nights.upcoming);
    return {
      isLoading,
      isError,
      retry,
      hero:
        hero && hero.date
          ? { name: hero.name, inDays: inDaysLabel(hero.date, todayKey), place: placeAndTime(hero), tag: statusLabel(hero), href: hero.href }
          : null,
      how: GOING_COPY.myUpcomingEmptyHow,
      nudge: nudgeCandidates(nights.past, todayKey),
      todayKey,
      goingCount,
      wentCount: goingCount === null ? null : nights.past.length,
      tagGoing: GOING_COPY.tagGoing,
      tileHelp: GOING_TILE_HELP,
    };
  }, [nights, todayKey, isError, isLoading, goingCount, retry]);
  useEffect(() => {
    onGoing(going);
  }, [going, onGoing]);
  return null;
};

export default HomeGoingFeed;
