import { useEffect, useMemo } from 'react';
import { GOING_COPY } from '@/modules/going';
import { nightNote, statusLabel, type Night } from './nightsModel';
import { useMyNights } from './useMyNights';
import type { NightRowData, NightsGoing } from './NightsScreen';

/**
 * The Nights screen's going FEED: the one place on Nights that reads the going module
 * (get_my_going_v1 through useMyNights, the module's words). NightsScreen lazy-loads it
 * only while the going switch is on; it renders nothing and hands the rows and words
 * back through `onGoing` (the CalendarGoingFeed pattern). With the switch off
 * (production) the /app/* first load carries no going code (perf-budgets.json,
 * dancer-app row). DATA only, so this chunk imports nothing from the dancer-app chunk
 * (screens/home/homeGoing.tsx says why that matters).
 */

/** Status colours (D121): Going teal, Went violet, Cancelled rose, the rest grey. Keys are the going module's tags. */
const STATUS_TONE: Record<string, string> = {
  [GOING_COPY.tagGoing]: 'da-tone-teal',
  [GOING_COPY.tagWent]: 'da-tone-violet',
  [GOING_COPY.tagCancelled]: 'da-tone-rose',
};
const statusTone = (tag: string): string => STATUS_TONE[tag] ?? 'da-tone-grey';

const row = (n: Night): NightRowData => {
  const tag = statusLabel(n);
  return { ...n, tag, tone: statusTone(tag), note: nightNote(n) };
};

const WORDS: NightsGoing['words'] = {
  empty: GOING_COPY.myUpcomingEmpty,
  emptyHow: GOING_COPY.myUpcomingEmptyHow,
  upcomingTitle: GOING_COPY.myUpcomingTitle,
  pastTitle: GOING_COPY.myPastTitle,
  pastEmpty: GOING_COPY.myPastEmpty,
};

const NightsGoingFeed = ({ onGoing }: { onGoing: (going: NightsGoing) => void }) => {
  const { isLoading, isError, retry, nights } = useMyNights();
  const going = useMemo<NightsGoing>(
    () => ({
      isLoading,
      isError,
      retry,
      nights: { upcoming: nights.upcoming.map(row), past: nights.past.map(row) },
      words: WORDS,
    }),
    [isLoading, isError, nights, retry],
  );
  useEffect(() => {
    onGoing(going);
  }, [going, onGoing]);
  return null;
};

export default NightsGoingFeed;
