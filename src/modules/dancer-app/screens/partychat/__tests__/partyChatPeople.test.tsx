// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const h = vi.hoisted(() => ({ members: { data: [] as unknown, error: null as unknown } }));
vi.mock('@/integrations/supabase/rpcLoose', () => ({
  rpcLoose: async (fn: string) => {
    if (fn === 'get_party_chat_v1') return { data: { ok: true, chat: { id: 'c1', city_name: 'London', party_date: '2026-11-24', closes_at: null, state: 'open' }, messages: [{ id: 'a', profile_id: 'p1', display_name: 'Ana', avatar_url: null, body: 'hi', created_at: '2026-11-23T10:00:00Z', mine: false }, { id: 'b', profile_id: 'me', display_name: 'Me', avatar_url: null, body: 'yo', created_at: '2026-11-23T12:00:00Z', mine: true }], has_more: false }, error: null };
    if (fn === 'get_party_chat_members_v1') return h.members;
    return { data: { ok: true }, error: null };
  },
}));
vi.mock('@/integrations/supabase/client', () => {
  const ch = { on: () => ch, subscribe: () => ch, track: async () => 'ok', presenceState: () => ({}) };
  return { supabase: { channel: () => ch, removeChannel: async () => 'ok' } };
});
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: React.ReactNode }) => children }));
import { PartyChatRoute } from '../PartyChatScreen';
import { parseMembers } from '../usePartyChatPeople';

const mem = (id: string, name: string, joined: string, role: string | null = null) => ({ profile_id: id, first_name: name, avatar_url: null, top_role: role, joined_at: joined });
const open = () => render(<MemoryRouter initialEntries={['/account/party-chat/c1']}><Routes><Route path="/account/party-chat/:chatId" element={<PartyChatRoute />} /><Route path="/dancers/:id" element={<p>PROFILE</p>} /></Routes></MemoryRouter>);
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

describe('party chat people', () => {
  it('parseMembers drops junk and unknown roles', () => {
    expect(parseMembers(null)).toEqual([]);
    expect(parseMembers([{ profile_id: 1 }, mem('x', 'X', '2026-11-23T09:00:00Z', 'boss')])[0].top_role).toBeNull();
  });
  it('strip, sheet, one badge, row opens profile; keep-list intact', async () => {
    vi.stubEnv('VITE_ENABLE_PARTY_CHAT', 'true');
    h.members = { data: [mem('p1', 'Ana', '2026-11-23T09:00:00Z', 'dj'), mem('me', 'Me', '2026-11-23T09:30:00Z'), mem('p3', 'Zed', '2026-11-23T11:00:00Z')], error: null };
    open();
    expect((await screen.findByTestId('party-chat-strip-count')).textContent).toBe('3 here tonight');
    expect(screen.getByTestId('party-chat-notice').textContent).toBe('Admin can read this chat to keep it safe.');
    expect(screen.getAllByTestId('party-chat-join').map((e) => e.textContent)).toEqual(['Zed joined the chat']);
    fireEvent.click(screen.getByTestId('party-chat-strip'));
    expect(await screen.findByText(/Others/)).toBeTruthy();
    expect(screen.getAllByTestId('party-chat-badge').map((e) => e.textContent)).toEqual(['DJ']);
    fireEvent.click(screen.getAllByTestId('party-chat-person')[0]);
    await screen.findByText('PROFILE');
  });
  it('RPC error: no strip, chat still works', async () => {
    vi.stubEnv('VITE_ENABLE_PARTY_CHAT', 'true');
    h.members = { data: null, error: { message: 'x' } };
    open();
    await screen.findByTestId('party-chat-input');
    await waitFor(() => expect(screen.queryByTestId('party-chat-strip')).toBeNull());
  });
});
