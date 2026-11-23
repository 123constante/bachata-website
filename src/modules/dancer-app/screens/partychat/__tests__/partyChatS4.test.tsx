// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const h = vi.hoisted(() => ({
  card: { state: 'none', city_id: null, chat_id: null, closes_at: null } as Record<string, unknown>,
  cities: [{ id: 'c-lon', name: 'London' }] as { id: string; name: string }[],
  calls: [] as string[],
}));
vi.mock('@/lib/goingCheckin', () => ({ GOING_CHECKIN_ENABLED: true }));
vi.mock('@/hooks/useAuth', async (importOriginal) => (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));
const rpc = async (fn: string) => {
  h.calls.push(fn);
  if (fn === 'get_my_going_v1') return { data: { upcoming: [], past: [] }, error: null };
  if (fn === 'get_party_card_v1') return { data: h.card, error: null };
  if (fn === 'get_party_chat_v1') return { data: { ok: true, chat: { id: 'chat1', city_name: 'London', party_date: null, closes_at: null, state: 'open' }, messages: [], has_more: false }, error: null };
  return { data: { ok: true }, error: null };
};
const supa = vi.hoisted(() => ({ rpc: null as unknown, from: null as unknown }));
Object.assign(supa, { rpc, from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: h.cities, error: null }) }) }) }) });
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => supa }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: supa }));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: (fn: string) => rpc(fn) }));
vi.mock('@/contexts/CityContext', () => ({ CityProvider: ({ children }: { children: React.ReactNode }) => children, useCity: () => ({ citySlug: 'london-gb', setCitySlug: () => {} }) }));
vi.mock('../../../api/useMyDancerEdit', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useMyDancerEdit: () => ({ data: { complete: true, based_city_id: 'c-lon', city_name: 'London', strength: { missing: [] } } }),
}));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { isPartyChatPath, partyChatPath } from '@/modules/dancer-app/shell/routes';

const root = path.resolve(__dirname, '../../../../../..');
const src = (p: string) => readFileSync(path.join(root, p), 'utf8');
beforeEach(() => { h.calls = []; h.cities = [{ id: 'c-lon', name: 'London' }]; h.card = { state: 'none', city_id: null, chat_id: null, closes_at: null }; vi.stubEnv('VITE_ENABLE_PARTY_CHAT', 'true'); });
afterEach(() => { cleanup(); resetShell(); vi.unstubAllEnvs(); });

describe('party chat S4: chat chrome', () => {
  it('renders full-screen in the dancer shell with no tabs and no site header', async () => {
    renderInShell({ path: '/app/party-chat/chat1' });
    await screen.findByTestId('party-chat');
    expect(screen.getByTestId('dancer-app-shell').getAttribute('data-chrome')).toBe('chat');
    expect(screen.queryByTestId('dancer-app-tabs')).toBeNull();
    expect(screen.queryByTestId('dancer-app-header')).toBeNull();
    expect(screen.getByTestId('party-chat-back').getAttribute('aria-label')).toBe('Back to Nights');
  });
  it('Back goes to Nights', async () => {
    renderInShell({ path: '/app/party-chat/chat1' });
    fireEvent.click(await screen.findByTestId('party-chat-back'));
    await screen.findByTestId('dancer-screen-nights');
  });
  it('flag off: leaves the chat path, zero chat calls', async () => {
    vi.stubEnv('VITE_ENABLE_PARTY_CHAT', 'false');
    renderInShell({ path: '/app/party-chat/chat1' });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('party-chat')).toBeNull();
    expect(h.calls.filter((c) => /party_chat/.test(c))).toHaveLength(0);
  });
  it('path helpers', () => {
    expect(partyChatPath('x')).toBe('/app/party-chat/x');
    expect(isPartyChatPath('/app/party-chat/x')).toBe(true);
    expect(isPartyChatPath('/app/nights')).toBe(false);
  });
  it('the old path redirects to the new one, and every link goes to the new path', () => {
    expect(src('src/components/AnimatedRoutes.tsx')).toContain('/app/party-chat/${useParams().chatId');
    for (const f of ['src/modules/dancer-app/shell/bellAlerts.ts', 'src/modules/dancer-app/screens/nights/PartyChatCard.tsx']) {
      expect(src(f), f).toContain('/app/party-chat/');
      expect(src(f), f).not.toContain('/account/party-chat/');
    }
  });
});

describe('party chat S4: Nights card', () => {
  const open = () => renderInShell({ path: '/app/nights' });
  it('city list Back returns to the two buttons', async () => {
    open();
    fireEvent.click(await screen.findByTestId('party-other-city'));
    await screen.findAllByTestId('party-city-row');
    expect(screen.queryByTestId('party-other-city')).toBeNull();
    fireEvent.click(screen.getByTestId('party-city-back'));
    expect(screen.getByTestId('party-join-home')).toBeTruthy();
    expect(screen.getByTestId('party-other-city')).toBeTruthy();
    expect(screen.queryByTestId('party-city-back')).toBeNull();
  });
  it('empty city list says so and keeps Back', async () => {
    h.cities = [];
    open();
    fireEvent.click(await screen.findByTestId('party-other-city'));
    expect((await screen.findByTestId('party-city-empty')).textContent).toBe('No cities available right now.');
    expect(screen.getByTestId('party-city-back').textContent).toBe('Back');
  });
  it('none: heading, line, home + Other city, no Back', async () => {
    open();
    await screen.findByText('Pre-party or after-party tonight?');
    expect(screen.getByText(/Tap your city if you/)).toBeTruthy();
    expect(screen.getByTestId('party-join-home').textContent).toBe('London');
    expect(screen.queryByTestId('party-city-back')).toBeNull();
  });
  it('in: unchanged lines, no button', async () => {
    h.card = { state: 'in', city_id: 'c-lon', chat_id: null, closes_at: null };
    open();
    const el = await screen.findByTestId('party-card-in');
    expect(el.textContent).toContain('The chat opens tonight if enough people join.');
    expect(el.querySelector('button')).toBeNull();
  });
  it('open: title and the one Open chat button, going to the new path', async () => {
    h.card = { state: 'open', city_id: 'c-lon', chat_id: 'chat1', closes_at: null };
    open();
    const btn = await screen.findByTestId('party-open-chat');
    expect(screen.getByTestId('party-card-open').querySelectorAll('button')).toHaveLength(1);
    fireEvent.click(btn);
    await screen.findByTestId('party-chat');
    await waitFor(() => expect(h.calls).toContain('get_party_chat_v1'));
  });
});
