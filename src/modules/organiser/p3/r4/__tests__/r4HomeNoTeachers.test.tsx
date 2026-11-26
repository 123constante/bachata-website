// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const rpc = vi.hoisted(() => vi.fn());
const nav = vi.hoisted(() => vi.fn());
const flag = vi.hoisted(() => ({ on: true }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => nav }));
vi.mock('@/lib/featureFlags', async (orig) => {
  const m = await orig<typeof import('@/lib/featureFlags')>();
  return { ...m, flags: new Proxy(m.flags, { get: (t, k) => (k === 'organiserNoTeachersCard' || k === 'organiserClassInvites' ? flag.on : (t as Record<string | symbol, unknown>)[k]) }) };
});
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ data: undefined }) }));
vi.mock('@/modules/organiser/shared/selfServeApi', async (orig) => {
  const m = await orig<typeof import('@/modules/organiser/shared/selfServeApi')>();
  return { ...m, fetchIncomingAccessRequests: vi.fn(async () => []) };
});
import { WaitingList } from '../R4Home';
import { R4_WAIT_CAP, r4WaitingOf } from '../r4Model';

const NT = (o: string, extra = {}) => ({ series_id: 's1', event_name: 'Friday Social', occurrence_id: o, date: '2026-12-04', session_id: `x${o}`, added_only: false, class_title: 'Salsa', start_time: '19:30:00', ...extra });
const INVITE = { invite_id: 'v1', display_name: 'Anna Lopez', series_id: 's1', event_name: 'Friday Social', class_title: 'Bachata', next_date: '2026-12-04', last_sent_at: null, status: 'open' };
let rows: unknown = [NT('o1'), NT('o2', { start_time: null, class_title: 'Kizomba' })];
let err: { message: string } | null = null;
const calls = (fn: string) => rpc.mock.calls.filter((c) => c[0] === fn);

function show() {
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'organiser_classes_without_teachers_v1') return { data: err ? null : rows, error: err };
    if (fn === 'organiser_class_invites_waiting_v1') return { data: [INVITE], error: null };
    return { data: null, error: null };
  });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><WaitingList rows={[]} pageId="p1" /></MemoryRouter></QueryClientProvider>);
}
afterEach(() => { cleanup(); rpc.mockReset(); nav.mockReset(); flag.on = true; err = null; rows = [NT('o1'), NT('o2', { start_time: null, class_title: 'Kizomba' })]; });

describe('Home: no-teacher rows', () => {
  it('flag off: no call, no row', async () => {
    flag.on = false; show();
    await new Promise((r) => setTimeout(r, 30));
    expect(calls('organiser_classes_without_teachers_v1')).toHaveLength(0);
    expect(screen.queryByText('Salsa has no teacher yet')).toBeNull();
  });
  it('flag on: titles, details, button, order after invite rows', async () => {
    show();
    expect(await screen.findByText('Salsa has no teacher yet')).toBeTruthy();
    expect(screen.getByText('At Friday Social on Friday 4 December, 7:30pm.')).toBeTruthy();
    expect(screen.getByText('At Friday Social on Friday 4 December.')).toBeTruthy();
    expect(calls('organiser_classes_without_teachers_v1')[0][1]).toEqual({ p_organiser_id: 'p1' });
    const items = screen.getAllByTestId('r4-wait-item');
    expect(items.map((i) => i.getAttribute('data-go'))).toEqual(['resend', 'teachers', 'teachers']);
    expect(screen.getAllByText('Add teacher')).toHaveLength(2);
    expect(screen.getByTestId('r4-waiting-heading').textContent).toBe('3 things waiting for you');
  });
  it('rpc error: other rows still render', async () => {
    err = { message: 'missing function' }; show();
    expect(await screen.findByText("Anna Lopez hasn't joined yet")).toBeTruthy();
    expect(screen.queryByText('Salsa has no teacher yet')).toBeNull();
  });
  it('non-array reads as no rows', async () => {
    rows = { nope: 1 }; show();
    expect(await screen.findByText("Anna Lopez hasn't joined yet")).toBeTruthy();
    expect(screen.queryAllByText('Add teacher')).toHaveLength(0);
  });
  it('tap Add teacher opens that night', async () => {
    show();
    const btns = await screen.findAllByText('Add teacher');
    fireEvent.click(btns[1]);
    expect(nav).toHaveBeenCalledWith('/account/p3/events/s1/night/o2');
  });
});

describe('r4WaitingOf: cap and more include no-teacher rows', () => {
  it('counts them', () => {
    const noTeachers = Array.from({ length: 7 }, (_, k) => NT(`o${k}`));
    const m = r4WaitingOf({ rows: [], todoIds: new Set(), requests: [], editor: true, noTeachers });
    expect(m.items).toHaveLength(R4_WAIT_CAP);
    expect(m.more).toBe(2);
    expect(m.heading).toBe('7 things waiting for you');
  });
});
