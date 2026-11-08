// @vitest-environment jsdom
/**
 * "Join two people": two-profile search -> existing preview (dry run) -> existing second confirm.
 * Fixtures are synthetic ids with the SHAPES of the Florian case (pre-made, no login vs sign-up stub); no live client.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: h.rpc } }));

import { JoinTwoPeople } from '../JoinTwoPeople';
import { JOIN_REFUSAL_COPY } from '../duplicatesCopy';
import { JOIN_TWO_COPY } from '../joinTwoCopy';
import { pairFrom, toCandidate } from '../joinSearchApi';

const row = (o: Record<string, unknown>) => ({ id: 'x', first_name: null, surname: null, display_name: null, claimed_by: null, archived_at: null, roles: [], ...o });
const PREMADE = row({ id: 'p-premade', first_name: 'Flor', surname: 'Premade', roles: ['organiser'] });
const STUB = row({ id: 'p-stub', first_name: 'Flori', claimed_by: 'u-1', roles: ['organiser'] });
const ARCHIVED = row({ id: 'p-arch', first_name: 'Flora', archived_at: '2026-01-01T00:00:00Z' });
const CHANGES = { changes: [{ kind: 'claim', text: 'Flor Premade becomes the profile of the signed-in account' }], applied: false };

let people: Record<string, unknown>[] = [];
let searchError = false;
let dry: unknown = CHANGES;
let real: unknown = { applied: true, changes: CHANGES.changes };

const calls = (fn: string) => h.rpc.mock.calls.filter((c) => c[0] === fn);
const joinCalls = () => calls('admin_join_duplicate_people_v1');

const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <JoinTwoPeople />
    </QueryClientProvider>,
  );

beforeEach(() => {
  h.rpc.mockReset();
  people = [PREMADE, STUB, ARCHIVED];
  searchError = false;
  dry = CHANGES;
  real = { applied: true, changes: CHANGES.changes };
  h.rpc.mockImplementation((fn: string, args: Record<string, unknown>) => {
    if (fn === 'admin_search_people_v1') return Promise.resolve(searchError ? { data: null, error: { message: 'network' } } : { data: people, error: null });
    if (fn === 'admin_join_duplicate_people_v1') return Promise.resolve({ data: args.p_dry_run === true ? dry : real, error: null });
    return Promise.resolve({ data: null, error: { message: 'unexpected' } });
  });
});
afterEach(cleanup);

const search = async (slot: 'keep' | 'fold', text: string) => {
  fireEvent.change(screen.getByTestId(`join-${slot}-input`), { target: { value: text } });
  await screen.findAllByTestId(`join-${slot}-result`, undefined, { timeout: 2000 });
};
const pick = async (slot: 'keep' | 'fold', index: number) => {
  fireEvent.click((await screen.findAllByTestId(`join-${slot}-result`))[index]);
  await screen.findByTestId(`join-${slot}-chosen`);
};
const chooseBoth = async () => {
  await search('keep', 'flor');
  await pick('keep', 0);
  await search('fold', 'flor');
  await pick('fold', 1);
};

describe('untouched', () => {
  it('sends no RPC at all, and the button is disabled with its reason', () => {
    mount();
    expect(h.rpc).not.toHaveBeenCalled();
    expect((screen.getByTestId('join-see') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('join-reason').textContent).toBe(JOIN_TWO_COPY.needTwo);
  });
  it('one letter is not a query', async () => {
    mount();
    fireEvent.change(screen.getByTestId('join-keep-input'), { target: { value: 'f' } });
    await new Promise((r) => setTimeout(r, 450));
    expect(h.rpc).not.toHaveBeenCalled();
  });
});

describe('search states', () => {
  it('zero results says what to try', async () => {
    people = [];
    mount();
    fireEvent.change(screen.getByTestId('join-keep-input'), { target: { value: 'zzzz' } });
    expect((await screen.findByTestId('join-keep-empty', undefined, { timeout: 2000 })).textContent).toMatch(/Try the first name or the Instagram/);
  });
  it('a search error says what to do and offers Try again', async () => {
    searchError = true;
    mount();
    fireEvent.change(screen.getByTestId('join-keep-input'), { target: { value: 'flor' } });
    const box = await screen.findByTestId('join-keep-error', undefined, { timeout: 2000 });
    expect(box.textContent).toMatch(/Try again/);
  });
  it('shows login and archived facts per result', async () => {
    mount();
    await search('keep', 'flor');
    const t = screen.getAllByTestId('join-keep-result').map((b) => b.textContent);
    expect(t[0]).toContain('No login');
    expect(t[1]).toContain('Has a login');
    expect(t[2]).toContain('Archived');
  });
});

describe('two different people', () => {
  it('the same person twice is not selectable in the other box and the button stays disabled with a reason', async () => {
    mount();
    await search('keep', 'flor');
    await pick('keep', 0);
    await search('fold', 'flor');
    const first = screen.getAllByTestId('join-fold-result')[0] as HTMLButtonElement;
    expect(first.disabled).toBe(true);
    expect(first.textContent).toMatch(/Already chosen in the other box/);
    expect((screen.getByTestId('join-see') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('join-reason').textContent).toBe(JOIN_TWO_COPY.needTwo);
  });
  it('pairFrom: same id or a missing side gives no pair; otherwise keep/fold map to keepId/foldId', () => {
    const a = toCandidate(PREMADE as never);
    const b = toCandidate(STUB as never);
    expect(pairFrom(a, a)).toBeNull();
    expect(pairFrom(a, null)).toBeNull();
    expect(pairFrom(a, b)).toMatchObject({ keepId: 'p-premade', foldId: 'p-stub', keepName: 'Flor Premade', foldName: 'Flori' });
  });
});

describe('preview then confirm', () => {
  it('Florian shape: preview is a dry run only, shows the list, and the real run waits for the second confirm', async () => {
    mount();
    await chooseBoth();
    fireEvent.click(screen.getByTestId('join-see'));
    expect((await screen.findByTestId('dup-change-list')).textContent).toMatch(/becomes the profile/);
    expect(joinCalls().length).toBeGreaterThan(0);
    expect(joinCalls().every((c) => c[1].p_dry_run === true)).toBe(true);
    expect(joinCalls()[0][1]).toMatchObject({ p_keep_profile: 'p-premade', p_fold_profile: 'p-stub' });
    fireEvent.click(screen.getByTestId('dup-join'));
    await new Promise((r) => setTimeout(r, 30));
    expect(joinCalls().every((c) => c[1].p_dry_run === true)).toBe(true);
    fireEvent.click(screen.getByTestId('dup-confirm-yes'));
    await screen.findByTestId('dup-joined');
    const real = joinCalls().filter((c) => c[1].p_dry_run === false);
    expect(real).toHaveLength(1);
    expect(real[0][1]).toMatchObject({ p_keep_profile: 'p-premade', p_fold_profile: 'p-stub' });
  });
  it('swap changes which record stays', async () => {
    mount();
    await chooseBoth();
    fireEvent.click(screen.getByTestId('join-swap'));
    fireEvent.click(screen.getByTestId('join-see'));
    await screen.findByTestId('dup-changes');
    expect(joinCalls()[0][1]).toMatchObject({ p_keep_profile: 'p-stub', p_fold_profile: 'p-premade' });
  });
  it('after a successful join both slots are cleared and the duplicates list is refetched', async () => {
    mount();
    await chooseBoth();
    fireEvent.click(screen.getByTestId('join-see'));
    await screen.findByTestId('dup-change-list');
    fireEvent.click(screen.getByTestId('dup-join'));
    fireEvent.click(screen.getByTestId('dup-confirm-yes'));
    await screen.findByTestId('dup-joined');
    fireEvent.click(screen.getByTestId('dup-close'));
    await waitFor(() => expect(screen.getByTestId('join-keep-input')).toBeTruthy());
    expect(screen.getByTestId('join-fold-input')).toBeTruthy();
    expect((screen.getByTestId('join-see') as HTMLButtonElement).disabled).toBe(true);
  });
  it('Back from the preview returns to the block with the choices kept', async () => {
    mount();
    await chooseBoth();
    fireEvent.click(screen.getByTestId('join-see'));
    await screen.findByTestId('dup-changes');
    fireEvent.click(screen.getByTestId('dup-back'));
    expect(screen.getByTestId('join-keep-chosen')).toBeTruthy();
    expect((screen.getByTestId('join-see') as HTMLButtonElement).disabled).toBe(false);
  });
  it('an empty change list blocks the join and says why', async () => {
    dry = { changes: [], applied: false };
    mount();
    await chooseBoth();
    fireEvent.click(screen.getByTestId('join-see'));
    expect((await screen.findByTestId('dup-join-blocked')).textContent).toMatch(/nothing to join/);
    expect((screen.getByTestId('dup-join') as HTMLButtonElement).disabled).toBe(true);
    expect(joinCalls().every((c) => c[1].p_dry_run === true)).toBe(true);
  });
  it('already done (idempotent answer) is shown as a refusal and cannot be confirmed', async () => {
    dry = { changes: [], applied: false, already_done: true };
    mount();
    await chooseBoth();
    fireEvent.click(screen.getByTestId('join-see'));
    expect((await screen.findByTestId('dup-dry-refused')).textContent).toBe(JOIN_REFUSAL_COPY.already_done);
    expect((screen.getByTestId('dup-join') as HTMLButtonElement).disabled).toBe(true);
  });
  it('an archived result can be previewed and the server refusal copy is shown', async () => {
    dry = { refused: 'keep_profile_archived' };
    mount();
    await search('keep', 'flor');
    await pick('keep', 2);
    await search('fold', 'flor');
    await pick('fold', 0);
    fireEvent.click(screen.getByTestId('join-see'));
    expect((await screen.findByTestId('dup-dry-refused')).textContent).toBe(JOIN_REFUSAL_COPY.keep_profile_archived);
  });
});

describe('one mapping from refusal code to copy', () => {
  const CODES = ['two_real_logins', 'no_signed_in_login', 'anonymous_login', 'keep_claimed_by_other', 'login_has_other_persona', 'keep_profile_archived', 'already_done'];
  it.each(CODES)('%s shows its own copy in the preview and offers no confirm', async (code) => {
    dry = { refused: code };
    mount();
    await chooseBoth();
    fireEvent.click(screen.getByTestId('join-see'));
    const msg = (await screen.findByTestId('dup-dry-refused')).textContent;
    expect(msg).toBe(JOIN_REFUSAL_COPY[code]);
    expect(msg).not.toMatch(/Something went wrong/);
    expect((screen.getByTestId('dup-join') as HTMLButtonElement).disabled).toBe(true);
  });
  it('no refusal copy or block copy points at a control that is not on screen', () => {
    const named = ['Show what will change', 'Review', 'Join into one profile'];
    const all = [...Object.values(JOIN_REFUSAL_COPY), ...Object.values(JOIN_TWO_COPY)];
    for (const text of all) {
      for (const label of named) if (text.includes(label)) throw new Error(`"${text}" points at "${label}"`);
    }
    // Copy that names a control must name one the block renders.
    mount();
    expect(screen.getByTestId('join-see').textContent).toBe(JOIN_TWO_COPY.see);
    expect(screen.getByTestId('join-swap').textContent).toBe(JOIN_TWO_COPY.swap);
    expect(JOIN_TWO_COPY.searchFailed).toMatch(new RegExp(JOIN_TWO_COPY.retry));
  });
});
