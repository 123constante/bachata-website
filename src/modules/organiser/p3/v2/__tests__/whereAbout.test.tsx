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
const venues = [
  { id: 'v1', name: 'Club Uno', neighbourhood: 'Soho', city_name: 'London' },
  { id: 'v2', name: 'Salsa Hall', neighbourhood: null, city_name: 'Leeds' },
];
vi.mock('../../../shared/publicVenues', () => ({ useVenueOptions: () => ({ data: venues, isPending: false }) }));
vi.mock('../../../dates/venueOverride', () => ({
  venueOverridePatch: async (id: string | null) => (id ? { venue_id: id, city_id: `c-${id}` } : { venue_id: null, city_id: null }),
}));
vi.mock('@/lib/londonDate', async (orig) => ({ ...((await orig()) as object), londonTodayKey: () => '2026-11-22' }));
import { NightCard } from '../NightCard';
import { WhereSheet, savedLabel } from '../WhereSheet';
import { AboutSheet, aboutToSave } from '../AboutSheet';
import { NIGHT_ABOUT_MAX } from '../editorModel';

const date = (over: Partial<WorkspaceDate> = {}) => ({ id: 'o1', occurrence_date: '2026-11-26', version: 3, lifecycle_status: 'scheduled', has_override: false, override_keys: [], session_overrides_count: 0, added_sessions_count: 0, ...over }) as WorkspaceDate;
const detail = (extra: Record<string, unknown> = {}) => ({ start: '19:30', end: '23:00', venueId: 'v1', venueOverride: null, descriptionOverride: null, coverImageOverride: null, ticketUrlOverride: null, titleOverride: null, passesOverride: null, coverImageUrl: null, ticketUrl: null, ...extra });
const ws = (desc: string | null = 'Usual text') => ({ series: { id: 's1', version: 7, format: 'recurring', name: 'Thursdays', lifecycle_status: 'live', default_venue_id: 'v1', default_description: desc, default_cover_image_url: null, default_ticket_url: null, default_local_start_time: '19:30', passes: null }, dates: [] }) as unknown as EventWorkspace;

const card = (d = date(), w = ws()) => {
  const onSave = vi.fn(async () => ({ ok: true, error: null }));
  const onBack = vi.fn();
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><NightCard ws={w} date={d} onSave={onSave} onBack={onBack} /></QueryClientProvider>);
  return { onSave, onBack };
};
beforeEach(() => { net.detail.mockReset().mockResolvedValue(detail()); });
afterEach(cleanup);
type Call = [{ target: string; id: string; version: number; part: string; order: number; command: { kind: string; payload: Record<string, unknown> } }[], Record<string, unknown>[], string];

