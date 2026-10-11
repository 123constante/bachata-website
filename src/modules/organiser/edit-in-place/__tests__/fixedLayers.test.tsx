// @vitest-environment jsdom
/**
 * The layer's fixed pieces on a phone (live site, 2026-10-11): the Save bar sat
 * UNDER the BottomNav (same rect, same z-index, Save not tappable) and, after a
 * client navigation, halfway down the page: the route's PageTransition wrapper
 * keeps `filter: blur(0px)`, which re-anchors position:fixed children to it. So
 * the harness puts the layer under exactly such a wrapper, and checks every
 * fixed piece lives in document.body, the bar sits above the nav, and the
 * spacer leaves room for both. Plus: the "Complete your page" card's text is
 * readable on both ends of its gradient (the heading measured 1.15:1 on prod).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useState } from 'react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ProfileEntity } from '@/modules/organiser/profile/profileForm';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn() } }));

import EditInPlaceLayer from '../EditInPlaceLayer';
import type { EipBridge } from '../bridge';
import { GOLD, INK } from '../parts';

const ID = '33333333-3333-4333-8333-333333333333';
const ENTITY = {
  id: ID, name: 'Ritmo Latino', avatar_url: null, bio: null, socials: null,
  city_id: '11111111-1111-4111-8111-111111111111', instagram: null, website: null,
  organisation_category: null, founded_year: null, cities: { name: 'London', slug: 'london-gb' },
} as ProfileEntity;

const NAV_OFFSET = 'calc(var(--bottom-nav-h, 68px) + env(safe-area-inset-bottom, 0px))';
const src = (p: string) => readFileSync(resolve(__dirname, p), 'utf8');
// The BottomNav's real z-index, read from its className so this tracks the nav.
const NAV_Z = Number(/<nav[\s\S]*?\bz-(\d+)\b/.exec(src('../../../../components/BottomNav.tsx'))?.[1]);

function Page() {
  const [eip, setEip] = useState<EipBridge | null>(null);
  return (
    // What PageTransition leaves on the route after a client navigation.
    <div data-testid="route" style={{ filter: 'blur(0px)', transform: 'none' }}>
      <article data-testid="article">
        {eip?.slot('card')}
        <p>About{eip?.slot('about')}</p>
        <EditInPlaceLayer organiserId={ID} entity={ENTITY} onBridge={setEip} client={{ rpc: vi.fn() } as never} />
      </article>
    </div>
  );
}

function setup() {
  const router = createMemoryRouter(
    [{ path: '/organisers/ritmo', element: <Page /> }, { path: '/organisers', element: <p>All</p> }],
    { initialEntries: ['/organisers/ritmo'] },
  );
  const { container } = render(<QueryClientProvider client={new QueryClient()}><RouterProvider router={router} /></QueryClientProvider>);
  return { router, container };
}

async function draftBio() {
  fireEvent.click(await waitFor(() => { const p = document.querySelector<HTMLButtonElement>('[data-eip-pencil="bio"]'); if (!p) throw new Error('no pencil'); return p; }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'We dance on Tuesdays.' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
}

/** The fixed element (nearest ancestor-or-self with position:fixed). */
const fixedOf = (el: HTMLElement) => {
  let n: HTMLElement | null = el;
  while (n && n.style.position !== 'fixed') n = n.parentElement;
  if (!n) throw new Error('no fixed ancestor');
  return n;
};

beforeEach(() => window.localStorage.clear());
afterEach(() => cleanup());

