// @vitest-environment jsdom
/**
 * W3 possible duplicates: {none, one, dismissed, not_linked} x confirm {cancel, confirm}, plus A2 not
 * applied yet. The pinned rule: nothing is sent before the second confirm -- no
 * admin_join_duplicate_people_v1 call with p_dry_run=false until "Yes, join them" is tapped.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

type Answer = { data: unknown; error: { message: string; code?: string } | null };
const h = vi.hoisted(() => ({ rpc: vi.fn(), answers: {} as Record<string, () => Answer> }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: h.rpc } }));

import { DuplicatesAlert } from '../DuplicatesAlert';
import { isMissingRpc, parseDryRun, parseDuplicates, parseJoinResult } from '../duplicatesModel';

const STUB = { keep_profile_id: 'k1', keep_name: 'Papacito', fold_profile_id: 'f1', fold_name: 'Jinder', organiser_name: 'Sensual Vibes', kind: 'stub', keep_facts: ['Made by you 15 Apr', 'Photo, DJ role'], fold_facts: ['Made at sign-up 22 Oct'] };
const PAUSED = { ...STUB, keep_profile_id: 'k2', fold_profile_id: 'f2', keep_name: 'Tom Reyes', fold_name: 'Tom', kind: 'not_linked' };
const CHANGES = { changes: [{ kind: 'claim', text: 'His login now owns the Papacito profile.' }, { kind: 'retire', text: 'The empty Jinder profile is retired.' }] };
const MISSING = { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.check_invitee_duplicates_v1' } };

const calls = (fn: string) => h.rpc.mock.calls.filter((c) => c[0] === fn);
const realRuns = () => calls('admin_join_duplicate_people_v1').filter((c) => c[1].p_dry_run === false);
const dryRuns = () => calls('admin_join_duplicate_people_v1').filter((c) => c[1].p_dry_run === true);

/** Lets any queued mutation reach the rpc mock before a 'nothing was sent' assertion. */
const flush = () => new Promise((r) => setTimeout(r, 20));

const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <DuplicatesAlert />
    </QueryClientProvider>,
  );

let pairs: unknown[] = [];
beforeEach(() => {
  h.rpc.mockReset();
  h.answers = {
    check_invitee_duplicates_v1: () => ({ data: pairs, error: null }),
    admin_join_duplicate_people_v1: () => ({ data: CHANGES, error: null }),
    admin_dismiss_duplicate_pair_v1: () => ({ data: null, error: null }),
  };
  h.rpc.mockImplementation((fn: string, args: Record<string, unknown>) => {
    if (fn === 'admin_join_duplicate_people_v1' && args.p_dry_run === false) return Promise.resolve({ data: { ok: true }, error: null });
    return Promise.resolve(h.answers[fn]?.() ?? { data: null, error: { message: 'unexpected' } });
  });
});
afterEach(cleanup);

describe('the admin-home alert', () => {
  it('A2 not applied (RPC missing): "available soon" with the reason, and no button that cannot work', async () => {
    h.answers.check_invitee_duplicates_v1 = () => MISSING;
    mount();
    const box = await screen.findByTestId('dup-unavailable');
    expect(box.textContent).toMatch(/available soon/);
    expect(box.textContent).toMatch(/server update .* not applied yet/);
    expect(box.querySelectorAll('button')).toHaveLength(0);
  });

  it('none: says so and what happens next', async () => {
    pairs = [];
    mount();
    expect((await screen.findByTestId('dup-none')).textContent).toMatch(/No possible duplicates/);
  });

  it('a load failure says what to do, with Try again', async () => {
    h.answers.check_invitee_duplicates_v1 = () => ({ data: null, error: { message: 'network' } });
    mount();
    expect((await screen.findByTestId('dup-load-error')).textContent).toMatch(/Try again/);
  });

  it('counts pairs, includes paused not_linked joins', async () => {
    pairs = [STUB, PAUSED];
    mount();
    expect((await screen.findByTestId('dup-count')).textContent).toBe('2 possible duplicates');
    const rows = screen.getAllByTestId('dup-pair');
    expect(rows.map((r) => r.getAttribute('data-kind'))).toEqual(['stub', 'not_linked']);
    expect(rows[0].textContent).toMatch(/Jinder signed up and is on the Sensual Vibes team list next to Papacito/);
    expect(rows[1].textContent).toMatch(/join is paused/);
  });
});

