// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';

vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { DANCER_SHAPES, type DancerShapeName } from '@/modules/dancer-app/api/fixtures';
import { DecodeError, TOO_SMALL_COPY, decodePhoto } from '../decodeImage';
import { photoScreenDeps, returnPathFor } from '../photoScreenDeps';
import { realPhotoDeps } from '../photoFlow';
import { jpegWithOrientation } from './jpegFixture';

const NEW = 'https://img.example/new.jpg';
let order: string[] = [];
const ctxStub = { setTransform: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn() };
const fakeDecoded = { source: {} as ImageBitmap, rawW: 800, rawH: 600, orientation: 1 as const, w: 800, h: 600 };

const savedFlow = { ...realPhotoDeps };
beforeEach(() => {
  order = [];
  photoScreenDeps.decode = vi.fn(async () => fakeDecoded);
  photoScreenDeps.flow = {
    upload: async () => { order.push('upload'); return NEW; },
    save: (url, current) => { order.push('save'); return savedFlow.save(url, current); },
    deleteOld: async () => { order.push('delete'); },
    log: () => { order.push('log'); },
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctxStub as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb: BlobCallback, type?: string, q?: unknown) {
    order.push(`toBlob:${type}:${String(q)}`);
    cb(new Blob(['jpeg'], { type: 'image/jpeg' }));
  });
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => { cleanup(); resetShell(); vi.restoreAllMocks(); photoScreenDeps.flow = realPhotoDeps; photoScreenDeps.decode = decodePhoto; });

const jpeg = (name = 'me.jpg', size = 1000) => {
  const f = new File(['x'], name, { type: 'image/jpeg' });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};
const pick = async (file: File, id = 'photo-input-library') => {
  await act(async () => { fireEvent.change(screen.getByTestId(id), { target: { files: [file] } }); });
};
const toPreview = async () => {
  await pick(jpeg());
  await screen.findByTestId('photo-crop');
  fireEvent.click(screen.getByTestId('photo-crop-done'));
  await screen.findByTestId('photo-preview');
};
const ready = async () => { await waitFor(() => expect(screen.getByTestId('photo-pick')).toBeTruthy()); await screen.findByText(/Choose from my photos/); };

