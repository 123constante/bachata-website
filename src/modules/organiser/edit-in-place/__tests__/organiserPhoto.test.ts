/**
 * The organiser photo pipeline (organiserPhotoModel + organiserPhotoUploadApi):
 * type, size, empty, the SVG-as-image sniff, the re-encode at the photo's own
 * limits (long edge 1200, about 400 KB, never over 2 MB), the storage path the
 * admin bucket policy admits, and the plain copy for a refused or failed upload.
 * The flyer's own behaviour is pinned by flyerModel.test.ts, unchanged.
 */
import { describe, expect, it, vi } from 'vitest';
import type { FlyerCanvas, ReencodeDeps } from '@/modules/organiser/shared/flyerModel';
import { FLYER_MAX_EDGE, FLYER_TARGET_BYTES, reencodeFlyer } from '@/modules/organiser/shared/flyerModel';
import {
  PHOTO_BUCKET,
  PHOTO_BUCKET_LIMIT_BYTES,
  PHOTO_MAX_EDGE,
  PHOTO_PROBLEM_COPY,
  PHOTO_TARGET_BYTES,
  checkPhotoFile,
  photoObjectPath,
  reencodePhoto,
} from '../organiserPhotoModel';
import { uploadOrganiserPhoto } from '../organiserPhotoUploadApi';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

const OID = '0f8fad5b-d9cb-469f-a165-70867728950e';
// The path shape the organiser-photos INSERT policy is to admit (the contract).
const POLICY_PATH_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{32}\.(jpg|png|webp)$/;

const text = (s: string) => new TextEncoder().encode(s);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const file = (bytes: Uint8Array, type: string, name = 'x') => new File([bytes], name, { type });

function fakeDeps(sizeOf: (type: string, q: number, w: number) => number = () => 300_000, dims = { width: 4000, height: 3000 }) {
  const sizes: Array<[number, number]> = [];
  const deps: ReencodeDeps = {
    decode: async () => ({ ...dims, image: {} as CanvasImageSource }),
    createCanvas: (w, h) => {
      sizes.push([w, h]);
      const c: FlyerCanvas = {
        width: w, height: h,
        getContext: () => ({ fillStyle: '', fillRect: () => {}, clearRect: () => {}, drawImage: () => {} }),
        toBlob: (cb, type = 'image/png', q = 0.9) => cb(new Blob([new Uint8Array(sizeOf(type, q, c.width))], { type })),
      };
      return c;
    },
  };
  return { deps, sizes };
}

