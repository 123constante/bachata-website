import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, EmptyState, GhostButton } from '@/modules/organiser/ui';
import { GOING_CHECKIN_ENABLED } from '@/lib/goingCheckin';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { useMyDancerEdit } from '../../api/useMyDancerEdit';
import { LevelVote } from './LevelVote';
import { NIGHTS_OFF_LINE, placeAndTime } from './nightsDates';
import { NightsOff } from './NightsOff';
import type { Night } from './nightsModel';
import { MoonArt } from '../art';
import { ScreenTitle, SectionTitle } from '../blocks';
import { DateBlock, StatusPill } from './nightsUi';
import { FIND_A_NIGHT } from '../../copy/sharedCopy';

/**
 * Going P2: the nights the person said I'm going to (get_my_going_v1), in the
 * going module's words. The zero-nights state says how a night gets here (the
 * event page's one I'm going button) and how to find one (the home link top
 * left, D130); while the going switch is off the screen is NightsOff (only the
 * second line).
 *
 * The list and its words come from ONE lazy feed, nightsGoing.tsx, mounted only
 * while the going switch is on (the CalendarGoingFeed pattern): switch off,
 * the /app/* first load carries none of the going module (perf-budgets.json,
 * dancer-app row). The going words are in the feed's NightsGoing value; this
 * view has no going import.
 */
/** D130: no Browse events button anywhere in /app/*; the way on is the home link top left. Review S9: ONE sentence app-wide. */
export const NO_NIGHTS_FIND = FIND_A_NIGHT;
export { NIGHTS_OFF_LINE };

/** One row, already in the going module's words (nightsGoing.tsx maps it). */
export type NightRowData = Night & { tag: string; tone: string; note: string | null };

/** Everything Nights shows from the going list. Built ONLY by nightsGoing.tsx. */
export type NightsGoing = {
  isLoading: boolean;
  isError: boolean;
  retry: () => void;
  nights: { upcoming: NightRowData[]; past: NightRowData[] };
  /** The going module's words for the screen ('' while the feed is loading, when none shows). */
  words: { empty: string; emptyHow: string; upcomingTitle: string; pastTitle: string; pastEmpty: string };
};

/** The feed's chunk is on its way: the same as the list loading. */
const NIGHTS_GOING_LOADING: NightsGoing = {
  isLoading: true,
  isError: false,
  retry: () => undefined,
  nights: { upcoming: [], past: [] },
  words: { empty: '', emptyHow: '', upcomingTitle: '', pastTitle: '', pastEmpty: '' },
};

const NightsGoingFeed = lazyWithRetry(() => import('./nightsGoing'));

/** `rate`: this row carries its series' level vote (one per series, review N10: the vote is series-wide). */
const NightRow = ({ night, profileComplete, focused, rate }: { night: NightRowData; profileComplete: boolean; focused: boolean; rate: boolean }) => {
  const ref = useRef<HTMLLIElement | null>(null);
  const note = night.note;
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView?.({ block: 'center' });
  }, [focused]);
  return (
    <li
      ref={ref}
      data-testid="night-row"
      data-series={night.seriesId ?? undefined}
      data-status={night.status}
      data-focused={focused ? 'true' : undefined}
      className={`flex items-start gap-[10px] py-[10px]${focused ? ' rounded-[10px] outline outline-2 outline-offset-2 outline-[var(--gold)]' : ''}`}
    >
      <DateBlock dateKey={night.date} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-[8px]">
          {night.href ? (
            <a href={night.href} className="flex min-h-[44px] items-center break-words text-[15px] font-bold text-[var(--fg)]">
              {night.name}
            </a>
          ) : (
            <span className="flex min-h-[44px] items-center break-words text-[15px] font-bold">{night.name}</span>
          )}
          <StatusPill label={night.tag} tone={night.tone} />
        </div>
        <div className="text-[13px] text-[var(--mut)]">{placeAndTime(night) || 'Place to be confirmed'}</div>
        {note && (
          <div className="text-[13px] text-[var(--mut)]" data-testid="night-note">
            {note}
          </div>
        )}
        {rate && night.listed && night.seriesId !== null && night.status === 'ended' && (
          <div className="mt-[6px]">
            <LevelVote seriesId={night.seriesId} profileComplete={profileComplete} />
          </div>
        )}
      </div>
    </li>
  );
};

