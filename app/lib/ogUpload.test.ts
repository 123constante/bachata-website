import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadJpeg } from './ogUpload';

const opts = (fetchImpl: typeof fetch, serviceKey: string | undefined = 'svc-key') => ({ supabaseUrl: 'https://x.supabase.co', serviceKey: serviceKey as string, fetchImpl });
const res = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
type Call = [string, RequestInit];

afterEach(() => vi.restoreAllMocks());

describe('og bake uploadJpeg (server caller)', () => {
  it('signs with the service key as bearer and apikey', async () => {
    const f = vi.fn(async () => res(401, { ok: false, reason: 'no_account' }));
    await uploadJpeg('p.jpg', Buffer.from('x'), opts(f as unknown as typeof fetch));
    const init = (f.mock.calls[0] as unknown as Call)[1];
    const h = init.headers as Record<string, string>;
    expect(h.Authorization).toBe('Bearer svc-key');
    expect(h.apikey).toBe('svc-key');
  });

  it('PUTs with exactly the Content-Type it asked to sign', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(res(200, { ok: true, uploadUrl: 'https://r2/put', publicUrl: 'https://cdn/a.jpg' }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    await uploadJpeg('a.jpg', Buffer.from('x'), opts(f as unknown as typeof fetch));
    const [signUrl, signInit] = f.mock.calls[0] as Call;
    const [putUrl, putInit] = f.mock.calls[1] as Call;
    const signedType = JSON.parse(signInit.body as string).contentType;
    expect(signUrl).toContain('/functions/v1/storage-sign-upload');
    expect(putUrl).toBe('https://r2/put');
    expect((putInit.headers as Record<string, string>)['Content-Type']).toBe(signedType);
    expect(signedType).toBe('image/jpeg');
  });

  it.each([['', 'empty'], [undefined, 'undefined']])('missing service key (%s) logs loudly, returns null, calls nothing', async (key) => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const f = vi.fn();
    expect(await uploadJpeg('p.jpg', Buffer.from('x'), { supabaseUrl: 'https://x.supabase.co', serviceKey: key as string, fetchImpl: f as unknown as typeof fetch })).toBeNull();
    expect(f).not.toHaveBeenCalled();
    expect(err).toHaveBeenCalledWith(expect.stringContaining('SUPABASE_SERVICE_ROLE_KEY is not set'));
  });

  it('never logs the key', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const f = vi.fn(async () => res(401, { ok: false, reason: 'no_account' }));
    await uploadJpeg('p.jpg', Buffer.from('x'), opts(f as unknown as typeof fetch));
    expect(JSON.stringify(err.mock.calls)).not.toContain('svc-key');
  });

  it.each([[401, 'no_account'], [403, 'not_owner'], [422, 'type_not_allowed']])(
    'sign %i logs status + reason loudly and returns null', async (status, reason) => {
      const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const f = vi.fn(async () => res(status, { ok: false, reason }));
      expect(await uploadJpeg('p.jpg', Buffer.from('x'), opts(f as unknown as typeof fetch))).toBeNull();
      expect(err).toHaveBeenCalledWith(expect.stringContaining(`status=${status} reason=${reason}`));
    });

  it('returns the server publicUrl, not one derived from path', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(res(200, { ok: true, uploadUrl: 'https://r2/put', publicUrl: 'https://cdn/server-chosen.jpg' }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    expect(await uploadJpeg('mine.jpg', Buffer.from('x'), opts(f as unknown as typeof fetch))).toBe('https://cdn/server-chosen.jpg');
  });
});
