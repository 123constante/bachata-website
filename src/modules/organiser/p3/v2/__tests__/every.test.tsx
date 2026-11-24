// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EventWorkspace } from '../../../events/eventModel';

const net = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock('../../../shared/publicVenues', () => ({ useVenueOptions: () => ({ data: [
  { id: 'v1', name: 'Club Uno', neighbourhood: 'Soho', city_name: 'London' },
  { id: 'v2', name: 'Casa Dos', neighbourhood: 'Camden', city_name: null },
], isPending: false }) }));
vi.mock('../../../events/media', () => ({ uploadEventPicture: (...a: unknown[]) => net.upload(...a) }));
vi.mock('../../../events/programmeSeriesApi', () => ({ fetchOrganiserPages: async (ids: string[]) => ids.map((i) => ({ id: i, name: `Org ${i}` })) }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...((await orig()) as object), londonTodayKey: () => '2026-11-22' }));
import { EveryBody } from '../EveryBody';

const ws = (over: Record<string, unknown> = {}, series: Record<string, unknown> = {}) => ({
  series: { id: 's1', version: 7, format: 'recurring', name: 'Thursdays', lifecycle_status: 'live', recurrence_rule: { mode: 'weekly', interval: 1, weekdays: [4], end: { kind: 'none' } }, default_venue_id: 'v1', default_city_id: 'c1', default_description: 'Old words', default_cover_image_url: 'https://x.test/f.jpg', default_ticket_url: null, default_local_start_time: '19:30:00', default_duration: '03:30:00', passes: null, ...series },
  gallery: ['https://x.test/g1.jpg'], musicStyles: ['Sensual', 'Dominican'], organiserIds: ['a', 'b'], endedOn: null, dates: [], ...over,
}) as unknown as EventWorkspace;
type Call = [{ target: string; id: string; version: number; command: { kind: string; payload: Record<string, unknown> } }[], Record<string, unknown>[], string];
const mount = (w = ws()) => {
  const saveNow = vi.fn(async () => ({ ok: true, error: null }));
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><EveryBody ws={w} day="Thursday" saveNow={saveNow} /></QueryClientProvider>);
  return saveNow;
};
const last = (f: ReturnType<typeof vi.fn>) => f.mock.calls[f.mock.calls.length - 1] as unknown as Call;
beforeEach(() => net.upload.mockReset());
afterEach(cleanup);

