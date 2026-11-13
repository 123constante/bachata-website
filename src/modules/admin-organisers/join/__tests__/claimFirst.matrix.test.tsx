// @vitest-environment jsdom
/**
 * Claim-first organiser invite (docs/briefs/claim-first-organiser-invite.md), table-driven: every prod invite
 * shape surveyed 2026-11-13 (open email-bound with/without prefill, open unbound, expired, revoked, used,
 * person-bound) x every invitee (signed out, signed in without a finished profile, finished, already on the
 * team) x the flag. The real case: an invitee typed the organisation's name ("Sueno Events") as their own
 * first name because "A bit about you" came before anything showed the organisation.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ProfileCompletion } from '@/lib/profileCompletion';
import { nameIsOrganisation, organiserLogoUrl, parseJoinPreview, recallClaimConfirmed, rememberClaimConfirmed, showClaimFirst, type JoinStep } from '../joinModel';

const TOKEN = 'cd'.repeat(32);
const ORG = 'Sueno Events';
const h = vi.hoisted(() => ({
  flag: true,
  auth: { user: null as null | { id: string; email: string }, authStatus: 'ready' as 'ready' | 'resolving', signOut: async () => 'signed-out' },
  completion: { status: 'signed_out', missing: [], profileId: null } as ProfileCompletion,
  rpc: vi.fn(),
  save: vi.fn(async () => undefined),
  organisers: [] as { id: string; name: string }[],
}));
vi.mock('@/lib/featureFlags', async (orig) => {
  const real = (await orig()) as { flags: Record<string, unknown> };
  return { ...real, flags: new Proxy(real.flags, { get: (t, k) => (k === 'claimFirstInvite' ? h.flag : t[k as string]) }) };
});
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => h.auth }));
vi.mock('@/hooks/useProfileCompletion', () => ({
  useProfileCompletion: () => ({ ...h.completion, refetch: async () => h.completion }),
  profileCompletionQueryKey: (id: string | null) => ['profile-completion', id],
}));
vi.mock('@/lib/saveMyDancerProfile', () => ({ saveMyDancerProfile: (...a: unknown[]) => h.save(...(a as [])) }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/lib/claimMyDancerProfile', () => ({ claimAtSignIn: async () => ({ status: 'not_applicable', profileId: null }) }));
vi.mock('@/modules/organiser/shared/selfServeApi', () => ({
  ORGANISER_HOME_KEY: ['organiser-home'],
  organiserHomeQueryKey: (id: string | undefined) => ['organiser-home', id ?? null],
  fetchOrganiserHome: async () => ({ organisers: h.organisers }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...a: unknown[]) => h.rpc(...a),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
    auth: { signInWithOtp: vi.fn(), verifyOtp: vi.fn(), getSession: async () => ({ data: { session: null } }) },
  },
}));

import InviteRedeemPage from '../../InviteRedeemPage';

type Person = 'signed_out' | 'no_name_yet' | 'finished' | 'on_team';
const PERSONS: Person[] = ['signed_out', 'no_name_yet', 'finished', 'on_team'];
const ME = { id: 'u1', email: 'sueno@example.com' };

function become(p: Person) {
  h.organisers = [];
  if (p === 'signed_out') {
    h.auth = { ...h.auth, user: null };
    h.completion = { status: 'signed_out', missing: [], profileId: null };
    return;
  }
  h.auth = { ...h.auth, user: ME };
  h.completion = p === 'no_name_yet' ? { status: 'incomplete', missing: ['first_name'], profileId: 'p1' } : { status: 'complete', missing: [], profileId: 'p1' };
  if (p === 'on_team') h.organisers = [{ id: 'o1', name: ORG }];
}

const ok = (data: unknown) => Promise.resolve({ data, error: null });
const base = { status: 'open', organiser_name: ORG, inviter_first_name: 'Ricky', email_hint: null };

/** What the page shows first: the claim screen, or the derived step's data-step. */
type Shown = 'claim' | JoinStep;
interface Shape { name: string; preview: Record<string, unknown>; on: Record<Person, Shown>; off: Record<Person, Shown> }
const OPEN_ON: Record<Person, Shown> = { signed_out: 'claim', no_name_yet: 'claim', finished: 'join', on_team: 'done' };
const OPEN_OFF: Record<Person, Shown> = { signed_out: 'email', no_name_yet: 'about', finished: 'join', on_team: 'done' };
const DEAD: Record<Person, Shown> = { signed_out: 'dead', no_name_yet: 'dead', finished: 'dead', on_team: 'dead' };
const SHAPES: Shape[] = [
  { name: 'open, email-bound, no prefill', preview: { ...base, email_hint: 's***@example.com', self_bound: false }, on: OPEN_ON, off: OPEN_OFF },
  { name: 'open, email-bound, prefill', preview: { ...base, email_hint: 's***@example.com', prefill: { first_name: 'Ana', city_id: null } }, on: OPEN_ON, off: OPEN_OFF },
  { name: 'open, unbound', preview: base, on: OPEN_ON, off: OPEN_OFF },
  { name: 'open, person-bound', preview: { ...base, person: { first_name: 'Ana', avatar_url: null, city: 'London' } }, on: OPEN_ON, off: OPEN_OFF },
  { name: 'expired', preview: { ...base, status: 'expired' }, on: DEAD, off: DEAD },
  { name: 'revoked', preview: { ...base, status: 'revoked' }, on: DEAD, off: DEAD },
  // Used (already-claimed organiser): never the claim screen; the person who used it is sent to their team.
  { name: 'used (organiser already claimed)', preview: { ...base, status: 'used' }, on: { ...DEAD, on_team: 'done' }, off: { ...DEAD, on_team: 'done' } },
];