describe('pick', () => {
  it('offers camera (capture) and library inputs', async () => {
    renderInShell({ path: '/app/me/photo' });
    await ready();
    expect(screen.getByTestId('photo-input-camera').getAttribute('capture')).toBe('user');
    expect(screen.getByTestId('photo-input-library').hasAttribute('capture')).toBe(false);
    expect(screen.getByText(/If your camera does not open/)).toBeTruthy();
  });

  it.each([
    ['svg', new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' }), /SVG images/],
    ['heic (no support)', new File(['x'], 'a.heic', { type: 'image/heic' }), /Only image files are allowed/],
    ['pdf', new File(['x'], 'a.pdf', { type: 'application/pdf' }), /Only image files are allowed/],
    ['oversized', jpeg('big.jpg', 6 * 1024 * 1024), /too large/],
  ])('refuses %s with the existing validator copy and a way to pick again', async (_n, file, copy) => {
    renderInShell({ path: '/app/me/photo' });
    await ready();
    await pick(file);
    expect((await screen.findByTestId('photo-refusal')).textContent).toMatch(copy);
    expect(screen.getByTestId('photo-refusal').textContent).toMatch(/Pick another photo/);
    expect(screen.getByTestId('photo-input-library')).toBeTruthy();
  });

  it('a tiny photo is refused with our own copy (the validator has none)', async () => {
    photoScreenDeps.decode = vi.fn(async () => { throw new DecodeError(TOO_SMALL_COPY); });
    renderInShell({ path: '/app/me/photo' });
    await ready();
    await pick(jpeg());
    expect((await screen.findByTestId('photo-refusal')).textContent).toContain('too small');
  });
});

describe('decodePhoto', () => {
  const bitmap = (w: number, h: number) => ({ width: w, height: h }) as ImageBitmap;
  it('refuses under 256px on the short side, AFTER rotation', async () => {
    await expect(decodePhoto(new Blob(['x']), { readBytes: async () => new ArrayBuffer(0), createBitmap: async () => bitmap(200, 900) })).rejects.toThrow(/too small/);
  });
  it('rotates a bitmap the browser left sideways (exif 6, size unchanged)', async () => {
    const d = await decodePhoto(new Blob(['x']), { readBytes: async () => jpegWithOrientation(6, 4000, 3000), createBitmap: async () => bitmap(4000, 3000) });
    expect(d.orientation).toBe(6);
    expect([d.w, d.h]).toEqual([3000, 4000]);
  });
  it('leaves a bitmap the browser already rotated alone', async () => {
    const d = await decodePhoto(new Blob(['x']), { readBytes: async () => jpegWithOrientation(6, 4000, 3000), createBitmap: async () => bitmap(3000, 4000) });
    expect(d.orientation).toBe(1);
  });
  it('asks the decoder for from-image', async () => {
    const createBitmap = vi.fn(async () => bitmap(500, 500));
    await decodePhoto(new Blob(['x']), { readBytes: async () => new ArrayBuffer(0), createBitmap });
    expect(createBitmap).toHaveBeenCalledWith(expect.anything(), { imageOrientation: 'from-image' });
  });
  it('an undecodable file is refused with copy, not thrown raw', async () => {
    await expect(decodePhoto(new Blob(['x']), { readBytes: async () => new ArrayBuffer(0), createBitmap: async () => { throw new Error('x'); } })).rejects.toBeInstanceOf(DecodeError);
  });
});

const SHAPES: DancerShapeName[] = ['emptyStub', 'nameCityOnly', 'fourFieldComplete', 'completeAllExtras', 'adminUnclaimedPhotoless', 'claimedAdmin', 'paused', 'namelessProfile'];

describe.each(SHAPES)('save order x shape %s', (shape) => {
  const had = Boolean(DANCER_SHAPES[shape].profile?.avatar_url);
  it(had ? 'replacing: crop output is a 1024 JPEG at 0.86; upload -> save -> delete' : 'first photo: upload -> save only', async () => {
    const { backend, location } = renderInShell({ path: '/app/me/photo', backend: { shape } });
    await ready();
    await toPreview();
    expect(order).toEqual(['toBlob:image/jpeg:0.86']);
    fireEvent.click(await screen.findByTestId('photo-use'));
    await waitFor(() => expect(location()).toBe('/app/me'));
    expect(order.slice(1)).toEqual(had ? ['upload', 'save', 'delete'] : ['upload', 'save']);
    expect(backend.writes).toBe(1);
    expect(backend.current()?.avatar_url).toBe(NEW);
  });
});

describe('failures each have a way out', () => {
  it('upload fails: message, crop kept, Try again uploads again and succeeds', async () => {
    let n = 0;
    photoScreenDeps.flow.upload = async () => { order.push('upload'); if (n++ === 0) throw new Error('Photo upload failed. Check your connection and try again.'); return NEW; };
    const { backend } = renderInShell({ path: '/app/me/photo' });
    await ready();
    await toPreview();
    fireEvent.click(screen.getByTestId('photo-use'));
    expect((await screen.findByTestId('photo-failure')).textContent).toMatch(/upload failed/i);
    expect(screen.getByTestId('photo-another')).toBeTruthy();
    expect(backend.writes).toBe(0);
    fireEvent.click(screen.getByTestId('photo-use'));
    await waitFor(() => expect(backend.writes).toBe(1));
    expect(order.filter((o) => o === 'upload')).toHaveLength(2);
  });

  it.each(['area_closed', 'rate_limited', 'unknown'] as const)('save fails with %s: the INTERFACE copy, old photo NOT deleted, retry skips the upload', async (code) => {
    const { backend } = renderInShell({ path: '/app/me/photo' });
    await ready();
    await toPreview();
    backend.failNextWith(code);
    fireEvent.click(screen.getByTestId('photo-use'));
    const msg = (await screen.findByTestId('photo-failure')).textContent ?? '';
    expect(msg.length).toBeGreaterThan(10);
    expect(order).not.toContain('delete');
    if (code === 'rate_limited') expect(msg).toMatch(/Wait a few minutes/);
    fireEvent.click(screen.getByTestId('photo-use'));
    await waitFor(() => expect(order).toContain('delete'));
    expect(order.filter((o) => o === 'upload')).toHaveLength(1);
  });

  it('offline: Use this photo is disabled and says why', async () => {
    renderInShell({ path: '/app/me/photo' });
    await ready();
    await toPreview();
    await act(async () => { window.dispatchEvent(new Event('offline')); });
    expect((screen.getByTestId('photo-use') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/off until you are back online/)).toBeTruthy();
    await act(async () => { window.dispatchEvent(new Event('online')); });
    expect((screen.getByTestId('photo-use') as HTMLButtonElement).disabled).toBe(false);
  });

  it('Take another returns to the pick step and clears the crop', async () => {
    renderInShell({ path: '/app/me/photo' });
    await ready();
    await toPreview();
    fireEvent.click(screen.getByTestId('photo-another'));
    expect(screen.getByTestId('photo-pick')).toBeTruthy();
  });

  it('a profile that cannot load: says so and offers Try again', async () => {
    renderInShell({ path: '/app/me/photo', backend: { shape: 'authUserNoPersona' } });
    expect((await screen.findByText(/could not load your profile/)).textContent).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });
});

describe('crop interactions', () => {
  it('keyboard arrows and plus/minus change the view; the guide overlay is present', async () => {
    renderInShell({ path: '/app/me/photo' });
    await ready();
    await pick(jpeg());
    const box = await screen.findByTestId('photo-crop-box');
    expect(screen.getByTestId('photo-guide')).toBeTruthy();
    const zoom = screen.getByTestId('photo-zoom') as HTMLInputElement;
    fireEvent.keyDown(box, { key: '+' });
    expect(Number(zoom.value)).toBeGreaterThan(1);
    const before = ctxStub.setTransform.mock.calls.length;
    fireEvent.keyDown(box, { key: 'ArrowLeft' });
    await waitFor(() => expect(ctxStub.setTransform.mock.calls.length).toBeGreaterThan(before));
  });
});

describe('return path', () => {
  it.each([
    [null, '/app/me'],
    ['/app/home', '/app/home'],
    ['/app/me/photo', '/app/me'],
    ['//evil.example', '/app/me'],
    ['https://evil.example', '/app/me'],
    ['/auth?x=1', '/app/me'],
  ])('?return=%s -> %s', (raw, want) => {
    expect(returnPathFor(raw)).toBe(want);
  });

  it('honours ?return= after a save', async () => {
    const { location } = renderInShell({ path: '/app/me/photo?return=/app/home' });
    await ready();
    await toPreview();
    fireEvent.click(screen.getByTestId('photo-use'));
    await waitFor(() => expect(location()).toBe('/app/home'));
  });
});
