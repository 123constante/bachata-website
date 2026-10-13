import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadJpeg } from './ogUpload';

const opts = (fetchImpl: typeof fetch) => ({ supabaseUrl: 'https://x.supabase.co', anonKey: 'anon', fetchImpl });
const res = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

afterEach(() => vi.restoreAllMocks());

describe('og bake uploadJpeg', () => {
  it('signs with the ANON key (present behaviour; 401 after admin #793)', async () => {
    const f = vi.fn(async () => res(401, { ok: false, reason: 'no_account' }));
    await uploadJpeg('p.jpg', Buffer.from('x'), opts(f as unknown as typeof fetch));
    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer anon');
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