describe('checkPhotoFile', () => {
  it.each([
    ['a GIF', file(text('GIF89a'), 'image/gif'), 'type'],
    ['an SVG', file(text('<svg/>'), 'image/svg+xml'), 'type'],
    ['an empty file', file(new Uint8Array(), 'image/jpeg'), 'empty'],
    ['an SVG named and typed as a JPEG', file(text('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/jpeg', 'me.jpg'), 'not_image'],
    ['HTML typed as a PNG', file(text('  <html><script>x</script>'), 'image/png'), 'not_image'],
    ['a real JPEG', file(JPEG, 'image/jpeg'), null],
  ])('%s -> %s', async (_n, f, problem) => {
    expect(await checkPhotoFile(f)).toBe(problem);
  });
  it('refuses a file over 10 MB before reading it', async () => {
    const big = { type: 'image/jpeg', size: 10 * 1024 * 1024 + 1, slice: () => new Blob([JPEG]) } as unknown as File;
    expect(await checkPhotoFile(big)).toBe('too_big');
  });
});

describe('reencodePhoto (the photo\u2019s own limits; flyer unchanged)', () => {
  it('redraws to a 1200px long edge and stops at about 400 KB', async () => {
    const { deps, sizes } = fakeDeps((_t, q) => (q > 0.75 ? 600_000 : 350_000));
    const out = await reencodePhoto(file(JPEG, 'image/jpeg'), deps);
    expect(sizes[0]).toEqual([PHOTO_MAX_EDGE, 900]);
    expect(out.blob.size).toBeLessThanOrEqual(PHOTO_TARGET_BYTES);
    expect(out.mime).toBe('image/webp');
  });
  it('never returns more than the 2 MB bucket limit', async () => {
    const { deps } = fakeDeps(() => PHOTO_BUCKET_LIMIT_BYTES + 1);
    await expect(reencodePhoto(file(JPEG, 'image/jpeg'), deps)).rejects.toMatchObject({ problem: 'too_detailed' });
  });
  it('the flyer still uses its own 1600px / 1 MB defaults', async () => {
    const { deps, sizes } = fakeDeps(() => FLYER_TARGET_BYTES - 1);
    await reencodeFlyer(file(JPEG, 'image/jpeg'), deps);
    expect(sizes[0][0]).toBe(FLYER_MAX_EDGE);
  });
});

describe('photoObjectPath', () => {
  it('is <organiser_id>/<32 hex>.<ext>, never a user filename', () => {
    const p = photoObjectPath(OID.toUpperCase(), 'webp');
    expect(p).toMatch(POLICY_PATH_RE);
    expect(p.startsWith(`${OID}/`)).toBe(true);
    expect(photoObjectPath(OID, 'jpg')).not.toBe(photoObjectPath(OID, 'jpg'));
  });
  it('refuses a non-uuid id or a bad token', () => {
    expect(() => photoObjectPath('../x', 'jpg')).toThrow();
    expect(() => photoObjectPath(OID, 'jpg', 'nothex')).toThrow();
  });
  it('the bucket is organiser-photos', () => expect(PHOTO_BUCKET).toBe('organiser-photos'));
});

describe('uploadOrganiserPhoto', () => {
  const client = (result: { error: unknown }) => {
    const upload = vi.fn(async () => result);
    const getPublicUrl = vi.fn((path: string) => ({ data: { publicUrl: `https://proj.supabase.co/storage/v1/object/public/organiser-photos/${path}` } }));
    const from = vi.fn(() => ({ upload, getPublicUrl }));
    return { c: { storage: { from } } as never, upload, from };
  };

  it('uploads the re-encoded picture (no overwrite) and returns its public URL', async () => {
    const { c, upload, from } = client({ error: null });
    const url = await uploadOrganiserPhoto(OID, file(JPEG, 'image/jpeg'), { client: c, deps: fakeDeps().deps });
    expect(from).toHaveBeenCalledWith('organiser-photos');
    const [path, , opts] = upload.mock.calls[0] as unknown as [string, Blob, Record<string, unknown>];
    expect(path).toMatch(POLICY_PATH_RE);
    expect(opts).toMatchObject({ upsert: false, contentType: 'image/webp' });
    expect(url).toBe(`https://proj.supabase.co/storage/v1/object/public/organiser-photos/${path}`);
  });

  it.each([
    ['the policy refuses (not owner or manager)', { statusCode: '403', message: 'new row violates row-level security policy' }, PHOTO_PROBLEM_COPY.permission],
    ['the bucket does not exist yet', { statusCode: '404', message: 'Bucket not found' }, PHOTO_PROBLEM_COPY.upload],
    ['the network fails', new Error('Failed to fetch'), PHOTO_PROBLEM_COPY.upload],
  ])('%s -> plain copy', async (_n, error, copy) => {
    const { c } = client({ error });
    await expect(uploadOrganiserPhoto(OID, file(JPEG, 'image/jpeg'), { client: c, deps: fakeDeps().deps })).rejects.toThrow(copy);
  });

  it('an SVG dressed as a JPEG never reaches storage', async () => {
    const { c, upload } = client({ error: null });
    await expect(uploadOrganiserPhoto(OID, file(text('<svg/>'), 'image/jpeg'), { client: c })).rejects.toThrow(PHOTO_PROBLEM_COPY.not_image);
    expect(upload).not.toHaveBeenCalled();
  });

  it('every problem has plain copy', () => {
    for (const v of Object.values(PHOTO_PROBLEM_COPY)) expect(v).toMatch(/^[A-Z].+\.$/);
  });
});
