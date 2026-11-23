// =============================================================================
// RaffleRedesignA — /raffles redesign part A (look C v6): hero, orbs, steps,
// footer, sticky bar. Rendered only when flags.raffleV2 && flags.raffleRedesign
// (see pages/Raffles.tsx); flag off = today's board page, unchanged.
// Part B (carousel, winners medals, entry sheet restyle) mounts at the
// `data-slot="raffle-part-b"` element below. Entry flow = the existing
// RaffleEntryDialog.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRaffleBoard } from '@/hooks/useRaffleBoard';
import { nightsWithWinner } from '@/lib/raffleBoard';
import { isRafflePoolJoined, markRafflePoolJoined } from '@/lib/raffleSession';
import { ACCOUNT_CONTACT_EMAIL } from '@/lib/accountDeletionCopy';
import { RaffleEntryDialog } from '@/modules/event-page/bento/modals/RaffleEntryDialog';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { buildSeoForRoute, useSeo } from '@/lib/seo';
import { RaffleNightCarousel } from './RaffleNightCarousel';
import './RaffleRedesignA.css';

const STEPS = ['Pick a night', 'Add your phone', 'Win a free entry'];
const fmtCount = (n: number): string => n.toLocaleString('en-GB');
const reducedMotion = (): boolean =>
  typeof window === 'undefined' || typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Counts up from 0 on first load (1100ms + 350ms per orb, ease-out cubic); reduced motion = final number at once. */
const CountUp = ({ value, index, testId }: { value: number | null; index: number; testId: string }) => {
  const [shown, setShown] = useState<number | null>(null);
  const done = useRef(false);
  useEffect(() => {
    if (value === null) return;
    if (done.current || reducedMotion() || typeof requestAnimationFrame !== 'function') { done.current = true; setShown(value); return; }
    done.current = true;
    const dur = 1100 + index * 350;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, Math.max(0, (t - t0) / dur));
      setShown(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step); else setShown(value);
    };
    setShown(0);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, index]);
  return <b data-testid={testId}>{value === null ? '–' : fmtCount(shown ?? value)}</b>;
};

const TrophyIcon = () => (
  <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true"><path fill="currentColor" d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3a5 5 0 0 1-2.7 2.6V18h3v3H8v-3h3v-3.4A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3zm0 4H6v1a2 2 0 0 0 1 1.7V7zm10 0v2.7A2 2 0 0 0 18 8V7h-1z" /></svg>
);

/** Drop-in reveal: adds `seen` once the item scrolls into view (no observer / reduced motion = shown, no animation). */
const WinnerItem = ({ n, children }: { n: number; children: React.ReactNode }) => {
  const ref = useRef<HTMLLIElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion() || typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }), { rootMargin: '0px 0px -6% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <li ref={ref} className={`rd-medal-li${seen ? ' seen' : ''}`} style={{ ['--n' as string]: n }}>{children}</li>;
};

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
  const [dialogEventId, setDialogEventId] = useState<string | undefined>(undefined);
  const [joined, setJoined] = useState<boolean>(() => isRafflePoolJoined());
  const onSubmitted = useCallback(() => { markRafflePoolJoined(); setJoined(true); }, []);

  // Lift the entry sheet above the phone keyboard (visualViewport) via --rd-kb.
  useEffect(() => {
    const vv = typeof window === 'undefined' ? null : window.visualViewport;
    if (!dialogOpen || !vv) return;
    const root = document.documentElement;
    const sync = () => root.style.setProperty('--rd-kb', `${Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))}px`);
    sync();
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    return () => { vv.removeEventListener('resize', sync); vv.removeEventListener('scroll', sync); root.style.removeProperty('--rd-kb'); };
  }, [dialogOpen]);

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
            <div className="rd-orb" style={{ ['--n' as string]: 0 }}><CountUp index={0} testId="raffles-count-pool" value={board ? board.poolCount : null} /><span>Entries</span></div>
            <div className="rd-orb" style={{ ['--n' as string]: 1 }}><CountUp index={1} testId="raffles-count-open" value={board ? openNights.length : null} /><span>Events open</span></div>
            <div className="rd-orb" style={{ ['--n' as string]: 2 }}><CountUp index={2} testId="raffles-count-winners" value={board ? winnersListed : null} /><span>Prizes won</span></div>
          </div>
          <ol className="rd-how">
            {STEPS.map((t, i) => (<li key={t}><b>{i + 1}</b>{t}</li>))}
          </ol>
        </div>

        <div className="rd-wrap rd-main">
          {isError ? (
            <div role="alert" data-testid="raffles-board-error" className="rd-state">
              <p>We couldn&rsquo;t load the raffle board.</p>
              <p>Check your connection, then try again.</p>
              <button type="button" className="rd-bar-btn" onClick={() => void refetch()}>Try again</button>
            </div>
          ) : isLoading || !board ? (
            <div role="status" aria-busy="true" data-testid="raffles-board-loading" className="rd-state">Loading the raffle board&hellip;</div>
          ) : null}
          {board && openNights.length > 0 ? (
            <RaffleNightCarousel
              nights={openNights}
              joined={joined}
              onEnter={(n) => { setDialogEventId(n.publicEventId); setDialogOpen(true); }}
            />
          ) : null}
          <div className="rd-slot" data-slot="raffle-part-b" />
          {board?.winners && board.winners.length > 0 ? (
            <section aria-labelledby="rd-recent-h" data-testid="raffles-recent-winners">
              <h2 id="rd-recent-h" className="rd-h2 rd-h2-c">This week&rsquo;s winners</h2>
              <ul className="rd-medals">
                {board.winners.map((w, i) => (
                  <WinnerItem key={`${w.firstName}-${w.lastInitial ?? ''}-${w.wonAt ?? i}`} n={i}>
                    <div className="rd-medal">
                      <span className="rd-medal__disc"><i /><TrophyIcon /></span>
                      <b>{w.lastInitial ? `${w.firstName} ${w.lastInitial}.` : w.firstName}</b>
                      {w.nightTitle ? <span>{w.nightTitle}</span> : null}
                      <em>won a free entry</em>
                    </div>
                  </WinnerItem>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <footer className="rd-wrap rd-foot">
          <nav aria-label="Footer">
            <Link to="/terms">Rules</Link>
            <a href={`mailto:${ACCOUNT_CONTACT_EMAIL}`}>Contact</a>
          </nav>
          <p className="rd-foot__info">Free to enter &middot; one phone number per night. We only use it to message winners.</p>
        </footer>

        <div className="rd-bar" data-testid="raffles-sticky-bar">
          {joined ? (
            <div className="rd-bar-in rd-bar-in-done" role="status" data-testid="raffles-youre-in">
              <span className="rd-bar-tick" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
              <p className="rd-bar-txt"><b>You&rsquo;re in for every night</b></p>
            </div>
          ) : (
            <div className="rd-bar-in">
              <p className="rd-bar-txt"><b>Free</b>One phone number</p>
              <button type="button" className="rd-bar-btn" onClick={() => { setDialogEventId(undefined); setDialogOpen(true); }} data-testid="raffles-enter">Enter the raffle</button>
            </div>
          )}
        </div>
      </div>
      <RaffleEntryDialog open={dialogOpen} onOpenChange={setDialogOpen} eventId={dialogEventId} consentVersion={null} onSubmitted={onSubmitted} redesign />
    </GlobalLayout>
  );
};

export default RaffleRedesignA;
