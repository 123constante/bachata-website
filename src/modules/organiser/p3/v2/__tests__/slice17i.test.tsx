// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EventWorkspace } from '../../../events/eventModel';
import type { WorkspaceDate } from '../../../shared/seriesModel';

const net = vi.hoisted(() => ({ detail: vi.fn() }));
vi.mock('../../../shared/selfServeApi', () => ({
  dateDetailQueryKey: (id: string) => ['d', id],
  fetchDateDetail: (id: string) => net.detail(id),
  fetchCancellationReasons: async () => [],
}));
vi.mock('../../../shared/publicVenues', () => ({ useVenueOptions: () => ({ data: [{ id: 'v1', name: 'Club Uno', neighbourhood: 'Soho', city_name: 'London' }], isPending: false }) }));
vi.mock('../../../events/media', () => ({ uploadEventPicture: vi.fn(async () => 'https://x.test/new.jpg') }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...((await orig()) as object), londonTodayKey: () => '2026-11-22' }));
import { NightCard } from '../NightCard';
import { undoPlan } from '../saveNow';

const SERIES = 'https://x.test/series.jpg';
const date = (over: Partial<WorkspaceDate> = {}) => ({ id: 'o1', occurrence_date: '2026-11-26', version: 3, lifecycle_status: 'scheduled', has_override: false, override_keys: [], session_overrides_count: 0, added_sessions_count: 0, ...over }) as WorkspaceDate;
const detail = (extra: Record<string, unknown> = {}) => ({ start: '19:30', end: '23:00', venueId: 'v1', venueOverride: null, descriptionOverride: null, coverImageOverride: null, ticketUrlOverride: null, titleOverride: null, passesOverride: null, coverImageUrl: null, ticketUrl: null, galleryOverride: null, ...extra });
const ws = (cover: string | null = SERIES, format = 'recurring') => ({ series: { id: 's1', version: 7, format, name: 'Thursdays', lifecycle_status: 'live', default_venue_id: 'v1', default_description: null, default_cover_image_url: cover, default_ticket_url: null, default_local_start_time: '19:30', passes: null }, gallery: [], dates: [] }) as unknown as EventWorkspace;
type Step = { target: string; id: string; command: { kind: string; payload: Record<string, unknown> } };
const card = (d = date(), w = ws()) => {
  const onSave = vi.fn(async () => ({ ok: true, error: null }));
  const onBack = vi.fn();
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><NightCard ws={w} date={d} onSave={onSave} onBack={onBack} /></QueryClientProvider>);
  return { onSave, onBack };
};
const open = async () => { await screen.findByText('Thursdays'); await waitFor(() => expect(screen.getByTestId('fact-flyer')).toBeTruthy()); fireEvent.click(screen.getByTestId('fact-flyer')); };
const removeAndRead = async (prior: string | null) => {
  net.detail.mockResolvedValue(detail({ coverImageOverride: prior, coverImageUrl: prior ?? SERIES }));
  const { onSave } = card();
  await open();
  fireEvent.click(screen.getByTestId('flyer-remove'));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  return onSave.mock.calls[0] as unknown as [Step[], Record<string, unknown>[], string];
};
beforeEach(() => net.detail.mockReset().mockResolvedValue(detail()));
afterEach(cleanup);

describe('slice 17i: remove the flyer for one night', () => {
  it('Remove shows on a night with a flyer, not on one without', async () => {
    card();
    await open();
    expect(screen.getByTestId('flyer-remove').textContent).toBe('Remove the flyer');
    cleanup();
    card(date(), ws(null));
    await open();
    expect(screen.queryByTestId('flyer-remove')).toBeNull();
  });
  it('Remove sends cover_image_url "" for the night, before = prior override, one-night label', async () => {
    const [steps, before, label] = await removeAndRead(null);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ target: 'occurrence', id: 'o1', command: { kind: 'occurrence.set_override', payload: { cover_image_url: '' } } });
    expect(before).toEqual([{ cover_image_url: null }]);
    expect(label).toBe('Saved for Thursday 26 November only');
  });
  it('Undo of a removal inherits (null prior) or restores the exact own flyer', async () => {
    const [s1, b1] = await removeAndRead(null);
    expect(undoPlan(s1 as never, b1 as never)?.[0].command.payload).toEqual({ cover_image_url: null });
    cleanup(); net.detail.mockReset();
    const [s2, b2] = await removeAndRead('https://x.test/own.jpg');
    expect(b2).toEqual([{ cover_image_url: 'https://x.test/own.jpg' }]);
    expect(undoPlan(s2 as never, b2 as never)?.[0].command.payload).toEqual({ cover_image_url: 'https://x.test/own.jpg' });
  });
  it('choosing a new flyer still sends the url', async () => {
    const { onSave } = card();
    await open();
    fireEvent.change(screen.getByTestId('flyer-file'), { target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect((onSave.mock.calls[0] as unknown as [Step[]])[0][0].command.payload).toEqual({ cover_image_url: 'https://x.test/new.jpg' });
  });
  it('a blank night flyer shows No flyer + the only-this-night tag, and Back to usual sends null', async () => {
    net.detail.mockResolvedValue(detail({ coverImageOverride: '', coverImageUrl: '' }));
    const { onBack } = card(date({ override_keys: ['cover_image_url'] }));
    await screen.findByText('Thursdays');
    await waitFor(() => expect(screen.getByText(/No flyer/).textContent).toBe('No flyer · only this night'));
    fireEvent.click(screen.getByTestId('fact-flyer'));
    fireEvent.click(screen.getByTestId('flyer-back'));
    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
    expect(onBack.mock.calls[0][0].command.payload).toEqual({ cover_image_url: null });
  });
});
