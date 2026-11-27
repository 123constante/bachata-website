// @vitest-environment jsdom
/**
 * Vendor dashboard keep-list after the Linked Events and Team tiles went (owner click
 * 2026-11-27). Both tiles opened editor sections retired in Phase 5.5 and always read
 * "No linked events" / "No team members". flags.vendorEventsTeamTilesRemoved (default
 * ON) drops them, the "events" core step, the "Link an event" nudge and the Growth
 * tab's mention of events. Every other tile, header line and tab stays.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({ removed: true }));
vi.mock('@/lib/featureFlags', async (orig) => {
  const real = await orig<typeof import('@/lib/featureFlags')>();
  return {
    ...real,
    flags: new Proxy(real.flags, {
      get: (t, k) => (k === 'vendorEventsTeamTilesRemoved' ? h.removed : Reflect.get(t, k)),
    }),
  };
});
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u-1' } }) }));
vi.mock('@/hooks/useUserIds', () => ({
  useUserIds: () => ({
    dancerId: null, dancerProfileComplete: false, organiserId: null, teacherId: null,
    videographerId: null, vendorId: 'v-1', loading: false,
  }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }));
vi.mock('@/pages/VendorDashboardPage', () => ({ default: () => null }));
// Radix tabs unmount inactive panels; render every panel so one mount sees every tile.
vi.mock('@/components/ui/tabs', () => {
  const Pass = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { Tabs: Pass, TabsList: Pass, TabsTrigger: Pass, TabsContent: Pass };
});
// A fully set-up vendor (name, city, logo, product, promo) -- the shape where the old
// screen nudged "Link an event" because linked events can never be counted.
const vendorRow = {
  id: 'v-1', user_id: 'u-1', business_name: 'Shoe Co', cities: { name: 'London' },
  photo_url: ['https://x/logo.png'], products: [{ name: 'Heels', price: 50 }],
  product_categories: ['shoes'], promo_code: 'DANCE', promo_discount_type: 'percent',
  promo_discount_value: 10, public_email: 'a@b.c', whatsapp: null, website: null,
  instagram: null, facebook: null, faq: null, ships_international: false,
};
vi.mock('@/integrations/supabase/client', () => {
  const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: vendorRow, error: null }) };
  return { supabase: { from: () => chain } };
});

import { VendorDashboard } from '@/components/profile/VendorDashboard';

const mount = async () => {
  render(
    <MemoryRouter>
      <VendorDashboard />
    </MemoryRouter>,
  );
  await screen.findByText('Grow your storefront');
};

afterEach(() => {
  cleanup();
  h.removed = true;
});

const KEPT_TILES = [
  'Products', 'Categories & Shipping', 'Promo Offer', 'Business Location', 'FAQ',
  'Business Name', 'Business logo', 'Contact Channels', 'Social Links',
];

describe('vendor dashboard Events + Team tiles', () => {
  it('flag on (default): no Events/Team tiles or events nudge; everything else stays', async () => {
    await mount();
    expect(screen.queryByText('Linked Events')).toBeNull();
    expect(screen.queryByText('Team')).toBeNull();
    expect(screen.queryByText('Manage events')).toBeNull();
    expect(screen.queryByText('Manage team')).toBeNull();
    for (const t of KEPT_TILES) expect(screen.getByText(t)).toBeTruthy();
    for (const tab of ['Growth', 'Catalog', 'Presence', 'Operations']) {
      expect(screen.getAllByText(tab).length).toBeGreaterThan(0);
    }
    expect(screen.getByText('Vendor dashboard')).toBeTruthy();
    expect(screen.getByText(/Core steps: 4\/4/)).toBeTruthy();
    expect(screen.getByText('Refresh profile')).toBeTruthy();
    expect(screen.getByText(/Use promos to get more profile views\./)).toBeTruthy();
    expect(screen.getByText(/Name: Shoe Co/)).toBeTruthy();
  });

  it('flag off (rollback): the old tiles, step and nudge come back', async () => {
    h.removed = false;
    await mount();
    expect(screen.getByText('Linked Events')).toBeTruthy();
    expect(screen.getByText('Team')).toBeTruthy();
    expect(screen.getByText(/Core steps: 4\/5/)).toBeTruthy();
    expect(screen.getByText('Boost visibility')).toBeTruthy();
    for (const t of KEPT_TILES) expect(screen.getByText(t)).toBeTruthy();
  });
});
