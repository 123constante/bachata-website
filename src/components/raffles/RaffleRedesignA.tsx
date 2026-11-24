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
import { nightsWithWinner, nextNightPerEvent } from '@/lib/raffleBoard';
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
  const shownRef = useRef<number | null>(null);
  useEffect(() => { shownRef.current = shown; }, [shown]);
  useEffect(() => {
    if (value === null) return;
    if (done.current && !reducedMotion() && typeof requestAnimationFrame === 'function' && shownRef.current !== null && shownRef.current !== value) {
      // A later change (a successful entry: n -> n+1): count from what is shown over 500ms.
      const from = shownRef.current;
      const t0 = performance.now();
      let raf = 0;
      const step = (t: number) => {
        const k = Math.min(1, Math.max(0, (t - t0) / 500));
        setShown(Math.round(from + (value - from) * k));
        if (k < 1) raf = requestAnimationFrame(step); else setShown(value);
      };
      raf = requestAnimationFrame(step);
      return () => cancelAnimationFrame(raf);
    }
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

type Burster = { burst: (x: number, y: number, n: number, power: number, spread?: number) => void; dispose: () => void };

/** Small canvas confetti (no dependency). Created on first burst; reduced motion = nothing. */
const makeConfetti = (): Burster => {
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let raf = 0;
  type P = { x: number; y: number; vx: number; vy: number; g: number; s: number; r: number; vr: number; c: string; dot: boolean; life: number; max: number };
  let parts: P[] = [];
  const COLS = ['#FFA600', '#FFD58A', '#FFFFFF', '#FF7A00'];
  const tick = () => {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    parts = parts.filter((p) => p.life < p.max && p.y < canvas!.height + 40);
    for (const p of parts) {
      p.life++; p.vx *= 0.985; p.vy = p.vy * 0.985 + p.g; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.globalAlpha = Math.min(1, (p.max - p.life) / 22); ctx.fillStyle = p.c;
      const w = Math.abs(Math.cos(p.life * 0.18)) * 0.8 + 0.2;
      if (p.dot) { ctx.beginPath(); ctx.ellipse(0, 0, p.s * 0.5, p.s * 0.5 * w, 0, 0, 6.3); ctx.fill(); }
      else ctx.fillRect(-p.s * 0.5, -p.s * 0.3 * w, p.s, p.s * 0.6 * w);
      ctx.restore();
    }
    if (parts.length) raf = requestAnimationFrame(tick); else { raf = 0; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  };
  return {
    burst(x, y, n, power, spread = Math.PI * 2) {
      if (reducedMotion() || typeof document === 'undefined' || typeof requestAnimationFrame !== 'function') return;
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        canvas.className = 'rd-confetti';
        document.body.appendChild(canvas);
        ctx = canvas.getContext('2d');
      }
      if (!ctx) return;
      canvas.width = window.innerWidth; canvas.height = window.innerHeight;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * spread;
        const v = power * (0.4 + Math.random() * 0.8);
        parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.2 + Math.random() * 0.14, s: 5 + Math.random() * 7, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4, c: COLS[(Math.random() * COLS.length) | 0], dot: Math.random() < 0.5, life: 0, max: 80 + Math.random() * 80 });
      }
      if (!raf) raf = requestAnimationFrame(tick);
    },
    dispose() { cancelAnimationFrame(raf); raf = 0; parts = []; canvas?.remove(); canvas = null; ctx = null; },
  };
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
  const [dialogNight, setDialogNight] = useState<string | undefined>(undefined);
  const [joined, setJoined] = useState<boolean>(() => isRafflePoolJoined());
  const [party, setParty] = useState(false);
  // Pool count the board showed when this visit's entry went in: while the board still says that, show +1.
  const [entryBase, setEntryBase] = useState<number | null>(null);
  const joinedRef = useRef(joined);
  const poolRef = useRef<number | null>(null);
  const confetti = useRef<Burster | null>(null);
  const timers = useRef<number[]>([]);
  const getConfetti = () => (confetti.current ??= makeConfetti());
  useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)); confetti.current?.dispose(); }, []);
  const onSubmitted = useCallback(() => {
    markRafflePoolJoined();
    setJoined(true);
    if (joinedRef.current) return; // celebrate once per entry
    joinedRef.current = true;
    if (poolRef.current !== null) setEntryBase(poolRef.current);
    setParty(true);
    timers.current.push(window.setTimeout(() => setParty(false), 4500));
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (let k = 0; k < 7; k++) {
      timers.current.push(window.setTimeout(() => getConfetti().burst(w * (0.15 + Math.random() * 0.7), h * (0.12 + Math.random() * 0.4), 46, 9 + Math.random() * 4), k * 260));
    }
  }, []);

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

  const poolNow = board ? board.poolCount : null;
  useEffect(() => { poolRef.current = poolNow; }, [poolNow]);
  const poolShown = board ? (board.entriesEver ?? board.poolCount) + (entryBase !== null && board.poolCount === entryBase ? 1 : 0) : null;
  const openNights = board ? nextNightPerEvent(board.nights.filter((n) => !n.winnerFirstName)) : [];
  // Winners listed from the nights the board lists, never total_winners (counts ~766 attendance pairs on prod).
  const winnersListed = board ? nightsWithWinner(board).length : 0;

  return (
    <GlobalLayout breadcrumbs={buildBreadcrumbs('raffles')} showGradientBg={false}>
      <div className={`rd-root${party ? ' rd-party' : ''}`} data-testid="raffles-redesign">
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
            <div className="rd-orb" style={{ ['--n' as string]: 0 }}><CountUp index={0} testId="raffles-count-pool" value={poolShown} /><span>Entries</span></div>
            <div className="rd-orb" style={{ ['--n' as string]: 1 }}><CountUp index={1} testId="raffles-count-open" value={board ? openNights.length : null} /><span>Events open</span></div>
            <div className="rd-orb" style={{ ['--n' as string]: 2 }}><CountUp index={2} testId="raffles-count-winners" value={board ? (board.winnersEver ?? winnersListed) : null} /><span>Winners ever</span></div>
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
              onEnter={(n) => { setDialogEventId(n.publicEventId); setDialogNight(n.title); setDialogOpen(true); }}
              onBurst={(x, y) => getConfetti().burst(x, y, 18, 6)}
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
              <button type="button" className="rd-bar-btn" onClick={() => { setDialogEventId(undefined); setDialogNight(undefined); setDialogOpen(true); }} data-testid="raffles-enter">Enter the raffle</button>
            </div>
          )}
        </div>
      </div>
      <RaffleEntryDialog open={dialogOpen} onOpenChange={setDialogOpen} eventId={dialogEventId} consentVersion={null} onSubmitted={onSubmitted} nightName={dialogNight} redesign />
    </GlobalLayout>
  );
};

export default RaffleRedesignA;
