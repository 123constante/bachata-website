import { CONFETTI_BIG, CONFETTI_SMALL } from '../neonMotion';

const COLOURS = CONFETTI_SMALL.colours;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const sign = () => (Math.random() < 0.5 ? -1 : 1);

const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const host = (): Element => document.querySelector('.neon') ?? document.body;

const fly = (el: HTMLElement, dx: number, dy: number, rot: number, ms: number) => {
  if (typeof el.animate !== 'function') return;
  el.animate(
    [{ transform: 'translate(0,0) rotate(0deg)', opacity: 1 }, { transform: `translate(${dx}px,${dy}px) rotate(${rot}deg)`, opacity: 0 }],
    { duration: ms, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' },
  );
};

/**
 * v8 neon confetti. Small burst (28 pieces) or big (90 pieces + "PROFILE COMPLETE!" banner).
 * Returns the number of pieces created: 0 under reduced motion (the big banner still shows, static).
 */
export const boom = (big = false): number => {
  if (typeof document === 'undefined') return 0;
  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  layer.setAttribute('data-testid', 'neon-confetti');
  layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:50';
  const calm = reducedMotion();
  const n = calm ? 0 : big ? CONFETTI_BIG.n : CONFETTI_SMALL.n;
  for (let i = 0; i < n; i += 1) {
    const p = document.createElement('i');
    p.setAttribute('data-piece', '');
    const w = CONFETTI_SMALL.w;
    const h = CONFETTI_SMALL.h;
    const left = big ? rand(0, 390) : CONFETTI_SMALL.startX + rand(-CONFETTI_SMALL.spreadX, CONFETTI_SMALL.spreadX);
    const top = big ? CONFETTI_BIG.topStart : CONFETTI_SMALL.startTop;
    p.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:${w}px;height:${h}px;border-radius:2px;background:${COLOURS[i % COLOURS.length]}`;
    layer.appendChild(p);
    if (big) fly(p, sign() * rand(0, CONFETTI_BIG.dx), rand(CONFETTI_BIG.dyMin, CONFETTI_BIG.dyMax), rand(0, 720), rand(CONFETTI_BIG.ms[0], CONFETTI_BIG.ms[1]));
    else fly(p, sign() * rand(0, CONFETTI_SMALL.dx), -rand(CONFETTI_SMALL.dyMin, CONFETTI_SMALL.dyMax), rand(0, CONFETTI_SMALL.rot), CONFETTI_SMALL.ms);
  }
  host().appendChild(layer);
  setTimeout(() => layer.remove(), CONFETTI_SMALL.removeMs);
  if (big) {
    const b = document.createElement('div');
    b.setAttribute('data-testid', 'neon-banner');
    b.textContent = CONFETTI_BIG.bannerText;
    b.style.cssText = 'position:absolute;left:0;right:0;top:300px;text-align:center;font:44px Anton,sans-serif;color:#fff;text-shadow:0 0 30px #ff2d95;pointer-events:none;z-index:51';
    if (!calm && typeof b.animate === 'function') b.animate([{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 600, fill: 'forwards' });
    host().appendChild(b);
    setTimeout(() => b.remove(), CONFETTI_BIG.bannerRemoveMs);
  }
  return n;
};
