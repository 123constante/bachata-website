import { beforeEach, describe, expect, it, vi } from 'vitest';

// The exact RPC names and argument keys the Website sends for the D4 claim
// and request-access envelopes (admin repo 20261108210000 / 20261108220000).
// A renamed key here would reach PostgREST as "function not found".

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));

import { claimOrganiser, requestOrganiserAccess } from '../selfServeApi';

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
