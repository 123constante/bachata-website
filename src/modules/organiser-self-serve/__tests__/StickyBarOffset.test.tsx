// @vitest-environment jsdom
/**
 * The two sticky action bars sit above the fixed 60px BottomNav. The root font size is fluid, so a
 * rem offset (3.75rem is ~51px on a phone) slid the bar's edge under the nav; the offset is px.
 * CreateEventForm also keeps a focused field clear of the bar plus nav (scroll-margin).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn(), auth: {} } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/components/ui/city-picker', () => ({ CityPicker: () => null }));
vi.mock('../components/VenuePicker', () => ({ VenuePicker: () => null }));
vi.mock('../components/useOwnerCommand', () => ({ useOwnerCommand: () => ({ mutateAsync: vi.fn() }) }));
vi.mock('../components/publicVenues', () => ({ useVenueOptions: () => ({ data: [] }), venueName: () => null }));
vi.mock('@/hooks/useUnsavedChangesGuard', () => ({ useUnsavedChangesGuard: () => {} }));

import { SeriesEditor } from '../components/SeriesEditor';
import { CreateEventForm } from '../components/CreateEventForm';
import type { HomeOrganiser } from '../selfServeApi';
import type { SeriesWorkspace } from '../seriesModel';

const OFFSET = 'bottom-[calc(60px+env(safe-area-inset-bottom))]';
const wrap = (ui: ReactNode) =>
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);

afterEach(cleanup);

describe('sticky action bar offset', () => {
  it('CreateEventForm bar uses the 60px nav offset (not rem) and the form clears a focused field', () => {
    const org = { id: 'org-1', name: 'Ritmo', slug: 'r', avatar_url: null, city_id: null, lifecycle_status: 'live', role: 'owner', latest_decision: null, series: [] } as unknown as HomeOrganiser;
    wrap(<CreateEventForm organisers={[org]} initialOrganiserId={null} today="2026-10-04" />);
    const bar = screen.getByTestId('create-actions');
    expect(bar.className).toContain(OFFSET);
    expect(bar.className).not.toContain('3.75rem');
    const form = screen.getByTestId('create-fields').closest('form')!;
    expect(form.className).toContain('scroll-mb-40');
  });

  it('SeriesEditor bar uses the 60px nav offset (not rem)', () => {
    const ws = {
      series: {
        id: 's1', name: 'Thursday Party', slug: 't', format: 'recurring', category: 'party', lifecycle_status: 'live', version: 3,
        default_venue_id: 'v1', default_local_start_time: '20:00:00', default_duration: '02:00:00', default_level: null,
        default_ticket_url: null, default_description: null, default_cover_image_url: null, default_start_date: null,
        instagram_url: null, passes: null, created_at: null, recurrence_rule: null, removed_dates: [],
      },
      hasSessions: false,
      dates: [],
    } as unknown as SeriesWorkspace;
    wrap(<SeriesEditor workspace={ws} today="2026-10-07" />);
    const bar = screen.getByTestId('basics-save').closest('div.sticky')!;
    expect(bar.className).toContain(OFFSET);
    expect(bar.className).not.toContain('3.75rem');
  });
});
