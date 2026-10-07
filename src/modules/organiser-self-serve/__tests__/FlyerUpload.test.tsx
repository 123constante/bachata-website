// @vitest-environment jsdom
/**
 * The series editor's picture: no pasted-link input any more, an existing link
 * shown read-only and left alone, wrong type / too big / SVG-as-PNG refused
 * before any upload, both previews before saving, then upload to
 * organiser-flyers under <series_id>/<random>.<ext> and ONE series.upsert of
 * {name, default_cover_image_url}. The re-encode itself is covered in
 * flyerModel.test.ts; here it is stubbed (jsdom has no canvas).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const rpc = vi.hoisted(() => vi.fn());
const upload = vi.hoisted(() => vi.fn());
const getPublicUrl = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());
const reencode = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn(), storage: { from } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../components/VenuePicker', () => ({ VenuePicker: () => null }));
vi.mock('../components/publicVenues', () => ({ useVenueOptions: () => ({ data: [] }), venueName: () => null }));
vi.mock('../flyerModel', async (importOriginal) => ({ ...(await importOriginal<typeof import('../flyerModel')>()), reencodeFlyer: reencode }));

import { SeriesEditor } from '../components/SeriesEditor';
import type { SeriesWorkspace, WorkspaceSeries } from '../seriesModel';

const SID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const PATH_RE = new RegExp(`^${SID}/[0-9a-f]{32}\\.webp$`);
const PUBLIC = (path: string) => `https://stsdtacfauprzrdebmzg.supabase.co/storage/v1/object/public/organiser-flyers/${path}`;
const PASTED = 'https://pub-07f606224cac4f2596903c44df723644.r2.dev/events/old-flyer.jpg';

const series = (cover: string | null) => ({
  id: SID, name: 'Thursday Class', slug: 'thursday-class', format: 'recurring', category: 'class',
  lifecycle_status: 'live', version: 3, default_venue_id: 'v1', default_local_start_time: '20:00:00',
  default_duration: '02:00:00', default_level: null, default_ticket_url: null, default_description: null,
  default_cover_image_url: cover, default_start_date: null, instagram_url: null, passes: null, created_at: null,
  recurrence_rule: null, removed_dates: [],
}) as WorkspaceSeries;
const workspace = (cover: string | null = PASTED): SeriesWorkspace => ({
  series: series(cover), hasSessions: false,
  dates: [{ id: 'o1', occurrence_date: '2026-10-09', lifecycle_status: 'scheduled' } as SeriesWorkspace['dates'][number]],
});

const commandCalls = () => rpc.mock.calls.filter(([fn]) => fn === 'series_command_p5');
const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d];

let client: QueryClient;
function tree(ws: SeriesWorkspace) {
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SeriesEditor workspace={ws} today="2026-10-07" />
      </MemoryRouter>
    </QueryClientProvider>
  );
}
const mount = (ws = workspace()) => render(tree(ws));
const pick = (file: File) => fireEvent.change(screen.getByTestId('flyer-input'), { target: { files: [file] } });
const pngFile = (name = 'flyer.png') => new File([new Uint8Array(PNG_HEAD)], name, { type: 'image/png' });

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  rpc.mockReset();
  rpc.mockResolvedValue({ data: { ok: true, new_version: 4 }, error: null });
  upload.mockReset();
  upload.mockResolvedValue({ data: { path: 'x' }, error: null });
  getPublicUrl.mockReset();
  getPublicUrl.mockImplementation((path: string) => ({ data: { publicUrl: PUBLIC(path) } }));
  from.mockReset();
  from.mockImplementation(() => ({ upload, getPublicUrl }));
  reencode.mockReset();
  reencode.mockResolvedValue({ blob: new Blob([new Uint8Array(900)], { type: 'image/webp' }), mime: 'image/webp', ext: 'webp', width: 1067, height: 1600 });
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:http://localhost/preview-${++n}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

describe('SeriesEditor picture (FlyerUpload)', () => {
  it('has no pasted-link input; an existing link is shown read-only and untouched', async () => {
    mount();
    expect(document.getElementById('series-cover')).toBeNull();
    expect(screen.queryByPlaceholderText('https://', { exact: true })).not.toBeNull(); // the booking link is still a link field
    expect(screen.getByTestId('flyer-current-link-value').textContent).toBe(PASTED);
    expect(screen.getByTestId('flyer-current-link').querySelector('input')).toBeNull();
    // Both previews show the current picture.
    expect(screen.getByTestId('flyer-hero-image').getAttribute('src')).toBe(PASTED);
    expect(screen.getByTestId('flyer-card-preview').querySelector('img')?.getAttribute('src')).toBe(PASTED);
    // A basics save (name only) never sends the cover.
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Thursday Bachata' } });
    fireEvent.click(screen.getByTestId('basics-save'));
    await waitFor(() => expect(commandCalls()).toHaveLength(1));
    expect(JSON.stringify(commandCalls()[0][1])).not.toContain('default_cover_image_url');
  });

  it('offers no remove once a picture is set', () => {
    mount();
    expect(screen.queryByRole('button', { name: /remove/i })).toBeNull();
    expect(screen.getByTestId('flyer-choose').textContent).toContain('Choose a new picture');
  });

  it('refuses a wrong type and a file over 10 MB before reading or uploading', async () => {
    mount();
    pick(new File(['GIF89a'], 'a.gif', { type: 'image/gif' }));
    expect((await screen.findByTestId('flyer-error')).textContent).toBe('That file type is not supported. Choose a JPEG, PNG or WebP picture.');
    const big = pngFile();
    Object.defineProperty(big, 'size', { value: 10 * 1024 * 1024 + 1 });
    pick(big);
    expect((await screen.findByTestId('flyer-error')).textContent).toBe('That picture is too big. Choose one under 10 MB.');
    expect(reencode).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it('refuses SVG and HTML dressed as a picture', async () => {
    mount();
    pick(new File(['<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'], 'flyer.png', { type: 'image/png' }));
    expect((await screen.findByTestId('flyer-error')).textContent).toMatch(/could not read that file as a picture/);
    pick(new File(['<!DOCTYPE html><script>alert(1)</script>'], 'flyer.jpg', { type: 'image/jpeg' }));
    await waitFor(() => expect(screen.getByTestId('flyer-error').textContent).toMatch(/could not read that file as a picture/));
    expect(reencode).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    expect(screen.queryByTestId('flyer-save')).toBeNull();
  });

  it('shows a file the browser cannot decode as not a picture', async () => {
    const { FlyerError } = await import('../flyerModel');
    reencode.mockRejectedValueOnce(new FlyerError('not_image'));
    mount();
    pick(pngFile());
    expect((await screen.findByTestId('flyer-error')).textContent).toMatch(/could not read that file as a picture/);
    expect(upload).not.toHaveBeenCalled();
  });

  it('previews both views before saving, then uploads and saves through the owner command', async () => {
    mount();
    pick(pngFile('My Flyer (final).png'));
    const save = await screen.findByTestId('flyer-save');
    expect(screen.getByTestId('flyer-preview-note')).toBeTruthy();
    expect(screen.getByTestId('flyer-hero-image').getAttribute('src')).toBe('blob:http://localhost/preview-1');
    expect(screen.getByTestId('flyer-card-preview').querySelector('img')?.getAttribute('src')).toBe('blob:http://localhost/preview-1');
    expect(screen.queryByTestId('flyer-current-link')).toBeNull();
    expect(upload).not.toHaveBeenCalled();
    expect(commandCalls()).toHaveLength(0);

    fireEvent.click(save);
    await waitFor(() => expect(commandCalls()).toHaveLength(1));
    expect(from).toHaveBeenCalledWith('organiser-flyers');
    expect(upload).toHaveBeenCalledTimes(1);
    const [path, body, opts] = upload.mock.calls[0];
    expect(path).toMatch(PATH_RE); // never the user's filename
    expect(path).not.toMatch(/flyer|final/i);
    expect(body).toBeInstanceOf(Blob);
    expect(opts).toEqual({ contentType: 'image/webp', upsert: false, cacheControl: '31536000' });
    const env = commandCalls()[0][1].p_envelope;
    expect(env).toMatchObject({ target_id: SID, expected_version: 3 });
    expect(env.command).toEqual({ kind: 'series.upsert', payload: { name: 'Thursday Class', default_cover_image_url: PUBLIC(path) } });
    expect((await screen.findByTestId('series-confirmation')).textContent).toContain('Picture saved.');
    expect(screen.queryByTestId('flyer-save')).toBeNull();
  });

  it('keep the old one discards the pick without uploading', async () => {
    mount();
    pick(pngFile());
    fireEvent.click(await screen.findByTestId('flyer-cancel'));
    expect(screen.queryByTestId('flyer-save')).toBeNull();
    expect(screen.getByTestId('flyer-hero-image').getAttribute('src')).toBe(PASTED);
    expect(upload).not.toHaveBeenCalled();
  });

  it('an upload failure says so and saves nothing', async () => {
    upload.mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } });
    mount();
    pick(pngFile());
    fireEvent.click(await screen.findByTestId('flyer-save'));
    expect((await screen.findByTestId('flyer-error')).textContent).toBe('The picture did not upload. Check your connection and try again.');
    expect(commandCalls()).toHaveLength(0);
    expect(screen.getByTestId('flyer-save')).toBeTruthy(); // can try again
  });

  it('a storage policy refusal is a permission message', async () => {
    upload.mockResolvedValueOnce({ data: null, error: { statusCode: '403', message: 'new row violates row-level security policy' } });
    mount();
    pick(pngFile());
    fireEvent.click(await screen.findByTestId('flyer-save'));
    expect((await screen.findByTestId('flyer-error')).textContent).toBe('You can only change the picture for events you own or manage.');
    expect(commandCalls()).toHaveLength(0);
  });

  it('an unsaved picture stops the tab closing', async () => {
    mount();
    const closing = () => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; };
    expect(closing()).toBe(false);
    pick(pngFile());
    await screen.findByTestId('flyer-save');
    expect(closing()).toBe(true);
  });

  it('a basics save after a picture save never sends the old cover back', async () => {
    const view = mount();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Thursday Bachata' } });
    pick(pngFile());
    fireEvent.click(await screen.findByTestId('flyer-save'));
    await waitFor(() => expect(commandCalls()).toHaveLength(1));
    const newUrl = commandCalls()[0][1].p_envelope.command.payload.default_cover_image_url as string;
    // The workspace reloads carrying the new picture while the name edit is still unsaved.
    const reloaded = workspace(newUrl);
    reloaded.series.version = 4;
    view.rerender(tree(reloaded));
    expect(screen.queryByTestId('flyer-current-link')).toBeNull(); // our own flyer is not a "link"
    // Keep typing after the reload, so the form renders against the new baseline.
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Thursday Bachata Night' } });
    fireEvent.click(screen.getByTestId('basics-save'));
    await waitFor(() => expect(commandCalls()).toHaveLength(2));
    const second = JSON.stringify(commandCalls()[1][1]);
    expect(second).toContain('Thursday Bachata Night');
    expect(second).not.toContain('default_cover_image_url');
  });
});
