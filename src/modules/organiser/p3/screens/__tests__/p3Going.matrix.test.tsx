// @vitest-environment jsdom
/**
 * P3 W4c: "Who is going" mounts, table-driven: every slot (Home hero, date sheet row,
 * Stats By-event row) x every shape (no going, 1, many, >200, cancelled, load error,
 * contributor, switch off, P3 off). One mapping (p3GoingSlot) decides what a slot shows.
 * The read is get_my_series_going_v1 by the series id every P3 row carries.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({ going: true, p3: true, rpc: vi.fn() }));
vi.mock('@/lib/goingCheckin', () => ({ get GOING_CHECKIN_ENABLED() { return h.going; } }));
vi.mock('@/lib/featureFlags', async (orig) => ({
  ...(await orig<typeof import('@/lib/featureFlags')>()),
  flags: { get organiserP3() { return h.p3; } },
}));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: (fn: string, a?: unknown) => h.rpc(fn, a) }));
vi.mock('@/lib/profileViewEmit', () => ({ emitProfileView: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, isLoading: false }) }));

import { P3NightGoing, P3SeriesGoing, p3GoingSlot, p3NightOf, p3SeriesGoingText } from '../P3Going';
import { organiserGoingStateFor } from '@/modules/going';

const SID = '11111111-1111-4111-8111-111111111111';
const OCC = '22222222-2222-4222-8222-222222222222';
const people = (n: number) => Array.from({ length: n }, (_, i) => ({ dancer_profile_id: `d${i}`, first_name: `P${i}`, photo_url: null }));
const night = (over: Record<string, unknown> = {}) => ({
  occurrence_id: OCC, occurrence_date: '2026-11-06', starts_at_local: '2026-11-06T21:00:00Z',
  is_cancelled: false, going_count: 0, people: [], ...over,
});
const reply = (nights: unknown[]) => ({ data: { public_event_id: 'pub', nights }, error: null });

type Shape = { name: string; rpc: () => unknown; text: RegExp | null; state?: string };
const SHAPES: Shape[] = [
  { name: 'no going', rpc: () => reply([night()]), text: /Nobody has said they.re going yet/ },
  { name: '1 going', rpc: () => reply([night({ going_count: 1, people: people(1) })]), text: /1 going/ },
  { name: 'many going', rpc: () => reply([night({ going_count: 9, people: people(9) })]), text: /9 going/ },
  { name: '>200 going (200 listed)', rpc: () => reply([night({ going_count: 250, people: people(200) })]), text: /250 going/ },
  { name: 'cancelled, nobody', rpc: () => reply([night({ is_cancelled: true })]), text: /This date is cancelled/ },
  { name: 'cancelled, had going', rpc: () => reply([night({ is_cancelled: true, going_count: 3, people: people(3) })]), text: /This date is cancelled/ },
  { name: 'load error', rpc: () => ({ data: null, error: { message: 'boom', code: 'XX000' } }), text: null, state: 'error' },
  { name: 'contributor (not_organiser)', rpc: () => ({ data: null, error: { message: 'not_organiser', code: '42501' } }), text: null, state: 'none' },
  { name: 'event not found', rpc: () => ({ data: null, error: { message: 'not_found', code: 'P0002' } }), text: null, state: 'not_found' },
];

const wrap = (node: JSX.Element) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><MemoryRouter>{node}</MemoryRouter></QueryClientProvider>);
};
const slot = () => <P3NightGoing seriesId={SID} seriesName="Sensual Fridays" nightKey={{ occurrenceId: OCC }} testId="slot" />;

beforeEach(() => { h.going = true; h.p3 = true; h.rpc.mockReset(); });
afterEach(cleanup);

describe('P3 going slots x shapes', () => {
  for (const s of SHAPES) {
    it(`date row / Home hero: ${s.name}`, async () => {
      h.rpc.mockResolvedValue(s.rpc());
      wrap(slot());
      if (s.text) {
        await waitFor(() => expect(screen.getByTestId('slot').textContent).toMatch(s.text!));
      } else if (s.state === 'none') {
        await waitFor(() => expect(h.rpc).toHaveBeenCalled());
        await new Promise((r) => setTimeout(r, 20));
        expect(screen.queryByTestId('slot')).toBeNull();
        expect(screen.queryByTestId('slot-state')).toBeNull();
      } else {
        await waitFor(() => expect(screen.getByTestId('slot-state').getAttribute('data-state')).toBe(s.state), { timeout: 4000 });
        const el = screen.getByTestId('slot-state');
        expect(el.textContent!.length).toBeGreaterThan(10); // says what the person can do
        if (s.state === 'error') expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
      }
      // the read is the series twin, by the series id
      expect(h.rpc).toHaveBeenCalledWith('get_my_series_going_v1', { p_series_id: SID });
      expect(h.rpc).not.toHaveBeenCalledWith('get_my_event_going_v1', expect.anything());
    });
  }

  it('the people sheet opens as a dialog with everyone listed (>200 case)', async () => {
    h.rpc.mockResolvedValue(reply([night({ going_count: 250, people: people(200) })]));
    wrap(slot());
    fireEvent.click(await screen.findByTestId('going-night-summary'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByTestId('going-people-sheet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('a date the read does not list renders nothing, never a wrong "nobody"', async () => {
    h.rpc.mockResolvedValue(reply([night({ occurrence_id: 'other', occurrence_date: '2026-11-13' })]));
    wrap(slot());
    await waitFor(() => expect(h.rpc).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('slot')).toBeNull();
  });

  for (const [name, set] of [['switch off', () => { h.going = false; }], ['P3 off', () => { h.p3 = false; }]] as const) {
    it(`${name}: nothing renders and no read runs`, async () => {
      set();
      wrap(<><P3NightGoing seriesId={SID} seriesName="x" nightKey={{ date: '2026-11-06' }} testId="slot" /><P3SeriesGoing seriesId={SID} testId="ser" /></>);
      await new Promise((r) => setTimeout(r, 20));
      expect(screen.queryByTestId('slot')).toBeNull();
      expect(screen.queryByTestId('ser')).toBeNull();
      expect(h.rpc).not.toHaveBeenCalled();
    });
  }
});

describe('Stats By-event row', () => {
  it('sums going over not-cancelled nights; says nobody when none', async () => {
    h.rpc.mockResolvedValue(reply([night({ going_count: 4, people: people(4) }), night({ occurrence_id: 'b', going_count: 5 }), night({ occurrence_id: 'c', is_cancelled: true, going_count: 9 })]));
    wrap(<P3SeriesGoing seriesId={SID} testId="ser" />);
    await waitFor(() => expect(screen.getByTestId('ser').textContent).toBe('9 going'));
  });
  it('no going anywhere', () => {
    expect(p3SeriesGoingText([night() as never])).toMatch(/Nobody has said/);
    expect(p3SeriesGoingText([])).toMatch(/Nobody has said/);
  });
  it('contributor renders nothing', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'not_organiser', code: '42501' } });
    wrap(<P3SeriesGoing seriesId={SID} testId="ser" />);
    await waitFor(() => expect(h.rpc).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('ser')).toBeNull();
    expect(screen.queryByTestId('ser-state')).toBeNull();
  });
});

describe('one mapping', () => {
  const facts = (error: string | null, status: 'pending' | 'success' | 'error' = 'error') =>
    organiserGoingStateFor({ enabled: true, signedIn: true, status, error: error as never });
  it('p3GoingSlot', () => {
    expect(p3GoingSlot(organiserGoingStateFor({ enabled: false, signedIn: true, status: 'pending', error: null }))).toBe('none');
    expect(p3GoingSlot(facts('not_organiser'))).toBe('none');
    expect(p3GoingSlot(facts(null, 'success'))).toBe('night');
    for (const e of ['not_found', 'unknown', 'not_signed_in']) expect(p3GoingSlot(facts(e))).toBe('state');
    expect(p3GoingSlot(facts(null, 'pending'))).toBe('state');
  });
  it('p3NightOf matches by occurrence id or by day', () => {
    const ns = [night() as never];
    expect(p3NightOf(ns, { occurrenceId: OCC })).toBe(ns[0]);
    expect(p3NightOf(ns, { date: '2026-11-06' })).toBe(ns[0]);
    expect(p3NightOf(ns, { date: '2026-11-07' })).toBeNull();
  });
});
