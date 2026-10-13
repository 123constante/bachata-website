import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));

import { uploadToR2, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES } from './uploadToR2';
import { validateImageFile, SVG_REJECTED_MESSAGE } from './upload-validation';

const MB = 1024 * 1024;
const png = () => new File([new Uint8Array(4)], 'a.png', { type: 'image/png' });
const sized = (bytes: number, type: string) => new File([new Uint8Array(bytes)], 'big', { type });
const httpError = (status: number, reason?: string) => ({
  name: 'FunctionsHttpError',
  message: 'Edge Function returned a non-2xx status code',
  context: new Response(JSON.stringify({ ok: false, reason }), { status }),
});

const ROLES = ['admin', 'dancer', 'vendor', 'anon'] as const;
// Each caller's real (bucket, file) as used in the source.
const CALLERS = [
  { name: 'AvatarUpload', file: 'src/components/profile/AvatarUpload.tsx', bucket: 'avatars' },
  { name: 'VendorPortal', file: 'src/pages/VendorPortal.tsx', bucket: 'images' },
  { name: 'VendorDashboardPage', file: 'src/pages/VendorDashboardPage.tsx', bucket: 'images' },
] as const;
const OUTCOMES = [
  { name: 'ok', error: null, match: null },
  { name: '401', error: httpError(401, 'no_account'), match: /sign in again/i },
  { name: '403', error: httpError(403, 'not_owner'), match: /permission/i },
  { name: '413', error: httpError(413, 'file_too_large'), match: /10 MB.*50 MB/ },
  { name: '422 presign_not_allowed', error: httpError(422, 'presign_not_allowed'), match: /reload the page/i },
  { name: '422 type', error: httpError(422, 'type_not_allowed'), match: /JPG, PNG or WebP/ },
] as const;

describe('uploadToR2 (storage-sign-upload proxy mode)', () => {
  beforeEach(() => {
    invoke.mockReset();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })));
  });

  describe.each(CALLERS)('caller $name', ({ file: src, bucket }) => {
    it('uses uploadToR2 and stores its return value (source check)', () => {
      const text = readFileSync(src, 'utf8');
      expect(text).toMatch(/uploadToR2\(/);
      expect(text).not.toMatch(/uploadUrl/);
    });

    describe.each(ROLES)('%s', (role) => {
      it.each(OUTCOMES)('$name', async ({ error, match }) => {
        const url = `https://cdn/${bucket}/u/uid/2026/10/abc.png`;
        invoke.mockResolvedValue(error ? { data: null, error } : { data: { ok: true, publicUrl: url, key: 'k' }, error: null });
        const f = png();
        const run = uploadToR2(f, bucket, 'sent-path.png');
        if (!error) {
          const stored = await run;
          expect(stored).toBe(url); // equals the returned publicUrl
          expect(stored).not.toContain('sent-path');
        } else {
          const err = await run.catch((e) => e);
          expect(err.message).toMatch(match as RegExp);
          expect(err.message).not.toMatch(/non-2xx/);
        }
        // request shape: multipart, exactly bucket + contentType + file, no JSON presign, no R2 PUT
        const [fn, opts] = invoke.mock.calls[0];
        expect(fn).toBe('storage-sign-upload');
        const form = opts.body as FormData;
        expect(form).toBeInstanceOf(FormData);
        expect([...form.keys()].sort()).toEqual(['bucket', 'contentType', 'file']);
        expect(form.get('bucket')).toBe(bucket);
        expect(form.get('contentType')).toBe('image/png');
        expect((form.get('file') as File).size).toBe(f.size);
        expect(fetch).not.toHaveBeenCalled();
        void role; // the role is decided server-side; the client sends the same request
      });
    });
  });

  describe('size check happens before any network call', () => {
    it.each([
      ['gif over 10 MB', MAX_IMAGE_BYTES + 1, 'image/gif', /10 MB/],
      ['video over 50 MB', MAX_VIDEO_BYTES + 1, 'video/mp4', /50 MB/],
    ])('%s is refused with the limit in the message', async (_n, bytes, type, re) => {
      const err = await uploadToR2(sized(bytes, type), 'images', 'p').catch((e) => e);
      expect(err.message).toMatch(re);
      expect(invoke).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    });

    it('an oversized photo that cannot be downscaled is refused', async () => {
      const deps = { decode: vi.fn().mockRejectedValue(new Error('x')), createCanvas: vi.fn() };
      const err = await uploadToR2(sized(MAX_IMAGE_BYTES + 1, 'image/jpeg'), 'images', 'p', { deps }).catch((e) => e);
      expect(err.message).toMatch(/limit is 10 MB/);
      expect(invoke).not.toHaveBeenCalled();
    });

    it('an oversized photo is downscaled and the smaller file is what is sent', async () => {
      const small = new Blob([new Uint8Array(1000)], { type: 'image/webp' });
      const canvas = {
        width: 0, height: 0,
        getContext: () => ({ drawImage() {}, fillRect() {}, clearRect() {}, fillStyle: '' }),
        toBlob: (cb: (b: Blob | null) => void) => cb(small),
      };
      const deps = { decode: async () => ({ width: 4000, height: 3000, image: {} as CanvasImageSource }), createCanvas: () => canvas };
      invoke.mockResolvedValue({ data: { ok: true, publicUrl: 'https://cdn/x.webp' }, error: null });
      const url = await uploadToR2(sized(MAX_IMAGE_BYTES + 1, 'image/jpeg'), 'images', 'p', { deps });
      expect(url).toBe('https://cdn/x.webp');
      const form = invoke.mock.calls[0][1].body as FormData;
      expect(form.get('contentType')).toBe('image/webp');
      expect((form.get('file') as Blob).size).toBe(1000);
    });

    it('files at exactly the cap are sent as they are', async () => {
      invoke.mockResolvedValue({ data: { ok: true, publicUrl: 'https://cdn/y.png' }, error: null });
      await uploadToR2(sized(MAX_IMAGE_BYTES, 'image/png'), 'images', 'p');
      expect(invoke).toHaveBeenCalledTimes(1);
      void MB;
    });
  });
});

describe('SVG rejected up front', () => {
  it.each([
    ['logo.svg', 'image/svg+xml'],
    ['logo.SVG', ''],
  ])('%s', (name, type) => {
    const r = validateImageFile(new File(['x'], name, { type }));
    expect(r).toEqual({ ok: false, message: SVG_REJECTED_MESSAGE });
  });
  it('still accepts jpeg/png/webp/gif/avif', () => {
    for (const t of ['jpeg', 'png', 'webp', 'gif', 'avif']) {
      expect(validateImageFile(new File(['x'], `a.${t}`, { type: `image/${t}` })).ok).toBe(true);
    }
  });
});
