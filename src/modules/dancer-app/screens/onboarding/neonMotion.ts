/** Dancer onboarding v8 motion constants, copied from the mockup. Reduced-motion handling is the consumer's job. */
export const YOURE_IN_MS = 2000;
export const TOAST_MS = 2200;
export const TOAST_FADE_MS = 250;
/** translateX keyframes: -7, 7, -5, 5, 0 */
export const SHAKE_MS = 450;
export const SHAKE_X = [-7, 7, -5, 5, 0] as const;
export const RING_MS = 1100;
export const RING_EASE = 'cubic-bezier(.2,.8,.2,1)';
export const RING_CIRC = 213.6;
export const COUNT_STEP = 3;
export const COUNT_TICK_MS = 18;
export const WIN_DELAY_MS = 250;
export const CONFETTI_DELAY_MS = 120;

export const CONFETTI_SMALL = {
  n: 28,
  colours: ['#ff2d95', '#ffa600', '#7a1fff', '#fff', '#2ee6a6'],
  ms: 1100,
  removeMs: 3200,
  startX: 195,
  spreadX: 30,
  startTop: 520,
  w: 9,
  h: 14,
  dx: 150,
  dyMin: 150,
  dyMax: 400,
  rot: 720,
} as const;

export const CONFETTI_BIG = {
  n: 90,
  ms: [1800, 2800],
  removeMs: 3200,
  topStart: -20,
  dx: 100,
  dyMin: 500,
  dyMax: 850,
  bannerText: 'PROFILE COMPLETE!',
  bannerRemoveMs: 2600,
} as const;
