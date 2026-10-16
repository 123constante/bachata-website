/**
 * CONTRACT: the RPC names, JSON keys and codes lib/accountDeletion and
 * lib/accountSettings read, pinned against the admin repo's #820 SQL
 * (123constante/bachata-admin, branch claude/account-system-db). Renaming one
 * here without the SQL (or the SQL without this) is exactly what must go red.
 *
 * Sources (the LAST migration defining a function wins):
 *  - _account_deletion_status_v1: supabase/migrations/20261122140000_account_delete_hide_v1.sql:41-59
 *    keys state / requested_at / restore_until (lines 50, 52-55); states none|pending|expired (47, 53).
 *  - my_account_deletion_status_v1: same file :227-243 (returns _account_deletion_status_v1).
 *  - my_account_restore_v1: 20261122210000_account_delete_hide_review_fixes_v1.sql:129-169
 *    status || {restored, code}; codes no_self_delete (151), restore_window_closed (155),
 *    admin_archived (159), success restored:true code NULL (166).
 *  - my_account_delete_v1: 20261122310000_account_delete_hide_takeover_v1.sql:123-191
 *    refusals admin_account / sole_organiser_owner (via _account_erase_refusal_v1) / already_archived / rate_limited.
 *  - account-erase edge function: supabase/functions/account-erase/handler.ts:25-33 (STATUS_BY_CODE),
 *    :50 (blockers only for sole_organiser_owner), :77 ({ ok: true, hidden: true, deletion }).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { classifyRestore, parseDeletionStatus } from '../accountDeletion';
import { DELETE_REFUSAL_CODES, classifyErase } from '../accountSettings';

const src = (f: string) => readFileSync(path.resolve(__dirname, '..', f), 'utf8');

describe('RPC names', () => {
  it.each([
    ['accountDeletion.ts', 'my_account_deletion_status_v1'],
    ['accountDeletion.ts', 'my_account_restore_v1'],
    ['accountSettings.ts', 'my_account_erase_check_v1'],
    ['accountSettings.ts', '"account-erase"'],
  ])('%s calls %s', (file, name) => expect(src(file)).toContain(name));
});

describe('status keys (20261122140000:50-55)', () => {
  // Literal copies of the two jsonb_build_object shapes.
  const NONE_SQL = { state: 'none', requested_at: null, restore_until: null };
  const LIVE_SQL = { state: 'pending', requested_at: '2026-10-01T10:00:00+00:00', restore_until: '2026-10-31T10:00:00+00:00' };
  it('parses exactly the SQL keys', () => {
    expect(parseDeletionStatus(NONE_SQL)).toEqual(NONE_SQL);
    expect(parseDeletionStatus(LIVE_SQL)).toEqual(LIVE_SQL);
    expect(parseDeletionStatus({ ...LIVE_SQL, state: 'expired' })?.state).toBe('expired');
  });
  it('a renamed key is not silently read', () => {
    expect(parseDeletionStatus({ status: 'pending' })).toBeNull();
    expect(parseDeletionStatus({ state: 'pending', deleted_at: 'x' })?.requested_at).toBeNull();
  });
});

describe('restore codes (20261122210000:151-166)', () => {
  it.each([
    [{ restored: true, code: null }, 'restored'],
    [{ restored: false, code: 'no_self_delete' }, 'nothing_to_restore'],
    [{ restored: false, code: 'restore_window_closed' }, 'window_closed'],
    [{ restored: false, code: 'admin_archived' }, 'admin_archived'],
  ])('%o -> %s', (extra, kind) => expect(classifyRestore({ state: 'none', requested_at: null, restore_until: null, ...extra }).kind).toBe(kind));
});

describe('delete refusal codes (handler.ts STATUS_BY_CODE)', () => {
  it('the four refusals the Website names, nothing else', () => {
    expect([...DELETE_REFUSAL_CODES].sort()).toEqual(['admin_account', 'already_archived', 'rate_limited', 'sole_organiser_owner']);
  });
  it('success body keys ok / hidden (handler.ts:77)', () => {
    expect(classifyErase({ ok: true, hidden: true })).toEqual({ kind: 'hidden' });
  });
  it('blockers ride only on sole_organiser_owner (handler.ts:50)', () => {
    const b = [{ entity_id: 'o', name: 'N' }];
    expect(classifyErase({ ok: false, code: 'sole_organiser_owner', blockers: b })).toEqual({ kind: 'refused', code: 'sole_organiser_owner', blockers: b });
  });
});
