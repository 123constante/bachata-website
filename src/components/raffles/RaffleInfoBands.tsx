// =============================================================================
// RaffleInfoBands — the non-data bands on the /raffles page:
//   HowItWorks    — the entry flow in three "pulls"
//   JackpotCounter — community numbers that roll up when scrolled into view
//   OrganiserCTA  — soft pitch for organisers to run a raffle at their night
// All styling lives in Raffles.css (.rp-*).
// =============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

// -- How it works -------------------------------------------------------------
const STEPS = [
  { sym: '\u{1F3AF}', n: 'Pull 1', title: 'Pick a party', body: 'Find any night with a raffle running.' },
  { sym: '\u{1F4F1}', n: 'Pull 2', title: 'Drop your number', body: 'One tap, one WhatsApp number. No payment, ever.' },
  { sym: '\u{1F389}', n: 'Pull 3', title: 'Win on the night', body: 'Winner drawn before doors. We message you on WhatsApp.' },
];

export const HowItWorks: React.FC = () => (
  <section className="rp-section">
    <div className="rp-divider"><span /><em>In three pulls</em><span /></div>
    <div className="rp-steps">
      {STEPS.map((s) => (
        <div className="rp-step" key={s.n}>
          <div className="rp-step-reel" aria-hidden="true">{s.sym}</div>
          <div>
            <div className="rp-step-n">{s.n}</div>
            <h3 className="rp-step-title">{s.title}</h3>
            <p className="rp-step-body">{s.body}</p>
          </div>
        </div>
      ))}
    </div>
  </section>
);

// -- Count-up number (animates 0 -> value once, when in view) -----------------
// Stats arrive async (React Query), often AFTER the section first scrolls into
// view. Rules:
//   * value === 0 and intro not yet played -> show 0, don't burn the animation.
//   * first non-zero value while in view   -> play the roll-up once.
//   * any later value change (refetch)     -> snap straight to the new number.
const CountUp: React.FC<{ value: number; prefix?: string }> = ({ value, prefix }) => {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (done.current) {
      // Intro already played — snap to the latest value (e.g. refetch bump).
      setDisplay(value);
      return;
    }
    if (value === 0) {
      // Nothing to animate yet; wait for real data before arming the observer.
      setDisplay(0);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting || done.current) continue;
          done.current = true;
          const dur = 1300;
          let startTs: number | null = null;
          const tick = (ts: number) => {
            if (startTs == null) startTs = ts;
            const p = Math.min((ts - startTs) / dur, 1);
            // easeOutCubic for a slot-machine-ish settle
            const eased = 1 - Math.pow(1 - p, 3);
            setDisplay(Math.floor(eased * value));
            if (p < 1) requestAnimationFrame(tick);
            else setDisplay(value);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value]);

  return (
    <span ref={ref} className="rp-tote-num">
      {prefix}{display.toLocaleString('en-GB')}
    </span>
  );
};

// -- Jackpot counter ----------------------------------------------------------
// Deliberately NO winners count: "1 winner / 157 entries" reads as bad odds.
// "In the draw now" (sum of entry counts across open raffles) reads as
// community activity instead — and it's already client-side, no extra RPC.
export const JackpotCounter: React.FC<{
  entriesThisMonth: number | null;
  inDrawNow: number;
  openNow: number;
}> = ({ entriesThisMonth, inDrawNow, openNow }) => (
  <section className="rp-section">
    <div className="rp-divider"><span /><em>This month</em><span /></div>
    <div className="rp-jackpot">
      <div className="rp-jackpot-tag">The community jackpot</div>
      <div className="rp-totes">
        <div className="rp-tote">
          <CountUp value={entriesThisMonth ?? 0} />
          <span className="rp-tote-cap">Entries</span>
        </div>
        <div className="rp-tote">
          <CountUp value={inDrawNow} />
          <span className="rp-tote-cap">In the draw now</span>
        </div>
        <div className="rp-tote">
          <CountUp value={openNow} />
          <span className="rp-tote-cap">Live raffles</span>
        </div>
      </div>
      <div className="rp-jackpot-foot">Someone wins, every single week. It could be you.</div>
    </div>
  </section>
);

// -- Organiser CTA ------------------------------------------------------------
export const OrganiserCTA: React.FC = () => (
  <section className="rp-section rp-section-last">
    <div className="rp-org">
      <div className="rp-org-tag">For organisers</div>
      <h3 className="rp-org-title">Run a raffle at your night</h3>
      <p className="rp-org-body">
        Fill the room, reward your regulars, and give every dancer a reason to arrive early.
      </p>
      <Link to="/organisers" className="rp-org-cta">List your night &rarr;</Link>
    </div>
  </section>
);