const openReview = async (pair: unknown) => {
  pairs = [pair];
  mount();
  fireEvent.click(await screen.findByTestId('dup-review'));
  expect(screen.getByTestId('dup-same').textContent).toContain('Same person?');
};

describe.each([['one (stub)', STUB], ['not_linked', PAUSED]] as const)('%s', (_label, pair) => {
  it('confirm: same -> what will change (dry run only) -> second confirm -> Joined; one real run', async () => {
    await openReview(pair);
    expect(screen.getByTestId('dup-keep').textContent).toContain(pair.keep_name);
    expect(screen.getByTestId('dup-fold').textContent).toContain(pair.fold_name);
    expect(calls('admin_join_duplicate_people_v1')).toHaveLength(0);
    fireEvent.click(screen.getByTestId('dup-show-changes'));
    expect((await screen.findByTestId('dup-change-list')).textContent).toContain('His login now owns the Papacito profile.');
    expect(dryRuns()[0][1]).toEqual({ p_keep_profile: pair.keep_profile_id, p_fold_profile: pair.fold_profile_id, p_dry_run: true });
    fireEvent.click(screen.getByTestId('dup-join'));
    // First tap only asks.
    expect(screen.getByTestId('dup-confirm').textContent).toContain('Join these two into one?');
    await flush();
    expect(realRuns()).toHaveLength(0);
    pairs = [];
    fireEvent.click(screen.getByTestId('dup-confirm-yes'));
    expect((await screen.findByTestId('dup-joined')).textContent).toContain(`Joined. ${pair.keep_name} is one profile now`);
    expect(realRuns()).toHaveLength(1);
    expect(realRuns()[0][1]).toEqual({ p_keep_profile: pair.keep_profile_id, p_fold_profile: pair.fold_profile_id, p_dry_run: false });
    // The live re-check no longer lists the pair; "Joined" stays until Close (found in the build walk).
    await waitFor(() => expect(calls('check_invitee_duplicates_v1').length).toBeGreaterThan(1));
    await flush();
    expect(screen.getByTestId('dup-joined')).toBeTruthy();
    fireEvent.click(screen.getByTestId('dup-close'));
    expect(await screen.findByTestId('dup-none')).toBeTruthy();
  });

  it('cancel at the second confirm: nothing sent, back on the change list', async () => {
    await openReview(pair);
    fireEvent.click(screen.getByTestId('dup-show-changes'));
    await screen.findByTestId('dup-change-list');
    fireEvent.click(screen.getByTestId('dup-join'));
    fireEvent.click(screen.getByTestId('dup-confirm-cancel'));
    expect(screen.queryByTestId('dup-confirm')).toBeNull();
    expect(screen.getByTestId('dup-change-list')).toBeTruthy();
    fireEvent.click(screen.getByTestId('dup-back'));
    expect(screen.getByTestId('dup-same')).toBeTruthy();
    await flush();
    expect(realRuns()).toHaveLength(0);
    expect(calls('admin_dismiss_duplicate_pair_v1')).toHaveLength(0);
  });
});

describe('dismissed ("Not the same person")', () => {
  it.each(['cancel', 'confirm'] as const)('%s: hides the pair for good and never calls the join', async () => {
    await openReview(STUB);
    pairs = [];
    fireEvent.click(screen.getByTestId('dup-not-same'));
    await waitFor(() => expect(calls('admin_dismiss_duplicate_pair_v1')).toHaveLength(1));
    expect(calls('admin_dismiss_duplicate_pair_v1')[0][1]).toEqual({ p_keep_profile: 'k1', p_fold_profile: 'f1' });
    expect(await screen.findByTestId('dup-none')).toBeTruthy();
    expect(calls('admin_join_duplicate_people_v1')).toHaveLength(0);
  });

  it('a dismiss before A2 says so and changes nothing', async () => {
    await openReview(STUB);
    h.answers.admin_dismiss_duplicate_pair_v1 = () => MISSING;
    fireEvent.click(screen.getByTestId('dup-not-same'));
    expect((await screen.findByTestId('dup-dismiss-error')).textContent).toMatch(/server update that is not applied yet/);
  });
});

