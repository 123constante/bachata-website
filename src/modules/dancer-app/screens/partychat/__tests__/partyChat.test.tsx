// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const h = vi.hoisted(() => ({ calls: [] as { fn: string; args?: Record<string, unknown> }[], rpc: null as unknown as (fn: string, a?: Record<string, unknown>) => unknown }));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: async (fn: string, args?: Record<string, unknown>) => { h.calls.push({ fn, args }); return h.rpc(fn, args); } }));
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: React.ReactNode }) => children }));
import { PartyChatRoute, dayLabel, dropRemoved, mergeMessages } from '../PartyChatScreen';

const now = Date.now();
const iso = (minsAgo: number) => new Date(now - minsAgo * 60000).toISOString();
const msg = (id: string, mins: number, mine = false) => ({ id, profile_id: mine ? 'me' : 'p', display_name: 'Ana Lopez', avatar_url: null, body: `body ${id}`, created_at: iso(mins), mine });
const st = { state: 'open', msgs: [msg('a', 5), msg('b', 4, true)], more: false, get: 'ok', post: { ok: true } as Record<string, unknown>, leave: { ok: true } as Record<string, unknown> };
h.rpc = (fn) => {
  if (fn === 'get_party_chat_v1') return { data: st.get === 'ok' ? { ok: true, chat: { id: 'c1', city_name: 'London', party_date: '2026-11-24', closes_at: null, state: st.state }, messages: st.msgs, has_more: st.more } : { ok: false, error: 'not_member' }, error: null };
  if (fn === 'post_party_chat_message_v1') return { data: st.post, error: null };
  if (fn === 'leave_party_chat_v1') return { data: st.leave, error: null };
  return { data: { ok: true }, error: null };
};
const open = () => render(<MemoryRouter initialEntries={['/account/party-chat/c1']}><Routes><Route path="/account/party-chat/:chatId" element={<PartyChatRoute />} /><Route path="/account" element={<p>ACCOUNT</p>} /><Route path="/app/nights" element={<p>NIGHTS</p>} /></Routes></MemoryRouter>);
beforeEach(() => { h.calls = []; st.state = 'open'; st.msgs = [msg('a', 5), msg('b', 4, true)]; st.more = false; st.get = 'ok'; st.post = { ok: true }; st.leave = { ok: true }; vi.stubEnv('VITE_ENABLE_PARTY_CHAT', 'true'); });
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.useRealTimers(); });
const type = (v: string) => fireEvent.change(screen.getByTestId('party-chat-input'), { target: { value: v } });

describe('party chat screen', () => {
  it('flag off: redirects to /account, zero RPC calls', async () => {
    vi.stubEnv('VITE_ENABLE_PARTY_CHAT', 'false');
    open();
    await screen.findByText('ACCOUNT');
    expect(h.calls).toHaveLength(0);
  });
  it('open: header, notice, bubbles, mark read', async () => {
    open();
    expect((await screen.findByText(/Party chat \u00b7 London/)).textContent).toContain('London');
    expect(screen.getByTestId('party-chat-notice').textContent).toBe('Admin can read this chat to keep it safe.');
    expect(screen.getAllByTestId('party-chat-msg')).toHaveLength(2);
    expect(screen.getAllByTestId('party-chat-msg')[1].getAttribute('data-mine')).toBe('true');
    await waitFor(() => expect(h.calls.some((c) => c.fn === 'mark_party_chat_read_v1')).toBe(true));
  });
  it('closed: no composer, says so', async () => {
    st.state = 'closed';
    open();
    await screen.findByTestId('party-chat-closed');
    expect(screen.queryByTestId('party-chat-input')).toBeNull();
  });
  it('not_member: screen with Back to Nights', async () => {
    st.get = 'no';
    open();
    fireEvent.click(await screen.findByText('Back to Nights'));
    await screen.findByText('NIGHTS');
  });
  it('send ok posts the trimmed body; Send disabled when empty', async () => {
    open();
    await screen.findByTestId('party-chat-input');
    expect((screen.getByTestId('party-chat-send') as HTMLButtonElement).disabled).toBe(true);
    type('  hi  ');
    fireEvent.click(screen.getByTestId('party-chat-send'));
    await waitFor(() => expect(h.calls.find((c) => c.fn === 'post_party_chat_message_v1')?.args).toEqual({ p_chat_id: 'c1', p_body: 'hi' }));
  });
  it.each([['too_long', 'Keep it under 500 characters.'], ['slow_down', 'Slow down a little.']])('refusal %s', async (e, line) => {
    st.post = { ok: false, error: e };
    open();
    await screen.findByTestId('party-chat-input');
    type('x');
    fireEvent.click(screen.getByTestId('party-chat-send'));
    expect((await screen.findByTestId('party-chat-send-error')).textContent).toBe(line);
  });
  it('refusal closed switches to the closed state', async () => {
    st.post = { ok: false, error: 'closed' };
    open();
    await screen.findByTestId('party-chat-input');
    type('x');
    fireEvent.click(screen.getByTestId('party-chat-send'));
    await screen.findByTestId('party-chat-closed');
  });
  it('day dividers and merge without duplicates', () => {
    const n = new Date();
    expect(dayLabel(n.toISOString(), n)).toBe('Today');
    expect(dayLabel(new Date(n.getTime() - 86400000).toISOString(), n)).toBe('Yesterday');
    expect(dayLabel('2026-11-10T12:00:00Z', n)).toMatch(/^Tue 10 Nov$/);
    expect(mergeMessages([msg('a', 5), msg('b', 4)], [msg('b', 4), msg('c', 3)]).map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });
  it('poll every 5s merges new messages once', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    open();
    await screen.findAllByTestId('party-chat-msg');
    st.msgs = [msg('a', 5), msg('b', 4, true), msg('c', 0)];
    await act(async () => { await vi.advanceTimersByTimeAsync(5100); });
    await waitFor(() => expect(screen.getAllByTestId('party-chat-msg')).toHaveLength(3));
  });
  it('leave: sheet, Leave calls RPC and goes to Nights', async () => {
    open();
    fireEvent.click(await screen.findByTestId('party-chat-menu'));
    fireEvent.click(screen.getByTestId('party-chat-leave'));
    expect(screen.getByText('You can\u2019t rejoin once you leave.')).toBeTruthy();
    fireEvent.click(screen.getByTestId('party-chat-leave-confirm'));
    await screen.findByText('NIGHTS');
    expect(h.calls.some((c) => c.fn === 'leave_party_chat_v1')).toBe(true);
  });
  it('report: only other people\u2019s messages, reason sent, toast', async () => {
    open();
    fireEvent.click(await screen.findByTestId('party-chat-menu'));
    fireEvent.click(screen.getByTestId('party-chat-report'));
    const [theirs, mine] = screen.getAllByTestId('party-chat-msg');
    fireEvent.click(mine);
    expect(screen.queryByTestId('party-chat-report-sheet')).toBeNull();
    fireEvent.click(theirs);
    fireEvent.click(screen.getAllByTestId('party-chat-reason')[1]);
    fireEvent.click(screen.getByTestId('party-chat-report-send'));
    expect((await screen.findByTestId('party-chat-toast')).textContent).toBe('Thanks, we\u2019ll look at it.');
    expect(h.calls.find((c) => c.fn === 'report_party_chat_message_v1')?.args).toEqual({ p_message_id: 'a', p_reason: 'Rude or unsafe' });
  });
});