function mount() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/invite/${TOKEN}`]}>
        <Routes>
          <Route path="/invite/:token" element={<InviteRedeemPage />} />
          <Route path="*" element={<p data-testid="elsewhere">elsewhere</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function serve(preview: unknown, person: Person) {
  h.rpc.mockImplementation((fn: string) => {
    if (fn === 'organiser_invite_preview_v1') return ok(preview);
    if (fn === 'redeem_organiser_invite_v1') return ok(person === 'on_team' ? { ok: true, status: 'already_member', organiser_id: 'o1' } : { ok: false, reason: 'used' });
    return ok({});
  });
}

async function shown(): Promise<Shown> {
  const step = await screen.findByTestId('join-step');
  await waitFor(() => expect(step.getAttribute('data-step')).not.toBe('checking'), { timeout: 4000 });
  // Let the page-list read settle (a member's Done can follow the first non-checking render).
  await new Promise((r) => setTimeout(r, 30));
  return screen.queryByTestId('join-claim') ? 'claim' : (screen.getByTestId('join-step').getAttribute('data-step') as JoinStep);
}

beforeEach(() => {
  h.rpc.mockReset();
  h.save.mockClear();
  sessionStorage.clear();
  window.history.replaceState(null, '', `/invite/${TOKEN}`);
});
afterEach(cleanup);

describe.each([true, false])('flag claimFirstInvite=%s', (flag) => {
  describe.each(SHAPES)('shape: $name', (shape) => {
    it.each(PERSONS)('%s', async (person) => {
      h.flag = flag;
      become(person);
      serve(shape.preview, person);
      mount();
      expect(await shown()).toBe((flag ? shape.on : shape.off)[person]);
      // Nothing is claimed by looking: no redeem except the used-link membership check.
      if (shape.preview.status === 'open') expect(h.rpc).not.toHaveBeenCalledWith('redeem_organiser_invite_v1', expect.anything());
      expect(h.save).not.toHaveBeenCalled();
      expect(screen.queryByTestId('elsewhere')).toBeNull();
    });
  });
});

describe('claim screen (flag on)', () => {
  beforeEach(() => { h.flag = true; });

  it('shows the organisation name, its first letter without a logo, and who sent the link', async () => {
    become('signed_out');
    serve(base, 'signed_out');
    mount();
    expect(await shown()).toBe('claim');
    expect(screen.getByTestId('join-claim-name').textContent).toBe(ORG);
    expect(screen.getByTestId('join-claim-initial').textContent).toBe('S');
    expect(screen.getByTestId('join-claim-heading').textContent).toBe('You are taking over this organisation');
    expect(screen.getByTestId('join-claim-by').textContent).toContain('Ricky');
    expect(screen.getByTestId('join-claim-help').getAttribute('href')).toMatch(/^https:\/\//);
  });

  it('shows the logo when the preview carries one', async () => {
    become('signed_out');
    serve({ ...base, organiser_logo_url: 'https://cdn.example.com/sueno.png' }, 'signed_out');
    mount();
    expect(await shown()).toBe('claim');
    expect(screen.getByTestId('join-claim-logo').getAttribute('src')).toBe('https://cdn.example.com/sueno.png');
  });

  it('signed out: Yes -> the email step; the confirm sends nothing and survives a reload', async () => {
    become('signed_out');
    serve(base, 'signed_out');
    const first = mount();
    expect(await shown()).toBe('claim');
    const before = h.rpc.mock.calls.length;
    fireEvent.click(screen.getByTestId('join-claim-confirm'));
    expect(await shown()).toBe('email');
    expect(h.rpc.mock.calls.length).toBe(before);
    first.unmount();
    mount();
    expect(await shown()).toBe('email');
  });

  it('signed in, no name yet: Yes -> "Now about you"; the organisation name is refused as a first name', async () => {
    become('no_name_yet');
    serve(base, 'no_name_yet');
    mount();
    expect(await shown()).toBe('claim');
    fireEvent.click(screen.getByTestId('join-claim-confirm'));
    expect(await shown()).toBe('about');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Now about you');
    expect(screen.getByText('Your own first name')).toBeTruthy();
    expect(screen.getByTestId('join-about-lead').textContent).toContain(ORG);
    const input = screen.getByTestId('join-about-first-name');
    const save = screen.getByTestId('join-about-save') as HTMLButtonElement;
    // Untouched: Continue is off with a reason, and nothing is saved.
    expect(save.disabled).toBe(true);
    for (const typed of ['Sueno Events', '  sueno events ', 'SUENO-EVENTS', 'Suéno Events']) {
      fireEvent.change(input, { target: { value: typed } });
      expect(save.disabled).toBe(true);
      expect(screen.getByTestId('join-about-name-is-org').textContent).toContain('your own first name');
      expect(save.getAttribute('aria-describedby')).toBe('join-about-name-is-org');
    }
    fireEvent.change(input, { target: { value: 'Maria' } });
    expect(save.disabled).toBe(false);
    expect(screen.queryByTestId('join-about-name-is-org')).toBeNull();
    fireEvent.click(save);
    await waitFor(() => expect(h.save).toHaveBeenCalledWith({ first_name: 'Maria' }));
  });

  it('flag off: About is unchanged (old heading, no organisation-name refusal)', async () => {
    h.flag = false;
    become('no_name_yet');
    serve(base, 'no_name_yet');
    mount();
    expect(await shown()).toBe('about');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('A bit about you');
    fireEvent.change(screen.getByTestId('join-about-first-name'), { target: { value: ORG } });
    expect((screen.getByTestId('join-about-save') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByTestId('join-about-name-is-org')).toBeNull();
  });
});

describe('claim-first model', () => {
  const steps: JoinStep[] = ['checking', 'dead', 'unreachable', 'email', 'code', 'about', 'join', 'done', 'wrong_account', 'no_profile'];
  it.each(steps)('showClaimFirst on step %s', (step) => {
    const expected = step === 'email' || step === 'about';
    expect(showClaimFirst({ enabled: true, step, confirmed: false })).toBe(expected);
    expect(showClaimFirst({ enabled: true, step, confirmed: true })).toBe(false);
    expect(showClaimFirst({ enabled: false, step, confirmed: false })).toBe(false);
  });

  it.each([
    ['Sueno Events', 'Sueno Events', true],
    ['sueno events', 'Sueno Events', true],
    ['Sueno', 'Sueno Events', false],
    ['Maria', 'Maria Bachata', false],
    ['', 'Sueno Events', false],
    ['   ', 'Sueno Events', false],
    ['Café Latino', 'Cafe Latino', true],
  ])('nameIsOrganisation(%j, %j) = %s', (first, org, want) => {
    expect(nameIsOrganisation(first, org)).toBe(want);
  });

  it('logo: https only, else null; parseJoinPreview carries it', () => {
    expect(organiserLogoUrl({ organiser_logo_url: 'https://x/y.png' })).toBe('https://x/y.png');
    expect(organiserLogoUrl({ organiser_logo_url: 'http://x/y.png' })).toBeNull();
    expect(organiserLogoUrl({ organiser_logo_url: 'javascript:alert(1)' })).toBeNull();
    expect(organiserLogoUrl({})).toBeNull();
    expect(organiserLogoUrl(null)).toBeNull();
    expect(parseJoinPreview({ ...base, organiser_logo_url: 'https://x/y.png' })?.organiserLogoUrl).toBe('https://x/y.png');
    expect(parseJoinPreview(base)?.organiserLogoUrl).toBeNull();
  });

  it('the confirm is per link: another link asks again', () => {
    rememberClaimConfirmed(TOKEN);
    expect(recallClaimConfirmed(TOKEN)).toBe(true);
    expect(recallClaimConfirmed('ef'.repeat(32))).toBe(false);
  });
});
