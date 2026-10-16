/**
 * lib/accountDeletion: delete = hide (admin PR #820). Table-driven over every
 * status x code shape the RPCs return: none / pending / expired / malformed,
 * each restore code, each delete refusal code, and a network error.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: (fn: string) => h.rpc(fn) }));

import {
  classifyRestore,
  deletionLanding,
  fetchDeletionStatus,
  parseDeletionStatus,
  restoreAccount,
  type DeletionStatus,
  type RestoreOutcome,
} from '../accountDeletion';
import { deleteRefusalMessage, formatDeletedOn, restoreMessage } from '../accountDeletionCopy';
import { DELETE_REFUSAL_CODES } from '../accountSettings';

const NONE = { state: 'none', requested_at: null, restore_until: null };
const PENDING = { state: 'pending', requested_at: '2026-10-01T10:00:00+00:00', restore_until: '2026-10-31T10:00:00+00:00' };
const EXPIRED = { state: 'expired', requested_at: '2026-08-01T10:00:00+00:00', restore_until: '2026-08-31T10:00:00+00:00' };

beforeEach(() => h.rpc.mockReset());

describe('deletionLanding: one reading of the status', () => {
  const ROWS: Array<[string, unknown, ReturnType<typeof deletionLanding>]> = [
    ['none', NONE, null],
    ['pending', PENDING, 'restore'],
    ['expired', EXPIRED, 'deleted-card'],
    ['unknown state', { ...PENDING, state: 'erased' }, null],
    ['no state key', { requested_at: PENDING.requested_at }, null],
    ['null (failed read)', null, null],
    ['a string', 'pending', null],
  ];
  it.each(ROWS)('%s', (_n, raw, want) => {
    expect(deletionLanding(parseDeletionStatus(raw))).toBe(want);
  });
  it('undefined (not read yet) is null, never a guess', () => expect(deletionLanding(undefined)).toBeNull());
});

describe('fetchDeletionStatus', () => {
  it.each([
    ['none', NONE],
    ['pending', PENDING],
    ['expired', EXPIRED],
  ])('%s parses', async (_n, data) => {
    h.rpc.mockResolvedValue({ data, error: null });
    expect(await fetchDeletionStatus()).toEqual(data as DeletionStatus);
    expect(h.rpc).toHaveBeenCalledWith('my_account_deletion_status_v1');
  });
  it('an RPC error throws (the caller treats it as unknown)', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'not_signed_in' } });
    await expect(fetchDeletionStatus()).rejects.toBeTruthy();
  });
});

describe('restoreAccount: every my_account_restore_v1 code', () => {
  const ROWS: Array<[string, { data: unknown; error: unknown }, RestoreOutcome['kind'], RegExp]> = [
    ['restored', { data: { ...NONE, restored: true, code: null }, error: null }, 'restored', /Welcome back, your account is restored/],
    ['admin_archived', { data: { ...PENDING, restored: false, code: 'admin_archived' }, error: null }, 'admin_archived', /An admin has hidden this profile.*contact us/i],
    ['restore_window_closed', { data: { ...EXPIRED, restored: false, code: 'restore_window_closed' }, error: null }, 'window_closed', /30 days/],
    ['no_self_delete', { data: { ...NONE, restored: false, code: 'no_self_delete' }, error: null }, 'nothing_to_restore', /not hidden/],
    ['unknown code', { data: { restored: false, code: 'later_code' }, error: null }, 'failed', /try again/i],
    ['RPC error', { data: null, error: { message: 'boom' } }, 'failed', /try again/i],
  ];
  it.each(ROWS)('%s', async (_n, res, kind, words) => {
    h.rpc.mockResolvedValue(res);
    const out = await restoreAccount();
    expect(out.kind).toBe(kind);
    expect(restoreMessage(out)).toMatch(words);
    expect(h.rpc.mock.calls).toEqual([['my_account_restore_v1']]);
  });
  it('network error (the call throws): failed, with retry words', async () => {
    h.rpc.mockImplementationOnce(async () => {
      throw new TypeError('Failed to fetch');
    });
    const out = await restoreAccount();
    expect(out).toEqual({ kind: 'failed' });
    expect(restoreMessage(out)).toMatch(/try again/i);
  });
  it('window_closed carries the date the deleted card names', () => {
    const out = classifyRestore({ ...EXPIRED, restored: false, code: 'restore_window_closed' });
    expect(out).toEqual({ kind: 'window_closed', status: EXPIRED });
  });
});

describe('deleteRefusalMessage: one message per code', () => {
  it('every refusal code has its own words, and none is the generic one', () => {
    const generic = deleteRefusalMessage(null);
    const texts = DELETE_REFUSAL_CODES.map((c) => deleteRefusalMessage(c));
    expect(new Set(texts).size).toBe(DELETE_REFUSAL_CODES.length);
    for (const t of texts) expect(t).not.toBe(generic);
    expect(generic).toMatch(/try again/i);
    expect(deleteRefusalMessage('delete_failed')).toBe(generic);
  });
  it('no message promises an erase', () => {
    for (const c of [...DELETE_REFUSAL_CODES, null]) {
      expect(deleteRefusalMessage(c)).not.toMatch(/erased|permanent|cannot be undone|photos are gone/i);
    }
  });
});

describe('formatDeletedOn', () => {
  it.each([
    ['2026-08-01T10:00:00+00:00', '1 August 2026'],
    ['2026-03-29T23:30:00+00:00', '30 March 2026'], // London is BST that night
    [null, null],
    ['not a date', null],
  ])('%s', (iso, want) => expect(formatDeletedOn(iso)).toBe(want));
});
