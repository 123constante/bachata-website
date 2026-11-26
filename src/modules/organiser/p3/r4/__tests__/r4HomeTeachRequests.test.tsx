// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const rpc = vi.hoisted(() => vi.fn());
const flag = vi.hoisted(() => ({ on: true }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
vi.mock('@/lib/featureFlags', async (orig) => {
  const m = await orig<typeof import('@/lib/featureFlags')>();
  return { ...m, flags: new Proxy(m.flags, { get: (t, k) => (k === 'teachRequests' ? flag.on : (t as Record<string | symbol, unknown>)[k]) }) };
});
import { TeachRequestsCard } from '../R4Home';

const TR = (n: number, extra = {}) => ({ request_id: `r${n}`, occurrence_id: `o${n}`, night_date: '2026-12-04', event_name: 'Friday Social', class_title: 'Salsa', teacher_profile_id: `t${n}`, teacher_name: 'Ana Lopez', teacher_photo_url: null, created_at: '2026-11-26T10:00:00Z', ...extra });
let rows: unknown = [];
let decideErr: { message: string } | null = null;
const calls = (fn: string) => rpc.mock.calls.filter((c) => c[0] === fn);

function show() {
  rpc.mockImplementation(async (fn: string) => (fn === 'decide_teach_request_v1'
    ? { data: decideErr ? null : { request_id: 'r1', status: 'x', attached: true }, error: decideErr }
    : { data: rows, error: null }));
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><TeachRequestsCard pageId="p1" today="2026-12-01" /></MemoryRouter></QueryClientProvider>);
}
afterEach(() => { cleanup(); rpc.mockReset(); flag.on = true; decideErr = null; rows = []; });

describe('Home: Teacher requests', () => {
  it('flag off: no call, no card', async () => {
    flag.on = false; rows = [TR(1)]; show();
    await new Promise((r) => setTimeout(r, 30));
    expect(rpc).not.toHaveBeenCalled();
    expect(screen.queryByTestId('r4-teach-requests')).toBeNull();
  });
  it('empty list: no card', async () => {
    show();
    await new Promise((r) => setTimeout(r, 30));
    expect(calls('organiser_teach_requests_v1')[0][1]).toEqual({ p_organiser_id: 'p1' });
    expect(screen.queryByTestId('r4-teach-requests')).toBeNull();
  });
  it('row shows name, class, day and event', async () => {
    rows = [TR(1)]; show();
    const row = await screen.findByTestId('r4-teach-r1');
    expect(row.textContent).toContain('Ana Lopez wants to teach');
    expect(row.textContent).toContain('Salsa,');
    expect(row.textContent).toContain('Friday Social');
    expect(screen.getByText('Teacher requests')).toBeTruthy();
  });
  it('Accept calls decide(true) and shows the added line', async () => {
    rows = [TR(1)]; show();
    fireEvent.click(await screen.findByText('Accept'));
    expect(await screen.findByText('Ana added to Salsa.')).toBeTruthy();
    expect(calls('decide_teach_request_v1')[0][1]).toEqual({ p_request_id: 'r1', p_accept: true });
    expect(screen.queryByText('Accept')).toBeNull();
  });
  it('Decline calls decide(false) and removes the row', async () => {
    rows = [TR(1)]; show();
    fireEvent.click(await screen.findByText('Decline'));
    await waitFor(() => expect(screen.queryByTestId('r4-teach-r1')).toBeNull());
    expect(calls('decide_teach_request_v1')[0][1]).toEqual({ p_request_id: 'r1', p_accept: false });
  });
  it('7 rows show 5 and "+2 more"', async () => {
    rows = Array.from({ length: 7 }, (_, k) => TR(k + 1)); show();
    await screen.findByTestId('r4-teach-requests');
    expect(screen.getAllByText('Accept')).toHaveLength(5);
    expect(screen.getByText('+2 more')).toBeTruthy();
  });
  it('class_closed: closed line, Decline only', async () => {
    rows = [TR(1)]; decideErr = { message: 'permission_denied: class_closed' }; show();
    fireEvent.click(await screen.findByText('Accept'));
    expect(await screen.findByText('This class is closed.')).toBeTruthy();
    expect(screen.queryByText('Accept')).toBeNull();
    expect(screen.getByText('Decline')).toBeTruthy();
  });
  it('other error: retry line, buttons stay', async () => {
    rows = [TR(1)]; decideErr = { message: 'boom' }; show();
    fireEvent.click(await screen.findByText('Accept'));
    expect(await screen.findByText(/Couldn.t save\. Try again\./)).toBeTruthy();
    expect(screen.getByText('Accept')).toBeTruthy();
  });
});
