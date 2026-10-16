/**
 * Site-wide keyboard safety, installed ONCE from the app shell (app/root.tsx).
 *
 * A phone keyboard either shrinks the page (Android with the viewport meta's
 * `interactive-widget=resizes-content`) or overlays it (iOS Safari, some in-app
 * tabs: window.visualViewport shrinks, the layout does not). Either way, while a
 * text field has focus and the keyboard is up, this:
 *   - sets `data-keyboard-open` and `--keyboard-inset` (px the overlay hides at
 *     the bottom) on <html>; index.css adds that much scroll room at the end;
 *   - hides the fixed bars that sit on the bottom edge of what is still visible
 *     (bottom nav, consent, sticky actions, toasts): ONE rule for every bar.
 *     Dialogs and sheets are left alone (they lift themselves), as is anything
 *     marked `data-keyboard-keep`; a bar that is not fixed itself (the organiser
 *     tabs, in a fixed frame's column) opts in with `data-keyboard-hide`;
 *   - scrolls the field so its top sits just under any sticky header when the
 *     field, or its first result, is not visible. Results are the element named
 *     by `aria-controls`, or `[data-keyboard-results]` inside the field's
 *     `[data-keyboard-scope]`; a search field without either keeps one row's
 *     room below it. Always an instant scroll (no smooth motion), never a focus
 *     change, and no scroll at all when the field and its results already show.
 */

const GAP = 8;
/** Room kept under a search field whose results are not marked (about one result row). */
const ROW = 72;
/** Less than this is a browser toolbar moving, not a keyboard. */
const MIN_KEYBOARD = 120;
const HIDDEN = 'data-keyboard-hidden';

const TEXT_INPUT = /^(?:text|search|email|tel|url|number|password)$/;

export function isTextField(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) return TEXT_INPUT.test(el.type) && !el.readOnly && !el.disabled;
  return /^(?:combobox|searchbox|textbox)$/.test(el.getAttribute('role') ?? '');
}

const isSearchLike = (el: HTMLElement) =>
  (el as HTMLInputElement).type === 'search' ||
  /^(?:combobox|searchbox)$/.test(el.getAttribute('role') ?? '') ||
  el.hasAttribute('aria-autocomplete') ||
  el.getAttribute('enterkeyhint') === 'search';

/** The first result row of the field's results, if it renders one. */
function firstResult(field: HTMLElement): HTMLElement | null {
  const id = field.getAttribute('aria-controls')?.trim().split(/\s+/)[0];
  const list = (id && document.getElementById(id)) || field.closest('[data-keyboard-scope]')?.querySelector('[data-keyboard-results]');
  if (!list) return null;
  const row = (list.querySelector('[role="option"]') ?? list.firstElementChild) as HTMLElement | null;
  return row && row.getBoundingClientRect().height > 0 ? row : null;
}

const pinned = (el: Element) => /^(?:fixed|sticky)$/.test(getComputedStyle(el).position);

/** The nearest fixed/sticky element at or above each element hit at height y. */
function layersAt(y: number): HTMLElement[] {
  const out = new Set<HTMLElement>();
  const w = window.innerWidth;
  for (const x of [8, w / 2, w - 8]) {
    for (const hit of document.elementsFromPoint(x, y)) {
      for (let el: Element | null = hit; el && el !== document.body; el = el.parentElement) {
        if (pinned(el)) {
          out.add(el as HTMLElement);
          break;
        }
      }
    }
  }
  return [...out];
}

/** The field's own layers: what holds it, what holds its results (a portalled panel), dialogs and sheets. */
function ownLayer(layer: HTMLElement, field: HTMLElement) {
  const id = field.getAttribute('aria-controls')?.trim().split(/\s+/)[0];
  const results = id ? document.getElementById(id) : null;
  return layer.contains(field) || (!!results && layer.contains(results)) || !!layer.closest('[role="dialog"],[aria-modal="true"],[data-keyboard-keep]');
}

let tallest = { w: 0, h: 0 };

function measure() {
  const vv = window.visualViewport;
  if (window.innerWidth !== tallest.w) tallest = { w: window.innerWidth, h: window.innerHeight };
  else tallest.h = Math.max(tallest.h, window.innerHeight);
  const overlay = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
  const shrunk = tallest.h - window.innerHeight;
  const top = vv ? vv.offsetTop : 0;
  const field = document.activeElement;
  return {
    field: isTextField(field) ? field : null,
    open: overlay >= MIN_KEYBOARD || shrunk >= MIN_KEYBOARD,
    overlay,
    top,
    bottom: vv ? top + vv.height : window.innerHeight,
  };
}

