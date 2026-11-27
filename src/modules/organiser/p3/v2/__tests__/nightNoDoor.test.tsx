// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EventWorkspace } from '../../../events/eventModel';

const net = vi.hoisted(() => ({ detail: vi.fn(), setNoDoor: vi.fn(), flag: { waysInV2: true } }));
vi.mock('../../../shared/selfServeApi', () => ({
  dateDetailQueryKey: (id: string) => ['d', id],
  fetchDateDetail: (id: string) => net.detail(id),
  setNightNoDoor: (id: string, v: boolean) => net.setNoDoor(id, v),
}));
vi.mock('@/lib/featureFlags', () => ({ flags: net.flag }));
vi.mock('../../tickets/data', () => ({ useSeriesTypes: () => ({ data: [] }) }));
vi.mock('../../../shared/publicVenues', () => ({ useVenueOptions: () => ({ data: [{ id: 'v1', name: 'Club Uno', neighbourhood: 'Soho', city_name: 'London' }] }) }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...((await orig()) as object), londonTodayKey: () => '2026-11-22' }));
import { NightCard } from '../NightCard';
import { getGate, closeGate, subscribeGate } from '../../onboarding/gate';

const date = { id: 'o1', occurrence_date: '2026-12-03', version: 3, lifecycle_status: 'scheduled', has_override: false, override_keys: [], session_overrides_count: 0, added_sessions_count: 0 };
const ws = (extra: Record<string, unknown> = {}) => ({ series: { id: 's1', version: 7, format: 'recurring', name: 'Thursdays', lifecycle_status: 'live', default_venue_id: 'v1', default_description: null, default_cover_image_url: null, default_ticket_url: null, passes: null, payment_methods: 'door', ...extra }, program: [], dates: [date] }) as unknown as EventWorkspace;
const detail = (noDoor = false) => ({ start: '19:30', end: '00:00', venueId: 'v1', venueOverride: null, descriptionOverride: null, coverImageOverride: null, ticketUrlOverride: null, titleOverride: null, passesOverride: null, coverImageUrl: null, ticketUrl: null, noDoor });
const show = (w = ws(), onSave: unknown = vi.fn()) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <NightCard ws={w} date={date as never} onBack={vi.fn()} onSave={(onSave ?? undefined) as never} />
  </QueryClientProvider>);
beforeEach(() => { net.flag.waysInV2 = true; net.detail.mockReset().mockResolvedValue(detail()); net.setNoDoor.mockReset().mockResolvedValue(undefined); });
afterEach(() => { cleanup(); closeGate(); });

describe('night no-door switch', () => {
  it('is off by default under the price row', async () => {
    show();
    const sw = await screen.findByTestId('night-no-door');
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByTestId('night-no-door-on')).toBeNull();
    expect(screen.getByTestId('fact-price').textContent).toContain('Pay at the door');
  });
  it('on: calls the RPC, shows the line, price row drops the door', async () => {
    net.detail.mockResolvedValueOnce(detail()).mockResolvedValue(detail(true));
    show();
    fireEvent.click(await screen.findByTestId('night-no-door'));
    await waitFor(() => expect(net.setNoDoor).toHaveBeenCalledWith('o1', true));
    expect((await screen.findByTestId('night-no-door')).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('night-no-door-on').textContent).toContain('see “Pay at the door” on');
    await waitFor(() => expect(screen.getByTestId('fact-price').textContent).not.toContain('Pay at the door'));
  });
  it('off: calls the RPC with false and the line goes', async () => {
    net.detail.mockResolvedValue(detail(true));
    show();
    await waitFor(() => expect(screen.getByTestId('night-no-door').getAttribute('aria-checked')).toBe('true'));
    net.detail.mockResolvedValue(detail(false));
    fireEvent.click(screen.getByTestId('night-no-door'));
    await waitFor(() => expect(net.setNoDoor).toHaveBeenCalledWith('o1', false));
    await waitFor(() => expect(screen.queryByTestId('night-no-door-on')).toBeNull());
  });
  it('error: flips back and shows the error line', async () => {
    net.setNoDoor.mockRejectedValue(new Error('x'));
    show();
    fireEvent.click(await screen.findByTestId('night-no-door'));
    expect((await screen.findByTestId('night-no-door-err')).textContent).toBe('Could not save. Try again.');
    expect(screen.getByTestId('night-no-door').getAttribute('aria-checked')).toBe('false');
  });
  it('onboarding refusal: opens the gate, no error line, flips back', async () => {
    const unsub = subscribeGate(() => {});
    net.setNoDoor.mockRejectedValue({ message: 'onboarding_incomplete', details: '{"missing":["photo"],"organiser_id":"o1"}' });
    show();
    fireEvent.click(await screen.findByTestId('night-no-door'));
    await waitFor(() => expect(getGate()).not.toBeNull());
    await waitFor(() => expect((screen.getByTestId('night-no-door') as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByTestId('night-no-door-err')).toBeNull();
    expect(screen.getByTestId('night-no-door').getAttribute('aria-checked')).toBe('false');
    unsub();
  });
  it.each([
    ['flag off', () => { net.flag.waysInV2 = false; return show(); }],
    ['door not ticked', () => show(ws({ payment_methods: 'cash' }))],
    ['one-off', () => show(ws({ format: 'one_off' }))],
    ['read-only', () => show(ws(), null)],
  ])('hidden: %s', async (_n, go) => {
    go();
    await screen.findByTestId('night-card');
    expect(screen.queryByTestId('night-no-door')).toBeNull();
  });
});
