import { beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.fn(async (..._args: unknown[]) => ({ data: {}, error: null as unknown }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));

import { deleteOwnPhoto, keyFromPublicUrl } from '../photoFlow';

const UID = 'u-123';
const OWN = `https://cdn.example/avatars/u/${UID}/2026/10/abc.jpg`;

type Row = { name: string; url: string | null; uid: string; sent: { keys: string[] } | null };
const rows: Row[] = [
  { name: 'own-prefix URL -> keys sent', url: OWN, uid: UID, sent: { keys: [`avatars/u/${UID}/2026/10/abc.jpg`] } },
  { name: 'admin/legacy URL (no /u/<uid>/) -> nothing', url: 'https://cdn.example/avatars/legacy/old.jpg', uid: UID, sent: null },
  { name: "another user's prefix -> nothing", url: 'https://cdn.example/avatars/u/u-999/2026/10/abc.jpg', uid: UID, sent: null },
  { name: 'uid that is only a prefix of the path uid -> nothing', url: 'https://cdn.example/avatars/u/u-1234/x.jpg', uid: UID, sent: null },
  { name: 'other bucket under own uid -> nothing', url: `https://cdn.example/images/u/${UID}/x.jpg`, uid: UID, sent: null },
  { name: 'malformed URL -> nothing', url: 'not a url', uid: UID, sent: null },
  { name: 'first photo (no old URL) -> nothing', url: null, uid: UID, sent: null },
];

describe('deleteOwnPhoto request shape (storage-delete-object takes { keys: string[] } only)', () => {
  beforeEach(() => invoke.mockClear());
  it.each(rows)('$name', async ({ url, uid, sent }) => {
    await deleteOwnPhoto(url as string, uid);
    if (sent) {
      expect(invoke).toHaveBeenCalledTimes(1);
      expect(invoke).toHaveBeenCalledWith('storage-delete-object', { body: sent });
    } else {
      expect(invoke).not.toHaveBeenCalled();
    }
  });
  it('keyFromPublicUrl returns the pathname minus the leading slash, else null', () => {
    expect(keyFromPublicUrl(OWN, UID)).toBe(`avatars/u/${UID}/2026/10/abc.jpg`);
    expect(keyFromPublicUrl('https://cdn.example/avatars/u/other/x.jpg', UID)).toBeNull();
  });
  it('a function error still throws (the flow swallows it)', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: new Error('boom') });
    await expect(deleteOwnPhoto(OWN, UID)).rejects.toThrow('boom');
  });
});