describe('refusals on the change list', () => {
  it('both_signed_in: the join stays off with the reason; nothing sent', async () => {
    h.answers.admin_join_duplicate_people_v1 = () => ({ data: { changes: [], refused: 'both_signed_in' }, error: null });
    await openReview(STUB);
    fireEvent.click(screen.getByTestId('dup-show-changes'));
    expect((await screen.findByTestId('dup-dry-refused')).textContent).toMatch(/two real people/);
    expect((screen.getByTestId('dup-join') as HTMLButtonElement).disabled).toBe(true);
    expect(realRuns()).toHaveLength(0);
  });

  it('an empty change list: the join is off with a reason', async () => {
    h.answers.admin_join_duplicate_people_v1 = () => ({ data: { changes: [] }, error: null });
    await openReview(STUB);
    fireEvent.click(screen.getByTestId('dup-show-changes'));
    expect((await screen.findByTestId('dup-join-blocked')).textContent).toMatch(/nothing to join/);
    expect((screen.getByTestId('dup-join') as HTMLButtonElement).disabled).toBe(true);
  });

  it('a refused real run shows the reason and stays on the confirm', async () => {
    await openReview(STUB);
    h.rpc.mockImplementation((fn: string, args: Record<string, unknown>) =>
      Promise.resolve(fn === 'admin_join_duplicate_people_v1' && args.p_dry_run === false ? { data: { refused: 'both_signed_in' }, error: null } : h.answers[fn]()));
    fireEvent.click(screen.getByTestId('dup-show-changes'));
    await screen.findByTestId('dup-change-list');
    fireEvent.click(screen.getByTestId('dup-join'));
    fireEvent.click(screen.getByTestId('dup-confirm-yes'));
    expect((await screen.findByTestId('dup-join-error')).textContent).toMatch(/never joins two used logins/);
    expect(screen.queryByTestId('dup-joined')).toBeNull();
  });
});

describe('parsers', () => {
  it('parseDuplicates: array or {pairs}; drops half rows and unknown kinds; non-list is null', () => {
    expect(parseDuplicates([STUB])?.[0]).toMatchObject({ keepId: 'k1', foldId: 'f1', kind: 'stub', keepFacts: ['Made by you 15 Apr', 'Photo, DJ role'] });
    expect(parseDuplicates({ pairs: [PAUSED] })?.[0].kind).toBe('not_linked');
    expect(parseDuplicates([{ ...STUB, fold_profile_id: null }, { ...STUB, kind: 'other' }, { ...STUB, fold_profile_id: 'k1' }])).toEqual([]);
    expect(parseDuplicates(null)).toBeNull();
    expect(parseDuplicates({})).toBeNull();
  });
  it('parseDryRun / parseJoinResult', () => {
    expect(parseDryRun(CHANGES)).toEqual({ kind: 'changes', changes: CHANGES.changes });
    expect(parseDryRun({ changes: [], refused: 'both_signed_in' })).toEqual({ kind: 'refused', code: 'both_signed_in' });
    expect(parseDryRun({})).toBeNull();
    expect(parseJoinResult({ refused: 'already_joined' })).toEqual({ ok: false, code: 'already_joined' });
    expect(parseJoinResult(null)).toEqual({ ok: true });
  });
  it('isMissingRpc: PGRST202, 42883, 404, the PostgREST message; not other errors', () => {
    expect(isMissingRpc({ code: 'PGRST202' })).toBe(true);
    expect(isMissingRpc({ code: '42883' })).toBe(true);
    expect(isMissingRpc({ status: 404 })).toBe(true);
    expect(isMissingRpc({ message: 'Could not find the function public.x' })).toBe(true);
    expect(isMissingRpc({ code: 'P0001', message: 'not_admin' })).toBe(false);
    expect(isMissingRpc(null)).toBe(false);
  });
});
