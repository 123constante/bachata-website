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
import { inviteMessage, invitesForClass, type ClassInvite } from '../ClassInvites';

const inv = (over: Partial<ClassInvite> = {}): ClassInvite => ({ invite_id: 'v1', display_name: 'Ana Lopez', program_item_id: 'i1', added_session_id: null, forward: false, made_on_date: null, last_sent_at: null, expires_at: null, status: 'open', ...over });
const row = (over: Partial<DraftSession> = {}, orig: Record<string, unknown> | null = { series_item_id: 'i1' }): DraftSession =>
  ({ key: 's:i1', original: orig, type: 'class', title: 'Salsa basics', start: '19:30', end: '20:30', levels: [], removed: false, people: [], ...over });
const invite = (canForwardItem = true) => ({ occurrenceId: 'o1', eventName: 'Friday Social', dateLabel: 'Thursday 26 November', canForwardItem });
let list: ClassInvite[] = [];

function show(r: DraftSession | null, inv_: ReturnType<typeof invite> | null = invite()) {
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'organiser_class_invite_list_v1') return { data: list, error: null };
    if (fn === 'organiser_class_invite_create_v1') return { data: { invite_id: 'n1', token: 'tok1', expires_at: null }, error: null };
    if (fn === 'organiser_class_invite_resend_v1') return { data: { invite_id: 'v1', token: 'tok2', expires_at: null }, error: null };
    return { data: { invite_id: 'v1', revoked: true }, error: null };
  });
  render(<QueryClientProvider client={new QueryClient()}><SessionSheetV2 row={r} count={2} ctx="night" dayLabel="x" invite={inv_ ?? undefined} onDone={vi.fn()} onRemove={vi.fn()} onClose={vi.fn()} /></QueryClientProvider>);
}
const calls = (fn: string) => rpc.mock.calls.filter((c) => c[0] === fn);
const OPEN = /Invite a teacher who isn.t on the site/;

afterEach(() => { cleanup(); rpc.mockReset(); flag.on = true; list = []; });

describe('model', () => {
  it('invitesForClass: this class only, claimed hidden', () => {
    const out = invitesForClass([inv(), inv({ invite_id: 'v2', status: 'expired' }), inv({ invite_id: 'v3', status: 'claimed' }), inv({ invite_id: 'v4', program_item_id: 'i2' }), inv({ invite_id: 'v5', program_item_id: null, added_session_id: 'a1' })], { itemId: 'i1', addedId: null });
    expect(out.map((i) => i.invite_id)).toEqual(['v1', 'v2']);
    expect(invitesForClass([inv({ invite_id: 'v5', program_item_id: null, added_session_id: 'a1' })], { itemId: null, addedId: 'a1' })).toHaveLength(1);
  });
  it('inviteMessage uses the first name', () => {
    expect(inviteMessage({ name: 'Ana Lopez', classTitle: 'Salsa basics', eventName: 'Friday Social', dateLabel: 'Thursday 26 November', link: 'L' }))
      .toBe("Hi Ana, you're teaching Salsa basics at Friday Social on Thursday 26 November. Tap this link to join Bachata Calendar and you'll show on the class: L");
  });
});

