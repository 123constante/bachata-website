// =============================================================================
// RaffleRedesignA — /raffles redesign part A (look C v6): hero, orbs, steps,
// footer, sticky bar. Rendered only when flags.raffleV2 && flags.raffleRedesign
// (see pages/Raffles.tsx); flag off = today's board page, unchanged.
// Part B (carousel, winners medals, entry sheet restyle) mounts at the
// `data-slot="raffle-part-b"` element below. Entry flow = the existing
// RaffleEntryDialog.
// =============================================================================

import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRaffleBoard } from '@/hooks/useRaffleBoard';
import { nightsWithWinner, thisWeeksWinners } from '@/lib/raffleBoard';
import { isRafflePoolJoined, markRafflePoolJoined } from '@/lib/raffleSession';
import { ACCOUNT_CONTACT_EMAIL } from '@/lib/accountDeletionCopy';
import { RaffleEntryDialog } from '@/modules/event-page/bento/modals/RaffleEntryDialog';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { buildSeoForRoute, useSeo } from '@/lib/seo';
import './RaffleRedesignA.css';

const fmtNight = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' }).format(d);
};

const MEDALS = ['gold', 'silver', 'bronze'] as const;
const STEPS = ['Pick a night', 'Add your phone', 'Win a free entry'];
const fmtCount = (n: number): string => n.toLocaleString('en-GB');

// Deterministic embers (no Math.random: stable renders, no hydration drift).
const EMBERS = Array.from({ length: 24 }, (_, i) => ({
  left: (i * 37) % 100,
  size: 2 + (i % 4),
  dx: ((i * 13) % 80) - 40,
  dur: 5 + (i % 6),
  delay: -((i * 7) % 10),
}));

