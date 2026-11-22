// =============================================================================
// Raffles — public /raffles landing page ("Win Your Next Night Free").
//
// One scrolling page: Lucky Reels hero -> Live raffles grid -> How it works ->
// Jackpot counter -> Organiser CTA. Flag-gated at the route level
// (flags.rafflesPage); when off the route redirects home, so this component
// only mounts when the page is live.
// =============================================================================

import { useCallback, useState } from 'react';
import { flags } from '@/lib/featureFlags';
import { useRaffleBoard } from '@/hooks/useRaffleBoard';
import { nightsWithWinner, thisWeeksWinners } from '@/lib/raffleBoard';
import { isRafflePoolJoined, markRafflePoolJoined } from '@/lib/raffleSession';
import { RaffleEntryDialog } from '@/modules/event-page/bento/modals/RaffleEntryDialog';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { buildSeoForRoute, useSeo } from '@/lib/seo';
import { useOpenRaffles, useRaffleStats } from '@/hooks/useOpenRaffles';
import RaffleHero from '@/components/raffles/RaffleHero';
import OpenRafflesGrid from '@/components/raffles/OpenRafflesGrid';
import { HowItWorks, JackpotCounter, OrganiserCTA } from '@/components/raffles/RaffleInfoBands';
import '@/pages/Raffles.css';

const RafflesLegacy = () => {
  useSeo(buildSeoForRoute('raffles'));

  const { data: raffles, isLoading, isError } = useOpenRaffles();
  const { data: stats } = useRaffleStats();
  const openNow = raffles?.length ?? 0;
  // Names currently in open draws — a community-activity number (reads as
  // "you'd be in good company"), deliberately instead of a winners count
  // (which reads as odds).
  const inDrawNow = (raffles ?? []).reduce((sum, r) => sum + r.entry_count, 0);

  return (
    <GlobalLayout breadcrumbs={buildBreadcrumbs('raffles')} showGradientBg={false}>
      <div className="rp-root">
        <RaffleHero />
        <OpenRafflesGrid raffles={raffles ?? []} loading={isLoading} error={isError} />
        <HowItWorks />
        <JackpotCounter
          entriesThisMonth={stats?.entries_this_month ?? null}
          inDrawNow={inDrawNow}
          openNow={openNow}
          totalWinners={stats?.total_winners ?? null}
        />
        <OrganiserCTA />
      </div>
    </GlobalLayout>
  );
};

// Raffle v2 (flags.raffleV2): the winners board.
// `iso` is a UTC instant (parseRaffleBoard adds the Z); show the London date.
const fmtNight = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' }).format(d);
};

const RafflesBoard = () => {
  useSeo(buildSeoForRoute('raffles'));
  const { data: board, isLoading, isError, refetch } = useRaffleBoard();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [joined, setJoined] = useState<boolean>(() => isRafflePoolJoined());
  const onSubmitted = useCallback(() => { markRafflePoolJoined(); setJoined(true); }, []);

  const winners = board ? thisWeeksWinners(board, new Date()) : [];
  const nightsOpen = board ? board.nights.filter((n) => !n.winnerFirstName).length : 0;
  // Winners come from the nights the board lists (locked/attended wins), never total_winners,
  // which on prod counts ~766 attendance pairs.
  const openNights = board ? board.nights.filter((n) => !n.winnerFirstName) : [];
  const winnersListed = board ? nightsWithWinner(board).length : 0;

  return (
    <GlobalLayout breadcrumbs={buildBreadcrumbs('raffles')} showGradientBg={false}>
      <div className="rp-root rp-board p-3 space-y-3">
        <h1 className="rp-bh1">Win a free night</h1>

        {isError ? (
          <div role="alert" data-testid="raffles-board-error" className="text-sm">
            <p>We couldn&rsquo;t load the raffle board.</p>
            <p>Check your connection, then try again.</p>
            <button type="button" className="mt-2 min-h-[44px] rounded-md border px-4 font-semibold" onClick={() => void refetch()}>
              Try again
            </button>
          </div>
        ) : isLoading || !board ? (
          <div role="status" aria-busy="true" data-testid="raffles-board-loading">
            <p className="text-sm">Loading the raffle board&hellip;</p>
            <div className="mt-2 h-16 animate-pulse rounded-md bg-white/10" />
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-3 gap-2 text-center" data-testid="raffles-board-counters">
              <div className="rp-bc"><dd className="rp-bc-num" data-testid="raffles-count-pool">{board.poolCount}</dd><dt className="rp-bc-cap">In the draw</dt></div>
              <div className="rp-bc"><dd className="rp-bc-num" data-testid="raffles-count-open">{nightsOpen}</dd><dt className="rp-bc-cap">Nights open</dt></div>
              <div className="rp-bc"><dd className="rp-bc-num" data-testid="raffles-count-winners">{winnersListed}</dd><dt className="rp-bc-cap">Winners listed</dt></div>
            </dl>

            <section aria-labelledby="raffles-week-h" className="rp-bsec">
              <h2 id="raffles-week-h" className="rp-bh">This week&rsquo;s winners</h2>
              {winners.length === 0 ? (
                <p className="text-sm" data-testid="raffles-week-empty">
                  {board.nights.length === 0
                    ? 'No raffle nights are open right now. Check back soon, or enter and you will be in when the next one opens.'
                    : 'No winners yet this week. Enter now and you could be next.'}
                </p>
              ) : (
                <ul className="space-y-1 text-sm" data-testid="raffles-week-list">
                  {winners.map((n) => (
                    <li key={n.occurrenceId} className="rp-brow">
                      <b>{n.winnerFirstName}</b> &mdash; {n.title} &middot; {fmtNight(n.start)}
                      {n.venue ? <> &middot; {n.venue}</> : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {joined ? (
          <p role="status" className="rp-benter rp-benter-in" data-testid="raffles-youre-in">You&rsquo;re in</p>
        ) : (
          <button
            type="button"
            className="rp-benter"
            onClick={() => setDialogOpen(true)}
            data-testid="raffles-enter"
          >
            Enter the raffle
          </button>
        )}
        {board && !isError && !isLoading && openNights.length > 0 ? (
          <section aria-labelledby="raffles-open-h" className="rp-bsec" data-testid="raffles-open-nights">
            <h2 id="raffles-open-h" className="rp-bh">Nights you can win</h2>
            <ul className="space-y-1 text-sm">
              {openNights.map((n) => (
                <li key={n.occurrenceId} className="rp-brow">
                  {fmtNight(n.start)} &middot; {n.title}
                  {n.venue ? <> &middot; {n.venue}</> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <HowItWorks />
      </div>
      <RaffleEntryDialog open={dialogOpen} onOpenChange={setDialogOpen} consentVersion={null} onSubmitted={onSubmitted} />
    </GlobalLayout>
  );
};

const Raffles = () => (flags.raffleV2 ? <RafflesBoard /> : <RafflesLegacy />);

export default Raffles;
