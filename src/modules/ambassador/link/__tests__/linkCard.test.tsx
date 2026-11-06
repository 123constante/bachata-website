// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LinkSection } from '../LinkCard';
import { LOCKED_REASON, EMPTY_TEXT, OFF_NOTE, NOT_LIVE_NOTE, parseTracker, linkUrl, type TrackerLink } from '../trackerModel';

const rpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (fn: string, a?: Record<string, unknown>) => rpc(fn, a) } }));

const mk = (o: Partial<TrackerLink> = {}): TrackerLink => ({
  link_id: 'l1', code: 'brs-abc', city_name: 'Bristol', city_slug: 'bristol', is_active: true, admin_locked: false,
  live: true, ambassador_first_name: 'Jan', joined: 0, city_set: 0, ...o,
});
let rows: TrackerLink[] = [];
const writes = () => rpc.mock.calls.filter(([fn]) => fn === 'set_ambassador_link_active_v1');
const mount = (isAdmin = false) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <LinkSection userId="u1" isAdmin={isAdmin} />
    </QueryClientProvider>,
  );

beforeEach(() => {
  rpc.mockReset();
  rows = [];
  rpc.mockImplementation(async (fn: string) => (fn === 'get_ambassador_link_tracker_v1' ? { data: { links: rows }, error: null } : { data: { ok: true }, error: null }));
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  delete (navigator as { share?: unknown }).share;
});

type State = 'active' | 'off' | 'not_live';
const stateRow = (s: State, joined: number): TrackerLink =>
  mk({ is_active: s !== 'off', live: s === 'active', joined, city_set: Math.min(joined, 3) });

describe('link card matrix', () => {
  const counts = [0, 1, 60];
  const states: State[] = ['active', 'off', 'not_live'];
  for (const who of ['ambassador', 'admin'] as const) {
    for (const s of states) {
      for (const n of counts) {
        it(`${who} / ${s} / ${n} joined`, async () => {
          rows = who === 'admin' ? [stateRow(s, n), { ...stateRow(s, n), link_id: 'l2', city_name: 'Bath', ambassador_first_name: 'Sam' }] : [stateRow(s, n)];
          mount(who === 'admin');
          const cards = await screen.findAllByTestId('link-card');
          expect(cards).toHaveLength(rows.length);
          expect(screen.getAllByTestId('link-joined')[0].textContent).toBe(`Joined ${n}`);
          expect(screen.getAllByTestId('link-cityset')[0].textContent).toBe(`Set Bristol ${Math.min(n, 3)}`);
          expect(screen.queryAllByText(EMPTY_TEXT)).toHaveLength(s !== 'not_live' && n === 0 ? rows.length : 0);
          expect(screen.queryAllByText(OFF_NOTE)).toHaveLength(s === 'off' ? rows.length : 0);
          expect(screen.queryAllByText(NOT_LIVE_NOTE)).toHaveLength(s === 'not_live' ? rows.length : 0);
          expect(screen.queryAllByRole('button', { name: 'Copy link' })).toHaveLength(s === 'not_live' ? 0 : rows.length);
          expect(screen.queryAllByRole('button', { name: 'Switch off' })).toHaveLength(s === 'active' ? rows.length : 0);
          expect(screen.queryAllByRole('button', { name: 'Switch on' })).toHaveLength(s === 'off' ? rows.length : 0);
          if (who === 'admin') expect(screen.getByText('Your Bath link (Sam)')).toBeTruthy();
          else expect(screen.getByText('Your Bristol link')).toBeTruthy();
          expect(writes()).toHaveLength(0);
        });
      }
    }
  }
});

describe('link card behaviour', () => {
  it('copies the exact URL and sends no write', async () => {
    rows = [mk()];
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Copy link' }));
    await screen.findByText('Copied');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(linkUrl(window.location.origin, 'brs-abc'));
    expect(linkUrl('https://x.test', 'brs-abc')).toBe('https://x.test/join/a/brs-abc');
    expect(writes()).toHaveLength(0);
  });
  it('says so when copy fails', async () => {
    rows = [mk()];
    (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('no'));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Copy link' }));
    await screen.findByText(/Could not copy/);
  });
  it('shows Share only when navigator.share exists', async () => {
    rows = [mk()];
    const a = mount();
    await screen.findByTestId('link-card');
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
    a.unmount();
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Share' }));
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: linkUrl(window.location.origin, 'brs-abc') }));
  });
  it('switch off: confirm sentence, one RPC, then a refresh', async () => {
    rows = [mk()];
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Switch off' }));
    expect(writes()).toHaveLength(0);
    await screen.findByTestId('switch-confirm');
    rows = [mk({ is_active: false })];
    fireEvent.click(screen.getAllByRole('button', { name: 'Switch off' })[0]);
    await screen.findByText(OFF_NOTE);
    expect(writes()).toEqual([['set_ambassador_link_active_v1', { p_link_id: 'l1', p_active: false }]]);
    expect(rpc.mock.calls.filter(([fn]) => fn === 'get_ambassador_link_tracker_v1')).toHaveLength(2);
  });
  it('cancel sends nothing', async () => {
    rows = [mk()];
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Switch off' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(writes()).toHaveLength(0);
  });
  it('admin_locked: ambassador switch-on is disabled with the reason; admin can switch on', async () => {
    rows = [mk({ is_active: false, admin_locked: true })];
    const a = mount(false);
    const b = await screen.findByRole('button', { name: 'Switch on' });
    expect((b as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('switch-reason').textContent).toBe(LOCKED_REASON);
    a.unmount();
    mount(true);
    expect(((await screen.findByRole('button', { name: 'Switch on' })) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByTestId('switch-reason')).toBeNull();
  });
  it('a refused switch shows the reason', async () => {
    rows = [mk()];
    rpc.mockImplementation(async (fn: string) =>
      fn === 'get_ambassador_link_tracker_v1' ? { data: { links: rows }, error: null } : { data: null, error: { message: 'admin_locked' } });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Switch off' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Switch off' })[0]);
    await waitFor(() => expect(screen.getByTestId('switch-error').textContent).toBe(LOCKED_REASON));
  });
  it('renders nothing for no links or a read error', async () => {
    mount();
    await waitFor(() => expect(rpc).toHaveBeenCalled());
    expect(screen.queryByTestId('link-section')).toBeNull();
  });
  it('parseTracker survives bad shapes and a null first name', () => {
    expect(parseTracker(null)).toEqual([]);
    expect(parseTracker({ links: [{ nope: 1 }, { link_id: 'a', code: 'c', joined: -3, ambassador_first_name: null }] })).toMatchObject([{ link_id: 'a', joined: 0, ambassador_first_name: null, live: false }]);
  });
});
afterEach(() => cleanup());