describe('party chat S3 fixes', () => {
  it('sending while scrolled up scrolls to the bottom', async () => {
    open();
    const list = await screen.findByTestId('party-chat-list');
    Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 1000 });
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: 300 });
    list.scrollTop = 0;
    fireEvent.scroll(list);
    type('hello');
    st.msgs = [msg('a', 5), msg('b', 4, true), msg('c', 0, true)];
    fireEvent.click(screen.getByTestId('party-chat-send'));
    await waitFor(() => expect(screen.getAllByTestId('party-chat-msg')).toHaveLength(3));
    expect(list.scrollTop).toBe(1000);
  });

  it('polling skips a tick while the previous fetch is pending', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const base = h.rpc;
    let release: () => void = () => {};
    let gets = 0;
    h.rpc = (fn, a) => {
      if (fn !== 'get_party_chat_v1') return base(fn, a);
      gets += 1;
      if (gets === 1) return base(fn, a);
      return new Promise((res) => { release = () => res(base(fn, a)); });
    };
    try {
      open();
      await screen.findAllByTestId('party-chat-msg');
      await act(async () => { await vi.advanceTimersByTimeAsync(5100); });
      expect(gets).toBe(2);
      await act(async () => { await vi.advanceTimersByTimeAsync(10100); });
      expect(gets).toBe(2);
      await act(async () => { release(); });
      await act(async () => { await vi.advanceTimersByTimeAsync(5100); });
      expect(gets).toBe(3);
    } finally {
      h.rpc = base;
    }
  });

  it('dropRemoved: removes held messages inside the page range, keeps older and newer', () => {
    const held = [msg('old', 30), msg('a', 5), msg('gone', 4), msg('b', 3), msg('new', 0)];
    const page = [msg('a', 5), msg('b', 3)];
    expect(dropRemoved(held, page).map((m) => m.id)).toEqual(['old', 'a', 'b', 'new']);
    expect(dropRemoved(held, [])).toBe(held);
  });

  it('a poll that no longer lists a message removes it without reload', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    st.msgs = [msg('a', 5), msg('x', 4), msg('b', 3, true)];
    open();
    await waitFor(() => expect(screen.getAllByTestId('party-chat-msg')).toHaveLength(3));
    st.msgs = [msg('a', 5), msg('b', 3, true)];
    await act(async () => { await vi.advanceTimersByTimeAsync(5100); });
    await waitFor(() => expect(screen.getAllByTestId('party-chat-msg')).toHaveLength(2));
    expect(screen.queryByText('body x')).toBeNull();
  });

  it('Space activates a message in report mode, same as Enter', async () => {
    open();
    fireEvent.click(await screen.findByTestId('party-chat-menu'));
    fireEvent.click(screen.getByTestId('party-chat-report'));
    const [theirs] = screen.getAllByTestId('party-chat-msg');
    fireEvent.keyDown(theirs, { key: ' ' });
    expect(screen.getByTestId('party-chat-report-sheet')).toBeTruthy();
  });
});