function showBars() {
  document.querySelectorAll(`[${HIDDEN}]`).forEach((el) => el.removeAttribute(HIDDEN));
}

/** Update <html>, hide or restore the bottom bars, and scroll the field into view if it needs it. */
function check() {
  const m = measure();
  const root = document.documentElement;
  const open = m.open && !!m.field;
  root.style.setProperty('--keyboard-inset', `${open ? m.overlay : 0}px`);
  root.toggleAttribute('data-keyboard-open', open);
  if (!open || !m.field) return showBars();
  const field = m.field;

  // Bars resting on the visible bottom edge; a hidden one can reveal another under it.
  for (let i = 0; i < 3; i++) {
    const bars = layersAt(m.bottom - 2).filter((l) => !ownLayer(l, field) && !l.hasAttribute(HIDDEN));
    if (!bars.length) break;
    bars.forEach((b) => b.setAttribute(HIDDEN, ''));
  }
  let top = m.top;
  let bottom = m.bottom;
  // Headers stack (the site header, then the sticky section row under it): look again under each.
  for (let i = 0, prev = -1; i < 4 && top !== prev; i++) {
    prev = top;
    for (const l of layersAt(top + 1)) if (!ownLayer(l, field)) top = Math.max(top, l.getBoundingClientRect().bottom);
  }
  // A scrolling box (the organiser frame's body, a sheet) clips the field to its own edges.
  for (let el = field.parentElement; el && el !== document.body; el = el.parentElement) {
    if (!/^(?:auto|scroll)$/.test(getComputedStyle(el).overflowY)) continue;
    const box = el.getBoundingClientRect();
    top = Math.max(top, box.top);
    bottom = Math.min(bottom, box.bottom);
  }

  const r = field.getBoundingClientRect();
  const row = firstResult(field);
  let need = row ? row.getBoundingClientRect().bottom : isSearchLike(field) ? r.bottom + ROW : r.bottom;
  need = Math.min(Math.max(need, r.bottom), r.top + (bottom - top) - GAP);
  if (r.top >= top && need <= bottom) return;
  scrollBy(field, r.top - (top + GAP));
}

/** Move the field by `delta` px: its scrolling boxes first, then the page. */
function scrollBy(field: HTMLElement, delta: number) {
  for (let el = field.parentElement; el && el !== document.body && Math.abs(delta) >= 1; el = el.parentElement) {
    const cs = getComputedStyle(el);
    if (/^(?:auto|scroll)$/.test(cs.overflowY) && el.scrollHeight > el.clientHeight) {
      const take = Math.max(-el.scrollTop, Math.min(delta, el.scrollHeight - el.clientHeight - el.scrollTop));
      el.scrollTop += take;
      delta -= take;
    }
    // The page cannot move a field inside a fixed box.
    if (cs.position === 'fixed') return;
  }
  if (Math.abs(delta) >= 1) window.scrollBy({ top: delta, behavior: 'instant' as ScrollBehavior });
}

/** Installs the listeners; returns the uninstall. Browser only. */
export function installKeyboardSafe(): () => void {
  let frame = 0;
  let lastTyped = 0;
  const timers: number[] = [];
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => requestAnimationFrame(check));
  };
  // The keyboard animates in after focus; look again as it settles.
  const onFocus = (e: FocusEvent) => {
    if (!isTextField(e.target as Element)) return;
    lastTyped = Date.now();
    schedule();
    timers.push(window.setTimeout(schedule, 300), window.setTimeout(schedule, 700));
  };
  const onBlur = () => window.setTimeout(schedule, 0);
  const onInput = (e: Event) => {
    if (isTextField(e.target as Element)) {
      lastTyped = Date.now();
      schedule();
    }
  };
  // Results render after a debounce or a fetch: follow them for a moment after typing.
  const observer = new MutationObserver(() => {
    if (Date.now() - lastTyped < 2500 && isTextField(document.activeElement)) schedule();
  });
  const vv = window.visualViewport;
  document.addEventListener('focusin', onFocus);
  document.addEventListener('focusout', onBlur);
  document.addEventListener('input', onInput);
  window.addEventListener('resize', schedule);
  vv?.addEventListener('resize', schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  measure();
  return () => {
    document.removeEventListener('focusin', onFocus);
    document.removeEventListener('focusout', onBlur);
    document.removeEventListener('input', onInput);
    window.removeEventListener('resize', schedule);
    vv?.removeEventListener('resize', schedule);
    observer.disconnect();
    cancelAnimationFrame(frame);
    timers.forEach(clearTimeout);
    showBars();
  };
}
