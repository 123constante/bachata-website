// @vitest-environment jsdom
/**
 * BUG F1: every route step that saves to an EXISTING event must send a
 * series.upsert the server accepts. The handler answers `invalid_payload: name
 * required` to an upsert with no name, so the harness below refuses exactly
 * that, the way the live handler does. Table-driven over every step.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { home, rawWorkspace, venues } from '../../events/__tests__/fixtures';

const rpc = vi.hoisted(() => vi.fn());
const upload = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-10-08' }));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity: async () => ({ cityId: 'c-london' }) }));
vi.mock('../../events/media', () => ({ uploadEventPicture: upload }));

import NewFlow from '../new/NewFlow';
import CoverFlow from '../fix/CoverFlow';

type Envelope = { command: { kind: string; payload: Record<string, unknown> } };
const sent = (): Envelope[] => rpc.mock.calls.filter(([fn]) => fn === 'series_command_p5').map(([, a]) => (a as { p_envelope: Envelope }).p_envelope);

beforeEach(() => {
  rpc.mockReset();
  upload.mockReset().mockResolvedValue('https://cdn.example/c.jpg');
  rpc.mockImplementation(async (fn: string, args: { p_envelope?: Envelope }) => {
    if (fn === 'organiser_home_v1') return { data: home(), error: null };
    if (fn === 'get_organiser_venue_options_v1') return { data: venues, error: null };
    if (fn === 'admin_event_workspace_p5') return { data: rawWorkspace({ format: 'one_off', version: 3, default_cover_image_url: null }), error: null };
    if (fn === 'series_command_p5') {
      const c = args.p_envelope!.command;
      if (c.kind === 'series.upsert' && !String(c.payload.name ?? '').trim()) return { data: null, error: { code: 'P0001', message: 'invalid_payload: name required' } };
      return { data: { ok: true, new_version: 4 }, error: null };
    }
    return { data: null, error: { message: 'unexpected ' + fn } };
  });
});
afterEach(cleanup);

function Where() { return <span data-testid="where">{useLocation().pathname}</span>; }

function mount(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/account/o/new/:seriesId/venue" element={<NewFlow />} />
          <Route path="/account/o/new/:seriesId/date" element={<NewFlow />} />
          <Route path="/account/o/new/:seriesId/time" element={<NewFlow />} />
          <Route path="/account/o/new/:seriesId/cover" element={<NewFlow />} />
          <Route path="/account/o/cover/:seriesId" element={<CoverFlow />} />
          <Route path="*" element={<span data-testid="elsewhere" />} />
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const file = () => new File(['x'], 'cover.png', { type: 'image/png' });

const STEPS: Array<{ name: string; path: string; act: () => Promise<void>; key: string }> = [
  { name: 'New event: venue', path: '/account/o/new/s1/venue', key: 'default_venue_id', act: async () => { fireEvent.click((await screen.findAllByTestId('org-new-venue-row'))[0]); } },
  { name: 'New event: first date', path: '/account/o/new/s1/date', key: 'default_start_date', act: async () => { fireEvent.click((await screen.findAllByTestId('org-new-date-row'))[1]); } },
  { name: 'New event: time', path: '/account/o/new/s1/time', key: 'default_local_start_time', act: async () => {
    fireEvent.change(await screen.findByTestId('org-new-time'), { target: { value: '20:30' } });
    await waitFor(() => expect((screen.getByTestId('org-new-next') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('org-new-next'));
  } },
  { name: 'New event: flyer', path: '/account/o/new/s1/cover', key: 'default_cover_image_url', act: async () => {
    const input = (await screen.findByTestId('org-new-live')).closest('div')!.parentElement!.querySelector('input[type=file]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file()] } });
  } },
  { name: 'Flyer page /account/o/cover/:id', path: '/account/o/cover/s1', key: 'default_cover_image_url', act: async () => {
    fireEvent.change(await screen.findByTestId('cover-input'), { target: { files: [file()] } });
  } },
];

describe('F1: a route step on an existing event sends the name the server requires', () => {
  it.each(STEPS)('$name', async ({ path, act, key }) => {
    mount(path);
    await act();
    await waitFor(() => expect(sent().length).toBeGreaterThan(0));
    const upserts = sent().filter((e) => e.command.kind === 'series.upsert');
    expect(upserts.length).toBeGreaterThan(0);
    for (const u of upserts) expect(u.command.payload.name).toBe('Friday Party');
    expect(upserts.some((u) => key in u.command.payload)).toBe(true);
    // The harness refused nothing: no error is on screen.
    expect(screen.queryByText(/Enter the event name/i)).toBeNull();
  });
});
