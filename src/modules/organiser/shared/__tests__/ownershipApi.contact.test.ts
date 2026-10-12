/**
 * Arc PR 3 review: fetchContactSettings must THROW on an answer that carries none of
 * the four contact keys (null, a non-object, an empty object). Returning a "ready"
 * all-empty result would make the next save blank the stored phone and flip the flag.
 *
 * Contact split (admin PR #771): the read carries show_phone_publicly and
 * show_email_publicly. The RPC before #771 carries only the legacy
 * show_contact_publicly: both flags then take that value (never a crash).
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
      contact_email: null, contact_phone: null, show_phone_publicly: false, show_email_publicly: false, claim_email: null,
    });
    h.answer = { data: { contact_phone: '0113 000' }, error: null };
    await expect(fetchContactSettings('o1')).resolves.toMatchObject({ contact_phone: '0113 000', show_phone_publicly: false, show_email_publicly: false });
  });

  it('reads the two split flags (admin #771), each on its own', async () => {
    h.answer = { data: { contact_email: 'a@x.example', contact_phone: '0113 000', show_phone_publicly: true, show_email_publicly: false, show_contact_publicly: true, claim_email: null }, error: null };
    await expect(fetchContactSettings('o1')).resolves.toEqual({
      contact_email: 'a@x.example', contact_phone: '0113 000', show_phone_publicly: true, show_email_publicly: false, claim_email: null,
    });
  });

  it.each([true, false])('legacy payload with only show_contact_publicly = %s: both flags take it', async (v) => {
    h.answer = { data: { contact_email: 'a@x.example', contact_phone: '0113 000', show_contact_publicly: v, claim_email: null }, error: null };
    await expect(fetchContactSettings('o1')).resolves.toMatchObject({ show_phone_publicly: v, show_email_publicly: v });
  });

  it('a non-boolean flag is never read as public', async () => {
    h.answer = { data: { contact_phone: '0113 000', show_phone_publicly: 'true', show_email_publicly: 1 }, error: null };
    await expect(fetchContactSettings('o1')).resolves.toMatchObject({ show_phone_publicly: false, show_email_publicly: false });
  });
});
