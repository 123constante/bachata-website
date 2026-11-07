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
import { thisWeeksWinners } from '@/lib/raffleBoard';
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
const fmtNight = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d);
};

const RafflesBoard = () => {
  useSeo(buildSeoForRoute('raffles'));
  const { data: board, isLoading, isError, refetch } = useRaffleBoard();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [joined, setJoined] = useState<boolean>(() => isRafflePoolJoined());
  const onSubmitted = useCallback(() => { markRafflePoolJoined(); setJoined(true); }, []);

  const winners = board ? thisWeeksWinners(board, new Date()) : [];
  const nightsOpen = board ? board.nights.filter((n) => !n.winnerFirstName).length : 0;

  return (
    <GlobalLayout breadcrumbs={buildBreadcrumbs('raffles')} showGradientBg={false}>
      <div className="rp-root rp-board p-3 space-y-3">
        <h1 className="text-lg font-bold">Win a free night</h1>

        {isError ? (
          <div role="alert" data-testid="raffles-board-error" className="text-sm">
            <p>We couldn&rsquo;t load the raffle board.</p>
            <button type="button" className="mt-2 min-h-[44px] rounded-md border px-4 font-semibold" onClick={() => void refetch()}>
              Try again
            </button>
          </div>
        ) : isLoading || !board ? (
          <div className="h-16 animate-pulse rounded-md bg-white/10" aria-busy="true" />
        ) : (
          <>
            <dl className="grid grid-cols-3 gap-2 text-center" data-testid="raffles-board-counters">
              <div><dd className="text-xl font-bold" data-testid="raffles-count-pool">{board.poolCount}</dd><dt className="text-xs">In the draw</dt></div>
              <div><dd className="text-xl font-bold" data-testid="raffles-count-open">{nightsOpen}</dd><dt className="text-xs">Nights open</dt></div>
              <div><dd className="text-xl font-bold" data-testid="raffles-count-winners">{board.totalWinners}</dd><dt className="text-xs">Winners so far</dt></div>
            </dl>

            <section aria-labelledby="raffles-week-h">
              <h2 id="raffles-week-h" className="text-sm font-bold">This week&rsquo;s winners</h2>
              {winners.length === 0 ? (
                <p className="text-sm" data-testid="raffles-week-empty">
                  No winners yet this week. Enter now and you could be next.
                </p>
              ) : (
                <ul className="space-y-1 text-sm" data-testid="raffles-week-list">
                  {winners.map((n) => (
                    <li key={n.occurrenceId}>
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
          <p role="status" className="text-sm font-bold" data-testid="raffles-youre-in">You&rsquo;re in</p>
        ) : (
          <button
            type="button"
            className="min-h-[44px] w-full rounded-md bg-primary px-4 font-bold text-primary-foreground"
            onClick={() => setDialogOpen(true)}
            data-testid="raffles-enter"
          >
            Enter the raffle
          </button>
        )}
      </div>
      <RaffleEntryDialog open={dialogOpen} onOpenChange={setDialogOpen} consentVersion={null} onSubmitted={onSubmitted} />
    </GlobalLayout>
  );
};

const Raffles = () => (flags.raffleV2 ? <RafflesBoard /> : <RafflesLegacy />);

export default Raffles;
