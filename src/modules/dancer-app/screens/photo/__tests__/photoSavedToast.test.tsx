// @vitest-environment jsdom
/** D119: a visible "Saved" toast after a photo saves (it outlives the screen: the save returns to the return= target). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';

vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { makeProfile, CITY_LONDON } from '@/modules/dancer-app/api/fixtures';
import { photoScreenDeps } from '../photoScreenDeps';
import { realPhotoDeps } from '../photoFlow';
import { decodePhoto } from '../decodeImage';

const ctxStub = { setTransform: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn() };
const fakeDecoded = { source: {} as ImageBitmap, rawW: 800, rawH: 600, orientation: 1 as const, w: 800, h: 600 };
const HALF = makeProfile({ first_name: 'Ana', based_city_id: CITY_LONDON.id, dance_role: 'Leader', avatar_url: null });

beforeEach(() => {
  photoScreenDeps.decode = vi.fn(async () => fakeDecoded);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctxStub as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb: BlobCallback) {
    cb(new Blob(['jpeg'], { type: 'image/jpeg' }));
  });
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
  photoScreenDeps.flow = { ...realPhotoDeps, upload: async () => 'https://img.example/new.jpg', deleteOld: async () => {}, log: () => {} };
});
afterEach(() => { cleanup(); resetShell(); vi.restoreAllMocks(); photoScreenDeps.flow = realPhotoDeps; photoScreenDeps.decode = decodePhoto; });

const savePhoto = async (path: string) => {
  const r = renderInShell({ path, backend: { profile: HALF } });
  await screen.findByTestId('photo-pick');
  await act(async () => { fireEvent.change(screen.getByTestId('photo-input-library'), { target: { files: [new File(['x'], 'me.jpg', { type: 'image/jpeg' })] } }); });
  await screen.findByTestId('photo-crop');
  fireEvent.click(screen.getByTestId('photo-crop-done'));
  await screen.findByTestId('photo-preview');
  await waitFor(() => expect((screen.getByTestId('photo-use') as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByTestId('photo-use'));
  return r;
};

describe('D119: "Saved" toast after a photo saves', () => {
  it('shows a visible Saved status on the screen it returns to', async () => {
    const r = await savePhoto('/app/me/photo?return=/app/me/edit');
    await screen.findByTestId('dancer-screen-edit');
    expect(r.location()).toBe('/app/me/edit');
    const toast = await screen.findByTestId('da-toast');
    expect(toast.textContent).toBe('Saved');
    expect(toast.getAttribute('role')).toBe('status');
  });
  it('does not show it when the save fails', async () => {
    photoScreenDeps.flow = { ...realPhotoDeps, upload: async () => { throw new Error('boom'); }, deleteOld: async () => {}, log: () => {} };
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await savePhoto('/app/me/photo');
    await screen.findByTestId('photo-failure');
    expect(screen.queryByTestId('da-toast')).toBeNull();
  });
});
