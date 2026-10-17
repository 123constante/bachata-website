/**
 * TEST UTIL (never imported by app code). The four definition-of-done checks the
 * dancer-journey consistency matrices run on whatever screen a cell lands on:
 *
 *   pointers(root)     no text points at a control that is not on screen
 *   emptyStates(root)  every empty / not-found state offers something to do
 *   disabled(root)     every disabled control carries a visible reason
 *   avatars(root)      every avatar is the ONE PersonAvatar, its no-photo disc never black / see-through
 *
 * Each returns a list of human-readable problems ([] = pass), so a failing cell
 * names exactly what is wrong.
 */

const CONTROL = 'a[href], button, [role="button"], summary, label, input:not([type="hidden"])';
const NAV = 'nav';

const visible = (el: Element): boolean => !el.closest('[hidden], [aria-hidden="true"]');

const nameOf = (el: Element): string =>
  (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim();

/** Controls on screen (bottom tabs included: copy may point at a tab). */
export const controls = (root: ParentNode): Element[] => [...root.querySelectorAll(CONTROL)].filter(visible);

const hasControl = (root: ParentNode, name: RegExp | string): boolean =>
  controls(root).some((c) => {
    const n = nameOf(c);
    return typeof name === 'string' ? n.toLowerCase().includes(name.toLowerCase()) : name.test(n) || name.test(c.getAttribute('href') ?? '');
  });

/** Text that is NOT itself a control's label: what the screen says around its controls. */
export const proseOf = (root: ParentNode): string[] => {
  const out: string[] = [];
  const walk = (n: Node) => {
    if (n.nodeType === 3) {
      const t = (n.textContent ?? '').trim();
      if (t) out.push(t);
      return;
    }
    if (n.nodeType !== 1) return;
    const el = n as Element;
    if (el.matches('a, button, [role="button"], label, input, select, textarea, option, script, style, [hidden], [aria-hidden="true"]')) return;
    // Join one block's inline text into one line (a <b> or <Link> inside a sentence stays in it).
    if (el.matches('p, li, h1, h2, h3, h4, dd, dt, figcaption, [role="alert"], [role="status"]')) {
      const t = blockText(el);
      if (t) out.push(t);
      return;
    }
    el.childNodes.forEach(walk);
  };
  root.childNodes.forEach(walk);
  return out;
};

/** A block's text with its controls' labels blanked out (so "tap X" inside a link to X never self-satisfies). */
const blockText = (el: Element): string => {
  const parts: string[] = [];
  const walk = (n: Node) => {
    if (n.nodeType === 3) parts.push(n.textContent ?? '');
    else if (n.nodeType === 1 && !(n as Element).matches('a, button, [role="button"], label, input, [hidden], [aria-hidden="true"]')) n.childNodes.forEach(walk);
    else if (n.nodeType === 1) parts.push(' \u2026 ');
  };
  el.childNodes.forEach(walk);
  return parts.join('').replace(/\s+/g, ' ').trim();
};

// "tap Show my profile again in Account settings", "Press Try again above", "Tap I'm Going or Interested on any event".
const VERB = /\b(?:[Tt]ap|[Pp]ress|[Cc]lick|[Uu]se|[Cc]hoose|[Ss]elect|[Hh]it)\s+(?:the\s+)?["\u201c\u2018]?([A-Z][^.,;:!?"\u201d]*?)["\u201d\u2019]?(?:\s+(?:button|link|tab|row))?(?:\s+(in|on|from|at)\s+(?:the\s+)?([^.,;:!?]+?))?(?=\s+(?:above|below|to|and|then)\b|[.,;:!?]|$)/g;

/** (a) No text points at a control that is not on screen. */
export const pointers = (root: ParentNode): string[] => {
  const problems: string[] = [];
  for (const line of proseOf(root)) {
    if (/\bMessage us\b/i.test(line) && !hasControl(root, /message us|whatsapp|wa\.me/i)) {
      problems.push(`"${line}" says Message us, but no Message-us control is on screen`);
    }
    if (/\b(top[- ]right|picture at the top|your picture)\b/i.test(line) && !root.querySelector('[data-testid="profile-switcher-button"]')) {
      problems.push(`"${line}" points at the header picture, which is not on screen`);
    }
    for (const m of line.matchAll(VERB)) {
      const [, target, prep, place] = m;
      if (place) {
        // A control on ANOTHER page: the way to that page must be here.
        const ok = /any event|an event|the event/i.test(place) ? hasControl(root, /browse events|events/i) : hasControl(root, place.trim());
        if (!ok) problems.push(`"${line}" sends the person ${prep} "${place.trim()}", which no control on screen opens`);
      } else if (!hasControl(root, target.trim())) {
        problems.push(`"${line}" names "${target.trim()}", which is not a control on screen`);
      }
    }
  }
  return problems;
};

const EMPTY_RE = /\b(?:No [a-z\u2019' ]*yet|Nothing (?:listed|here|saved)|can(?:\u2019|')t find|could not (?:find|load)|couldn(?:\u2019|')t (?:find|load)|not set yet)\b/i;

const actionable = (el: Element): boolean =>
  !el.closest(NAV) && visible(el) && !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true'
  && (el.matches('a[href], button, [role="button"]') || (el.matches('label') && !!el.querySelector('input[type="file"]')));

/** (b) Every empty / not-found state says what the person can do: an enabled control in its own block. */
export const emptyStates = (root: ParentNode): string[] => {
  const problems: string[] = [];
  const blocks = [...root.querySelectorAll('p, b, span, h1, h2, h3, div')].filter(
    (el) => visible(el) && !el.closest(NAV) && [...el.childNodes].some((n) => n.nodeType === 3 && EMPTY_RE.test(n.textContent ?? '')),
  );
  for (const el of blocks) {
    let box: Element | null = el;
    let found = false;
    for (let i = 0; i < 5 && box && box !== root; i += 1) {
      if ([...box.querySelectorAll('a[href], button, [role="button"], label')].some(actionable)) { found = true; break; }
      box = box.parentElement;
    }
    if (!found) problems.push(`empty state "${(el.textContent ?? '').trim().slice(0, 80)}" offers nothing to do`);
  }
  return problems;
};

const reasonText = (el: Element | null | undefined): string => {
  if (!el || !visible(el) || el.matches('a, button, [role="button"], input, label')) return '';
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
};

/** (c) Every disabled control has a visible reason: aria-describedby to visible text, or reason text beside it. */
export const disabled = (root: ParentNode): string[] => {
  const problems: string[] = [];
  const doc = (root as Node).ownerDocument ?? (root as Document);
  const els = [...root.querySelectorAll('button[disabled], input[disabled], select[disabled], textarea[disabled], [aria-disabled="true"]')].filter(
    (el) => visible(el) && !el.closest(NAV),
  );
  for (const el of els) {
    const ids = (el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
    const described = ids.map((id) => reasonText(doc.getElementById(id))).filter((t) => t.length >= 10);
    const host = el.closest('[role="switch"]') ?? el;
    const beside = [host.nextElementSibling, host.previousElementSibling, host.parentElement?.nextElementSibling, host.parentElement?.parentElement?.nextElementSibling]
      .map(reasonText)
      .filter((t) => t.length >= 10);
    if (described.length === 0 && beside.length === 0) problems.push(`disabled control "${nameOf(el) || el.outerHTML.slice(0, 80)}" has no visible reason`);
  }
  return problems;
};

/** (d) Avatars: only PersonAvatar ([data-face]); its no-photo disc is painted with the avatar token, never black or see-through. */
export const avatars = (root: ParentNode, photoUrls: readonly string[]): string[] => {
  const problems: string[] = [];
  for (const el of [...root.querySelectorAll('[data-face]')]) {
    if (el.tagName === 'IMG') continue;
    const bg = (el as HTMLElement).style.background || (el as HTMLElement).style.backgroundColor;
    if (!/var\(--da-avatar,\s*hsl\(var\(--muted-foreground\)\)\)/.test(bg)) problems.push(`no-photo avatar disc painted "${bg}"`);
    if (/transparent|rgba?\(0,\s*0,\s*0|#000\b|black/i.test(bg)) problems.push(`no-photo avatar disc is black / transparent: "${bg}"`);
  }
  for (const img of [...root.querySelectorAll('img')]) {
    const src = img.getAttribute('src') ?? '';
    if (photoUrls.some((u) => u && src.includes(u)) && !img.hasAttribute('data-face')) problems.push(`the dancer photo ${src} is drawn outside PersonAvatar`);
  }
  // shadcn's Avatar root (components/ui/avatar) is never used on the journey.
  if (root.querySelector('span.relative.flex.shrink-0.overflow-hidden.rounded-full')) problems.push('a shadcn Avatar is on screen');
  return problems;
};
