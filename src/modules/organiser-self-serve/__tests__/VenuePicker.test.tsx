// @vitest-environment jsdom
/**
 * Lever 2 B2: the organiser venue picker, rendered. The RPCs are mocked at the Supabase
 * client. Asserts the picker lists a draft venue from get_organiser_venue_options_v1, still
 * works off the public list when that RPC errors (merge order), and that "no match" leads
 * to a venue request sent through submit_listing_request_v1.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));

import { VenuePicker } from '../components/VenuePicker';

const DRAFT = { id: 'v-draft', name: 'New Studio', neighbourhood: null, city_name: 'London', address: null, postcode: 'E1 6AN' };
const LISTED = { id: 'v-listed', name: 'Pura Social', neighbourhood: 'Soho', city_name: 'London', address: null, postcode: null };

function mount(onChange = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <VenuePicker id="v" value={null} onChange={onChange} organiserName="Ritmo" />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByText('Change venue'));
  return onChange;
}
const search = (text: string) => fireEvent.change(screen.getByPlaceholderText('Search venues by name or area'), { target: { value: text } });

beforeEach(() => rpc.mockReset());
afterEach(cleanup);

describe('VenuePicker', () => {
  it('offers a draft venue from the organiser RPC and picks it', async () => {
    rpc.mockImplementation(async (fn: string) =>
      fn === 'get_organiser_venue_options_v1' ? { data: [DRAFT, LISTED], error: null } : { data: [LISTED], error: null },
    );
    const onChange = mount();
    search('new st');
    fireEvent.click(await screen.findByText('New Studio'));
    expect(onChange).toHaveBeenCalledWith('v-draft');
    expect(rpc).not.toHaveBeenCalledWith('get_public_venues_list_v4');
  });

  it('falls back to the public list when the organiser RPC is not there yet', async () => {
    rpc.mockImplementation(async (fn: string) =>
      fn === 'get_organiser_venue_options_v1'
        ? { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }
        : { data: [LISTED], error: null },
    );
    const onChange = mount();
    search('soho');
    fireEvent.click(await screen.findByText('Pura Social'));
    expect(onChange).toHaveBeenCalledWith('v-listed');
    expect(rpc).toHaveBeenCalledWith('get_public_venues_list_v4');
  });

  it('no match -> ask the team, which sends a venue request to the Listing requests queue', async () => {
    rpc.mockImplementation(async (fn: string) =>
      fn === 'submit_listing_request_v1' ? { data: { ok: true, id: 'r1' }, error: null } : { data: [LISTED], error: null },
    );
    mount();
    search('Salsa Cellar');
    fireEvent.click(await screen.findByTestId('venue-request-open'));
    expect((screen.getByTestId('venue-request-name') as HTMLInputElement).value).toBe('Salsa Cellar');
    const send = screen.getByTestId('venue-request-send') as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('venue-request-link'), { target: { value: 'https://maps.app.goo.gl/x' } });
    fireEvent.change(screen.getByTestId('venue-request-phone'), { target: { value: '+44 7700 900123' } });
    expect(send.disabled).toBe(false);
    fireEvent.click(send);
    await screen.findByTestId('venue-request-sent');
    expect(rpc).toHaveBeenCalledWith('submit_listing_request_v1', {
      p_payload: expect.objectContaining({
        section: 'venue_detail',
        name: 'Salsa Cellar (venue for Ritmo)',
        phone: '+44 7700 900123',
        event_link: 'https://maps.app.goo.gl/x',
      }),
    });
  });

  it('a refused request says why and keeps the form', async () => {
    rpc.mockImplementation(async (fn: string) =>
      fn === 'submit_listing_request_v1' ? { data: { ok: false, error: 'rate_limited' }, error: null } : { data: [], error: null },
    );
    mount();
    search('Salsa Cellar');
    fireEvent.click(await screen.findByTestId('venue-request-open'));
    fireEvent.change(screen.getByTestId('venue-request-link'), { target: { value: 'https://x.example' } });
    fireEvent.change(screen.getByTestId('venue-request-phone'), { target: { value: '07700900123' } });
    fireEvent.click(screen.getByTestId('venue-request-send'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Too many requests'));
    expect(screen.queryByTestId('venue-request-sent')).toBeNull();
  });
});
