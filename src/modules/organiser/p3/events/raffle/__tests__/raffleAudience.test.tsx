// @vitest-environment jsdom
// Raffle "Who can win": flag off = card unchanged; flag on = items 1-6 of the brief.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ aud: true, rpc: vi.fn() }));
vi.mock('@/lib/featureFlags', async (orig) => ({ ...(await orig<object>()), flags: new Proxy({}, { get: (_t, k) => (k === 'raffleAudience' ? h.aud : false) }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => h.rpc(...a) } }));

import { SeriesSwitchCard } from '../RaffleParts';

const read = (over: Record<string, unknown> = {}) => ({ ok: true, series_id: 's1', series_raffle_enabled: true, can_edit: true, view_only_reason: null, nights: [], series_raffle_audience: 'new_only', series_raffle_audience_admin_set: false, ...over });
const serve = (data: unknown, set: unknown = { ok: true, raffle_audience: 'anyone' }) =>
  h.rpc.mockImplementation((fn: string) => Promise.resolve(fn === 'organiser_raffle_nights_v1' ? { data, error: null } : { data: set, error: null }));
const wrap = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><SeriesSwitchCard seriesId="s1" /></QueryClientProvider>);

afterEach(cleanup);
beforeEach(() => { h.aud = true; h.rpc.mockReset(); });

describe('flag off keep-list', () => {
  it('shows switch, hint and locked chip; no Who can win', async () => {
    h.aud = false;
    serve(read({ series_admin_locked: true }));
    wrap();
    await screen.findByTestId('raffle-series-switch');
    expect(screen.getByTestId('raffle-series-hint').textContent).toMatch(/Default for every night\./);
    expect(screen.getByTestId('raffle-series-chip').textContent).toBe('Switched off by admin');
    expect(screen.getByTestId('raffle-series-locked')).toBeTruthy();
    expect(screen.queryByText(/Who can win/)).toBeNull();
  });
});

describe('flag on', () => {
  it('1+2: group, labels, default new_only selected, note', async () => {
    serve(read());
    wrap();
    const g = await screen.findByRole('group', { name: 'Who can win' });
    expect(g).toBeTruthy();
    expect(screen.getByTestId('raffle-audience-label').textContent).toBe('Who can win');
    const a = screen.getByText('New people only') as HTMLButtonElement;
    const b = screen.getByText('Anyone') as HTMLButtonElement;
    expect(a.getAttribute('aria-pressed')).toBe('true');
    expect(b.getAttribute('aria-pressed')).toBe('false');
    expect(a.style.minHeight).toBe('44px');
    expect(screen.getByTestId('raffle-audience-note').textContent).toMatch(/been to your events before can.t win\./);
  });
  it('2: anyone note', async () => {
    serve(read({ series_raffle_audience: 'anyone' }));
    wrap();
    await screen.findByTestId('raffle-audience');
    expect(screen.getByTestId('raffle-audience-note').textContent).toBe('Anyone can win, including regulars.');
  });
  it('unknown audience reads as new_only', async () => {
    serve(read({ series_raffle_audience: 'weird' }));
    wrap();
    await screen.findByTestId('raffle-audience');
    expect(screen.getByText('New people only').getAttribute('aria-pressed')).toBe('true');
  });
  it('3: tap sends exact args and refetches', async () => {
    serve(read());
    wrap();
    fireEvent.click(await screen.findByText('Anyone'));
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('organiser_raffle_audience_set_v1', { p_series_id: 's1', p_audience: 'anyone' }));
    await waitFor(() => expect(h.rpc.mock.calls.filter((c) => c[0] === 'organiser_raffle_nights_v1').length).toBe(2));
    expect(screen.queryByTestId('raffle-audience-error')).toBeNull();
  });
  it('3: ok:false reverts and alerts', async () => {
    serve(read(), { ok: false, reason: 'view_only' });
    wrap();
    fireEvent.click(await screen.findByText('Anyone'));
    expect((await screen.findByRole('alert')).textContent).toBe('Could not change who can win. Try again.');
    expect(screen.getByText('New people only').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Anyone').getAttribute('aria-pressed')).toBe('false');
  });
  it('3: throw reverts and alerts', async () => {
    serve(read());
    h.rpc.mockImplementation((fn: string) => Promise.resolve(fn === 'organiser_raffle_nights_v1' ? { data: read(), error: null } : { data: null, error: { message: 'boom' } }));
    wrap();
    fireEvent.click(await screen.findByText('Anyone'));
    expect((await screen.findByRole('alert')).textContent).toBe('Could not change who can win. Try again.');
    expect(screen.getByText('New people only').getAttribute('aria-pressed')).toBe('true');
  });
  it('4: admin set disables both, keeps selection, suffix, no call', async () => {
    serve(read({ series_raffle_audience: 'anyone', series_raffle_audience_admin_set: true }));
    wrap();
    await screen.findByTestId('raffle-audience');
    expect(screen.getByTestId('raffle-audience-label').textContent).toBe('Who can win (set by Bachata Calendar)');
    const a = screen.getByText('New people only') as HTMLButtonElement;
    const b = screen.getByText('Anyone') as HTMLButtonElement;
    expect(a.disabled && b.disabled).toBe(true);
    expect(b.getAttribute('aria-pressed')).toBe('true');
    expect(b.style.opacity).toBe('0.5');
    fireEvent.click(a);
    expect(h.rpc).toHaveBeenCalledTimes(1);
  });
  it('5: canEdit false disables both, no suffix', async () => {
    serve(read({ can_edit: false }));
    wrap();
    await screen.findByTestId('raffle-audience');
    expect(screen.getByTestId('raffle-audience-label').textContent).toBe('Who can win');
    expect((screen.getByText('Anyone') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText('New people only') as HTMLButtonElement).disabled).toBe(true);
  });
  it('6: switch Off renders nothing of it', async () => {
    serve(read({ series_raffle_enabled: false }));
    wrap();
    await screen.findByTestId('raffle-series-switch');
    expect(screen.queryByText(/Who can win/)).toBeNull();
  });
});
