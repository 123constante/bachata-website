// @vitest-environment jsdom
/**
 * A page row opened from Review (org_link, org_category, org_logo, contact_confirm) returns to Review after
 * its save and on Back; the same step reached any other way (deep link) keeps today's next().
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: vi.fn(), from: vi.fn() } }));
vi.mock('@/modules/organiser/wizard/wizardCountries', () => ({ wizardCountries: () => Promise.resolve([]) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'sam@example.com' } }) }));
vi.mock('@/components/account/profiles/signOutToHome', () => ({ SIGN_OUT_FAILED: 'failed', useSignOutToHome: () => ({ signOutToHome: vi.fn(async () => 'ok'), busy: false }) }));
const home = vi.hoisted(() => ({ organisers: [{ id: 'o1' }] as { id: string }[], teach: 'yes' as 'yes' | 'no' }));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ data: { organisers: home.organisers }, isPending: false, isError: false, refetch: vi.fn() }) }));

import OnboardingFlow from '../OnboardingFlow';
import { GO_LIVE_NOT_DEPLOYED, type PageReads, type PageWrites } from '../pageApi';
import type { PersonReads, PersonWrites } from '../personApi';
import type { PageCommand } from '../pageModel';
import { REVIEW_ROWS, pageRowPath, pageRowExit } from '../pageModel';

const PAGE = { name: 'Leeds Nights', city: 'Leeds', socials: null, organisation_category: null, avatar_url: null };
const ALL = ['org_logo', 'org_link', 'org_category', 'contact_confirm'];
const PERSON_READS: PersonReads = {
  dancer: async () => ({ first_name: 'Sam', avatar_url: 'https://img/a.jpg', dance_role: 'Follower', nationality: 'GB', languages: ['English'] }),
  intent: async () => ({ roles: [], declined: ['teacher'] }) as never,
  teacher: async () => ({ teaching_styles: [], years_teaching: 0 }),
  organiser: async () => ({ id: 'o1', name: 'Leeds Nights', bio: '', category: 'Promoter', city: 'Leeds' }),
};
function Where() {
  return <span data-testid="where">{useLocation().pathname}</span>;
}
function mount(o: { at: string; phone: string | null; fail?: boolean }) {
  const sent: PageCommand[] = [];
  const reads: PageReads = {
    page: async () => PAGE,
    phone: async () => o.phone,
    status: async (id: string) => ({ v: 1, is_admin: false, person: { complete: true, missing: [] }, organisers: [{ id, name: 'L', role: 'owner', lifecycle: 'draft', complete: false, missing: ALL, about: { done: false, skipped: false } }] }),
    findPages: async () => [],
    cities: async () => [],
  };
  const writes: PageWrites = {
    run: async (cmd: PageCommand) => {
      if (o.fail) throw new Error('boom');
      sent.push(cmd);
    },
    create: async () => 'o1', claim: async () => undefined, ask: async () => undefined, rename: async () => undefined,
  };
  const pw: PersonWrites = { run: async () => undefined, skipAbout: async () => undefined };
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/account/p3/start?at=${o.at}`]}>
        <Routes>
          <Route path="/account/p3/start" element={<OnboardingFlow reads={reads} writes={writes} personReads={PERSON_READS} personWrites={pw} goLive={GO_LIVE_NOT_DEPLOYED} organiserDetail upload={async () => 'https://img/new.png'} />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return sent;
}
const shownStep = () => screen.getByTestId('p3-ob-shell').getAttribute('data-screen');
const onStep = (s: string) => waitFor(() => expect(shownStep()).toBe(s));
const btn = () => (screen.queryByTestId('p3-ob-page-row-return') ?? screen.getByTestId('p3-ob-continue'));

/** Fill the step so Continue is valid and sends a command. */
async function fill(step: string) {
  if (step === 'link') fireEvent.change(screen.getByTestId('p3-ob-link'), { target: { value: 'https://leedsnights.com' } });
  if (step === 'cat') fireEvent.click(screen.getByTestId('p3-ob-cat-Promoter'));
  if (step === 'contact-phone') fireEvent.change(screen.getByTestId('p3-ob-phone'), { target: { value: '+447700900123' } });
  if (step === 'whatsapp') fireEvent.click(screen.getByTestId('p3-ob-wa-yes'));
  if (step === 'logo') {
    fireEvent.change(screen.getByTestId('p3-ob-logo-file'), { target: { files: [new File(['x'], 'l.png', { type: 'image/png' })] } });
    await waitFor(() => expect(btn().getAttribute('aria-disabled')).toBeNull());
  }
}

