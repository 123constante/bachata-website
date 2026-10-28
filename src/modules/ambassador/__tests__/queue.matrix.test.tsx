// @vitest-environment jsdom
/** Ambassador A1 (option B): every screen x every shape from the mockup switcher. New code, so no unfixed-code run exists. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SHAPES, agoIso, hundred, newestFirst, row, twelve } from './fixtures';
import { BATH, BRISTOL, Page, USER_ID, answer, from, h, pinNow } from './harness';
import AmbassadorQueuePage from '../AmbassadorQueuePage';
import { decisionError, loadErrorKind, moreText } from '../ambassadorModel';

vi.mock('@/integrations/supabase/client', async () => {
  const { h, from } = await import('./harness');
  return { supabase: { rpc: (fn: string, args?: Record<string, unknown>) => h.rpc(fn, args), from } };
});
vi.mock('@/hooks/useAuth', async () => {
  const { USER_ID } = await import('./harness');
  return { useAuth: () => ({ user: { id: USER_ID } }) };
});
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/layout/GlobalLayout', () => ({
  default: ({ children, breadcrumbs }: { children: ReactNode; breadcrumbs?: { label: string }[] }) => (
    <div data-testid="layout" data-crumbs={(breadcrumbs ?? []).map((b) => b.label).join('>')}>{children}</div>
  ),
}));

const decisions = () => h.rpc.mock.calls.filter(([fn]) => /approve_entity|reject_entity/.test(fn as string));
const open = (path = '/ambassador') => Page({ Component: AmbassadorQueuePage, path });
const settle = () => new Promise((r) => setTimeout(r, 25));
const rows = () => screen.queryAllByTestId('queue-row');

beforeEach(() => {
  pinNow();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  h.rpc.mockReset();
  h.members = [{ entity_id: BRISTOL.id }];
  h.membersError = null;
  h.reads = [];
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const listCalls = () => h.rpc.mock.calls.filter(([fn]) => fn === 'admin_list_pending_review_v1');
const reachDecision = async (raw = SHAPES.one) => {
  await waitFor(() => expect(rows()).toHaveLength(1));
  fireEvent.click(rows()[0]);
  fireEvent.click(await screen.findByTestId('approve-open'));
  fireEvent.click(await screen.findByTestId('approve-confirm'));
  return raw;
};

describe('list screen x queue shapes', () => {
  it('12 items: oldest first, count 12, oldest-waiting bar, no RPC decision on open', async () => {
    answer({ list: newestFirst(twelve()) });
    open();
    await waitFor(() => expect(rows()).toHaveLength(12));
    expect(rows()[0].textContent).toContain('Thursday Bachata at The Lantern');
    expect(screen.getByTestId('queue-count').textContent).toBe('12');
    expect(screen.getByTestId('age-bar').textContent).toBe('Oldest waiting 9 days · oldest first');
    expect(decisions()).toHaveLength(0);
  });

  it('asks for the scope city, page size 100, offset 0, no target-type filter', async () => {
    answer({ list: [] });
    open();
    await screen.findByTestId('queue-empty');
    const call = h.rpc.mock.calls.find(([fn]) => fn === 'admin_list_pending_review_v1');
    expect(call?.[1]).toEqual({ p_city_id: 'c-bristol', p_limit: 100, p_offset: 0 });
  });

  it('1 item: count 1, singular day text', async () => {
    answer({ list: [SHAPES.one] });
    open();
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(screen.getByTestId('age-bar').textContent).toContain('1 day');
    expect(screen.getByTestId('age-bar').textContent).not.toContain('1 days');
  });

  it('0 items: says all caught up and what to do, no count', async () => {
    answer({ list: [] });
    open();
    const e = await screen.findByTestId('queue-empty');
    expect(e.textContent).toContain('All caught up');
    expect(e.textContent).toContain('nothing needs you');
    expect(screen.queryByTestId('queue-count')).toBeNull();
    expect(within(e).getByRole('link', { name: 'Back to the site' })).toBeTruthy();
  });

  it('9-day-old item: amber chip with the warning mark; a fresh one has neither', async () => {
    answer({ list: newestFirst([SHAPES.series13, SHAPES.today]) });
    open();
    await waitFor(() => expect(rows()).toHaveLength(2));
    const [old, fresh] = screen.getAllByTestId('age-chip');
    expect(old.textContent).toBe('\u26A0 Waiting 9 days');
    expect(old.getAttribute('data-old')).toBe('true');
    expect(fresh.textContent).toBe('Waiting since today');
    expect(fresh.getAttribute('data-old')).toBe('false');
  });

  it('a list of exactly 100 says there may be more and pages with p_offset (never silently capped)', async () => {
    answer({ list: [], pages: { 0: hundred(), 100: [row('x1', 'Page two organiser', { ago: 8 })] } });
    open();
    await waitFor(() => expect(rows()).toHaveLength(100));
    expect(screen.getByTestId('queue-more').textContent).toContain('This shows the first 100 in Bristol. There may be more');
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    await waitFor(() => expect(rows()).toHaveLength(101));
    expect(rows()[0].textContent).toContain('Page two organiser'); // re-sorted oldest first across pages
    expect(screen.queryByTestId('queue-more')).toBeNull();
    expect(h.rpc.mock.calls.some(([fn, a]) => fn === 'admin_list_pending_review_v1' && (a as { p_offset: number }).p_offset === 100)).toBe(true);
  });

  it('99 rows do not claim there is more', async () => {
    answer({ list: hundred().slice(0, 99) });
    open();
    await waitFor(() => expect(rows()).toHaveLength(99));
    expect(screen.queryByTestId('queue-more')).toBeNull();
  });

  it('very long name is clamped in the row and shown in full on the review', async () => {
    answer({ list: [SHAPES.longName] });
    open();
    await waitFor(() => expect(rows()).toHaveLength(1));
    fireEvent.click(rows()[0]);
    expect((await screen.findByRole('heading', { level: 2 })).textContent).toBe(SHAPES.longName.name);
  });

  it('loading: skeleton, no empty state, no count', async () => {
    h.rpc.mockImplementation(() => new Promise(() => undefined));
    open();
    expect(await screen.findByTestId('queue-loading')).toBeTruthy();
    expect(screen.queryByTestId('queue-empty')).toBeNull();
  });

  it('error: says nothing was changed, Try again reloads', async () => {
    answer({ list: new Error('boom') });
    open();
    const e = await screen.findByTestId('queue-error');
    expect(e.textContent).toContain('Nothing has been approved or rejected');
    answer({ list: [SHAPES.one] });
    fireEvent.click(within(e).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(rows()).toHaveLength(1));
  });

  it('no ambassador rows: calm no-access state with something to do, and the queue is never requested', async () => {
    h.members = [];
    answer({ list: [SHAPES.one] });
    open();
    const e = await screen.findByTestId('queue-no-access');
    expect(e.textContent).toContain('ask an admin');
    // no copy pointing at a control that is not there
    expect(e.textContent).not.toContain('signed in with the right account');
    expect(within(e).getByRole('link', { name: 'Back to the site' })).toBeTruthy();
    expect(listCalls()).toHaveLength(0);
  });

  it('scope read error is a retryable error, not "no access"', async () => {
    h.membersError = { message: 'Failed to fetch' };
    answer({ list: [SHAPES.one] });
    open();
    expect(await screen.findByTestId('queue-error')).toBeTruthy();
    expect(screen.queryByTestId('queue-no-access')).toBeNull();
  });
});

describe('access: the city list comes from entity_members, never the manager-scope table', () => {
  it('Bristol ambassador row: reads own city-ambassador rows, then the city, then the Bristol queue', async () => {
    answer({ list: [SHAPES.one] });
    open();
    await waitFor(() => expect(rows()).toHaveLength(1));
    const [members, cities] = h.reads;
    expect(members).toMatchObject({ table: 'entity_members', eq: { entity_type: 'city', member_role: 'ambassador', user_id: USER_ID } });
    expect(cities).toMatchObject({ table: 'cities', in: { id: [BRISTOL.id] } });
    expect(listCalls().map(([, a]) => (a as { p_city_id: string }).p_city_id)).toEqual([BRISTOL.id]);
    expect(h.rpc.mock.calls.some(([fn]) => fn === 'admin_get_my_city_scopes')).toBe(false);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Bristol');
  });

  it.each(['admin_only', 'not_authorized', 'not_authorised'])('list RPC refuses with %s: no-access state, not "check your connection"', async (code) => {
    answer({ list: new Error(code) });
    open();
    const e = await screen.findByTestId('queue-no-access');
    expect(e.textContent).not.toContain(code);
    expect(screen.queryByTestId('queue-error')).toBeNull();
    expect(document.body.textContent).not.toContain('Check your connection');
  });

  it.each(['authentication_required', 'JWT expired'])('list RPC says %s: signed-out state with a Sign in link back here', async (code) => {
    answer({ list: new Error(code) });
    open();
    const e = await screen.findByTestId('queue-signed-out');
    expect(within(e).getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/auth?mode=signin&returnTo=%2Fambassador');
  });

  it('two cities: both are queried, rows from both are shown with their city, oldest first', async () => {
    h.members = [{ entity_id: BRISTOL.id }, { entity_id: BATH.id }];
    const bath = { city_id: BATH.id, city_name: BATH.name };
    answer({ list: (city) => (city === BATH.id ? [row('ob', 'Bath Bachata Club', { ago: 12, city: bath })] : [SHAPES.one]) });
    open();
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(listCalls().map(([, a]) => (a as { p_city_id: string }).p_city_id).sort()).toEqual([BATH.id, BRISTOL.id].sort());
    expect(rows()[0].textContent).toContain('Bath Bachata Club');
    expect(rows()[0].textContent).toContain('Bath');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Bath and Bristol');
  });

  it('two cities, only one has a full page: the "first N" copy names that city and counts its page, not the total', async () => {
    h.members = [{ entity_id: BRISTOL.id }, { entity_id: BATH.id }];
    const bath = { city_id: BATH.id, city_name: BATH.name };
    answer({ list: (city) => (city === BATH.id ? Array.from({ length: 30 }, (_, i) => row(`b${i}`, `Bath ${i}`, { ago: 2, city: bath })) : hundred()) });
    open();
    await waitFor(() => expect(rows()).toHaveLength(130));
    expect(screen.getByTestId('queue-more').textContent).toContain('This shows the first 100 in Bristol.');
    expect(screen.getByTestId('queue-more').textContent).not.toContain('130');
  });

  it('two full cities: "the first 100 in each of", so it never reads as 100 in total', () => {
    expect(moreText(0, ['Bath', 'Bristol'])).toBe('This shows the first 100 in each of Bath and Bristol. There may be more waiting.');
    expect(moreText(0, ['Bristol'])).toBe('This shows the first 100 in Bristol. There may be more waiting.');
  });
});

describe('review screen x item shapes', () => {
  const reviewOf = async (raw: ReturnType<typeof row>) => {
    answer({ list: [raw] });
    open();
    await waitFor(() => expect(rows()).toHaveLength(1));
    fireEvent.click(rows()[0]);
    return screen.findByTestId('review-view');
  };

  it('series with 13 dates: three named weekdays and "+ 10 more (13 in all)"', async () => {
    const v = await reviewOf(SHAPES.series13);
    expect(v.textContent).toContain('Thursday 29 October');
    expect(v.textContent).toContain('+ 10 more (13 in all)');
    expect(v.textContent).toContain('Next dates');
    expect(v.textContent).toContain('\u00a38');
    expect(v.textContent).toContain('Uploaded');
    expect(v.textContent).toContain('Last changed 9 days ago');
  });

  it('series with no flyer says so; free price says Free', async () => {
    const v = await reviewOf(SHAPES.freeNoFlyer);
    expect(v.textContent).toContain('None uploaded');
    expect(v.textContent).toContain('Free');
  });

  it('price range, plural organisers, single date wording', async () => {
    expect((await reviewOf(SHAPES.longName)).textContent).toContain('\u00a35\u2013\u00a312');
    cleanup();
    h.rpc.mockReset();
    const v = await reviewOf(SHAPES.one);
    expect(v.textContent).toContain('Date');
    expect(v.textContent).not.toContain('more (');
  });

  it('organiser, live shape (every series field NULL): no fact rows, says what is known and that there is nothing more, decisions still usable', async () => {
    const v = await reviewOf(SHAPES.organiserBare);
    expect(SHAPES.organiserBare).toMatchObject({ organiser_names: null, next_occurrence_dates: null, future_occurrence_count: null, has_flyer: null, price_currency: null });
    expect(v.querySelectorAll('dt')).toHaveLength(0);
    const note = screen.getByTestId('no-extras').textContent ?? '';
    expect(note).toContain('the name, the city (Bristol) and that it has waited 6 days');
    expect(note).toContain('nothing more to show');
    for (const w of ['Flyer', 'Price', 'Venue', 'Next dates', 'Organiser:']) expect(v.textContent).not.toContain(w);
    // the pending page 404s on the public site (no session on the server loader): no link to it, no copy sending them there
    expect(screen.queryByRole('link', { name: /Preview public page/ })).toBeNull();
    expect(document.body.textContent).not.toMatch(/public page/i);
    expect((screen.getByTestId('approve-open') as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByTestId('reject-open') as HTMLButtonElement).disabled).toBe(false);
  });

  it('organiser that arrived today says so', async () => {
    await reviewOf(SHAPES.today);
    expect(screen.getByTestId('no-extras').textContent).toContain('arrived today');
  });

  it.each([
    ['GBP', 8, 8, '\u00a38'],
    ['EUR', 15, 15, '\u20ac15'],
    ['USD', 10, 20, '$10\u2013$20'],
    ['PLN', 30, 30, 'PLN 30'],
    [null, 8, 15, '8\u201315 (currency not given)'],
    [null, 0, 0, 'Free'],
  ])('price in %s (%s to %s) reads "%s"', async (cur, pmin, pmax, text) => {
    const v = await reviewOf(row('sp', 'Priced series', { type: 'series', dates: ['2026-11-08'], count: 1, pmin, pmax, cur }));
    expect(v.textContent).toContain(`Price${text}`);
    if (cur !== 'GBP') expect(v.textContent).not.toContain('\u00a3');
  });

  it('opening a review sends no decision; Back returns to the list with the row still there', async () => {
    const v = await reviewOf(SHAPES.one);
    expect(decisions()).toHaveLength(0);
    fireEvent.click(within(v).getByTestId('review-back'));
    await waitFor(() => expect(screen.queryByTestId('review-view')).toBeNull());
    expect(rows()).toHaveLength(1);
  });

  it('a deep link to an item that is not in the queue says so and offers the list', async () => {
    answer({ list: [SHAPES.one] });
    open('/ambassador/review/series/gone-id');
    const g = await screen.findByTestId('review-gone');
    expect(g.textContent).toContain('No longer waiting');
    expect(within(g).getByRole('button', { name: 'Back to the list' })).toBeTruthy();
  });

  it('the breadcrumb id follows the screen', async () => {
    answer({ list: [SHAPES.one] });
    open();
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(screen.getByTestId('layout').getAttribute('data-crumbs')).toBe('Pending review');
    fireEvent.click(rows()[0]);
    await screen.findByTestId('review-view');
    expect(screen.getByTestId('layout').getAttribute('data-crumbs')).toBe('Pending review>Review');
  });
});

describe('approve confirm and reject sheet', () => {
  const start = async (raws = [SHAPES.one, SHAPES.today]) => {
    answer({ list: newestFirst(raws) });
    open();
    await waitFor(() => expect(rows()).toHaveLength(raws.length));
    fireEvent.click(rows()[0]);
    await screen.findByTestId('review-view');
  };

  it('approve: confirm first (no RPC until Yes), cancel sends nothing', async () => {
    await start();
    fireEvent.click(screen.getByTestId('approve-open'));
    const d = await screen.findByRole('dialog', { name: 'Approve' });
    expect(d.textContent).toContain('goes live on the public Bristol pages');
    fireEvent.click(within(d).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await settle();
    expect(decisions()).toHaveLength(0);
  });

  it('approve success: RPC args, item leaves, count drops, toast says what happened and how many are left', async () => {
    await start();
    fireEvent.click(screen.getByTestId('approve-open'));
    fireEvent.click(await screen.findByTestId('approve-confirm'));
    const toast = await screen.findByTestId('toast');
    expect(toast.textContent).toBe('Approved: Bachata Fundamentals Workshop. 1 left.');
    expect(decisions()).toEqual([['admin_approve_entity_v1', { p_target_type: 'series', p_target_id: 's9' }]]);
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(screen.getByTestId('queue-count').textContent).toBe('1');
  });

  it('approving the last item lands on All caught up with "None left."', async () => {
    await start([SHAPES.one]);
    fireEvent.click(screen.getByTestId('approve-open'));
    fireEvent.click(await screen.findByTestId('approve-confirm'));
    expect((await screen.findByTestId('toast')).textContent).toContain('None left.');
    expect(await screen.findByTestId('queue-empty')).toBeTruthy();
  });

  it('reject: empty and too-short show the inline message and send NOTHING', async () => {
    await start();
    fireEvent.click(screen.getByTestId('reject-open'));
    const d = await screen.findByRole('dialog', { name: 'Reject' });
    fireEvent.click(within(d).getByTestId('reject-submit'));
    expect(screen.getByTestId('reject-reason-error').textContent).toBe('Say why, so the organiser knows what to fix.');
    fireEvent.change(within(d).getByRole('textbox'), { target: { value: 'Not clear' } });
    fireEvent.click(within(d).getByTestId('reject-submit'));
    expect(screen.getByTestId('reject-reason-error').textContent).toBe('Add a little more detail (9 of 10 characters so far).');
    await settle();
    expect(decisions()).toHaveLength(0);
    // whitespace padding does not count
    fireEvent.change(within(d).getByRole('textbox'), { target: { value: '   short    ' } });
    fireEvent.click(within(d).getByTestId('reject-submit'));
    await settle();
    expect(decisions()).toHaveLength(0);
  });

  it('reject with 10+ characters sends the trimmed reason, the item leaves, toast says Rejected', async () => {
    await start();
    fireEvent.click(screen.getByTestId('reject-open'));
    const d = await screen.findByRole('dialog', { name: 'Reject' });
    fireEvent.change(within(d).getByRole('textbox'), { target: { value: '  Flyer shows another venue.  ' } });
    fireEvent.click(within(d).getByTestId('reject-submit'));
    expect((await screen.findByTestId('toast')).textContent).toBe('Rejected: Bachata Fundamentals Workshop. 1 left.');
    expect(decisions()).toEqual([['admin_reject_entity_v1', { p_target_type: 'series', p_target_id: 's9', p_reason: 'Flyer shows another venue.' }]]);
  });

  it('cancelling the reject sheet sends nothing', async () => {
    await start();
    fireEvent.click(screen.getByTestId('reject-open'));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    await settle();
    expect(decisions()).toHaveLength(0);
  });

  it('self_approval_not_allowed: the row becomes "needs an admin", stays in the list, buttons are gone and say why', async () => {
    answer({ list: [SHAPES.one], decide: () => ({ error: { message: 'self_approval_not_allowed' } }) });
    open();
    await waitFor(() => expect(rows()).toHaveLength(1));
    fireEvent.click(rows()[0]);
    fireEvent.click(await screen.findByTestId('approve-open'));
    fireEvent.click(await screen.findByTestId('approve-confirm'));
    const note = await screen.findByTestId('party-note');
    expect(note.textContent).toContain('an admin has to decide it');
    expect(note.textContent).toContain('Nothing for you to do');
    expect(screen.queryByTestId('approve-open')).toBeNull();
    expect(screen.queryByTestId('reject-open')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByTestId('review-back'));
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0].textContent).toContain('Needs an admin');
  });

  it.each(['target_not_found', 'not_pending_review'])('%s: the item is taken off the list, as the toast says, and is not re-sent', async (code) => {
    answer({ list: newestFirst([SHAPES.one, SHAPES.today]), decide: () => ({ error: { message: code } }) });
    open();
    await waitFor(() => expect(rows()).toHaveLength(2));
    fireEvent.click(rows()[0]);
    fireEvent.click(await screen.findByTestId('approve-open'));
    fireEvent.click(await screen.findByTestId('approve-confirm'));
    const toast = await screen.findByTestId('toast');
    expect(toast.textContent).toContain('no longer waiting');
    expect(toast.textContent).toContain('It has been taken off your list.');
    expect(toast.textContent).not.toContain(code);
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByTestId('review-view')).toBeNull();
    expect(rows()[0].textContent).not.toContain('Bachata Fundamentals Workshop');
    expect(decisions()).toHaveLength(1);
  });

  it.each([
    [{ message: 'authentication_required' }],
    [{ message: 'JWT expired', code: 'PGRST301' }],
    [{ message: 'Unauthorized', status: 401 }],
  ])('signed out (%o): says so with a Sign in link back to this review, never "check your connection"', async (error) => {
    answer({ list: [SHAPES.one], decide: () => ({ error }) });
    open();
    await reachDecision();
    const err = await screen.findByTestId('decision-error');
    expect(err.textContent).toContain('You are signed out. Sign in again');
    expect(err.textContent).not.toContain('connection');
    expect(within(err).getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe(
      `/auth?mode=signin&returnTo=${encodeURIComponent('/ambassador/review/series/s9')}`,
    );
    expect(rows()).toHaveLength(1);
  });

  it.each([
    ['42501 permission denied', 'do not have access'],
    ['not_authorised', 'do not have access'],
    ['something_unmapped_xyz', 'did not go through'],
    ['permission denied for table entity_members', 'did not go through'],
  ])('error %s becomes readable copy with Try again, never the raw code, and the item stays', async (code, copy) => {
    answer({ list: [SHAPES.one], decide: () => ({ error: { message: code } }) });
    open();
    await waitFor(() => expect(rows()).toHaveLength(1));
    fireEvent.click(rows()[0]);
    fireEvent.click(await screen.findByTestId('approve-open'));
    fireEvent.click(await screen.findByTestId('approve-confirm'));
    const err = await screen.findByTestId('decision-error');
    expect(err.textContent).toContain(copy);
    expect(err.textContent).not.toContain(code);
    expect(screen.getByTestId('approve-confirm').textContent).toBe('Try again');
    // Try again re-sends, and succeeds once the RPC does
    answer({ list: [SHAPES.one] });
    fireEvent.click(screen.getByTestId('approve-confirm'));
    expect((await screen.findByTestId('toast')).textContent).toContain('Approved');
  });
});

describe('a missing grant is not "not an ambassador"', () => {
  it.each([
    [{ code: '42501', message: 'permission denied for table entity_members' }],
    [{ code: '42501', message: 'permission denied for function admin_list_pending_review_v1' }],
  ])('%o: list and decision both fall to the generic copy', (err) => {
    expect(loadErrorKind(err)).toBe('other');
    expect(decisionError(err).kind).toBe('other');
  });

  it('a bare 42501 and the RPC refusals stay "no access"; the word "permission" alone does not', () => {
    expect(loadErrorKind({ code: '42501', message: 'permission denied' })).toBe('access');
    expect(loadErrorKind({ message: 'admin_only' })).toBe('access');
    expect(decisionError({ message: 'not_authorized' }).kind).toBe('access');
    expect(loadErrorKind({ message: 'missing permission on a cache' })).toBe('other');
  });
});

describe('the two rules that matter', () => {
  it('(a) never renders or requests submitter_email, even when the row carries one', async () => {
    answer({ list: newestFirst(twelve()) });
    open();
    await waitFor(() => expect(rows()).toHaveLength(12));
    fireEvent.click(rows()[0]);
    await screen.findByTestId('review-view');
    expect(document.body.innerHTML).not.toContain('someone.private@example.com');
    expect(document.body.textContent).not.toMatch(/@example\.com/);
    expect(JSON.stringify(h.rpc.mock.calls)).not.toContain('email');
  });

  it('(b) reject cannot be submitted under 10 characters', async () => {
    answer({ list: [SHAPES.one] });
    open();
    await waitFor(() => expect(rows()).toHaveLength(1));
    fireEvent.click(rows()[0]);
    fireEvent.click(await screen.findByTestId('reject-open'));
    const d = await screen.findByRole('dialog');
    for (const t of ['', ' ', 'abc', '123456789', '         x         ']) {
      fireEvent.change(within(d).getByRole('textbox'), { target: { value: t } });
      fireEvent.click(within(d).getByTestId('reject-submit'));
    }
    await settle();
    expect(decisions()).toHaveLength(0);
  });
});