const NightsView = ({ going }: { going: NightsGoing }) => {
  const { isLoading, isError, retry, nights, words } = going;
  const profile = useMyDancerEdit();
  const [params] = useSearchParams();
  const focus = params.get('focus');
  const complete = profile.data?.complete === true;
  // One focused row: the most recent past night of that series.
  const focusedKey = focus ? nights.past.find((n) => n.seriesId === focus) : undefined;

  return (
    <div data-testid="dancer-screen-nights" className="grid gap-[12px]">
      <ScreenTitle>Nights</ScreenTitle>
      {isLoading && <p className="text-[var(--mut)]" role="status">Loading your nights&hellip;</p>}
      {isError && (
        <Card variant="padded" role="alert" className="grid gap-[8px]">
          <p className="m-0">We couldn&rsquo;t load your nights.</p>
          <GhostButton size="sm" onClick={retry}>Try again</GhostButton>
        </Card>
      )}
      {!isLoading && !isError && nights.upcoming.length === 0 && nights.past.length === 0 && (
        <EmptyState
          testId="nights-empty"
          icon={<MoonArt />}
          title={words.empty}
          body={
            <>
              <span className="block">{words.emptyHow}</span>
              <span className="block">{NO_NIGHTS_FIND}</span>
            </>
          }
        />
      )}
      {!isLoading && !isError && (nights.upcoming.length > 0 || nights.past.length > 0) && (
        <>
          <section aria-label="Upcoming nights" data-testid="nights-upcoming">
            <SectionTitle>{words.upcomingTitle}</SectionTitle>
            <Card variant="padded" className="py-[6px]">
              {nights.upcoming.length === 0 ? (
                <p className="my-[10px] text-[14px]" data-testid="nights-upcoming-empty">
                  {words.empty} {words.emptyHow} {NO_NIGHTS_FIND}
                </p>
              ) : (
                <ul className="m-0 list-none divide-y divide-[var(--line)] p-0">
                  {nights.upcoming.map((n, i) => (
                    <NightRow key={n.occurrenceId} night={n} profileComplete={complete} focused={false} rate={false} />
                  ))}
                </ul>
              )}
            </Card>
          </section>
          <section aria-label="Past nights" data-testid="nights-past">
            <SectionTitle>{words.pastTitle}</SectionTitle>
            <Card variant="padded" className="py-[6px]">
              {nights.past.length === 0 ? (
                <p className="my-[10px] text-[14px] text-[var(--mut)]" data-testid="nights-past-empty">
                  {words.pastEmpty}
                </p>
              ) : (
                <ul className="m-0 list-none divide-y divide-[var(--line)] p-0">
                  {nights.past.map((n, i) => (
                    <NightRow
                      key={n.occurrenceId}
                      night={n}
                      profileComplete={complete}
                      focused={n === focusedKey}
                      rate={nights.past.findIndex((x) => x.seriesId === n.seriesId) === i}
                    />
                  ))}
                </ul>
              )}
            </Card>
          </section>
        </>
      )}
    </div>
  );
};

const NightsScreen = () => {
  const [going, setGoing] = useState<NightsGoing>(NIGHTS_GOING_LOADING);
  // Read at render (not at import): the switch is the only thing deciding, and tests flip it.
  if (!GOING_CHECKIN_ENABLED) return <NightsOff />;
  return (
    <>
      <Suspense fallback={null}>
        <NightsGoingFeed onGoing={setGoing} />
      </Suspense>
      <NightsView going={going} />
    </>
  );
};

export default NightsScreen;
