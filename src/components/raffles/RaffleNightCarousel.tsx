// "Pick a night" carousel (redesign part B1): one open night per card, flyer,
// name, Enter button. No dates. Scroll-snap = native swipe.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RaffleNight } from '@/lib/raffleBoard';

const MAX_CARDS = 13;

const initials = (title: string): string => {
  const w = title.split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] ?? '') + (w.length > 1 ? (w[w.length - 1][0] ?? '') : '')).toUpperCase() || '?';
};

const Tick = ({ size }: { size: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

type Props = {
  nights: RaffleNight[];
  joined: boolean;
  onEnter: (n: RaffleNight) => void;
  /** Tap on an entered card's button: a small confetti burst from (x, y) in viewport px. */
  onBurst?: (x: number, y: number) => void;
};

export const RaffleNightCarousel = ({ nights, joined, onEnter, onBurst }: Props) => {
  const items = nights.slice(0, MAX_CARDS);
  const track = useRef<HTMLUListElement>(null);
  const [idx, setIdx] = useState(0);

  const onScroll = useCallback(() => {
    const el = track.current;
    if (!el || el.children.length === 0) return;
    const first = el.children[0] as HTMLElement;
    const step = first.offsetWidth + 14;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
    setIdx(atEnd ? items.length - 1 : Math.min(items.length - 1, Math.max(0, Math.round(el.scrollLeft / step))));
  }, [items.length]);

  useEffect(() => { onScroll(); }, [onScroll]);

  const go = (d: number) => {
    const el = track.current;
    if (!el) return;
    const first = el.children[0] as HTMLElement;
    el.scrollTo({ left: Math.max(0, idx + d) * (first.offsetWidth + 14), behavior: 'smooth' });
  };

  return (
    <section aria-labelledby="rd-pick-h" className="rd-pick" data-testid="raffles-night-carousel">
      <h2 id="rd-pick-h" className="rd-h2">Pick a night</h2>
      <ul className="rd-car" ref={track} onScroll={onScroll}>
        {items.map((n) => (
          <li key={n.occurrenceId} className={`rd-card${joined ? ' is-in' : ''}`}>
            <div className="rd-art">
              {n.posterUrl ? (
                <img className="rd-flyer" src={n.posterUrl} alt="" loading="lazy" />
              ) : (
                <div className="rd-flyer rd-flyer-tile" aria-hidden="true">{initials(n.title)}</div>
              )}
              {joined ? <span className="rd-seal" data-testid="raffles-card-seal" aria-hidden="true"><Tick size={44} /></span> : null}
            </div>
            <p className="rd-card-name">{n.title}</p>
            {joined ? (
              <button
                type="button"
                className="rd-card-btn rd-card-btn-in"
                data-testid="raffles-card-in"
                onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); onBurst?.(r.left + r.width / 2, r.top + r.height / 2); }}
              ><Tick size={18} />You&rsquo;re in</button>
            ) : (
              <button type="button" className="rd-card-btn" onClick={() => onEnter(n)} aria-label={`Enter ${n.title}`}>Enter</button>
            )}
          </li>
        ))}
      </ul>
      <div className="rd-car-nav">
        <button type="button" className="rd-car-arrow" onClick={() => go(-1)} disabled={idx === 0} aria-label="Previous night">&lsaquo;</button>
        <span className="rd-car-count" data-testid="raffles-carousel-count">{idx + 1} of {items.length}</span>
        <button type="button" className="rd-car-arrow" onClick={() => go(1)} disabled={idx >= items.length - 1} aria-label="Next night">&rsaquo;</button>
      </div>
      <div className="rd-car-prog" aria-hidden="true"><i style={{ width: `${((idx + 1) / items.length) * 100}%` }} /></div>
    </section>
  );
};

export default RaffleNightCarousel;