describe('fixed pieces: in document.body, above the BottomNav', () => {
  it('reads a real z-index off the BottomNav', () => {
    expect(NAV_Z).toBe(50);
  });

  it('the bar + notice wrapper is a child of document.body, offset above the nav, layered over it', async () => {
    const { container } = setup();
    await draftBio();
    const dock = fixedOf(screen.getByTestId('eip-bar'));
    expect(dock.parentElement).toBe(document.body);
    expect(screen.getByTestId('route').contains(dock)).toBe(false);
    expect(dock.contains(screen.getByTestId('eip-notice'))).toBe(true);
    expect(dock.style.bottom).toBe(NAV_OFFSET);
    // On the nav's layer and AFTER the app root in the DOM (the render container
    // stands in for #root, where AppChrome renders the BottomNav), so a tie with
    // the nav goes to the bar; a page dialog portalled later still covers it.
    expect(Number(dock.style.zIndex)).toBeGreaterThanOrEqual(NAV_Z);
    expect(container.compareDocumentPosition(dock) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Below the layer's own sheet (60) and leave dialog (70).
    expect(Number(dock.style.zIndex)).toBeLessThan(60);
  });

  it('the spacer sits at the very end of the page and leaves room for the notice + bar above the nav', async () => {
    setup();
    await draftBio();
    // Old code: an in-article spacer of 112px, ignoring the nav.
    const spacer = screen.getByTestId('eip-spacer');
    expect(spacer.parentElement).toBe(document.body);
    // jsdom has no ResizeObserver: the estimate (notice 72 + bar 64) applies.
    expect(spacer.style.height).toBe('calc(136px + var(--bottom-nav-h, 68px) - 64px)');
  });

  it('on a phone (ResizeObserver) the spacer follows the dock\'s MEASURED height, e.g. a wrapped error notice', async () => {
    let fire: (() => void) | null = null;
    vi.stubGlobal('ResizeObserver', class {
      constructor(cb: () => void) { fire = cb; }
      observe() {}
      disconnect() {}
    });
    try {
      setup();
      await draftBio();
      const dock = fixedOf(screen.getByTestId('eip-bar'));
      Object.defineProperty(dock, 'offsetHeight', { configurable: true, value: 210 });
      act(() => fire?.());
      await waitFor(() => expect(screen.getByTestId('eip-spacer').style.height).toBe('calc(210px + var(--bottom-nav-h, 68px) - 64px)'));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('the sheet and its overlay are children of document.body; the keyboard offset still applies', async () => {
    setup();
    fireEvent.click(await waitFor(() => document.querySelector<HTMLButtonElement>('[data-eip-pencil="bio"]')!));
    const sheet = await screen.findByTestId('eip-sheet');
    expect(sheet.parentElement).toBe(document.body);
    expect(screen.getByTestId('eip-sheet-overlay').parentElement).toBe(document.body);
    expect(Number(sheet.style.zIndex)).toBeGreaterThan(NAV_Z);
    expect(sheet.style.bottom).toBe('0px');
    // Escape still reaches the sheet's handler through the portal.
    fireEvent.keyDown(sheet, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('eip-sheet')).toBeNull());
  });

  it('the leave dialog and its overlay are children of document.body, above the bar', async () => {
    const { router } = setup();
    await draftBio();
    void router.navigate('/organisers');
    const dialog = await screen.findByTestId('eip-leave');
    expect(dialog.parentElement).toBe(document.body);
    expect(Number(dialog.style.zIndex)).toBeGreaterThan(Number(fixedOf(screen.getByTestId('eip-bar')).style.zIndex));
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Save and leave'));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('eip-leave')).toBeNull());
  });
});

// ---- contrast (WCAG 2.x relative luminance) ------------------------------------------------

type Rgb = [number, number, number];
const hex = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
const channel = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const luminance = ([r, g, b]: Rgb) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (a: Rgb, b: Rgb) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const over = (fg: Rgb, bg: Rgb, alpha: number): Rgb => fg.map((v, i) => v * alpha + bg[i] * (1 - alpha)) as Rgb;
const css = (c: string): Rgb => {
  if (c.startsWith('#')) return hex(c);
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c);
  if (!m) throw new Error(`colour ${c}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};

// The card's gradient stops: linear-gradient(135deg,#FBEFC4,GOLD).
const STOPS = ['#FBEFC4', GOLD];
// index.css gives every h2 `color: hsl(var(--foreground))` (white on this site:
// the live heading measured rgb(255,255,255)), so a heading without its own
// colour does NOT inherit the card's ink.
const WHITE: Rgb = [255, 255, 255];

/** The colour a text node paints, and the opacity it is painted at, inside the card. */
function painted(el: HTMLElement, card: HTMLElement): { color: Rgb; alpha: number } {
  let color: Rgb | null = null;
  let alpha = 1;
  for (let n: HTMLElement | null = el; n; n = n === card ? null : n.parentElement) {
    if (n.style.opacity) alpha *= Number(n.style.opacity);
    if (color) continue;
    if (n.style.color) color = css(n.style.color);
    else if (n.tagName === 'H2') color = WHITE;
  }
  return { color: color ?? [0, 0, 0], alpha };
}

describe('"Complete your page" card: every text readable on both gradient stops', () => {
  it('the colour maths reproduces the live measurement (white heading 1.15 to 1.75)', () => {
    expect(contrast(WHITE, hex(STOPS[0])).toFixed(2)).toBe('1.15');
    expect(contrast(WHITE, hex(STOPS[1])).toFixed(2)).toBe('1.75');
    expect(contrast(hex(INK), hex(GOLD))).toBeGreaterThan(11);
  });

  it('heading, progress, row labels, reasons and buttons all reach 4.5:1 on both stops', async () => {
    setup();
    const card = await screen.findByTestId('eip-complete-card');
    expect(css(within(card).getByRole('heading', { name: 'Complete your page' }).style.color)).toEqual(hex(INK));
    const texts = Array.from(card.querySelectorAll<HTMLElement>('*')).filter((e) =>
      Array.from(e.childNodes).some((c) => c.nodeType === 3 && c.textContent!.trim()) && !e.closest('[aria-hidden="true"]'));
    expect(texts.length).toBeGreaterThan(5);
    for (const el of texts) {
      // Text on a solid ink pill (the Add buttons) is checked against that pill.
      const pill = el.closest<HTMLElement>('button')?.style.background;
      const { color, alpha } = painted(el, card);
      for (const stop of pill && pill !== 'none' ? [pill] : STOPS) {
        const bg = css(stop);
        const ratio = contrast(over(color, bg, alpha), bg);
        expect(ratio, `${el.tagName} "${el.textContent}" on ${stop}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
