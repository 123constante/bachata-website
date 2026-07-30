import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PromoBlock } from '@/modules/event-page/bento/blocks/PromoBlock';
import { PromoTicketStub } from '@/modules/event-page/promo/PromoTicketStub';
import type { EventPagePromoCode } from '@/modules/event-page/types';

/**
 * Static-render contract for the ticket-stub promo (claude.ai/design 1b).
 *
 * The suite runs in vitest's `node` environment and this repo carries neither
 * jsdom nor Testing Library, so these assert SERVER-RENDERED markup via
 * react-dom/server. That covers the parts a wrong edit would silently break:
 * which code renders, the accessible name, the host-driven layout/density
 * contract, and the DEV warning that stops a second code disappearing quietly.
 *
 * The tear/confetti/replay sequence is deliberately NOT covered here -- it is
 * timer- and mount-driven and needs a real DOM. It was verified in-browser on
 * the festival page (idle -> tearing at 330ms -> torn at 420ms -> idle at
 * 3.6s, and a second tap restarting every animation). If jsdom is ever added,
 * that is the gap to close.
 */

const code = (over: Partial<EventPagePromoCode> = {}): EventPagePromoCode => ({
  id: 'p1',
  code: 'COMMUNITY',
  discount_type: 'fixed',
  discount_amount: 25,
  currency: 'GBP',
  limit: '',
  valid_until: '',
  ...over,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PromoTicketStub', () => {
  it('exposes the code as the accessible name of a real button', () => {
    const html = renderToStaticMarkup(
      <PromoTicketStub code="COMMUNITY" discountLabel="25 off" tone="festival" />,
    );
    expect(html).toContain('<button');
    expect(html).toContain('aria-label="Copy promo code COMMUNITY"');
  });

  it('starts idle: the COPY stub is present and the copied panel is not', () => {
    const html = renderToStaticMarkup(
      <PromoTicketStub code="COMMUNITY" discountLabel="25 off" tone="festival" />,
    );
    expect(html).toContain('ps-stub');
    expect(html).not.toContain('ps-done');
    expect(html).toContain('Tap to tear off');
  });

  it('carries an aria-live region that is empty until a copy happens', () => {
    const html = renderToStaticMarkup(
      <PromoTicketStub code="COMMUNITY" discountLabel="25 off" tone="festival" />,
    );
    // The only non-visual confirmation a screen reader gets. It must exist up
    // front so the announcement lands when its content changes.
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain('copied to clipboard');
  });

  it('defaults to the design 1:1 layout and lets the host override it', () => {
    const fest = renderToStaticMarkup(
      <PromoTicketStub code="X" discountLabel="d" tone="festival" />,
    );
    expect(fest).toContain('data-layout="stub-right"');
    expect(fest).toContain('data-density="default"');

    const bento = renderToStaticMarkup(
      <PromoTicketStub
        code="X"
        discountLabel="d"
        tone="bento"
        layout="stub-bottom"
        density="compact"
      />,
    );
    expect(bento).toContain('data-layout="stub-bottom"');
    expect(bento).toContain('data-density="compact"');
  });

  it('paints from tone variables rather than literal colours', () => {
    const fest = renderToStaticMarkup(
      <PromoTicketStub code="X" discountLabel="d" tone="festival" />,
    );
    const bento = renderToStaticMarkup(
      <PromoTicketStub code="X" discountLabel="d" tone="bento" />,
    );
    expect(fest).toContain('--promo-accent:#fb923c');
    expect(bento).toContain('--promo-accent:hsl(var(--bento-accent))');
  });
});

describe('PromoBlock', () => {
  it('renders nothing when the event has no codes', () => {
    expect(renderToStaticMarkup(<PromoBlock codes={[]} />)).toBe('');
  });

  it('renders the first code only', () => {
    const html = renderToStaticMarkup(
      <PromoBlock codes={[code(), code({ id: 'p2', code: 'SECOND' })]} />,
    );
    expect(html).toContain('COMMUNITY');
    expect(html).not.toContain('SECOND');
  });

  it('warns in DEV when a second code is being dropped', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    renderToStaticMarkup(
      <PromoBlock codes={[code(), code({ id: 'p2', code: 'SECOND' })]} />,
    );
    // First-code-only is intentional, but it must never be silent.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('2 promo codes');
  });

  it('does not warn for the single-code case that live data actually has', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    renderToStaticMarkup(<PromoBlock codes={[code()]} />);
    expect(warn).not.toHaveBeenCalled();
  });

  it('formats the discount through the shared formatter', () => {
    const html = renderToStaticMarkup(<PromoBlock codes={[code()]} />);
    // formatDiscount('fixed', 25, 'GBP') -> the pound-prefixed string.
    expect(html).toMatch(/25 off/);
  });
});
