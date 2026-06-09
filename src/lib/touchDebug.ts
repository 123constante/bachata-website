/**
 * touchDebug.ts -- TEMPORARY on-device diagnostic scaffolding for the
 * festival-map popup dead-tap on iOS Safari. Opt-in via ?touchdebug=1 (or the
 * persisted hm_touchdebug localStorage flag). Entirely inert when disabled:
 * no listeners install and tlog() is a no-op, so this is safe to deploy.
 *
 * REVERT this file (plus TouchDebugOverlay.tsx and the 4 instrumentation
 * edits) once the root cause is confirmed on a real iPhone.
 */

const LS_KEY = 'hm_touchdebug';
const MAX_ENTRIES = 40;

export interface TouchLogEntry {
  /** ms since navigation start (performance.now). */
  t: number;
  msg: string;
}

let entries: TouchLogEntry[] = [];
const listeners = new Set<() => void>();

/**
 * Read ?touchdebug from the current URL and persist/clear the localStorage
 * flag. Call once at startup (main.tsx) BEFORE React renders, so the flag
 * survives the `/` -> `/city/:slug` redirect that drops the query string.
 */
export function captureTouchDebugFlag(): void {
  if (typeof window === 'undefined') return;
  try {
    const v = new URLSearchParams(window.location.search).get('touchdebug');
    if (v === '1') window.localStorage.setItem(LS_KEY, '1');
    else if (v === '0') window.localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore privacy-mode / quota errors */
  }
}

/** True when the query says touchdebug=1 OR the persisted flag is set. */
export function isTouchDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (new URLSearchParams(window.location.search).get('touchdebug') === '1') return true;
    return window.localStorage.getItem(LS_KEY) === '1';
  } catch {
    return false;
  }
}

/** Append a log line (no-op when disabled). Keeps the last MAX_ENTRIES. */
export function tlog(msg: string): void {
  if (!isTouchDebugEnabled()) return;
  const t = typeof performance !== 'undefined' ? performance.now() : 0;
  entries = [...entries, { t, msg }].slice(-MAX_ENTRIES);
  listeners.forEach((fn) => fn());
}

export function getTouchLog(): TouchLogEntry[] {
  return entries;
}

export function clearTouchLog(): void {
  entries = [];
  listeners.forEach((fn) => fn());
}

/** Subscribe to log pushes; returns an unsubscribe fn. */
export function subscribeTouchLog(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function tag(el: EventTarget | null): string {
  if (!(el instanceof Element)) return '(non-element)';
  const cls = typeof el.className === 'string' ? el.className.trim().slice(0, 40) : '';
  const base = el.tagName.toLowerCase();
  return cls ? `${base}.${cls.replace(/\s+/g, '.')}` : base;
}

function inPopup(el: EventTarget | null): string {
  if (!(el instanceof Element)) return '';
  const cta = el.closest('a.rpop-cta') ? ' [cta]' : '';
  const card = el.closest('.rpop') ? ' [in-rpop]' : '';
  return `${card}${cta}`;
}

let installed = false;

/**
 * Install capture-phase document listeners that log the pointer/touch/click
 * sequence. Idempotent and inert when disabled. Returns an uninstall fn.
 */
export function installTouchProbe(): () => void {
  if (typeof document === 'undefined' || !isTouchDebugEnabled() || installed) {
    return () => {};
  }
  installed = true;

  const onEvt = (ev: Event) => {
    const pe = ev as PointerEvent & TouchEvent;
    let x: number | undefined;
    let y: number | undefined;
    if (typeof pe.clientX === 'number' && (pe.clientX || pe.clientY)) {
      x = pe.clientX;
      y = pe.clientY;
    } else if (pe.touches && pe.touches[0]) {
      x = pe.touches[0].clientX;
      y = pe.touches[0].clientY;
    } else if (pe.changedTouches && pe.changedTouches[0]) {
      x = pe.changedTouches[0].clientX;
      y = pe.changedTouches[0].clientY;
    }
    let coords = '';
    let hit = '';
    if (x != null && y != null) {
      coords = ` @${Math.round(x)},${Math.round(y)}`;
      hit = ` hit=${tag(document.elementFromPoint(x, y))}`;
    }
    const prevented = ev.defaultPrevented ? ' PREVENTED' : '';
    tlog(`${ev.type} -> ${tag(ev.target)}${inPopup(ev.target)}${coords}${hit}${prevented}`);
  };

  const types = ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click'];
  types.forEach((tp) => document.addEventListener(tp, onEvt, true));

  return () => {
    types.forEach((tp) => document.removeEventListener(tp, onEvt, true));
    installed = false;
  };
}
