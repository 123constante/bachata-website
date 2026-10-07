// @vitest-environment jsdom
/** A save that fails while offline (or on a dropped connection) says it may not have saved. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../components/VenuePicker', () => ({ VenuePicker: () => null }));
vi.mock('../components/publicVenues', () => ({ useVenueOptions: () => ({ data: [] }), venueName: () => null }));

import { SeriesEditor } from '../components/SeriesEditor';
import { OFFLINE_SAVE_MESSAGE, commandErrorMessage, isNetworkFailure } from '../selfServeErrors';
import type { SeriesWorkspace, WorkspaceSeries } from '../seriesModel';

const setOnline = (value: boolean) => Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });

describe('commandErrorMessage offline copy', () => {
  afterEach(() => setOnline(true));

  it('chooses the offline copy when the phone is offline', () => {
    setOnline(false);
    expect(commandErrorMessage({ message: 'anything' })).toBe(OFFLINE_SAVE_MESSAGE);
  });

  it('chooses the offline copy for a dropped connection', () => {
    expect(commandErrorMessage(new TypeError('Failed to fetch'))).toBe(OFFLINE_SAVE_MESSAGE);
    expect(commandErrorMessage({ message: 'TypeError: Failed to fetch', code: '' })).toBe(OFFLINE_SAVE_MESSAGE);
  });

  it('says the save may not have gone through and tells the organiser what to do', () => {
    expect(OFFLINE_SAVE_MESSAGE).toMatch(/may not have saved/);
    expect(OFFLINE_SAVE_MESSAGE).toMatch(/Check your connection/);
    expect(OFFLINE_SAVE_MESSAGE).toMatch(/before you save again/);
  });

  it('keeps the specific copy when the server answered, even if the phone reports offline', () => {
    setOnline(false);
    const refusal = { message: 'version_conflict', code: 'P0001' };
    expect(isNetworkFailure(refusal)).toBe(false);
    expect(commandErrorMessage(refusal)).toMatch(/changed somewhere else/);
  });

  it('keeps the generic line for an unknown online error', () => {
    expect(commandErrorMessage({ message: 'boom' })).toBe('Something went wrong. Please try again.');
  });
});

describe('SeriesEditor offline save', () => {
  beforeEach(() => rpc.mockReset());
  afterEach(() => { cleanup(); setOnline(true); });

  it('shows the offline copy in the existing alert and keeps what was typed', async () => {
    const series = {
      id: 's1', name: 'Thursday Class', slug: 'thursday-class', format: 'recurring', category: 'class',
      lifecycle_status: 'live', version: 3, default_venue_id: 'v1', default_local_start_time: '20:00:00',
      default_duration: '02:00:00', default_level: 'improver', default_ticket_url: null, default_description: null,
      default_cover_image_url: null, default_start_date: null, instagram_url: null, passes: null, created_at: null,
      recurrence_rule: null, removed_dates: [],
    } as WorkspaceSeries;
    const workspace: SeriesWorkspace = { series, hasSessions: false, dates: [] };
    rpc.mockResolvedValue({ data: null, error: { message: 'TypeError: Failed to fetch', code: '' } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><SeriesEditor workspace={workspace} today="2026-10-05" /></MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Thursday Bachata' } });
    fireEvent.click(screen.getByTestId('basics-save'));
    const alert = await screen.findByTestId('basics-error');
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.textContent).toBe(OFFLINE_SAVE_MESSAGE);
    await waitFor(() => expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Thursday Bachata'));
  });
});