describe('Every tab body', () => {
  it('shows the card, rows and none of the night-only pieces', async () => {
    mount();
    expect(screen.getByText('What dancers see every Thursday. Tap to change.')).toBeTruthy();
    expect(screen.getByText('About this event')).toBeTruthy();
    expect(screen.getByTestId('every-name').textContent).toBe('Thursdays');
    expect(screen.getByTestId('fact-when').textContent).toContain('Every Thursday');
    expect(screen.getByTestId('fact-when').textContent).toContain('19:30 to 23:00');
    expect(screen.getByTestId('fact-where').textContent).toContain('Club Uno');
    expect(screen.getByTestId('row-about').textContent).toContain('Old words');
    expect(screen.getByTestId('row-music').textContent).toContain('Sensual, Dominican');
    expect(screen.getByTestId('row-repeats').textContent).toContain('Every Thursday, no end date');
    await waitFor(() => expect(screen.getByTestId('row-organisers').textContent).toContain('Org a, Org b'));
    expect(screen.queryByText(/Only this night/)).toBeNull();
    expect(screen.queryByText(/Back to usual/i)).toBeNull();
    expect(screen.queryByText(/Cancel this night|Share/i)).toBeNull();
  });
  it('falls back to None yet / No description and shows an end date', () => {
    mount(ws({ musicStyles: [], organiserIds: [], endedOn: '2027-01-14' }, { default_description: null }));
    expect(screen.getByTestId('row-music').textContent).toContain('None yet');
    expect(screen.getByTestId('row-organisers').textContent).toContain('None yet');
    expect(screen.getByTestId('row-about').textContent).toContain('No description');
    expect(screen.getByTestId('row-repeats').textContent).toContain('ends after');
  });
  it('pending rows do nothing on tap', () => {
    mount();
    for (const id of ['fact-price']) fireEvent.click(screen.getByTestId(id).querySelector('button')!);
    expect(screen.queryByTestId('v2-sheet')).toBeNull();
  });
  it('Where saves the series venue and city, Undo before holds the old pair', async () => {
    const save = mount();
    fireEvent.click(screen.getByTestId('fact-where').querySelector('button')!);
    fireEvent.click((await screen.findAllByTestId('where-row'))[1]);
    await waitFor(() => expect(save).toHaveBeenCalled());
    const [steps, before, label] = last(save);
    expect(steps[0]).toMatchObject({ target: 'series', id: 's1', version: 7 });
    expect(steps[0].command.kind).toBe('series.upsert');
    expect(steps[0].command.payload).toMatchObject({ name: 'Thursdays', default_venue_id: 'v2' });
    expect(before[0]).toMatchObject({ name: 'Thursdays', default_venue_id: 'v1' });
    expect(label).toBe('Saved for every Thursday');
  });
  it('Description saves default_description', async () => {
    const save = mount();
    fireEvent.click(screen.getByTestId('row-about').querySelector('button')!);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New words' } });
    fireEvent.click(screen.getByText('Done'));
    await waitFor(() => expect(save).toHaveBeenCalled());
    const [steps, before, label] = last(save);
    expect(steps[0].command.payload).toEqual({ name: 'Thursdays', default_description: 'New words' });
    expect(before[0]).toEqual({ name: 'Thursdays', default_description: 'Old words' });
    expect(label).toBe('Saved for every Thursday');
  });
  it('Name: empty errors and stays open, unchanged closes with no save, else one upsert', async () => {
    const save = mount();
    fireEvent.click(screen.getByTestId('row-name').querySelector('button')!);
    const input = screen.getByLabelText('Event name') as HTMLInputElement;
    expect(input.value).toBe('Thursdays');
    expect(screen.getByText('The name is the same for every Thursday.')).toBeTruthy();
    fireEvent.change(input, { target: { value: '  ' } });
    fireEvent.click(screen.getByTestId('name-done'));
    expect(screen.getByTestId('name-error').textContent).toBe('Add a name');
    expect(screen.getByTestId('v2-sheet')).toBeTruthy();
    fireEvent.change(input, { target: { value: 'Thursdays' } });
    fireEvent.click(screen.getByTestId('name-done'));
    expect(save).not.toHaveBeenCalled();
    expect(screen.queryByTestId('v2-sheet')).toBeNull();
    fireEvent.click(screen.getByTestId('row-name').querySelector('button')!);
    fireEvent.change(screen.getByLabelText('Event name'), { target: { value: 'Bachata Thursdays' } });
    fireEvent.click(screen.getByTestId('name-done'));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const [steps, before, label] = last(save);
    expect(steps[0].target).toBe('series');
    expect(steps[0].command.payload).toEqual({ name: 'Bachata Thursdays' });
    expect(before[0]).toEqual({ name: 'Thursdays' });
    expect(label).toBe('Saved for every Thursday');
  });
  it('Flyer: choose and add photos write the series keys', async () => {
    const save = mount();
    net.upload.mockResolvedValue('https://x.test/new.jpg');
    fireEvent.click(screen.getByTestId('fact-flyer'));
    expect(screen.getByText('Photos and videos dancers see every Thursday.')).toBeTruthy();
    fireEvent.change(screen.getByTestId('flyer-file'), { target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    let c = last(save);
    expect(c[0][0].target).toBe('series');
    expect(c[0][0].command.payload).toEqual({ name: 'Thursdays', default_cover_image_url: 'https://x.test/new.jpg' });
    expect(c[1][0]).toEqual({ name: 'Thursdays', default_cover_image_url: 'https://x.test/f.jpg' });
    expect(screen.queryByTestId('flyer-remove')).toBeNull();
    fireEvent.change(screen.getByTestId('gallery-file'), { target: { files: [new File(['x'], 'b.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    c = last(save);
    expect(c[0][0].command.payload).toEqual({ name: 'Thursdays', default_gallery: ['https://x.test/g1.jpg', 'https://x.test/new.jpg'] });
    expect(c[1][0]).toEqual({ name: 'Thursdays', default_gallery: ['https://x.test/g1.jpg'] });
    expect(c[2]).toBe('Saved for every Thursday');
  });
});
