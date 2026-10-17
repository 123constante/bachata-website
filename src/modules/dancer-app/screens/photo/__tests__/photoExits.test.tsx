// @vitest-environment jsdom
/** Audit L11 (a way back from pick and crop) and M22 (unknown upload errors are one plain sentence). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';

vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { makeProfile, CITY_LONDON } from '@/modules/dancer-app/api/fixtures';
import { UPLOAD_NETWORK_MESSAGE } from '@/lib/upload-validation';
import { signUploadMessage } from '@/lib/uploadToR2';
import { photoScreenDeps } from '../photoScreenDeps';
import { realPhotoDeps } from '../photoFlow';
import { decodePhoto } from '../decodeImage';
import { UPLOAD_FAILED_MESSAGE } from '../uploadFailure';

const ctxStub = { setTransform: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn() };
const fakeDecoded = { source: {} as ImageBitmap, rawW: 800, rawH: 600, orientation: 1 as const, w: 800, h: 600 };
// Prod shape: half-finished setup whose stored photo URL is broken (404).
const HALF = makeProfile({ first_name: 'Ana', based_city_id: CITY_LONDON.id, dance_role: 'Leader', avatar_url: 'https://img.example/missing-404.jpg' });

beforeEach(() => {
  photoScreenDeps.decode = vi.fn(async () => fakeDecoded);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctxStub as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb: BlobCallback) {
    cb(new Blob(['jpeg'], { type: 'image/jpeg' }));
  });
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => { cleanup(); resetShell(); vi.restoreAllMocks(); photoScreenDeps.flow = realPhotoDeps; photoScreenDeps.decode = decodePhoto; });

const jpeg = () => new File(['x'], 'me.jpg', { type: 'image/jpeg' });
const pick = async () => {
  await act(async () => { fireEvent.change(screen.getByTestId('photo-input-library'), { target: { files: [jpeg()] } }); });
};

describe('L11: pick and crop have a way back to the return= target', () => {
  it.each([
    ['/app/me/photo?return=/app/welcome', 'Back to setup', '/app/welcome'],
    [`/app/me/photo?return=${encodeURIComponent('/app/welcome?returnTo=/account/o')}`, 'Back to setup', '/app/welcome?returnTo=/account/o'],
    ['/app/me/photo?return=/app/me/edit', 'Back', '/app/me/edit'],
  ])('%s', async (path, label, href) => {
    renderInShell({ path, backend: { profile: HALF } });
    await screen.findByTestId('photo-pick');
    expect(screen.getByRole('link', { name: label }).getAttribute('href')).toBe(href);
    await pick();
    await screen.findByTestId('photo-crop');
    expect(screen.getByRole('link', { name: label }).getAttribute('href')).toBe(href);
  });

  it('no return= (reached from the Me tab): no extra link, the tabs are the way back', async () => {
    renderInShell({ path: '/app/me/photo', backend: { profile: HALF } });
    await screen.findByTestId('photo-pick');
    expect(screen.queryByTestId('photo-back')).toBeNull();
  });
});

describe('M22: upload failures', () => {
  const failWith = async (err: unknown) => {
    photoScreenDeps.flow = { ...realPhotoDeps, upload: async () => { throw err; }, deleteOld: async () => {}, log: () => {} };
    renderInShell({ path: '/app/me/photo', backend: { profile: HALF } });
    await screen.findByTestId('photo-pick');
    await waitFor(() => expect(screen.getByTestId('photo-pick')).toBeTruthy());
    await pick();
    await screen.findByTestId('photo-crop');
    fireEvent.click(screen.getByTestId('photo-crop-done'));
    await screen.findByTestId('photo-preview');
    await waitFor(() => expect((screen.getByTestId('photo-use') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('photo-use'));
    return (await screen.findByTestId('photo-failure')).textContent;
  };

  it('an unknown server message is never shown word for word; it is logged', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const text = await failWith(new Error('storage-sign-upload: 500 bucket avatars policy violation'));
    expect(text).toBe(UPLOAD_FAILED_MESSAGE);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('photo upload failed'), expect.stringContaining('policy violation'));
  });

  it('a refusal uploadToR2 already words (expired session) keeps its sentence', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await failWith(new Error(signUploadMessage(401)))).toBe(signUploadMessage(401));
  });

  it('a network failure keeps the connection sentence', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await failWith(new TypeError('Failed to fetch'))).toBe(UPLOAD_NETWORK_MESSAGE);
  });
});
