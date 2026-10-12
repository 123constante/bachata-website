/**
 * ONE animation clock for every waving flag on the page.
 *
 * - A single requestAnimationFrame loop draws every registered flag that is on screen;
 *   there is never one timer per flag.
 * - A single shared IntersectionObserver marks flags visible / hidden, so a list of 100+
 *   avatars only animates the dozen on screen. With nothing visible the loop stops.
 * - The loop stops while the tab is hidden (visibilitychange) and restarts on return.
 * - prefers-reduced-motion: no loop at all; each flag is drawn once, still, when it first
 *   shows (and again if the setting changes).
 */
import { STILL_T } from './flagWave';

type DrawFn = (t: number) => void;
interface Entry {
  draw: DrawFn;
  visible: boolean;
}

const entries = new Map<Element, Entry>();
let raf = 0;
let io: IntersectionObserver | null | undefined;
let wired = false;
let reducedMq: MediaQueryList | null = null;

const stats = { frames: 0, flagsLastFrame: 0, drawMsTotal: 0, maxFrameMs: 0, registered: 0, loops: 0 };
/** Measurement only (phone QA reads it); never drives behaviour. */
export const getFlagClockStats = () => ({ ...stats, registered: entries.size, running: raf !== 0 });
export const resetFlagClockStats = () => {
  stats.frames = 0;
  stats.flagsLastFrame = 0;
  stats.drawMsTotal = 0;
  stats.maxFrameMs = 0;
  stats.loops = 0;
};

const hasWindow = () => typeof window !== 'undefined' && typeof document !== 'undefined';
export const prefersReducedMotion = () => !!reducedMq?.matches;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function anyVisible() {
  for (const e of entries.values()) if (e.visible) return true;
  return false;
}

function frame(t: number) {
  raf = 0;
  if (document.hidden || prefersReducedMotion()) return;
  const start = now();
  let n = 0;
  for (const e of entries.values()) {
    if (!e.visible) continue;
    e.draw(t);
    n++;
  }
  const ms = now() - start;
  stats.frames++;
  stats.flagsLastFrame = n;
  stats.drawMsTotal += ms;
  if (ms > stats.maxFrameMs) stats.maxFrameMs = ms;
  if (n > 0) raf = requestAnimationFrame(frame);
}

function start() {
  if (raf || !hasWindow() || document.hidden || prefersReducedMotion() || !anyVisible()) return;
  stats.loops++;
  raf = requestAnimationFrame(frame);
}

function stop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

function drawAllStill() {
  for (const e of entries.values()) if (e.visible) e.draw(STILL_T);
}

function wire() {
  if (wired || !hasWindow()) return;
  wired = true;
  reducedMq = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const onReduced = () => {
    if (prefersReducedMotion()) {
      stop();
      drawAllStill();
    } else start();
  };
  reducedMq?.addEventListener?.('change', onReduced);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  io =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(
          (list) => {
            for (const it of list) {
              const e = entries.get(it.target);
              if (!e) continue;
              e.visible = it.isIntersecting;
              if (e.visible && prefersReducedMotion()) e.draw(STILL_T);
            }
            if (anyVisible()) start();
            else stop();
          },
          { rootMargin: '64px' },
        )
      : null;
  if (import.meta.env?.DEV) (window as unknown as { __flagClock?: unknown }).__flagClock = { getFlagClockStats, resetFlagClockStats };
}

/** Registers a flag's canvas with the shared clock; returns the unregister function. */
export function registerFlag(el: Element, draw: DrawFn): () => void {
  if (!hasWindow()) return () => {};
  wire();
  // Without IntersectionObserver every flag counts as visible.
  entries.set(el, { draw, visible: !io });
  io?.observe(el);
  if (!io) start();
  return () => {
    io?.unobserve(el);
    entries.delete(el);
    if (!anyVisible()) stop();
  };
}

/** Draws one flag now (art just loaded): still frame under reduced motion, else the current time. */
export function drawNow(el: Element) {
  const e = entries.get(el);
  if (!e) return;
  e.draw(prefersReducedMotion() ? STILL_T : now());
}
