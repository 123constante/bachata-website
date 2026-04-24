import { useCallback, useState } from 'react';
import { BentoTile } from '@/modules/event-page/bento/BentoTile';
import { BLOCK_COLORS, BLOCK_TITLES } from '@/modules/event-page/bento/BentoGrid';

// Brass — the bento's own accent token, distinct from site-wide --primary.
// The event page is a themed surface (Vibe F: Velvet & Brass); the rest of
// the site keeps using --primary for orange accents.
const GOLD = 'hsl(var(--bento-accent))';

// Phase 8e — static "prize pool coming soon" placeholder. Always renders
// (even on past events); there is no form, no modal, no real raffle data.
// The real raffle feature is a separate future project; this block only
// signals anticipation so the bento doesn't leave an empty slot where the
// eventual raffle entry point will live.
//
// Visual spec comes from preview B: compact 72×72 chest with lid slightly
// ajar, a thin blurred gold wedge pulsing softly through the seam gap
// (raffle-glow-pulse-soft, low amplitude so it doesn't compete with the
// cover block sitting above), and a padlock hanging off-axis as if
// already defeated. Row layout, title + subtitle on the right.
//
// Tap → 250 ms raffle-shake on the whole row + navigator.vibrate(30).
const AjarChestCompact = () => (
  <svg viewBox="0 0 64 64" className="h-[72px] w-[72px] shrink-0" aria-hidden="true">
    <defs>
      <filter id="raffleChest-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="1.8" />
      </filter>
    </defs>

    {/* Thin wedge of gold light escaping through the lid/body gap. */}
    <ellipse
      cx="32"
      cy="26"
      rx="22"
      ry="2.5"
      fill={GOLD}
      filter="url(#raffleChest-glow)"
      style={{ animation: 'raffle-glow-pulse-soft 2s ease-in-out infinite' }}
    />

    {/* Chest body */}
    <rect
      x="6"
      y="28"
      width="52"
      height="28"
      rx="2"
      fill="#2a1f17"
      stroke={GOLD}
      strokeWidth="1.5"
    />
    <line x1="6" y1="40" x2="58" y2="40" stroke={GOLD} strokeWidth="0.5" opacity="0.4" />

    {/* Lid — translated up 3 px and tilted -2° so the seam gap is visible
        without the chest reading as broken. */}
    <g transform="translate(0 -3) rotate(-2 32 24)">
      <path
        d="M 6 26 L 6 18 Q 6 8 32 8 Q 58 8 58 18 L 58 26 Z"
        fill="#1f1510"
        stroke={GOLD}
        strokeWidth="1.5"
      />
      <circle cx="12" cy="22" r="0.9" fill={GOLD} opacity="0.65" />
      <circle cx="52" cy="22" r="0.9" fill={GOLD} opacity="0.65" />
    </g>

    {/* Padlock, hanging off-axis as if the shackle has slipped through one
        arm. Reads as "already cracked" rather than "still locked". */}
    <g transform="translate(32 42) rotate(-22)">
      <rect x="-4.5" y="0" width="9" height="9" rx="1" fill={GOLD} />
      <path
        d="M -2.8 0 L -2.8 -2.8 Q -2.8 -6 0 -6 Q 2.4 -6 2.8 -3.5"
        fill="none"
        stroke={GOLD}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="0" cy="3.8" r="1.1" fill="#141414" />
      <rect x="-0.55" y="4.2" width="1.1" height="2.6" fill="#141414" />
    </g>
  </svg>
);

const tryVibrate = (ms: number) => {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms);
    }
  } catch {
    /* platforms that throw on permission denial */
  }
};

export const RaffleBlock = () => {
  // Bump on each tap so React remounts the shaking wrapper and the CSS
  // animation re-runs cleanly even if the user taps within the 250 ms window.
  const [shakeKey, setShakeKey] = useState(0);
  const handleTap = useCallback(() => {
    setShakeKey((k) => k + 1);
    tryVibrate(30);
  }, []);

  return (
    <BentoTile title={BLOCK_TITLES.raffle} color={BLOCK_COLORS.raffle} onClick={handleTap}>
      <div
        key={shakeKey}
        className="flex items-center gap-3"
        style={{
          animation: shakeKey > 0 ? 'raffle-shake 250ms ease' : undefined,
        }}
      >
        <AjarChestCompact />
        <div className="flex-1">
          <div
            className="text-[15px] font-extrabold leading-[1.15] tracking-[-0.015em]"
            style={{ fontFamily: '"Fraunces", Georgia, serif', color: 'hsl(var(--bento-fg))' }}
          >
            Prize pool unlocking soon
          </div>
          <div className="mt-1 text-[11px]" style={{ color: 'hsl(var(--bento-fg-muted))' }}>
            Coming in a future update
          </div>
        </div>
      </div>
    </BentoTile>
  );
};
