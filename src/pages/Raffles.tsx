// =============================================================================
// Raffles — public /raffles landing page ("Win Your Next Night Free").
//
// One scrolling page: Lucky Reels hero -> Live raffles grid -> How it works ->
// Jackpot counter -> Organiser CTA. Flag-gated at the route level
// (flags.rafflesPage); when off the route redirects home, so this component
// only mounts when the page is live.
// =============================================================================

import { useEffect } from 'react';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { useOpenRaffles, useRaffleStats } from '@/hooks/useOpenRaffles';
import RaffleHero from '@/components/raffles/RaffleHero';
import OpenRafflesGrid from '@/components/raffles/OpenRafflesGrid';
import { HowItWorks, JackpotCounter, OrganiserCTA } from '@/components/raffles/RaffleInfoBands';
import '@/pages/Raffles.css';

const Raffles = () => {
  useEffect(() => {
    document.title = 'Raffles — Win your next night free | Bachata Calendar';
  }, []);

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

export default Raffles;
