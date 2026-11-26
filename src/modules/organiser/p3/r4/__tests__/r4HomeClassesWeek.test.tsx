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
  return { ...m, flags: new Proxy(m.flags, { get: (t, k) => (k === 'organiserHomeClassesWeek' ? flag.on : (t as Record<string | symbol, unknown>)[k]) }) };
});
import { ClassesWeekCard } from '../R4Home';

const WC = (o: string, extra = {}) => ({ series_id: 's1', event_name: 'Friday Social', occurrence_id: o, date: '2026-12-04', session_id: `x${o}`, added_only: false, class_title: 'Salsa', start_time: '19:30:00', teachers: [], invite_pending: false, ...extra });
let rows: unknown = [];
let err: { message: string } | null = null;
const calls = () => rpc.mock.calls.filter((c) => c[0] === 'organiser_class_teachers_week_v1');

function show() {
  rpc.mockImplementation(async () => ({ data: err ? null : rows, error: err }));
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><ClassesWeekCard pageId="p1" today="2026-12-01" /></MemoryRouter></QueryClientProvider>);
}
afterEach(() => { cleanup(); rpc.mockReset(); nav.mockReset(); flag.on = true; err = null; rows = []; });

describe('Home: Classes this week', () => {
  it('flag off: no call, no card', async () => {
    flag.on = false; rows = [WC('o1')]; show();
    await new Promise((r) => setTimeout(r, 30));
    expect(calls()).toHaveLength(0);
    expect(screen.queryByTestId('r4-classes-week')).toBeNull();
  });
  it('flag on, 0 rows: no card', async () => {
    show();
    await new Promise((r) => setTimeout(r, 30));
    expect(calls()[0][1]).toEqual({ p_organiser_id: 'p1' });
    expect(screen.queryByTestId('r4-classes-week')).toBeNull();
  });
  it('rows: titles, lines and end texts', async () => {
    rows = [
      WC('o1'),
      WC('o2', { class_title: 'Kizomba', start_time: null, invite_pending: true }),
      WC('o3', { class_title: 'Zouk', teachers: ['Ana'] }),
      WC('o4', { class_title: 'Sensual', teachers: ['Ana', 'Leo', 'Mia'] }),
    ];
    show();
    expect(await screen.findByText('Salsa')).toBeTruthy();
    expect(screen.getByTestId('r4-week-o1-xo1').textContent).toContain('Add teacher');
    expect(screen.getByTestId('r4-week-o1-xo1').textContent).toContain('7:30pm, Friday Social');
    expect(screen.getByTestId('r4-week-o2-xo2').textContent).toContain('Invite sent');
    expect(screen.getByTestId('r4-week-o2-xo2').textContent).not.toContain('pm');
    expect(screen.getByTestId('r4-week-o3-xo3').textContent).toContain('Ana');
    expect(screen.getByTestId('r4-week-o4-xo4').textContent).toContain('Ana, Leo +1');
  });
  it('7 rows show 6', async () => {
    rows = Array.from({ length: 7 }, (_, k) => WC(`o${k}`));
    show();
    await screen.findByTestId('r4-classes-week');
    expect(screen.getByTestId('r4-classes-week').querySelectorAll('a')).toHaveLength(6);
  });
  it('rpc error: no card, no crash', async () => {
    err = { message: 'missing function' }; show();
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByTestId('r4-classes-week')).toBeNull();
  });
  it('row links to the night with ?open=when', async () => {
    rows = [WC('o1')]; show();
    const a = await screen.findByTestId('r4-week-o1-xo1');
    expect(a.getAttribute('href')).toBe('/account/p3/events/s1/night/o1?open=when');
    fireEvent.click(a);
  });
});
