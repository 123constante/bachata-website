import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

// The per-page checks every visited page gets (Layer 3), plus the two Layer 1
// rules that are about any screen rather than any one shape (copy that points
// at a control which is not there; a disabled control with no reason).
//
// Each check returns Findings keyed by a DATA-INDEPENDENT signature (element
// tag + sorted class list, or an axe rule id), never by text, so the baseline
// in baseline.json stays valid while event names and dates change daily.

export type Finding = {
  rule: 'overflow' | 'tap-target' | 'axe' | 'dangling-control-ref' | 'disabled-no-reason';
  /** Stable signature, no user data: what the baseline matches on. */
  sig: string;
  /** Human detail for the report (may include page text). */
  detail: string;
};

export const MIN_TAP = 44;

/**
 * Horizontal overflow: the document is wider than the DEVICE width. Compared
 * against the configured viewport, NOT window.innerWidth: with isMobile, Chrome
 * widens the layout viewport to fit overflowing content (it zooms the page
 * out), so innerWidth grows with the bug and the comparison could never fail.
 */
export async function checkOverflow(page: Page): Promise<Finding[]> {
  const device = page.viewportSize()?.width ?? 390;
  const r = await page.evaluate((vw) => {
    const el = document.scrollingElement || document.documentElement;
    let widest = '';
    let widestRight = vw;
    if (el.scrollWidth > vw + 1) {
      for (const n of Array.from(document.body.querySelectorAll('*'))) {
        const b = (n as HTMLElement).getBoundingClientRect();
        if (b.width > 0 && b.right > widestRight + 1) {
          widestRight = b.right;
          widest = `${n.tagName.toLowerCase()}.${String((n as HTMLElement).className || '').split(/\s+/).slice(0, 4).join('.')}`;
        }
      }
    }
    return { scrollWidth: el.scrollWidth, vw, widest };
  }, device);
  if (r.scrollWidth <= r.vw + 1) return [];
  return [{ rule: 'overflow', sig: 'document', detail: `scrollWidth ${r.scrollWidth} > viewport ${r.vw}; widest: ${r.widest}` }];
}

/**
 * Tap targets smaller than 44x44 CSS px. Exempt, per WCAG 2.5.5's inline
 * exception: a link inside a run of text (display inline AND its block parent
 * carries more text than the link). Hidden and zero-size elements are skipped.
 */
export async function checkTapTargets(page: Page): Promise<Finding[]> {
  const rows = await page.evaluate((min) => {
    const sel = 'a[href], button, [role="button"], [role="tab"], [role="link"], input:not([type="hidden"]), select, textarea, summary';
    const out: { sig: string; detail: string }[] = [];
    for (const n of Array.from(document.querySelectorAll(sel)) as HTMLElement[]) {
      const cs = getComputedStyle(n);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
      const b = n.getBoundingClientRect();
      // <= 1px is the sr-only pattern (skip links): visible only on focus.
      if (b.width <= 1 || b.height <= 1) continue;
      if (n.closest('[aria-hidden="true"], [inert]')) continue;
      if (cs.display === 'inline') {
        const block = n.parentElement?.closest('p, li, dd, td, span, div');
        const own = (n.textContent || '').trim().length;
        const around = (block?.textContent || '').trim().length;
        if (around > own + 3) continue;
      }
      if (b.width >= min && b.height >= min) continue;
      const cls = String(n.className && typeof n.className === 'string' ? n.className : '')
        .split(/\s+/).filter(Boolean).sort().slice(0, 8).join('.');
      const name = (n.getAttribute('aria-label') || n.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
      out.push({
        sig: `${n.tagName.toLowerCase()}.${cls}`,
        detail: `${Math.round(b.width)}x${Math.round(b.height)} ${n.tagName.toLowerCase()} "${name}"`,
      });
    }
    return out;
  }, MIN_TAP);
  return rows.map((r) => ({ rule: 'tap-target' as const, ...r }));
}

/** axe-core, serious + critical impact only. */
export async function checkAxe(page: Page): Promise<Finding[]> {
  // preload:false -- axe otherwise re-fetches every stylesheet with XHR, and
  // the site's CSP connect-src (rightly) blocks fonts.googleapis.com: the
  // suite would then report its OWN fetch as a site console error.
  const res = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .options({ preload: false })
    .analyze();
  return res.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({
      rule: 'axe' as const,
      sig: v.id,
      detail: `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`,
    }));
}

