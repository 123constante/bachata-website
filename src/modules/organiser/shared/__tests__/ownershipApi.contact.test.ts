/**
 * Arc PR 3 review: fetchContactSettings must THROW on an answer that carries none of
 * the four contact keys (null, a non-object, an empty object). Returning a "ready"
 * all-empty result would make the next save blank the stored phone and flip the flag.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ answer: { data: null, error: null } as { data: unknown; error: { message: string } | null } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: async () => h.answer } }));

import { fetchContactSettings } from '../ownershipApi';

beforeEach(() => {
  h.answer = { data: null, error: null };
});

describe('fetchContactSettings', () => {
  it.each([
    ['null data', null],
    ['a string', 'nope'],
    ['an array', []],
    ['an empty object', {}],
    ['an object with none of the four keys', { something: 'else' }],
  ])('throws on %s with no error', async (_name, data) => {
    h.answer = { data, error: null };
    await expect(fetchContactSettings('o1')).rejects.toThrow();
  });

  it('throws the RPC error', async () => {
    h.answer = { data: null, error: { message: 'permission_denied' } };
    await expect(fetchContactSettings('o1')).rejects.toBeTruthy();
  });

  it('keeps a valid object with some keys null working', async () => {
    h.answer = { data: { contact_email: null, contact_phone: null, show_contact_publicly: false, claim_email: null }, error: null };
    await expect(fetchContactSettings('o1')).resolves.toEqual({
      contact_email: null, contact_phone: null, show_contact_publicly: false, claim_email: null,
    });
    h.answer = { data: { contact_phone: '0113 000' }, error: null };
    await expect(fetchContactSettings('o1')).resolves.toMatchObject({ contact_phone: '0113 000', show_contact_publicly: false });
  });
});
