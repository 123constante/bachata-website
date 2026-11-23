// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  card: { state: 'none', city_id: null, chat_id: null, closes_at: null } as Record<string, unknown>,
  join: { ok: true } as Record<string, unknown>,
  calls: [] as { fn: string; args?: Record<string, unknown> }[],
  rpc: null as unknown as (fn: string, args?: Record<string, unknown>) => Promise<unknown>,
}));
vi.mock('@/lib/goingCheckin', () => ({ GOING_CHECKIN_ENABLED: true }));
vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));
h.rpc = async (fn, args) => {
  h.calls.push({ fn, args });
  if (fn === 'get_my_going_v1') return { data: { upcoming: [], past: [] }, error: null };
  if (fn === 'get_party_card_v1') return { data: h.card, error: null };
  if (fn === 'register_party_interest_v1') return { data: h.join, error: null };
  return { data: null, error: { message: `unexpected ${fn}` } };
};
const cityRows = [{ id: 'c-lon', name: 'London' }, { id: 'c-man', name: 'Manchester' }];
const supa = vi.hoisted(() => ({ rpc: null as unknown, from: null as unknown }));
Object.assign(supa, { rpc: (f: string, a?: Record<string, unknown>) => h.rpc(f, a), from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: cityRows, error: null }) }) }) }) });
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => supa }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: supa }));
vi.mock('@/contexts/CityContext', () => ({
  CityProvider: ({ children }: { children: React.ReactNode }) => children,
  useCity: () => ({ citySlug: 'london-gb', setCitySlug: () => {} }),
}));
const edit = vi.hoisted(() => ({ city: true }));
vi.mock('../../../api/useMyDancerEdit', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useMyDancerEdit: () => ({ data: { complete: true, based_city_id: edit.city ? 'c-lon' : null, city_name: edit.city ? 'London' : null } }),
}));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';

const open = () => renderInShell({ path: '/app/nights' });
const setFlag = (on: boolean) => vi.stubEnv('VITE_ENABLE_PARTY_CHAT', on ? 'true' : 'false');
beforeEach(() => { h.calls = []; h.join = { ok: true }; edit.city = true; h.card = { state: 'none', city_id: null, chat_id: null, closes_at: null }; });
afterEach(() => { cleanup(); resetShell(); vi.unstubAllEnvs(); });

describe('party chat card', () => {
  it('flag off: no card, zero party RPC calls', async () => {
    setFlag(false);
    open();
    await screen.findByTestId('dancer-screen-nights');
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText(/Pre-party/)).toBeNull();
    expect(h.calls.filter((c) => /party/.test(c.fn))).toHaveLength(0);
  });
  it.each([true, false])('state none, profile city %s', async (hasCity) => {
    setFlag(true); edit.city = hasCity;
    open();
    await screen.findByText('Pre-party or after-party tonight?');
    expect(!!screen.queryByTestId('party-join-home')).toBe(hasCity);
    expect(screen.getByTestId('party-other-city')).toBeTruthy();
  });
  it('tap on the profile city joins with its id, no confirm', async () => {
    setFlag(true);
    open();
    fireEvent.click(await screen.findByTestId('party-join-home'));
    await waitFor(() => expect(h.calls.find((c) => c.fn === 'register_party_interest_v1')?.args).toEqual({ p_city_id: 'c-lon', p_party_date: null }));
  });
  it('Other city lists active cities; a tap joins that city', async () => {
    setFlag(true);
    open();
    fireEvent.click(await screen.findByTestId('party-other-city'));
    const rows = await screen.findAllByTestId('party-city-row');
    expect(rows).toHaveLength(2);
    fireEvent.click(rows[1]);
    await waitFor(() => expect(h.calls.find((c) => c.fn === 'register_party_interest_v1')?.args?.p_city_id).toBe('c-man'));
  });
  it('ok:false shows the error line', async () => {
    setFlag(true); h.join = { ok: false, error: 'city_not_found' };
    open();
    fireEvent.click(await screen.findByTestId('party-join-home'));
    expect((await screen.findByTestId('party-error')).textContent).toBe('Couldn’t join. Try again.');
  });
  it('state in: violet card with the city name, no button', async () => {
    setFlag(true); h.card = { state: 'in', city_id: 'c-lon', chat_id: null, closes_at: null };
    open();
    const el = await screen.findByTestId('party-card-in');
    await waitFor(() => expect(el.textContent).toContain('London'));
    expect(el.querySelector('button')).toBeNull();
  });
  it('state open: Open chat button', async () => {
    setFlag(true); h.card = { state: 'open', city_id: 'c-lon', chat_id: 'chat1', closes_at: null };
    open();
    expect((await screen.findByTestId('party-open-chat')).textContent).toBe('Open chat');
  });
  it('state closed: no card', async () => {
    setFlag(true); h.card = { state: 'closed', city_id: null, chat_id: null, closes_at: null };
    open();
    await waitFor(() => expect(h.calls.some((c) => c.fn === 'get_party_card_v1')).toBe(true));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('party-card-none')).toBeNull();
    expect(screen.queryByTestId('party-card-in')).toBeNull();
  });
});
