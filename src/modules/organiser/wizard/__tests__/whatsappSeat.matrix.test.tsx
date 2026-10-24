// @vitest-environment jsdom
/**
 * FIX-RELEASE-A-WEB #2 (owner decision D76): the required `phone_or_whatsapp`
 * step. The server (admin 20261129370000) counts an active owner/manager seat
 * as WhatsApp-eligible. The wizard's REAL dancer writer runs here
 * (save_my_dancer_profile_v2 through dancerApi); only the RPC is a fake that
 * models the server's rule. If a server still answers `whatsapp_not_allowed`,
 * the step stays required and the copy gives the team's contact links, never a
 * dead end.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc, from: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'me@x.example' }, session: null }) }));

import { ProfileWizardScreen } from '../ProfileWizard';
import { saveWizardDancer, WHATSAPP_NOT_ALLOWED_COPY } from '../dancerApi';
import { SKIP_LABEL } from '../stepKinds';
import type { WizardWriters } from '../wizardApi';

const QUESTION = 'What is your WhatsApp number?';
const NUMBER = '+44 7700 900123';
/** What is saved: the ONE phone rule's E.164 (invite W2); the box keeps the digits after the picked +44. */
const E164 = '+447700900123';

/** The server's D76 rule: another active role, OR an active owner/manager seat. `d76: false` = a server without it. */
type Who = { otherRoles: string[]; seat: 'owner' | 'manager' | null; d76: boolean };
let who: Who;
let saved: Record<string, unknown>[];

function serverAllowsWhatsapp(w: Who): boolean {
  return w.otherRoles.length > 0 || (w.d76 && w.seat !== null);
}

beforeEach(() => {
  saved = [];
  vi.unstubAllEnvs();
  const dancerRow = () => ({ profile_id: 'p1', user_id: 'u1', first_name: 'Ana', whatsapp: null, languages: [], favorite_styles: [], achievements: [], other_roles: who.otherRoles });
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string, args?: Record<string, unknown>) => {
    if (fn === 'organiser_home_v1') {
      const organisers = who.seat ? [{ id: 'org-1', name: 'Ritmo', slug: 'ritmo', avatar_url: null, city_id: 'c1', lifecycle_status: 'live', role: who.seat, latest_decision: null, series: [], team: [] }] : [];
      return { data: { today: '2026-10-20', organisers }, error: null };
    }
    if (fn === 'my_profile_progress_v1') {
      return { data: { percent: 80, required_left: 1, publish_ready: false, declined: [], steps: [{ area: 'dancer', field: 'phone_or_whatsapp', required: true, done: false }, { area: 'dancer', field: 'bio', required: false, done: false }] }, error: null };
    }
    if (fn === 'my_dancer_edit_v1') return { data: dancerRow(), error: null };
    if (fn === 'save_my_dancer_profile_v2') {
      const payload = (args?.p_payload ?? {}) as Record<string, unknown>;
      saved.push(payload);
      if ('whatsapp' in payload && !serverAllowsWhatsapp(who)) return { data: null, error: { message: 'whatsapp_not_allowed' } };
      return { data: { ...dancerRow(), ...payload }, error: null };
    }
    return { data: null, error: { message: `unexpected ${fn}` } };
  });
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // The REAL dancer writer: the payload is what save_my_dancer_profile_v2 receives.
  const writers = { saveDancer: saveWizardDancer, saveOrganiser: vi.fn() } as unknown as WizardWriters;
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/account/o/complete']}>
        <Routes>
          <Route path="/account/o/complete" element={<ProfileWizardScreen writers={writers} uploadLogo={async () => ''} />} />
          <Route path="*" element={<span data-testid="where" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const question = () => screen.getByTestId('wizard-question').textContent;

async function answerNumber() {
  mount();
  await waitFor(() => expect(question()).toBe(QUESTION));
  expect(screen.queryByText(SKIP_LABEL)).toBeNull(); // required: never optional
  fireEvent.change(screen.getByRole('textbox'), { target: { value: NUMBER } });
  fireEvent.click(screen.getByTestId('step-continue'));
}

describe('phone_or_whatsapp: who can save a WhatsApp number (D76)', () => {
  it.each<[string, Who]>([
    ['another active role (teacher)', { otherRoles: ['teacher'], seat: null, d76: true }],
    ['seat holder (owner), not otherwise eligible', { otherRoles: [], seat: 'owner', d76: true }],
    ['seat holder (manager), not otherwise eligible', { otherRoles: [], seat: 'manager', d76: true }],
  ])('%s: saves ONE key, `whatsapp`, accepted, and moves on', async (_label, w) => {
    who = w;
    await answerNumber();
    await waitFor(() => expect(question()).not.toBe(QUESTION));
    expect(saved).toEqual([{ whatsapp: E164 }]);
    expect(screen.queryByTestId('step-error')).toBeNull();
  });
});

describe('a server that still answers whatsapp_not_allowed: a way to reach the team, never a dead end', () => {
  beforeEach(() => { who = { otherRoles: [], seat: 'owner', d76: false }; });

  it('the plain copy, both contact links, the answer kept, the step still required', async () => {
    vi.stubEnv('VITE_SUPPORT_WHATSAPP', 'https://wa.me/440000000000');
    vi.stubEnv('VITE_SUPPORT_EMAIL', 'help@example.com');
    await answerNumber();
    await waitFor(() => expect(screen.getByTestId('step-error').textContent).toBe(WHATSAPP_NOT_ALLOWED_COPY));
    expect(saved).toEqual([{ whatsapp: E164 }]);
    const wa = screen.getByRole('link', { name: 'WhatsApp us' });
    const mail = screen.getByRole('link', { name: 'Email us' });
    expect(wa.getAttribute('href')).toBe('https://wa.me/440000000000');
    expect(mail.getAttribute('href')).toBe('mailto:help@example.com');
    for (const a of [wa, mail]) expect(a.className).toMatch(/min-h-\[(4[4-9]|[5-9]\d)px\]/);
    expect(question()).toBe(QUESTION);
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('7700900123');
    expect(screen.queryByText(SKIP_LABEL)).toBeNull();
  });

  it('only one contact set: that one link, no dead one', async () => {
    vi.stubEnv('VITE_SUPPORT_WHATSAPP', '');
    vi.stubEnv('VITE_SUPPORT_EMAIL', 'help@example.com');
    await answerNumber();
    await screen.findByRole('link', { name: 'Email us' });
    expect(screen.queryByRole('link', { name: 'WhatsApp us' })).toBeNull();
  });

  it('no contact set: says so in words and points at Finish later, never a blank', async () => {
    vi.stubEnv('VITE_SUPPORT_WHATSAPP', '');
    vi.stubEnv('VITE_SUPPORT_EMAIL', '');
    await answerNumber();
    expect((await screen.findByTestId('step-support-none')).textContent).toMatch(/Finish later/);
  });
});

describe('#4 the wizard screen shows the ONE "N left" wording beside its bar', () => {
  it('required_left 1 -> "1 answer left"', async () => {
    who = { otherRoles: ['teacher'], seat: null, d76: true };
    mount();
    expect((await screen.findByTestId('wizard-required-left')).textContent).toBe('1 answer left');
  });
});
