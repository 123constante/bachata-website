const COLOURS = ['#f0703a', '#e8487f', '#8a4dff', '#4fe0cf', '#ffcf66', '#ff9cc0'];
const PIECES = 36;
const LIFETIME_MS = 1150;

/** True when the person asked their device for less motion. Confetti is OFF then (nothing is created). */
const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * D121 celebration: 36 small CSS-animated pieces (no library), removed after ~1.15s. Fires on "You're in" and when
 * profile strength crosses 70% or reaches 100%. Returns the number of pieces created (0 under reduced motion).
 */
export const daConfetti = (): number => {
  if (typeof document === 'undefined' || reducedMotion()) return 0;
  const host = document.querySelector('[data-profile="dancer"].dancer-app') ?? document.body;
  const layer = document.createElement('div');
  layer.className = 'da-confetti';
  layer.setAttribute('aria-hidden', 'true');
  layer.setAttribute('data-testid', 'da-confetti');
  for (let i = 0; i < PIECES; i += 1) {
    const piece = document.createElement('i');
    piece.style.left = `${(i * 100) / PIECES + (i % 3)}%`;
    piece.style.background = COLOURS[i % COLOURS.length];
    piece.style.animationDelay = `${(i % 5) * 0.04}s`;
    layer.appendChild(piece);
  }
  host.appendChild(layer);
  setTimeout(() => layer.remove(), LIFETIME_MS);
  return PIECES;
};