describe('session sheet', () => {
  it('flag off: no invite row and no rpc', () => { flag.on = false; show(row()); expect(screen.queryByText(OPEN)).toBeNull(); expect(rpc).not.toHaveBeenCalled(); });
  it('no invite prop: nothing new', () => { show(row(), null); expect(screen.queryByText(OPEN)).toBeNull(); });
  it('new unsaved session: nothing new', () => { show(null); expect(screen.queryByText(OPEN)).toBeNull(); });
  it('party (DJs only): nothing new', () => { show(row({ type: 'party' })); expect(screen.queryByText(OPEN)).toBeNull(); });
  it('stored class shows the row and only this class\'s pending chips', async () => {
    list = [inv(), inv({ invite_id: 'v2', display_name: 'Bo', status: 'expired' }), inv({ invite_id: 'v3', display_name: 'Cy', program_item_id: 'i9' }), inv({ invite_id: 'v4', display_name: 'Di', status: 'claimed' })];
    show(row());
    expect(screen.getByText(OPEN)).toBeTruthy();
    expect(await screen.findByText('Ana Lopez')).toBeTruthy();
    expect(screen.getByText('Invited, not joined yet')).toBeTruthy();
    expect(screen.getByText('Link expired')).toBeTruthy();
    expect(screen.queryByText('Cy')).toBeNull();
    expect(screen.queryByText('Di')).toBeNull();
  });
  it('series class with later nights: two buttons, item only, p_forward each way, ready message', async () => {
    show(row());
    fireEvent.click(screen.getByText(OPEN));
    const all = screen.getByText('This date and all later dates') as HTMLButtonElement;
    expect(all.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Their name'), { target: { value: '  Ana Lopez ' } });
    fireEvent.click(all);
    await waitFor(() => expect(calls('organiser_class_invite_create_v1')).toHaveLength(1));
    expect(calls('organiser_class_invite_create_v1')[0][1]).toEqual({ p_occurrence_id: 'o1', p_program_item_id: 'i1', p_added_session_id: null, p_name: 'Ana Lopez', p_forward: true });
    const msg = (await screen.findByTestId('class-invite-message')) as HTMLTextAreaElement;
    expect(msg.value).toContain('/join/class/tok1');
    expect(screen.getByText('Send this to Ana')).toBeTruthy();
    expect((screen.getByTestId('class-invite-whatsapp') as HTMLAnchorElement).href).toContain('https://wa.me/?text=');
    fireEvent.click(screen.getByTestId('class-invite-done'));
    expect(screen.queryByTestId('class-invite-message')).toBeNull();
  });
  it('Just this date sends p_forward false', async () => {
    show(row());
    fireEvent.click(screen.getByText(OPEN));
    fireEvent.change(screen.getByLabelText('Their name'), { target: { value: 'Bo' } });
    fireEvent.click(screen.getByText('Just this date'));
    await waitFor(() => expect(calls('organiser_class_invite_create_v1')[0][1].p_forward).toBe(false));
  });
  it('one-night class (added session): single button, added id only', async () => {
    show(row({ key: 's:a1' }, { added_session_id: 'a1' }), invite(false));
    fireEvent.click(screen.getByText(OPEN));
    expect(screen.queryByText('Just this date')).toBeNull();
    fireEvent.change(screen.getByLabelText('Their name'), { target: { value: 'Bo' } });
    fireEvent.click(screen.getByText('Invite on WhatsApp'));
    await waitFor(() => expect(calls('organiser_class_invite_create_v1')).toHaveLength(1));
    expect(calls('organiser_class_invite_create_v1')[0][1]).toMatchObject({ p_program_item_id: null, p_added_session_id: 'a1', p_forward: false });
  });
  it('weekly item without later nights: single button, p_forward false', async () => {
    show(row(), invite(false));
    fireEvent.click(screen.getByText(OPEN));
    fireEvent.change(screen.getByLabelText('Their name'), { target: { value: 'Bo' } });
    fireEvent.click(screen.getByText('Invite on WhatsApp'));
    await waitFor(() => expect(calls('organiser_class_invite_create_v1')[0][1]).toMatchObject({ p_program_item_id: 'i1', p_forward: false }));
  });
  it('Resend shows the new link; Remove calls revoke', async () => {
    list = [inv()];
    show(row());
    fireEvent.click(await screen.findByText('Resend'));
    expect(((await screen.findByTestId('class-invite-message')) as HTMLTextAreaElement).value).toContain('/join/class/tok2');
    fireEvent.click(screen.getByTestId('class-invite-done'));
    fireEvent.click(screen.getByText('Remove'));
    await waitFor(() => expect(calls('organiser_class_invite_revoke_v1')[0][1]).toEqual({ p_invite_id: 'v1' }));
  });
  it('cap and generic errors', async () => {
    show(row(), invite(false));
    rpc.mockImplementation(async (fn: string) => (fn === 'organiser_class_invite_create_v1' ? { data: null, error: { message: 'cap: 20 open invites' } } : { data: [], error: null }));
    fireEvent.click(screen.getByText(OPEN));
    fireEvent.change(screen.getByLabelText('Their name'), { target: { value: 'Bo' } });
    fireEvent.click(screen.getByText('Invite on WhatsApp'));
    expect(await screen.findByText('You have 20 invites waiting. Remove one first.')).toBeTruthy();
    rpc.mockImplementation(async (fn: string) => (fn === 'organiser_class_invite_create_v1' ? { data: null, error: { message: 'boom' } } : { data: [], error: null }));
    fireEvent.click(screen.getByText('Invite on WhatsApp'));
    expect(await screen.findByText("Couldn't make the link. Try again.")).toBeTruthy();
  });
});