/**
 * Copy that tells the person to use a control ("tap the Save button", "press
 * Share") must name a control that is actually on screen. Matches
 * tap|click|press|hit|use + optional the + a quoted or Capitalised name + an
 * optional button|link|tab|icon noun, then looks for a visible
 * button/link/tab whose accessible name contains that name.
 */
export const CONTROL_REF = /\b(?:[Tt]ap|[Cc]lick|[Pp]ress|[Hh]it|[Uu]se|[Oo]pen)\s+(?:on\s+)?(?:the\s+)?(?:["\u201c\u2018']([^"\u201d\u2019']{2,30})["\u201d\u2019']|([A-Z][A-Za-z]*(?:\s+[A-Za-z]+){0,3}?)\s+(button|link|tab|icon)\b)/g;

export function extractControlRefs(text: string): string[] {
  const names = new Set<string>();
  for (const m of text.matchAll(CONTROL_REF)) {
    // A quoted name ("Share"), or a Capitalised phrase followed by an
    // explicit button|link|tab|icon noun. A bare capitalised word with no noun
    // ("use Instagram") is not a control reference.
    const name = (m[1] || m[2] || '').trim();
    if (name) names.add(name);
  }
  return [...names];
}

export async function checkControlRefs(page: Page): Promise<Finding[]> {
  const text = await page.locator('body').innerText().catch(() => '');
  const out: Finding[] = [];
  for (const name of extractControlRefs(text)) {
    const re = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const hits = page.getByRole('button', { name: re })
      .or(page.getByRole('link', { name: re }))
      .or(page.getByRole('tab', { name: re }));
    const visible = await hits.filter({ visible: true }).count();
    if (visible === 0) {
      out.push({ rule: 'dangling-control-ref', sig: `ref:${name.toLowerCase()}`, detail: `copy refers to "${name}" but no visible button/link/tab has that name` });
    }
  }
  return out;
}

/**
 * A control that cannot work must say why. A visible disabled control
 * passes when it has a title, an aria-describedby that resolves to text, or
 * visible text next to it inside its own container.
 */
export async function checkDisabledReasons(page: Page): Promise<Finding[]> {
  const rows = await page.evaluate(() => {
    const out: { sig: string; detail: string }[] = [];
    const nodes = Array.from(document.querySelectorAll('button[disabled], [aria-disabled="true"], input[disabled], select[disabled]')) as HTMLElement[];
    for (const n of nodes) {
      const b = n.getBoundingClientRect();
      const cs = getComputedStyle(n);
      if (b.width === 0 || b.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (n.closest('[aria-hidden="true"], [inert]')) continue;
      // The current page in a breadcrumb (aria-current) is not a control.
      if (n.hasAttribute('aria-current')) continue;
      if ((n.getAttribute('title') || '').trim()) continue;
      const ids = (n.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
      if (ids.some((id) => (document.getElementById(id)?.textContent || '').trim())) continue;
      const own = (n.innerText || '').trim();
      const parentText = (n.parentElement?.innerText || '').trim();
      if (parentText.replace(own, '').trim().length > 0) continue;
      const cls = String(typeof n.className === 'string' ? n.className : '').split(/\s+/).filter(Boolean).sort().slice(0, 8).join('.');
      out.push({ sig: `${n.tagName.toLowerCase()}.${cls}`, detail: `disabled ${n.tagName.toLowerCase()} "${(n.getAttribute('aria-label') || own).slice(0, 40)}" with no reason` });
    }
    return out;
  });
  return rows.map((r) => ({ rule: 'disabled-no-reason' as const, ...r }));
}

export async function runAllChecks(page: Page): Promise<Finding[]> {
  return [
    ...(await checkOverflow(page)),
    ...(await checkTapTargets(page)),
    ...(await checkAxe(page)),
    ...(await checkControlRefs(page)),
    ...(await checkDisabledReasons(page)),
  ];
}
