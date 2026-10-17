// @vitest-environment jsdom
/**
 * Audit L1 on the code step: the address we sent the code to wraps like the account pages
 * (the one shared EmailText: a break point before "@", then overflow-wrap:anywhere, never break-all).
 * Seed: a 49-character prod-shape address.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { verifyOtp: vi.fn() } } }));
vi.mock('@/lib/analytics', () => ({ trackAnalyticsEvent: vi.fn() }));

import MagicLinkConfirmation from '@/components/MagicLinkConfirmation';

const LONG_EMAIL = 'maria.fernanda.rodriguez.villanueva@example.co.uk';

afterEach(cleanup);

describe('L1: code step email', () => {
  it('renders the 49-character address with the shared EmailText', async () => {
    expect(LONG_EMAIL).toHaveLength(49);
    const { container } = render(
      <MagicLinkConfirmation email={LONG_EMAIL} onResend={async () => 'sent'} onChangeEmail={() => {}} onVerified={() => {}} />,
    );
    await screen.findByText('Check your email');
    const spans = container.querySelectorAll('[data-email]');
    expect(spans).toHaveLength(1);
    const el = spans[0] as HTMLElement;
    expect(el.textContent).toBe(LONG_EMAIL);
    expect(el.className).toContain('[overflow-wrap:anywhere]');
    const wbr = el.querySelector('wbr');
    expect(wbr?.nextSibling?.textContent).toBe('@example.co.uk');
    expect(container.querySelector('.break-all')).toBeNull();
  });
});
