import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));

import { uploadToR2 } from './uploadToR2';
import { validateImageFile, SVG_REJECTED_MESSAGE } from './upload-validation';

const png = () => new File([new Uint8Array(4)], 'a.png', { type: 'image/png' });
const httpError = (status: number) => ({ name: 'FunctionsHttpError', message: 'Edge Function returned a non-2xx status code', context: { status } });

const ROLES = ['admin', 'dancer', 'vendor', 'organiser member'] as const;

describe('uploadToR2 (storage-sign-upload outcomes)', () => {
  beforeEach(() => {
    invoke.mockReset();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  describe.each(ROLES)('%s', (_role) => {
    it('stores the RETURNED publicUrl, not one built from the sent path', async () => {
      invoke.mockResolvedValue({ data: { ok: true, uploadUrl: 'https://r2/put', publicUrl: 'https://cdn/avatars/u/uid/2026/10/abc.png' }, error: null });
      const url = await uploadToR2(png(), 'avatars', 'sent-path.png');
      expect(url).toBe('https://cdn/avatars/u/uid/2026/10/abc.png');
      expect(url).not.toContain('sent-path');
    });

    it.each([
      [401, /sign in again/i],
      [403, /permission/i],
      [422, /JPG, PNG or WebP/],
    ])('status %i becomes plain English', async (status, re) => {
      invoke.mockResolvedValue({ data: null, error: httpError(status) });
      const err = await uploadToR2(png(), 'images', 'p.png').catch((e) => e);
      expect(err.message).toMatch(re);
      expect(err.message).not.toMatch(/non-2xx/);
    });
  });

  it('anon (401) never PUTs to R2', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(401) });
    await uploadToR2(png(), 'images', 'p.png').catch(() => undefined);
    expect(fetch).not.toHaveBeenCalled();
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
