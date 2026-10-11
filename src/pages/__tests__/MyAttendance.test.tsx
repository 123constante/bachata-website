// @vitest-environment jsdom
/**
 * /account/attendance (the dancer home's "My attendance"). Prod shape
 * 2026-10-11: event_attendance holds 3 rows for 1 account, so nearly every
 * dancer sees the EMPTY state -- it must name the event-page controls that
 * really exist, and offer a way on. A past night links to that event's own
 * rating card.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({ rows: [] as unknown[] }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: async () => ({ data: h.rows, error: null }) },
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, isLoading: false, authStatus: 'ready' }) }));
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/layout/GlobalLayout', () => ({
  default: ({ children, backHref }: { children: ReactNode; backHref?: string }) => (
    <div data-back={backHref}>{children}</div>
  ),
}));
vi.mock('@/contexts/CityContext', () => ({ useCity: () => ({ citySlug: 'london-gb' }) }));
vi.mock('@/lib/seo', () => ({ useSeo: () => undefined }));

import MyAttendance, { RATE_ANCHOR } from '../MyAttendance';
import { LEVEL_RATING_ANCHOR } from '@/components/LevelRatingPrompt';
import { ACCOUNT_HOME_PATH } from '@/lib/accountRouting';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/account/attendance']}>
        <MyAttendance />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const row = (o: Record<string, unknown>) => ({
  event_id: 'ev1', status: 'going', updated_at: null, name: 'Friday Social', occurrence_date: '2026-10-02',
  city_name: 'London', country: 'GB', city_slug: 'london', start_time: null, type: 'party', is_active: true, ...o,
});

afterEach(cleanup);

describe('My attendance', () => {
  it('the rating link lands on the rating card anchor', () => {
    expect(RATE_ANCHOR).toBe(LEVEL_RATING_ANCHOR);
  });

  it('empty: names the real RSVP controls and offers a way on; back goes to the account', async () => {
    h.rows = [];
    mount();
    expect(await screen.findByText(/No event attendance yet/)).toBeTruthy();
    // The event page's RsvpBlock labels these two buttons exactly so.
    const rsvp = readFileSync(path.resolve(__dirname, '../../modules/event-page/bento/blocks/RsvpBlock.tsx'), 'utf8');
    expect(rsvp).toContain(`"I'm Going"`);
    expect(rsvp).toMatch(/>\s*Interested\s*</);
    expect(screen.getByText(/I\u2019m Going\u201d or \u201cInterested\u201d on any event page/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Browse events' })).toBeTruthy();
    expect(document.querySelector('[data-back]')?.getAttribute('data-back')).toBe(ACCOUNT_HOME_PATH);
  });

  it('a past party offers "Rate the dancing level" on its own event page; a future one and a festival do not', async () => {
    h.rows = [
      row({ event_id: 'past1', occurrence_date: '2026-01-02' }),
      row({ event_id: 'fut1', occurrence_date: '2099-01-02' }),
      row({ event_id: 'fest1', occurrence_date: '2026-01-02', type: 'festival' }),
    ];
    mount();
    const links = await screen.findAllByTestId('attendance-rate');
    expect(links.map((a) => a.getAttribute('href'))).toEqual([`/event/past1#${LEVEL_RATING_ANCHOR}`]);
  });
});
