import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, EmptyState, GhostButton } from '@/modules/organiser/ui';
import { GOING_CHECKIN_ENABLED } from '@/lib/goingCheckin';
import { useMyDancerEdit } from '../../api/useMyDancerEdit';
import { LevelVote } from './LevelVote';
import { statusLabel, placeAndTime, type Night } from './nightsModel';
import { MoonArt } from '../art';
import { ScreenTitle, SectionTitle } from '../blocks';
import { DateBlock, StatusPill } from './nightsUi';
import { FIND_A_NIGHT } from '../../copy/sharedCopy';

/**
 * Audit L22 / L14: the zero-nights state names BOTH ways a night gets saved (the
 * event page's "I'm Going" and "Interested") and offers the browse link.
 */
export const NO_NIGHTS_LINE = 'No nights saved yet.';
export const NO_NIGHTS_HOW = 'Tap I\u2019m Going or Interested on any event and it shows up here.';
/** D130: no Browse events button anywhere in /app/*; the way on is the home link top left. Review S9: ONE sentence app-wide. */
export const NO_NIGHTS_FIND = FIND_A_NIGHT;
export const NO_UPCOMING_LINE = 'No upcoming nights.';
import { useMyNights } from './useMyNights';

/** `rate`: this row carries its series' level vote (one per series, review N10: the vote is series-wide). */
const NightRow = ({ night, profileComplete, focused, rate }: { night: Night; profileComplete: boolean; focused: boolean; rate: boolean }) => {
  const ref = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView?.({ block: 'center' });
  }, [focused]);
  return (
    <li
      ref={ref}
      data-testid="night-row"
      data-series={night.seriesId}
      data-focused={focused ? 'true' : undefined}
      className={`flex items-start gap-[10px] py-[10px]${focused ? ' rounded-[10px] outline outline-2 outline-offset-2 outline-[var(--gold)]' : ''}`}
    >
      <DateBlock dateKey={night.date} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-[8px]">
          <a href={night.href} className="flex min-h-[44px] items-center break-words text-[15px] font-bold text-[var(--fg)]">
            {night.name}
          </a>
          <StatusPill label={statusLabel(night)} />
        </div>
        <div className="text-[13px] text-[var(--mut)]">{placeAndTime(night) || 'Place to be confirmed'}</div>
        {!night.listed && (
          <div className="text-[13px] text-[var(--mut)]" data-testid="night-unlisted">
            This event is no longer listed.
          </div>
        )}
        {rate && night.listed && !night.isFestival && night.status !== 'other' && (
          <div className="mt-[6px]">
            <LevelVote seriesId={night.seriesId} profileComplete={profileComplete} />
          </div>
        )}
      </div>
    </li>
  );
};

const NightsScreen = () => {
  const { isLoading, isError, retry, nights } = useMyNights();
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
          title={NO_NIGHTS_LINE}
          body={
            <>
              {GOING_CHECKIN_ENABLED && <span className="block">{NO_NIGHTS_HOW}</span>}
              <span className="block">{NO_NIGHTS_FIND}</span>
            </>
          }
        />
      )}
      {!isLoading && !isError && (nights.upcoming.length > 0 || nights.past.length > 0) && (
        <>
          <section aria-label="Upcoming nights" data-testid="nights-upcoming">
            <SectionTitle>Upcoming</SectionTitle>
            <Card variant="padded" className="py-[6px]">
              {nights.upcoming.length === 0 ? (
                <p className="my-[10px] text-[14px]" data-testid="nights-upcoming-empty">
                  {NO_UPCOMING_LINE} {NO_NIGHTS_FIND}
                </p>
              ) : (
                <ul className="m-0 list-none divide-y divide-[var(--line)] p-0">
                  {nights.upcoming.map((n, i) => (
                    <NightRow key={`${n.seriesId}-${n.date}-${i}`} night={n} profileComplete={complete} focused={false} rate={false} />
                  ))}
                </ul>
              )}
            </Card>
          </section>
          <section aria-label="Past nights" data-testid="nights-past">
            <SectionTitle>Past</SectionTitle>
            <Card variant="padded" className="py-[6px]">
              {nights.past.length === 0 ? (
                <p className="my-[10px] text-[14px] text-[var(--mut)]" data-testid="nights-past-empty">
                  Your past nights will appear here.
                </p>
              ) : (
                <ul className="m-0 list-none divide-y divide-[var(--line)] p-0">
                  {nights.past.map((n, i) => (
                    <NightRow
                      key={`${n.seriesId}-${n.date}-${i}`}
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

export default NightsScreen;
