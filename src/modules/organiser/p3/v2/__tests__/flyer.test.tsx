// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EventWorkspace } from '../../../events/eventModel';
import type { WorkspaceDate } from '../../../shared/seriesModel';

const net = vi.hoisted(() => ({ detail: vi.fn(), upload: vi.fn() }));
vi.mock('../../../shared/selfServeApi', () => ({
  dateDetailQueryKey: (id: string) => ['d', id],
  fetchDateDetail: (id: string) => net.detail(id),
  fetchCancellationReasons: async () => [],
}));
vi.mock('../../../shared/publicVenues', () => ({ useVenueOptions: () => ({ data: [{ id: 'v1', name: 'Club Uno', neighbourhood: 'Soho', city_name: 'London' }], isPending: false }) }));
vi.mock('../../../events/media', () => ({ uploadEventPicture: (...a: unknown[]) => net.upload(...a) }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...((await orig()) as object), londonTodayKey: () => '2026-11-22' }));
import { NightCard, ownedKeys } from '../NightCard';
import { FlyerSheet, countWord } from '../FlyerSheet';
import { MAX_GALLERY } from '../../../events/eventModel';

const date = (over: Partial<WorkspaceDate> = {}) => ({ id: 'o1', occurrence_date: '2026-11-26', version: 3, lifecycle_status: 'scheduled', has_override: false, override_keys: [], session_overrides_count: 0, added_sessions_count: 0, ...over }) as WorkspaceDate;
const detail = (extra: Record<string, unknown> = {}) => ({ start: '19:30', end: '23:00', venueId: 'v1', venueOverride: null, descriptionOverride: null, coverImageOverride: null, ticketUrlOverride: null, titleOverride: null, passesOverride: null, coverImageUrl: null, ticketUrl: null, galleryOverride: null, ...extra });
const ws = (gallery: string[] = []) => ({ series: { id: 's1', version: 7, format: 'recurring', name: 'Thursdays', lifecycle_status: 'live', default_venue_id: 'v1', default_description: null, default_cover_image_url: null, default_ticket_url: null, default_local_start_time: '19:30', passes: null }, gallery, dates: [] }) as unknown as EventWorkspace;
const P = (n: number) => `https://x.test/p${n}.jpg`;
const YT = 'https://youtu.be/abcdefghijk';
type Call = [{ target: string; id: string; part: string; command: { kind: string; payload: Record<string, unknown> } }[], Record<string, unknown>[], string];
const file = (n = 'a.jpg') => new File(['x'], n, { type: 'image/jpeg' });
const pick = (id: string, files: File[]) => fireEvent.change(screen.getByTestId(id), { target: { files } });

const card = (d = date(), w = ws()) => {
  const onSave = vi.fn(async () => ({ ok: true, error: null }));
  const onBack = vi.fn();
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><NightCard ws={w} date={d} onSave={onSave} onBack={onBack} /></QueryClientProvider>);
  return { onSave, onBack };
};
const openSheet = async () => { await screen.findByText('Thursdays'); fireEvent.click(screen.getByTestId('fact-flyer')); };
beforeEach(() => { net.detail.mockReset().mockResolvedValue(detail()); net.upload.mockReset(); });
afterEach(cleanup);