export const RaffleRedesignA = () => {
  useSeo(buildSeoForRoute('raffles'));
  const { data: board, isLoading, isError, refetch } = useRaffleBoard();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [joined, setJoined] = useState<boolean>(() => isRafflePoolJoined());
  const onSubmitted = useCallback(() => { markRafflePoolJoined(); setJoined(true); }, []);

  const winners = useMemo(() => (board ? thisWeeksWinners(board, new Date()) : []), [board]);
  const openNights = board ? board.nights.filter((n) => !n.winnerFirstName) : [];
  // Winners listed from the nights the board lists, never total_winners (counts ~766 attendance pairs on prod).
  const winnersListed = board ? nightsWithWinner(board).length : 0;

  return (
    <GlobalLayout breadcrumbs={buildBreadcrumbs('raffles')} showGradientBg={false}>
      <div className="rd-root" data-testid="raffles-redesign">
        <header className="rd-hero">
          <div className="rd-beam rd-beam-l" aria-hidden="true" />
          <div className="rd-beam rd-beam-r" aria-hidden="true" />
          <i className="rd-pool" aria-hidden="true" />
          <i className="rd-bok" style={{ left: '12%', top: '20%' }} aria-hidden="true" />
          <i className="rd-bok" style={{ right: '10%', top: '34%' }} aria-hidden="true" />
          <i className="rd-bok" style={{ left: '20%', bottom: '30%' }} aria-hidden="true" />
          <div className="rd-embers" aria-hidden="true">
            {EMBERS.map((e, i) => (
              <i key={i} style={{ left: `${e.left}%`, width: e.size, height: e.size, animationDuration: `${e.dur}s`, animationDelay: `${e.delay}s`, ['--dx' as string]: `${e.dx}px` }} />
            ))}
          </div>
          <div className="rd-wrap">
            <h1 className="rd-h1"><em>Win a free night</em></h1>
          </div>
        </header>

        <div className="rd-wrap rd-under">
          <div className="rd-orbs" data-testid="raffles-board-counters">
            <div className="rd-orb" style={{ ['--n' as string]: 0 }}><b data-testid="raffles-count-pool">{board ? fmtCount(board.poolCount) : '–'}</b><span>Entries</span></div>
            <div className="rd-orb" style={{ ['--n' as string]: 1 }}><b data-testid="raffles-count-open">{board ? fmtCount(openNights.length) : '–'}</b><span>Events open</span></div>
            <div className="rd-orb" style={{ ['--n' as string]: 2 }}><b data-testid="raffles-count-winners">{board ? fmtCount(winnersListed) : '–'}</b><span>Prizes won</span></div>
          </div>
          <ol className="rd-how">
            {STEPS.map((t, i) => (<li key={t}><b>{i + 1}</b>{t}</li>))}
          </ol>
        </div>

        <main className="rd-wrap rd-main">
          {isError ? (
            <div role="alert" data-testid="raffles-board-error" className="rd-state">
              <p>We couldn&rsquo;t load the raffle board.</p>
              <p>Check your connection, then try again.</p>
              <button type="button" className="rd-bar-btn" onClick={() => void refetch()}>Try again</button>
            </div>
          ) : isLoading || !board ? (
            <div role="status" aria-busy="true" data-testid="raffles-board-loading" className="rd-state">Loading the raffle board&hellip;</div>
          ) : (
            <>
              <section aria-labelledby="rd-week-h">
                <h2 id="rd-week-h" className="rd-h2">This week&rsquo;s winners</h2>
                {winners.length === 0 ? (
                  <p className="text-sm" data-testid="raffles-week-empty">
                    {board.nights.length === 0
                      ? 'No raffle nights are open right now. Check back soon, or enter and you will be in when the next one opens.'
                      : 'No winners yet this week. Enter now and you could be next.'}
                  </p>
                ) : (
                  <ul className="rd-list" data-testid="raffles-week-list">
                    {winners.map((n) => (
                      <li key={n.occurrenceId} className="rd-row">
                        <b>{n.winnerFirstName}</b> &mdash; {n.title} &middot; {fmtNight(n.start)}
                        {n.venue ? <> &middot; {n.venue}</> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              {openNights.length > 0 ? (
                <section aria-labelledby="rd-open-h" data-testid="raffles-open-nights">
                  <h2 id="rd-open-h" className="rd-h2">Nights you can win</h2>
                  <ul className="rd-list">
                    {openNights.map((n) => (
                      <li key={n.occurrenceId} className="rd-row">
                        {fmtNight(n.start)} &middot; {n.title}
                        {n.venue ? <> &middot; {n.venue}</> : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
          <div className="rd-slot" data-slot="raffle-part-b" />
          {board?.winners && board.winners.length > 0 ? (
            <section aria-labelledby="rd-recent-h" data-testid="raffles-recent-winners">
              <h2 id="rd-recent-h" className="rd-h2">Recent winners</h2>
              <ul className="rd-medals">
                {board.winners.map((w, i) => (
                  <li key={`${w.profileSlug}-${w.wonAt ?? i}`}>
                    <Link to={`/dancers/${encodeURIComponent(w.profileSlug)}`} className={`rd-medal rd-medal-${MEDALS[i] ?? 'plain'}`}>
                      <b>{w.firstName}</b>
                      {w.nightTitle ? <span>{w.nightTitle}</span> : null}
                      <em>View profile &rsaquo;</em>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </main>

        <footer className="rd-wrap rd-foot">
          <nav aria-label="Footer">
            <Link to="/terms">Rules</Link>
            <Link to="/privacy">Privacy</Link>
            <a href={`mailto:${ACCOUNT_CONTACT_EMAIL}`}>Contact</a>
          </nav>
        </footer>

        <div className="rd-bar" data-testid="raffles-sticky-bar">
          {joined ? (
            <div className="rd-bar-in rd-bar-in-done" role="status" data-testid="raffles-youre-in">
              <p className="rd-bar-txt"><b>You&rsquo;re in for every night</b></p>
            </div>
          ) : (
            <div className="rd-bar-in">
              <p className="rd-bar-txt"><b>Free</b>One phone number</p>
              <button type="button" className="rd-bar-btn" onClick={() => setDialogOpen(true)} data-testid="raffles-enter">Enter the raffle</button>
            </div>
          )}
        </div>
      </div>
      <RaffleEntryDialog open={dialogOpen} onOpenChange={setDialogOpen} consentVersion={null} onSubmitted={onSubmitted} redesign />
    </GlobalLayout>
  );
};

export default RaffleRedesignA;
