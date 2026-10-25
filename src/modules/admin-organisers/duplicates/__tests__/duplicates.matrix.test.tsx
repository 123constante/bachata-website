// @vitest-environment jsdom
/**
 * W3 possible duplicates: {none, one, dismissed, not_linked} x confirm {cancel, confirm}, plus A2 not
 * applied yet. Fixtures are A2's real answer shapes (bachata-admin claude/invite-a2-identity-join,
 * 20261205330000 / 20261205340000): a not_linked entry is never a pair. The pinned rule: nothing is sent before the second confirm -- no
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

const STUB = { organiser_id: 'o1', organiser_name: 'Sensual Vibes', login_profile_id: 'f1', login_label: 'Jinder', premade_profile_id: 'k1', premade_label: 'Papacito', kind: 'team_stub' };
const STUB2 = { ...STUB, login_profile_id: 'f2', login_label: 'Tom', premade_profile_id: 'k2', premade_label: 'Tom Reyes' };
const NL = { invite_id: 'i1', organiser_id: 'o1', organiser_name: 'Sensual Vibes', user_id: 'u9', person_profile_id: 'k9', person_label: 'Maria Lopez', attempted_at: '2026-10-22T10:00:00Z' };
const answer = (pairs: unknown[], notLinked: unknown[] = []) => ({
  healthy: pairs.length + notLinked.length === 0, count: pairs.length, pairs, not_linked_count: notLinked.length, not_linked: notLinked,
  dismissed_count: 0, measured_as: 'authenticated', checked_at: '2026-10-23T09:00:00Z',
});
const CHANGES = {
  changes: [{ kind: 'claim', text: '"Papacito" becomes the profile of the signed-in account; its pages and seats stay' }, { kind: 'archive', text: 'Archive the duplicate profile "Jinder" (kept, not deleted)' }],
  applied: false,
};
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
let notLinked: unknown[] = [];
beforeEach(() => {
  h.rpc.mockReset();
  notLinked = [];
  h.answers = {
    check_invitee_duplicates_v1: () => ({ data: answer(pairs, notLinked), error: null }),
    admin_join_duplicate_people_v1: () => ({ data: CHANGES, error: null }),
    admin_dismiss_invitee_duplicate_v1: () => ({ data: { ok: true, dismissed: true }, error: null }),
  };
  h.rpc.mockImplementation((fn: string, args: Record<string, unknown>) => {
    if (fn === 'admin_join_duplicate_people_v1' && args.p_dry_run === false) return Promise.resolve({ data: { changes: CHANGES.changes, applied: true }, error: null });
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

  it('counts pairs and paused not_linked joins; a paused join is its own row with no join button', async () => {
    pairs = [STUB];
    notLinked = [NL];
    mount();
    expect((await screen.findByTestId('dup-count')).textContent).toBe('2 possible duplicates');
    const rows = screen.getAllByTestId('dup-pair');
    expect(rows).toHaveLength(1);
    expect(rows[0].getAttribute('data-kind')).toBe('stub');
    expect(rows[0].textContent).toMatch(/Jinder signed up and is on the Sensual Vibes team list next to Papacito/);
    const paused = screen.getByTestId('dup-paused');
    expect(paused.textContent).toMatch(/^Maria Lopez tried to join Sensual Vibes; the join is paused\./);
    expect(paused.querySelectorAll('button')).toHaveLength(0);
  });

  it('only paused joins: counted, no Review anywhere, nothing can be sent', async () => {
    pairs = [];
    notLinked = [NL];
    mount();
    expect((await screen.findByTestId('dup-count')).textContent).toBe('1 possible duplicate');
    expect(screen.queryByTestId('dup-review')).toBeNull();
    expect(screen.queryByTestId('dup-paused-review')).toBeNull();
  });

  it('a paused join whose invited profile has a matching pair opens that pair', async () => {
    pairs = [STUB];
    notLinked = [{ ...NL, person_profile_id: 'k1', person_label: 'Papacito' }];
    mount();
    fireEvent.click(await screen.findByTestId('dup-paused-review'));
    expect(screen.getByTestId('dup-keep').textContent).toContain('Papacito');
    expect(screen.getByTestId('dup-fold').textContent).toContain('Jinder');
  });
});

const openReview = async (pair: unknown) => {
  pairs = [pair];
  mount();
  fireEvent.click(await screen.findByTestId('dup-review'));
  expect(screen.getByTestId('dup-same').textContent).toContain('Same person?');
};

describe.each([['one (stub)', STUB], ['second pair', STUB2]] as const)('%s', (_label, pair) => {
  it('confirm: same -> what will change (dry run only) -> second confirm -> Joined; one real run', async () => {
    await openReview(pair);
    expect(screen.getByTestId('dup-keep').textContent).toContain(pair.premade_label);
    expect(screen.getByTestId('dup-fold').textContent).toContain(pair.login_label);
    expect(calls('admin_join_duplicate_people_v1')).toHaveLength(0);
    fireEvent.click(screen.getByTestId('dup-show-changes'));
    expect((await screen.findByTestId('dup-change-list')).textContent).toContain('becomes the profile of the signed-in account');
    expect(dryRuns()[0][1]).toEqual({ p_keep_profile: pair.premade_profile_id, p_fold_profile: pair.login_profile_id, p_dry_run: true });
    fireEvent.click(screen.getByTestId('dup-join'));
    // First tap only asks.
    expect(screen.getByTestId('dup-confirm').textContent).toContain('Join these two into one?');
    await flush();
    expect(realRuns()).toHaveLength(0);
    pairs = [];
    fireEvent.click(screen.getByTestId('dup-confirm-yes'));
    expect((await screen.findByTestId('dup-joined')).textContent).toContain(`Joined. ${pair.premade_label} is one profile now`);
    expect(realRuns()).toHaveLength(1);
    expect(realRuns()[0][1]).toEqual({ p_keep_profile: pair.premade_profile_id, p_fold_profile: pair.login_profile_id, p_dry_run: false });
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
    expect(calls('admin_dismiss_invitee_duplicate_v1')).toHaveLength(0);
  });
});

describe('dismissed ("Not the same person")', () => {
  it.each(['cancel', 'confirm'] as const)('%s: hides the pair for good and never calls the join', async () => {
    await openReview(STUB);
    pairs = [];
    fireEvent.click(screen.getByTestId('dup-not-same'));
    await waitFor(() => expect(calls('admin_dismiss_invitee_duplicate_v1')).toHaveLength(1));
    expect(calls('admin_dismiss_invitee_duplicate_v1')[0][1]).toEqual({ p_profile_a: 'k1', p_profile_b: 'f1', p_dismiss: true });
    expect(await screen.findByTestId('dup-none')).toBeTruthy();
    expect(calls('admin_join_duplicate_people_v1')).toHaveLength(0);
  });

  it('a dismiss before A2 says so and changes nothing', async () => {
    await openReview(STUB);
    h.answers.admin_dismiss_invitee_duplicate_v1 = () => MISSING;
    fireEvent.click(screen.getByTestId('dup-not-same'));
    expect((await screen.findByTestId('dup-dismiss-error')).textContent).toMatch(/server update that is not applied yet/);
  });
});

describe('refusals on the change list', () => {
  it.each([
    ['keep_profile_archived', /has been archived/],
    ['two_real_logins', /two real people/],
    ['no_signed_in_login', /no one to give the profile to/],
    ['anonymous_login', /guest session/],
    ['keep_claimed_by_other', /belongs to a different login/],
    ['login_has_other_persona', /already owns a third profile/],
  ])('%s (dry run): the join stays off with its own plain-English line; nothing sent', async (code, copy) => {
    h.answers.admin_join_duplicate_people_v1 = () => ({ data: { changes: [], refused: code, applied: false }, error: null });
    await openReview(STUB);
    fireEvent.click(screen.getByTestId('dup-show-changes'));
    const line = (await screen.findByTestId('dup-dry-refused')).textContent ?? '';
    expect(line).toMatch(copy);
    expect(line).not.toContain(code);
    expect((screen.getByTestId('dup-join') as HTMLButtonElement).disabled).toBe(true);
    await flush();
    expect(realRuns()).toHaveLength(0);
  });

  it('already_done on the dry run: says they are one profile; the join stays off', async () => {
    h.answers.admin_join_duplicate_people_v1 = () => ({ data: { changes: [], already_done: true, applied: false }, error: null });
    await openReview(STUB);
    fireEvent.click(screen.getByTestId('dup-show-changes'));
    expect((await screen.findByTestId('dup-dry-refused')).textContent).toMatch(/already one profile/);
    expect((screen.getByTestId('dup-join') as HTMLButtonElement).disabled).toBe(true);
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
      Promise.resolve(fn === 'admin_join_duplicate_people_v1' && args.p_dry_run === false ? { data: { changes: [], refused: 'two_real_logins', applied: false }, error: null } : h.answers[fn]()));
    fireEvent.click(screen.getByTestId('dup-show-changes'));
    await screen.findByTestId('dup-change-list');
    fireEvent.click(screen.getByTestId('dup-join'));
    fireEvent.click(screen.getByTestId('dup-confirm-yes'));
    expect((await screen.findByTestId('dup-join-error')).textContent).toMatch(/never joins two used logins/);
    expect(screen.queryByTestId('dup-joined')).toBeNull();
  });
});

describe('parsers', () => {
  it('parseDuplicates: A2 object; keep = premade, fold = login, team_stub -> stub; drops half rows; no pairs list is null', () => {
    const out = parseDuplicates(answer([STUB], [NL]));
    expect(out?.pairs[0]).toEqual({ keepId: 'k1', keepName: 'Papacito', foldId: 'f1', foldName: 'Jinder', organiserId: 'o1', organiserName: 'Sensual Vibes', kind: 'stub' });
    expect(out?.notLinked[0]).toMatchObject({ inviteId: 'i1', personLabel: 'Maria Lopez', organiserName: 'Sensual Vibes', pair: null });
    expect(parseDuplicates(answer([STUB], [{ ...NL, person_profile_id: 'k1' }]))?.notLinked[0].pair?.foldId).toBe('f1');
    expect(parseDuplicates(answer([{ ...STUB, login_profile_id: null }, { ...STUB, kind: 'other' }, { ...STUB, login_profile_id: 'k1' }]))?.pairs).toEqual([]);
    expect(parseDuplicates(answer([], [{ ...NL, invite_id: null }]))?.notLinked).toEqual([]);
    expect(parseDuplicates([STUB])).toBeNull();
    expect(parseDuplicates(null)).toBeNull();
    expect(parseDuplicates({})).toBeNull();
  });
  it('parseDryRun / parseJoinResult', () => {
    expect(parseDryRun(CHANGES)).toEqual({ kind: 'changes', changes: CHANGES.changes });
    expect(parseDryRun({ changes: [], refused: 'two_real_logins', applied: false })).toEqual({ kind: 'refused', code: 'two_real_logins' });
    expect(parseDryRun({ changes: [], already_done: true, applied: false })).toEqual({ kind: 'refused', code: 'already_done' });
    expect(parseDryRun({})).toBeNull();
    expect(parseJoinResult({ changes: [], refused: 'keep_claimed_by_other', applied: false })).toEqual({ ok: false, code: 'keep_claimed_by_other' });
    expect(parseJoinResult({ changes: [], already_done: true, applied: false })).toEqual({ ok: true });
    expect(parseJoinResult({ changes: [], applied: true })).toEqual({ ok: true });
    expect(parseJoinResult(null)).toEqual({ ok: false, code: 'error' });
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

// A profile with no first name comes back as the literal "(no name)"; every shape of "no name" must read
// as "no name yet" on every screen, never as the raw text or "Unnamed profile".
const NONAME_SHAPES: [string, unknown][] = [['literal (no name)', '(no name)'], ['empty', ''], ['whitespace', '   '], ['null', null], ['missing', undefined]];
const BAD = /\(no name\)|unnamed profile|undefined|null/i;

describe.each(NONAME_SHAPES)('nameless label shape: %s', (_shape, label) => {
  const keepless = { ...STUB, premade_label: label };
  const foldless = { ...STUB, login_label: label };
  const both = { ...STUB, premade_label: label, login_label: label };

  it.each([['keep side', keepless], ['fold side', foldless], ['both sides', both]] as const)('%s: no screen shows the raw text', async (_s, pair) => {
    notLinked = [{ ...NL, person_profile_id: pair.premade_profile_id, person_label: label }];
    pairs = [pair];
    mount();
    const row = await screen.findByTestId('dup-pair');
    expect(row.textContent).not.toMatch(BAD);
    expect(row.textContent).toMatch(/team list next to .+, a profile you made\.(Review)?$/);
    if (pair.premade_label === label) expect(row.textContent).toContain('next to a profile with no name yet, a profile you made.');
    if (pair.login_label === label) expect(row.textContent).toMatch(/^Someone who signed up is on the Sensual Vibes team list/);
    const paused = screen.getByTestId('dup-paused');
    expect(paused.textContent).not.toMatch(BAD);
    expect(paused.textContent).toMatch(/^Someone tried to join Sensual Vibes; the join is paused\./);
    fireEvent.click(screen.getByTestId('dup-review'));
    expect(screen.getByTestId('dup-same').textContent).not.toMatch(BAD);
    expect(screen.getByTestId('dup-same').textContent).toMatch(/one profile( with no name yet)?[:,]/);
    h.answers.admin_join_duplicate_people_v1 = () => ({ data: { changes: [{ kind: 'claim', text: '"(no name)" becomes the profile of the signed-in account' }, { kind: 'archive', text: 'Archive the duplicate profile "(no name)"' }], applied: false }, error: null });
    fireEvent.click(screen.getByTestId('dup-show-changes'));
    const list = await screen.findByTestId('dup-change-list');
    expect(list.textContent).not.toMatch(BAD);
    expect(list.textContent).toContain('The profile with no name yet becomes the profile');
    fireEvent.click(screen.getByTestId('dup-join'));
    expect(screen.getByTestId('dup-confirm').textContent).not.toMatch(BAD);
    h.rpc.mockImplementation((fn: string, args: Record<string, unknown>) =>
      Promise.resolve(fn === 'admin_join_duplicate_people_v1' && args.p_dry_run === false ? { data: { changes: [], applied: true }, error: null } : h.answers[fn]()));
    fireEvent.click(screen.getByTestId('dup-confirm-yes'));
    const joined = (await screen.findByTestId('dup-joined')).textContent ?? '';
    expect(joined).not.toMatch(BAD);
    if (pair.premade_label === label) expect(joined).toBe('Joined. This profile has no name yet and is one profile now, owned by their login.Close');
  });

  it('a paused join whose pair has a nameless fold reads grammatically', async () => {
    pairs = [foldless];
    notLinked = [{ ...NL, person_profile_id: 'k1', person_label: 'Papacito' }];
    mount();
    expect((await screen.findByTestId('dup-paused')).textContent).toContain('It matches the pair with someone who signed up: review it to join them.');
  });
});

describe('ordering', () => {
  it('pairs with a nameless side go last, stable otherwise', () => {
    const a = { ...STUB, login_profile_id: 'a', premade_profile_id: 'a2', premade_label: '(no name)' };
    const b = { ...STUB, login_profile_id: 'b', premade_profile_id: 'b2' };
    const c = { ...STUB, login_profile_id: 'c', premade_profile_id: 'c2', login_label: '(no name)' };
    const d = { ...STUB, login_profile_id: 'd', premade_profile_id: 'd2' };
    expect(parseDuplicates(answer([a, b, c, d]))?.pairs.map((p) => p.foldId)).toEqual(['b', 'd', 'a', 'c']);
  });
});