describe('Where sheet', () => {
  it('opens from the Where fact, filters as you type, current shows Now', async () => {
    card();
    await screen.findByText('Club Uno');
    fireEvent.click(screen.getByTestId('fact-where').querySelector('.fbtn')!);
    expect(screen.getAllByTestId('where-row')).toHaveLength(2);
    expect(screen.getAllByTestId('where-row')[0].textContent).toContain('Now');
    expect(screen.getAllByTestId('where-row')[1].textContent).not.toContain('Now');
    fireEvent.change(screen.getByLabelText('Search for a venue'), { target: { value: 'LEEDS' } });
    expect(screen.getAllByTestId('where-row')).toHaveLength(1);
    expect(screen.getByTestId('where-row').textContent).toContain('Salsa Hall');
  });
  it('picking another venue saves one night override with city, Undo state and the night toast', async () => {
    const { onSave } = card();
    await screen.findByText('Club Uno');
    fireEvent.click(screen.getByTestId('fact-where').querySelector('.fbtn')!);
    fireEvent.click(screen.getByText('Salsa Hall'));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const [steps, before, label] = onSave.mock.calls[0] as unknown as Call;
    expect(steps[0]).toMatchObject({ target: 'occurrence', id: 'o1', version: 3, order: 1, part: 'Venue', command: { kind: 'occurrence.set_override', payload: { venue_id: 'v2', city_id: 'c-v2' } } });
    expect(before[0]).toEqual({ venue_id: null, city_id: null });
    expect(label).toBe('Saved for Thursday 26 November only');
    await waitFor(() => expect(screen.queryByTestId('where-rows')).toBeNull());
  });
  it('picking the venue already shown closes without a save', async () => {
    const { onSave } = card();
    await screen.findByText('Club Uno');
    fireEvent.click(screen.getByTestId('fact-where').querySelector('.fbtn')!);
    fireEvent.click(screen.getAllByTestId('where-row')[0]);
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByTestId('where-rows')).toBeNull();
  });
  it('no Use "..." row for an unknown name', () => {
    render(<WhereSheet current="v1" mode="night" dateWords="Thursday 26 November" onSave={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Search for a venue'), { target: { value: 'Nowhere Bar' } });
    expect(screen.queryByText(/^Use /)).toBeNull();
    expect(screen.queryAllByTestId('where-row')).toHaveLength(0);
  });
  it('Back to the usual venue only when changed; runs back and closes', async () => {
    const { onBack } = card(date({ override_keys: ['venue_id', 'city_id'] }));
    await screen.findByText('Club Uno');
    fireEvent.click(screen.getByTestId('fact-where').querySelector('.fbtn')!);
    fireEvent.click(screen.getByTestId('where-back'));
    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('where-rows')).toBeNull();
    cleanup();
    card();
    await screen.findByText('Club Uno');
    fireEvent.click(screen.getByTestId('fact-where').querySelector('.fbtn')!);
    expect(screen.queryByTestId('where-back')).toBeNull();
  });
  it('usual mode: no back link, picks call onSave with the id', () => {
    const onSave = vi.fn();
    render(<WhereSheet current="v1" mode="usual" dateWords="Thursday 26 November" changed onSave={onSave} onBack={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByTestId('where-back')).toBeNull();
    fireEvent.click(screen.getByText('Salsa Hall'));
    expect(onSave).toHaveBeenCalledWith('v2');
  });
});

describe('Description sheet', () => {
  const open = async (d = date(), w = ws()) => {
    const r = card(d, w);
    await screen.findByText('Usual text');
    fireEvent.click(screen.getByTestId('fact-about').querySelector('.fbtn')!);
    return r;
  };
  it('night label has the date; text box prefilled', async () => {
    await open();
    expect(screen.getByLabelText('What dancers read on Thursday 26 November only')).toBeTruthy();
    expect((screen.getByPlaceholderText('What happens, who it is for') as HTMLTextAreaElement).value).toBe('Usual text');
  });
  it('unchanged Done closes without a save', async () => {
    const { onSave } = await open();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('changed text saves description with Undo state and toast', async () => {
    net.detail.mockResolvedValue(detail({ descriptionOverride: 'Old night text' }));
    const { onSave } = await open(date({ override_keys: ['description'] }), ws());
    fireEvent.change(screen.getByPlaceholderText('What happens, who it is for'), { target: { value: 'New words' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const [steps, before, label] = onSave.mock.calls[0] as unknown as Call;
    expect(steps[0]).toMatchObject({ target: 'occurrence', part: 'About this night', command: { kind: 'occurrence.set_override', payload: { description: 'New words' } } });
    expect(before[0]).toEqual({ description: 'Old night text' });
    expect(label).toBe('Saved for Thursday 26 November only');
  });
  it('text equal to the usual description clears the night key', async () => {
    net.detail.mockResolvedValue(detail({ descriptionOverride: 'Night text' }));
    const { onSave } = await open(date({ override_keys: ['description'] }), ws());
    fireEvent.change(screen.getByPlaceholderText('What happens, who it is for'), { target: { value: 'Usual text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect((onSave.mock.calls[0] as unknown as Call)[0][0].command.payload).toEqual({ description: null });
  });
  it('over the limit is blocked with a short message', async () => {
    const { onSave } = await open();
    fireEvent.change(screen.getByPlaceholderText('What happens, who it is for'), { target: { value: 'x'.repeat(NIGHT_ABOUT_MAX + 1) } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByTestId('about-problem').textContent).toBe(`Keep it under ${NIGHT_ABOUT_MAX} characters.`);
    expect(onSave).not.toHaveBeenCalled();
  });
  it('Back to the usual description only when changed', async () => {
    const { onBack } = await open(date({ override_keys: ['description'] }));
    fireEvent.click(screen.getByTestId('about-back'));
    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
    cleanup();
    await open();
    expect(screen.queryByTestId('about-back')).toBeNull();
  });
  it('usual and one-off modes: plain label, onSave gets the value', () => {
    const onSave = vi.fn();
    render(<AboutSheet current="" usual="U" mode="usual" dateWords="Thursday 26 November" changed onSave={onSave} onBack={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByLabelText('What dancers read')).toBeTruthy();
    expect(screen.queryByTestId('about-back')).toBeNull();
    fireEvent.change(screen.getByPlaceholderText('What happens, who it is for'), { target: { value: 'Every week' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onSave).toHaveBeenCalledWith('Every week');
    cleanup();
    render(<AboutSheet current="" mode="oneOff" dateWords="Thursday 26 November" onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByLabelText('What dancers read')).toBeTruthy();
  });
  it('aboutToSave rules', () => {
    expect(aboutToSave('a', 'a', 'u')).toBeUndefined();
    expect(aboutToSave('u', 'a', 'u')).toBeNull();
    expect(aboutToSave('b', 'a', 'u')).toBe('b');
  });
});

describe('toast strings', () => {
  it('per mode', () => {
    expect(savedLabel('night', 'Thursday 26 November')).toBe('Saved for Thursday 26 November only');
    expect(savedLabel('usual', 'Thursday 26 November')).toBe('Saved for every Thursday');
    expect(savedLabel('oneOff', 'Thursday 26 November')).toBe('Saved');
  });
});
