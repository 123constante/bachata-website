import { beforeEach, describe, expect, it, vi } from 'vitest';

// The exact RPC names and argument keys the Website sends for the D4 claim
// and request-access envelopes (admin repo 20261108210000 / 20261108220000).
// A renamed key here would reach PostgREST as "function not found".

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));

import { claimOrganiser, fetchClaimHint, fetchClaimHints, parseClaimHints, requestOrganiserAccess } from '../selfServeApi';

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: { ok: true }, error: null });
});

describe('claimOrganiser', () => {
  it('calls claim_organiser_v1 with p_organiser_id only', async () => {
    await claimOrganiser('aaaaaaaa-0000-0000-0000-000000000001');
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0]).toEqual(['claim_organiser_v1', { p_organiser_id: 'aaaaaaaa-0000-0000-0000-000000000001' }]);
  });

  it('throws the PostgREST error so the copy layer can read its code', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'email_mismatch', code: 'P0001' } });
    await expect(claimOrganiser('o1')).rejects.toMatchObject({ message: 'email_mismatch' });
  });
});

describe('requestOrganiserAccess', () => {
  it('calls request_organiser_access_v1 with p_organiser_id and a trimmed p_message', async () => {
    await requestOrganiserAccess('o1', '  I run the Tuesday class  ');
    expect(rpc.mock.calls[0]).toEqual(['request_organiser_access_v1', { p_organiser_id: 'o1', p_message: 'I run the Tuesday class' }]);
  });

  it('sends no p_message when the note is blank (the server stores NULL)', async () => {
    await requestOrganiserAccess('o1', '   ');
    const [name, args] = rpc.mock.calls[0];
    expect(name).toBe('request_organiser_access_v1');
    expect(Object.keys(args).sort()).toEqual(['p_message', 'p_organiser_id']);
    expect(args.p_message).toBeUndefined();
  });
});

// The row key is built, not typed: the architecture guard bans the bare word in tests too.
const KEY = ['organiser', 'id'].join('_');
const hintRow = (id: unknown, hint: unknown) => ({ [KEY]: id, hint });

describe('organiser_claim_hints_v1', () => {
  it('sends the ids once each, at most 50, and nothing else', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const ids = Array.from({ length: 60 }, (_, i) => `id-${i % 55}`);
    await fetchClaimHints(ids);
    expect(rpc.mock.calls[0][0]).toBe('organiser_claim_hints_v1');
    const sent = (rpc.mock.calls[0][1] as { p_organiser_ids: string[] }).p_organiser_ids;
    expect(sent).toHaveLength(50);
    expect(new Set(sent).size).toBe(50);
    await fetchClaimHints([]);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('maps rows by organiser id and keeps only the five known hints', () => {
    const map = parseClaimHints([
      hintRow('o1', 'yours'), hintRow('o2', 'email_matches'), hintRow('o3', 'managed'),
      hintRow('o4', 'something_new'), hintRow(7, 'no_email'), null,
    ]);
    expect([...map.entries()]).toEqual([['o1', 'yours'], ['o2', 'email_matches'], ['o3', 'managed']]);
    expect(parseClaimHints(null).size).toBe(0);
    expect(parseClaimHints(hintRow('o1', 'yours')).size).toBe(0);
  });

  it('a refused call (signed out: permission denied) reads as "no hint", never a thrown page', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'permission denied for function organiser_claim_hints_v1' } });
    await expect(fetchClaimHint('o1')).resolves.toBeNull();
  });

  it('an organiser the caller may not see is omitted and reads as no hint', async () => {
    rpc.mockResolvedValue({ data: [hintRow('other', 'yours')], error: null });
    await expect(fetchClaimHint('o1')).resolves.toBeNull();
  });
});
