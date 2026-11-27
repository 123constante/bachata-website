// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DraftSession } from '../../../shared/programmeModel';

const rpc = vi.hoisted(() => vi.fn());
const flag = vi.hoisted(() => ({ on: true }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
vi.mock('@/lib/featureFlags', async (orig) => {
  const m = await orig<typeof import('@/lib/featureFlags')>();
  return { ...m, flags: new Proxy(m.flags, { get: (t, k) => (k === 'organiserClassInvites' ? flag.on : (t as Record<string | symbol, unknown>)[k]) }) };
});
import { SessionSheetV2 } from '../SessionSheetV2';
import { FAIL_COPY } from '../ClassInvites';

const person = (id: string, name: string) => ({ id, name, role: 'teaching', removed: false });
const row = (): DraftSession =>
  ({ key: 's:i1', original: { series_item_id: 'i1' }, type: 'class', title: 'Salsa basics', start: '19:30', end: '20:30', levels: [], removed: false,
    people: [person('p1', 'Ana Lopez'), person('p2', 'Bo Chen')] } as unknown as DraftSession);
const invite = { occurrenceId: 'o1', eventName: 'Friday Social', dateLabel: 'Thursday 26 November', canForwardItem: true };
let unclaimed: unknown = [{ profile_id: 'p1', link_sent_at: null }];
let claimErr = false;

function show() {
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'organiser_unclaimed_teachers_v1') return unclaimed instanceof Error ? { data: null, error: { message: 'x' } } : { data: unclaimed, error: null };
    if (fn === 'organiser_teacher_claim_link_v1') return claimErr ? { data: null, error: { message: 'boom' } } : { data: { link_id: 'l1', token: 'tok9', expires_at: null, display_name: 'Ana Lopez' }, error: null };
    return { data: [], error: null };
  });
  render(<QueryClientProvider client={new QueryClient()}><SessionSheetV2 row={row()} count={2} ctx="night" dayLabel="x" invite={invite} onDone={vi.fn()} onRemove={vi.fn()} onClose={vi.fn()} /></QueryClientProvider>);
}
const calls = (fn: string) => rpc.mock.calls.filter((c) => c[0] === fn);

afterEach(() => { cleanup(); rpc.mockReset(); flag.on = true; unclaimed = [{ profile_id: 'p1', link_sent_at: null }]; claimErr = false; });

describe('unclaimed teachers line', () => {
  it('flag off: never called', async () => {
    flag.on = false; show();
    await new Promise((r) => setTimeout(r, 30));
    expect(calls('organiser_unclaimed_teachers_v1')).toHaveLength(0);
  });
  it('one line for the returned profile, with the right button', async () => {
    show();
    expect(await screen.findByText(/Ana Lopez hasn.t claimed their profile yet/)).toBeTruthy();
    expect(screen.queryByText(/Bo Chen hasn.t claimed/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Invite on WhatsApp' })).toBeTruthy();
    expect(calls('organiser_unclaimed_teachers_v1')[0][1]).toEqual({ p_occurrence_id: 'o1', p_profile_ids: ['p1', 'p2'] });
  });
  it('link_sent_at set: Send again', async () => {
    unclaimed = [{ profile_id: 'p1', link_sent_at: '2026-11-26T10:00:00Z' }]; show();
    expect(await screen.findByRole('button', { name: 'Send again' })).toBeTruthy();
  });
  it('tap makes the link and opens the ready sheet', async () => {
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Invite on WhatsApp' }));
    const msg = (await screen.findByTestId('class-invite-message')) as HTMLTextAreaElement;
    expect(msg.value).toContain('/claim/teacher/tok9');
    expect(msg.value).toContain('claim your teacher profile');
    expect(calls('organiser_teacher_claim_link_v1')[0][1]).toEqual({ p_occurrence_id: 'o1', p_profile_id: 'p1' });
  });
  it('create error shows the alert', async () => {
    claimErr = true; show();
    fireEvent.click(await screen.findByRole('button', { name: 'Invite on WhatsApp' }));
    await waitFor(() => expect(screen.getByText(FAIL_COPY)).toBeTruthy());
  });
  it('read error: no line, sheet still renders', async () => {
    unclaimed = new Error('x'); show();
    await waitFor(() => expect(calls('organiser_unclaimed_teachers_v1').length).toBeGreaterThan(0));
    expect(screen.queryByText(/hasn.t claimed/)).toBeNull();
    expect(screen.getByDisplayValue('Salsa basics')).toBeTruthy();
  });
});
