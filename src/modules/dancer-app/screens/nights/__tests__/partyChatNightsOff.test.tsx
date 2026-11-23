// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({
  card: { state: 'none', city_id: null, chat_id: null, closes_at: null } as Record<string, unknown>,
  join: { ok: true } as Record<string, unknown>,
  calls: [] as { fn: string; args?: Record<string, unknown> }[],
  rpc: null as unknown as (fn: string, args?: Record<string, unknown>) => Promise<unknown>,
}));
vi.mock('@/lib/goingCheckin', () => ({ GOING_CHECKIN_ENABLED: false }));
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
import { NIGHTS_OFF_LINE } from '../nightsDates';
import { FIND_A_NIGHT } from '../../../copy/sharedCopy';

afterEach(() => { cleanup(); resetShell(); vi.unstubAllEnvs(); });

describe('NightsOff (going switch off) party card', () => {
  it('flag on: shows the card (state none) above the kept empty state', async () => {
    vi.stubEnv('VITE_ENABLE_PARTY_CHAT', 'true');
    renderInShell({ path: '/app/nights' });
    await screen.findByText('Pre-party or after-party tonight?');
    expect(screen.getByTestId('party-other-city')).toBeTruthy();
    expect(screen.getByText('Nights')).toBeTruthy();
    expect(screen.getByTestId('nights-empty')).toBeTruthy();
    expect(screen.getByText(NIGHTS_OFF_LINE)).toBeTruthy();
    expect(screen.getByText(FIND_A_NIGHT)).toBeTruthy();
  });
  it('flag off: no card, no party RPC, rest unchanged', async () => {
    vi.stubEnv('VITE_ENABLE_PARTY_CHAT', 'false');
    renderInShell({ path: '/app/nights' });
    await screen.findByTestId('nights-empty');
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText(/Pre-party/)).toBeNull();
    expect(h.calls.filter((c) => /party/.test(c.fn))).toHaveLength(0);
    expect(screen.getByText('Nights')).toBeTruthy();
    expect(screen.getByText(NIGHTS_OFF_LINE)).toBeTruthy();
    expect(screen.getByText(FIND_A_NIGHT)).toBeTruthy();
  });
});
