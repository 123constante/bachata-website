import { describe, expect, it, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  invoke: vi.fn(),
}));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: (...a: unknown[]) => h.rpc(...a) }));
vi.mock('@/integrations/supabase/getSupabase', () => ({
  getSupabase: async () => ({ functions: { invoke: (...a: unknown[]) => h.invoke(...a) } }),
}));

import {
  ERASE_CONFIRM_WORD,
  canConfirmErase,
  eraseAccount,
  eraseCheckFact,
  exportFileName,
  fetchAccountExport,
  fetchEraseCheck,
  setProfileDisabled,
} from '../accountSettings';

beforeEach(() => {
  h.rpc.mockReset();
  h.invoke.mockReset();
});

describe('erase confirmation word', () => {
  // L19: stray spaces are ignored (a phone keyboard adds one); the capitals are still required.
  it('is DELETE, case-sensitive, ignoring surrounding spaces', () => {
    expect(ERASE_CONFIRM_WORD).toBe('DELETE');
    for (const ok of ['DELETE', 'DELETE ', ' DELETE']) expect(canConfirmErase(ok), JSON.stringify(ok)).toBe(true);
    for (const bad of ['', 'delete', 'Delete', 'DELET', 'DELETEE', 'DE LETE']) {
      expect(canConfirmErase(bad), JSON.stringify(bad)).toBe(false);
    }
  });
});

describe('exportFileName', () => {
  it('is bachata-calendar-my-data-YYYY-MM-DD.json', () => {
    expect(exportFileName(new Date(2026, 9, 3))).toBe('bachata-calendar-my-data-2026-10-03.json');
  });
});

describe('RPC wrappers', () => {
  it('export passes the RPC result through, including a null profile', async () => {
    const data = { exported_at: 'x', email: 'a@b.co', profile: null, roles: {}, ratings: [], attendance: [] };
    h.rpc.mockResolvedValue({ data, error: null });
    expect(await fetchAccountExport()).toEqual(data);
    expect(h.rpc).toHaveBeenCalledWith('my_account_export_v1');
  });

  it('disable sends p_disabled and returns the new state; error message is the code', async () => {
    h.rpc.mockResolvedValue({ data: { disabled: true }, error: null });
    expect(await setProfileDisabled(true)).toEqual({ ok: true, disabled: true });
    expect(h.rpc).toHaveBeenCalledWith('my_profile_disable_v1', { p_disabled: true });
    h.rpc.mockResolvedValue({ data: null, error: { message: 'no_profile' } });
    expect(await setProfileDisabled(false)).toEqual({ ok: false, code: 'no_profile' });
    h.rpc.mockResolvedValue({ data: null, error: { message: 'fetch failed' } });
    expect(await setProfileDisabled(false)).toEqual({ ok: false, code: 'failed' });
  });

  it('erase check throws on error, returns the shape otherwise', async () => {
    h.rpc.mockResolvedValue({ data: { can_erase: false, blockers: [{ entity_id: 'o1', name: 'Salsa Nights' }], code: 'sole_organiser_owner' }, error: null });
    expect((await fetchEraseCheck()).blockers[0].name).toBe('Salsa Nights');
    h.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(fetchEraseCheck()).rejects.toBeTruthy();
  });
});

describe('eraseAccount (edge function account-erase)', () => {
  const httpError = (status: number, body: unknown) => ({
    data: null,
    error: { name: 'FunctionsHttpError', message: 'non-2xx', context: new Response(JSON.stringify(body), { status }) },
  });

  // Delete = hide (admin PR #820, account-erase handler.ts STATUS_BY_CODE): every response shape.
  const B = [{ entity_id: 'o1', name: 'A' }];
  const SHAPES: Array<[string, unknown, unknown]> = [
    ['200 hidden', { data: { ok: true, hidden: true, deletion: { state: 'pending' } }, error: null }, { kind: 'hidden' }],
    ['200 from the old erasing deploy (ok only)', { data: { ok: true }, error: null }, { kind: 'hidden' }],
    ['403 admin_account', httpError(403, { ok: false, code: 'admin_account' }), { kind: 'refused', code: 'admin_account', blockers: [] }],
    ['409 sole_organiser_owner + blockers', httpError(409, { ok: false, code: 'sole_organiser_owner', blockers: B }), { kind: 'refused', code: 'sole_organiser_owner', blockers: B }],
    ['409 already_archived', httpError(409, { ok: false, code: 'already_archived' }), { kind: 'refused', code: 'already_archived', blockers: [] }],
    ['429 rate_limited', httpError(429, { ok: false, code: 'rate_limited' }), { kind: 'refused', code: 'rate_limited', blockers: [] }],
    ['409 with no code is NOT a refusal', httpError(409, { ok: false }), { kind: 'failed' }],
    ['500 delete_failed', httpError(500, { ok: false, code: 'delete_failed' }), { kind: 'failed' }],
    ['500 media_delete_failed (old deploy)', httpError(500, { ok: false, code: 'media_delete_failed' }), { kind: 'failed' }],
    ['401 not_authenticated', httpError(401, { ok: false, code: 'not_authenticated' }), { kind: 'failed' }],
    ['422 confirm_required', httpError(422, { ok: false, code: 'confirm_required' }), { kind: 'failed' }],
    ['network error', { data: null, error: { name: 'FunctionsFetchError', message: 'offline' } }, { kind: 'failed' }],
  ];
  it.each(SHAPES)('%s', async (_n, response, expected) => {
    h.invoke.mockResolvedValue(response);
    expect(await eraseAccount()).toEqual(expected);
    expect(h.invoke).toHaveBeenCalledWith('account-erase', { body: { confirm: 'DELETE' } });
  });
  it('a thrown invoke is failed', async () => {
    h.invoke.mockRejectedValue(new Error('boom'));
    expect(await eraseAccount()).toEqual({ kind: 'failed' });
  });
});

describe('eraseCheckFact: one reading of the check, used by every screen', () => {
  it('can erase', () => expect(eraseCheckFact({ can_erase: true, blockers: [], code: null }).kind).toBe('can_erase'));
  it('admin', () => {
    const f = eraseCheckFact({ can_erase: false, blockers: [], code: 'admin_account' });
    expect(f.kind).toBe('admin');
    expect(f.text).toMatch(/admin/i);
  });
  it('sole owner names the pages and what to do', () => {
    const f = eraseCheckFact({ can_erase: false, blockers: [{ entity_id: '1', name: 'Salsa Nights' }, { entity_id: '2', name: 'Late Club' }], code: 'sole_organiser_owner' });
    expect(f.kind).toBe('sole_owner');
    expect(f.blockerNames).toEqual(['Salsa Nights', 'Late Club']);
    expect(f.text).toMatch(/another owner/i);
    expect(f.text).toMatch(/remove the page/i);
  });
  it('cannot erase with an unknown code still blocks', () =>
    expect(eraseCheckFact({ can_erase: false, blockers: [], code: null }).kind).toBe('blocked_unknown'));
});
