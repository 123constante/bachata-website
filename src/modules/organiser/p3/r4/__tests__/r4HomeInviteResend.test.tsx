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
  return { ...m, flags: new Proxy(m.flags, { get: (t, k) => (k === 'organiserClassInvites' ? flag.on : (t as Record<string | symbol, unknown>)[k]) }) };
});
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ data: undefined }) }));
vi.mock('@/modules/organiser/shared/selfServeApi', async (orig) => {
  const m = await orig<typeof import('@/modules/organiser/shared/selfServeApi')>();
  return { ...m, fetchIncomingAccessRequests: vi.fn(async () => []) };
});
import { WaitingList } from '../R4Home';
import { FAIL_COPY } from '../../v2/ClassInvites';

const WAITING = [{
  invite_id: 'v1', display_name: 'Anna Lopez', series_id: 's1', event_name: 'Friday Social', class_title: 'Salsa basics',
  next_date: '2026-12-04', last_sent_at: '2026-11-20T10:00:00Z', status: 'open',
}];
let waiting: { data: unknown; error: { message: string } | null } = { data: WAITING, error: null };
let resend: { data: unknown; error: { message: string } | null } = { data: { invite_id: 'v1', token: 'tok9', expires_at: null }, error: null };
const calls = (fn: string) => rpc.mock.calls.filter((c) => c[0] === fn);

function show() {
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'organiser_class_invites_waiting_v1') return waiting;
    if (fn === 'organiser_class_invite_resend_v1') return resend;
    return { data: null, error: null };
  });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><WaitingList rows={[]} pageId="p1" /></MemoryRouter></QueryClientProvider>);
}

afterEach(() => {
  cleanup(); rpc.mockReset(); flag.on = true;
  waiting = { data: WAITING, error: null };
  resend = { data: { invite_id: 'v1', token: 'tok9', expires_at: null }, error: null };
});

describe('Home waiting list: invite Resend', () => {
  it('flag off: the waiting read is never called and no row shows', async () => {
    flag.on = false; show();
    await new Promise((r) => setTimeout(r, 30));
    expect(calls('organiser_class_invites_waiting_v1')).toHaveLength(0);
    expect(screen.queryByTestId('r4-wait-item')).toBeNull();
  });
  it('flag on + one row: the row shows with the board words', async () => {
    show();
    expect(await screen.findByText("Anna Lopez hasn't joined yet")).toBeTruthy();
    expect(screen.getByText('Teaching Salsa basics at Friday Social on Friday 4 December.')).toBeTruthy();
    expect(calls('organiser_class_invites_waiting_v1')[0][1]).toEqual({ p_organiser_id: 'p1' });
    expect(screen.getByTestId('r4-waiting-heading').textContent).toBe('1 thing waiting for you');
  });
  it('tap Resend: the resend rpc gets the invite id and the sheet carries the join link', async () => {
    show();
    fireEvent.click(await screen.findByTestId('r4-wait-go'));
    const msg = await screen.findByTestId('class-invite-message') as HTMLTextAreaElement;
    expect(calls('organiser_class_invite_resend_v1')[0][1]).toEqual({ p_invite_id: 'v1' });
    expect(msg.value).toContain('/join/class/tok9');
    expect(msg.value).toContain('Hi Anna');
    expect(screen.getByText('Send this to Anna')).toBeTruthy();
    expect((screen.getByTestId('class-invite-whatsapp') as HTMLAnchorElement).href).toContain('https://wa.me/?text=');
  });
  it('Done closes the sheet and re-reads the waiting list', async () => {
    show();
    fireEvent.click(await screen.findByTestId('r4-wait-go'));
    fireEvent.click(await screen.findByTestId('class-invite-done'));
    await waitFor(() => expect(screen.queryByTestId('class-invite-message')).toBeNull());
    await waitFor(() => expect(calls('organiser_class_invites_waiting_v1').length).toBeGreaterThan(1));
  });
  it('resend error: the row shows the failure line', async () => {
    resend = { data: null, error: { message: 'boom' } };
    show();
    fireEvent.click(await screen.findByTestId('r4-wait-go'));
    const a = await screen.findByTestId('r4-wait-resend-error');
    expect(a.textContent).toBe(FAIL_COPY);
    expect(a.getAttribute('role')).toBe('alert');
    expect(screen.queryByTestId('class-invite-message')).toBeNull();
  });
  it('waiting read error: nothing extra shows and the list does not break', async () => {
    waiting = { data: null, error: { message: 'nope' } };
    show();
    await waitFor(() => expect(calls('organiser_class_invites_waiting_v1')).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByTestId('r4-wait-item')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