describe('Flyer and photos on the night card', () => {
  it('pill opens the sheet with the night texts and an empty hint', async () => {
    card();
    await openSheet();
    expect(screen.getByRole('dialog', { name: 'Flyer and photos' })).toBeTruthy();
    expect(screen.getByText('Photos and videos from this night')).toBeTruthy();
    expect(screen.getByText('Photos and videos from this night only. Dancers see them on this night, with the event gallery.')).toBeTruthy();
    expect(screen.getByText('Nothing here yet.')).toBeTruthy();
    expect(screen.getByTestId('flyer-preview').textContent).toBe('No flyer');
    expect(screen.queryByTestId('flyer-remove')).toBeNull(); // no honest blank flyer on a night
    expect(screen.queryByTestId('flyer-back')).toBeNull();
  });
  it('choose flyer: one night step with cover_image_url, before, night toast', async () => {
    net.upload.mockResolvedValue('https://x.test/new.jpg');
    net.detail.mockResolvedValue(detail({ coverImageOverride: 'https://x.test/old.jpg' }));
    const { onSave } = card();
    await openSheet();
    pick('flyer-file', [file()]);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const [steps, before, label] = onSave.mock.calls[0] as unknown as Call;
    expect(net.upload).toHaveBeenCalledWith('s1', expect.any(File));
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ target: 'occurrence', id: 'o1', part: 'Flyer', command: { kind: 'occurrence.set_override', payload: { cover_image_url: 'https://x.test/new.jpg' } } });
    expect(before).toEqual([{ cover_image_url: 'https://x.test/old.jpg' }]);
    expect(label).toBe('Saved for Thursday 26 November only');
  });
  it('upload error shows under the button, nothing saved', async () => {
    net.upload.mockRejectedValue(new Error('That file is too big.'));
    const { onSave } = card();
    await openSheet();
    pick('flyer-file', [file()]);
    expect((await screen.findByTestId('flyer-error')).textContent).toBe('That file is too big.');
    expect(onSave).not.toHaveBeenCalled();
  });
  it('Back to the usual flyer shows only when changed, and runs back()', async () => {
    net.detail.mockResolvedValue(detail({ coverImageOverride: 'https://x.test/o.jpg' }));
    const { onBack } = card(date({ override_keys: ['cover_image_url'] }));
    await screen.findByText('Thursdays');
    await waitFor(() => expect(screen.getByTestId('fact-flyer')).toBeTruthy());
    fireEvent.click(screen.getByTestId('fact-flyer'));
    fireEvent.click(screen.getByTestId('flyer-back'));
    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
    const [step, before, label] = onBack.mock.calls[0];
    expect(step.command.payload).toEqual({ cover_image_url: null });
    expect(before).toEqual({ cover_image_url: 'https://x.test/o.jpg' });
    expect(label).toBe('Back to usual for Thursday 26 November');
    expect(screen.queryByTestId('v2-sheet')).toBeNull();
  });
  it('add photos: two files, ONE save with both urls appended, sheet stays open', async () => {
    net.upload.mockResolvedValueOnce(P(8)).mockResolvedValueOnce(P(9));
    const { onSave } = card(date(), ws([P(1)]));
    await openSheet();
    pick('gallery-file', [file('a.jpg'), file('b.jpg')]);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const [steps, before] = onSave.mock.calls[0] as unknown as Call;
    expect(steps[0]).toMatchObject({ part: 'Gallery', command: { kind: 'occurrence.set_override', payload: { gallery: [P(1), P(8), P(9)] } } });
    expect(before).toEqual([{ gallery: null }]);
    expect(screen.getByRole('dialog', { name: 'Flyer and photos' })).toBeTruthy();
  });
  it('tile opens Photo sheet; remove saves the list without it, returns, "Photo removed", before = old list', async () => {
    net.detail.mockResolvedValue(detail({ galleryOverride: [P(1), P(2)] }));
    const { onSave } = card();
    await openSheet();
    await waitFor(() => expect(screen.getAllByTestId('gallery-tile')).toHaveLength(2));
    const tiles = screen.getAllByTestId('gallery-tile');
    expect(tiles[1].getAttribute('aria-label')).toBe('Photo 2, tap to see it large or remove it');
    fireEvent.click(tiles[0]);
    expect(screen.getByRole('dialog', { name: 'Photo' })).toBeTruthy();
    fireEvent.click(screen.getByTestId('photo-remove'));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const [steps, before, label] = onSave.mock.calls[0] as unknown as Call;
    expect(steps[0].command.payload).toEqual({ gallery: [P(2)] });
    expect(before).toEqual([{ gallery: [P(1), P(2)] }]);
    expect(label).toBe('Photo removed');
    expect(screen.getByRole('dialog', { name: 'Flyer and photos' })).toBeTruthy();
  });
  it('video tile: Video sheet with link box, Back returns, "Video removed"', async () => {
    net.detail.mockResolvedValue(detail({ galleryOverride: [P(1), YT] }));
    const { onSave } = card();
    await openSheet();
    await waitFor(() => expect(screen.getAllByTestId('gallery-tile')).toHaveLength(2));
    expect(screen.getAllByTestId('gallery-tile')[1].getAttribute('aria-label')).toBe('Video 2, tap to see it large or remove it');
    fireEvent.click(screen.getAllByTestId('gallery-tile')[1]);
    expect(screen.getByRole('dialog', { name: 'Video' })).toBeTruthy();
    expect(screen.getByTestId('photo-link').getAttribute('href')).toBe(YT);
    fireEvent.click(screen.getByTestId('photo-back'));
    expect(screen.getByRole('dialog', { name: 'Flyer and photos' })).toBeTruthy();
    fireEvent.click(screen.getAllByTestId('gallery-tile')[1]);
    fireEvent.click(screen.getByText('Remove this video'));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect((onSave.mock.calls[0] as unknown as Call)[2]).toBe('Video removed');
  });
  it('own photos do not make the flyer "Changed"', () => {
    expect(ownedKeys({ override_keys: ['gallery'] }, 'flyer')).toEqual([]);
    expect(ownedKeys({ override_keys: ['cover_image_url'] }, 'flyer')).toEqual(['cover_image_url']);
  });
});