type Row = { code: string; first: string; phone: string | null; later: string[]; welcomeNext: string };
const ROWS: Row[] = [
  { code: 'org_link', first: 'link', phone: null, later: ['logo', 'name'], welcomeNext: 'logo' },
  { code: 'org_category', first: 'cat', phone: null, later: ['link', 'logo', 'name'], welcomeNext: 'link' },
  { code: 'org_logo', first: 'logo', phone: null, later: ['name'], welcomeNext: 'name' },
  { code: 'contact_confirm', first: 'contact-phone', phone: null, later: ['cat', 'link', 'logo', 'name'], welcomeNext: 'whatsapp' },
  { code: 'contact_confirm', first: 'contact', phone: '+447700900123', later: ['cat', 'link', 'logo', 'name'], welcomeNext: 'whatsapp' },
];

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

async function fromReview(r: Row, fail = false) {
  const sent = mount({ at: 'review', phone: r.phone, fail });
  await onStep('review');
  if (!screen.queryByTestId(`p3-ob-review-${r.code}`)) fireEvent.click(screen.getByTestId('p3-ob-review-all'));
  fireEvent.click(await screen.findByTestId(`p3-ob-review-${r.code}`));
  await onStep(r.first);
  return sent;
}

describe.each(ROWS)('$code (phone $phone) from Review', (r) => {
  it('save ok: returns to Review, no later step rendered', async () => {
    await fromReview(r);
    const seen: string[] = [];
    for (let i = 0; i < 4 && shownStep() !== 'review'; i++) {
      const s = shownStep() as string;
      seen.push(s);
      await fill(s);
      fireEvent.click(btn());
      await waitFor(() => expect(shownStep()).not.toBe(s));
    }
    expect(shownStep()).toBe('review');
    for (const l of r.later) expect(seen).not.toContain(l);
  });
  it('save refused: stays, error shown, no navigation', async () => {
    await fromReview(r, true);
    const s = shownStep() as string;
    await fill(s);
    fireEvent.click(btn());
    await screen.findByTestId('p3-ob-error');
    expect(shownStep()).toBe(s);
  });
  it('back: returns to Review', async () => {
    await fromReview(r);
    fireEvent.click(screen.getByTestId('p3-ob-back'));
    await onStep('review');
  });
  it('Continue carries the row-return test id', async () => {
    await fromReview(r);
    expect(screen.getByTestId('p3-ob-page-row-return')).toBeTruthy();
  });
});

describe.each(ROWS)('$code (phone $phone) deep link unchanged', (r) => {
  it('same next() as today, no Review marker', async () => {
    mount({ at: r.first, phone: r.phone });
    await onStep(r.first);
    expect(screen.queryByTestId('p3-ob-page-row-return')).toBeNull();
    await fill(r.first);
    fireEvent.click(btn());
    await onStep(r.welcomeNext);
  });
});

describe('pageRowPath', () => {
  it('every REVIEW_ROWS code with a page step is covered by the table and has a row path', () => {
    const pageCodes = Object.entries(REVIEW_ROWS).filter(([, v]) => v.step && pageRowPath(v.step as never).length);
    expect(pageCodes.map(([c]) => c).sort()).toEqual(['contact_confirm', 'org_category', 'org_link', 'org_logo']);
    for (const [c] of pageCodes) expect(ROWS.some((r) => r.code === c)).toBe(true);
  });
  it('exit: stays inside the row, else review', () => {
    expect(pageRowExit('contact', 'whatsapp')).toBe('whatsapp');
    expect(pageRowExit('link', 'logo')).toBe('review');
    expect(pageRowExit('logo', 'person')).toBe('review');
  });
});
