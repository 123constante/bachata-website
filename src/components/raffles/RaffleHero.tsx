// =============================================================================
// RaffleHero — the Lucky Reels hero for the /raffles page.
//
// The reels spin ambiently, then periodically decelerate and LAND on the
// jackpot row (WIN / YOUR / NIGHT) with a staggered chunk-chunk-chunk, hold,
// and resume — so the hero feels like winning, not just spinning. The cycle is
// a self-scheduling timeout chain driving one `landed` flag; all motion is CSS
// (see Raffles.css .rh-*). prefers-reduced-motion: no cycle, statically landed.
// =============================================================================

import React, { useEffect, useRef, useState } from 'react';

// Reel symbols as escapes (keep source ASCII per the FUSE-mount rule):
// gift, star, ticket, slot-machine.
const SYMS = ['\u{1F381}', '\u{2B50}', '\u{1F39F}\u{FE0F}', '\u{1F3B0}'];

// Each reel is a rotation of the base set so the three columns never line up.
const REELS: string[][] = [
  SYMS,
  [...SYMS.slice(1), ...SYMS.slice(0, 1)],
  [...SYMS.slice(2), ...SYMS.slice(0, 2)],
];

// One word per reel on the jackpot row.
const JACKPOT = ['WIN', 'YOUR', 'NIGHT'];

// Cycle timing (ms). Land duration must cover the slowest reel's land
// animation (1.8s in CSS) plus a readable hold.
const SPIN_MS = 3200;
const LAND_MS = 1800 + 1600;

export const RaffleHero: React.FC = () => {
  const [landed, setLanded] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    let reduced = false;
    try {
      reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      /* matchMedia unavailable — treat as motion-ok */
    }
    if (reduced) {
      setLanded(true); // static jackpot row, no cycle (CSS kills animation too)
      return;
    }
    const spinThenLand = () => {
      setLanded(false);
      timers.current.push(window.setTimeout(() => {
        setLanded(true);
        timers.current.push(window.setTimeout(spinThenLand, LAND_MS));
      }, SPIN_MS));
    };
    spinThenLand();
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  return (
    <header className="rh-hero">
      <div className="rh-kicker">Bachata Calendar Raffles</div>

      <div className="rh-cabinet" aria-hidden="true">
        <div className="rh-marquee">Lucky Reels</div>
        <div className="rh-bulbs"><i /><i /><i /><i /><i /></div>
        <div className={`rh-reels${landed ? ' is-landing' : ''}`}>
          {REELS.map((syms, ri) => (
            <div className={`rh-reel rh-reel${ri + 1}`} key={ri}>
              <div className="rh-strip">
                {/* 4 repeats keep the vertical loop seamless (240px period)... */}
                {[0, 1, 2, 3].map((rep) =>
                  syms.map((s, si) => (
                    <span className="rh-sym" key={`${rep}-${si}`}>{s}</span>
                  )),
                )}
                {/* ...then the jackpot cell the land animation locks onto, plus
                    two fillers so the window below the lock isn't blank. */}
                <span className="rh-sym rh-jackcell">{JACKPOT[ri]}</span>
                <span className="rh-sym">{syms[0]}</span>
                <span className="rh-sym">{syms[1]}</span>
              </div>
            </div>
          ))}
        </div>
        <div className={`rh-winline${landed ? ' is-hit' : ''}`}>
          <span className="rh-lamp" />
          <span className="rh-winlabel">WIN &middot; YOUR &middot; NIGHT</span>
          <span className="rh-lamp" />
        </div>
      </div>

      <h1 className="rh-title">Win Your<br />Next Night Free</h1>
      <p className="rh-sub">
        Every party on Bachata Calendar could send you to the next one &mdash; free.
        One tap to enter.
      </p>
      <a href="#rp-live" className="rh-cta">See tonight&rsquo;s raffles &#8595;</a>
    </header>
  );
};

export default RaffleHero;
