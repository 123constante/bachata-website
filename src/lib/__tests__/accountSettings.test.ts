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
  it('is exactly DELETE, case-sensitive, no padding', () => {
    expect(ERASE_CONFIRM_WORD).toBe('DELETE');
    expect(canConfirmErase('DELETE')).toBe(true);
    for (const bad of ['', 'delete', 'Delete', 'DELETE ', ' DELETE', 'DELET', 'DELETEE']) {
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

  it('sends confirm DELETE and maps 200', async () => {
    h.invoke.mockResolvedValue({ data: { ok: true }, error: null });
    expect(await eraseAccount()).toEqual({ kind: 'erased' });
    expect(h.invoke).toHaveBeenCalledWith('account-erase', { body: { confirm: 'DELETE' } });
  });
  it('maps 409 blockers', async () => {
    h.invoke.mockResolvedValue(httpError(409, { ok: false, code: 'sole_organiser_owner', blockers: [{ entity_id: 'o1', name: 'A' }] }));
    expect(await eraseAccount()).toEqual({ kind: 'blocked', code: 'sole_organiser_owner', blockers: [{ entity_id: 'o1', name: 'A' }] });
  });
  it('maps media_delete_failed to try-again (nothing erased)', async () => {
    h.invoke.mockResolvedValue(httpError(500, { ok: false, code: 'media_delete_failed' }));
    expect(await eraseAccount()).toEqual({ kind: 'media_failed' });
  });
  it('maps 422 and anything unreadable to failed', async () => {
    h.invoke.mockResolvedValue(httpError(422, { ok: false, code: 'confirm_required' }));
    expect(await eraseAccount()).toEqual({ kind: 'failed' });
    h.invoke.mockResolvedValue({ data: null, error: { name: 'FunctionsFetchError', message: 'offline' } });
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