const sheet = (over: Partial<React.ComponentProps<typeof FlyerSheet>> = {}) => {
  const p = { onFlyer: vi.fn(), onGallery: vi.fn(), onClose: vi.fn(), onBackToUsual: vi.fn() };
  render(<FlyerSheet seriesId="s1" flyer={null} gallery={[]} mode="usual" dateWords="Thursday 26 November" dayName="Thursday" {...p} {...over} />);
  return p;
};

describe('FlyerSheet (controlled)', () => {
  it('count word', () => {
    expect(countWord([])).toBe('');
    expect(countWord([P(1)])).toBe('1 photo');
    expect(countWord([P(1), P(2), P(3), P(4), YT])).toBe('4 photos, 1 video');
    expect(countWord([YT, 'https://vimeo.com/12345'])).toBe('2 videos');
  });
  it('texts per mode', () => {
    sheet();
    expect(screen.getByText('Photos and videos dancers see every Thursday.')).toBeTruthy();
    expect(screen.getByText('Photos and videos')).toBeTruthy();
    cleanup();
    sheet({ mode: 'oneOff', gallery: [P(1)] });
    expect(screen.getByText('Photos and videos dancers see on the event page.')).toBeTruthy();
    expect(screen.getByText('Photos and videos · 1 photo')).toBeTruthy();
    expect(screen.getByText('Tap a photo or video to see it large or remove it.')).toBeTruthy();
  });
  it('usual: Remove the flyer calls onFlyer(null)', () => {
    const p = sheet({ flyer: 'https://x.test/f.jpg' });
    fireEvent.click(screen.getByText('Remove the flyer'));
    expect(p.onFlyer).toHaveBeenCalledWith(null, 'Saved for every Thursday');
  });
  it('usual: a picked photo calls onGallery with the usual label', async () => {
    net.upload.mockResolvedValue(P(5));
    const p = sheet();
    pick('gallery-file', [file()]);
    await waitFor(() => expect(p.onGallery).toHaveBeenCalledWith([P(5)], 'Saved for every Thursday'));
  });
  it('add video: valid saves and clears, invalid shows message, empty ignored', async () => {
    const p = sheet({ mode: 'oneOff' });
    fireEvent.click(screen.getByTestId('video-add'));
    expect(p.onGallery).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Or add a video link'), { target: { value: 'youtube.com/x' } });
    fireEvent.click(screen.getByTestId('video-add'));
    expect(screen.getByText('Paste a full link starting with https://')).toBeTruthy();
    expect(p.onGallery).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Or add a video link'), { target: { value: `  ${YT} ` } });
    fireEvent.click(screen.getByTestId('video-add'));
    await waitFor(() => expect(p.onGallery).toHaveBeenCalledWith([YT], 'Saved'));
    await waitFor(() => expect((screen.getByLabelText('Or add a video link') as HTMLInputElement).value).toBe(''));
  });
  it('limit disables both adds and says why', () => {
    sheet({ gallery: Array.from({ length: MAX_GALLERY }, (_, i) => P(i)) });
    expect(screen.getByText('That is the most photos and videos for one event.')).toBeTruthy();
    expect((screen.getByTestId('gallery-add') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('video-add') as HTMLButtonElement).disabled).toBe(true);
  });
});
