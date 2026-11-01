// @vitest-environment jsdom
/** P3 Welcome x declined requests (FLIP-READINESS F-46): why, and what the person CAN do. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: vi.fn(), from: vi.fn() } }));
vi.mock('@/modules/organiser/wizard/wizardCountries', () => ({ wizardCountries: () => Promise.resolve([]) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'sam@example.com' } }) }));
vi.mock('@/components/account/profiles/signOutToHome', () => ({ SIGN_OUT_FAILED: 'failed', useSignOutToHome: () => ({ signOutToHome: vi.fn(async () => 'ok'), busy: false }) }));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ data: { organisers: [] }, isPending: false, isError: false, refetch: vi.fn() }) }));

import OnboardingFlow from '../OnboardingFlow';
import type { PageReads, PageWrites } from '../pageApi';
import type { PersonReads, PersonWrites } from '../personApi';
import type { MyAccessRequest } from '../../../shared/selfServeApi';
import { DECLINED_NEXT } from '../../../home/onboarding/onboardingModel';

const PERSON_READS: PersonReads = {
  dancer: async () => ({ first_name: 'Sam', avatar_url: null, dance_role: 'Follower', nationality: 'GB', languages: ['English'] }),
  intent: async () => ({ roles: [], declined: [] }) as never,
  teacher: async () => null as never,
  organiser: async () => null as never,
};

function mount(opts: { at?: string; org?: string; requests?: MyAccessRequest[] | 'fail' }) {
  const reads: PageReads = {
    page: vi.fn(async () => null),
    phone: vi.fn(async () => null),
    status: vi.fn(async () => null),
    findPages: vi.fn(async () => []),
    cities: vi.fn(async () => []),
    ...({ requests: vi.fn(async () => { if (opts.requests === 'fail') throw new Error('network'); return (opts.requests ?? []) as MyAccessRequest[]; }) }),
  };
  const writes: PageWrites = {
    run: vi.fn(async () => undefined),
    create: vi.fn(async () => 'o1'),
    claim: vi.fn(async () => undefined),
    ask: vi.fn(async () => undefined),
    rename: vi.fn(async () => undefined),
  };
  const personWrites: PersonWrites = { run: vi.fn(async () => undefined), skipAbout: vi.fn(async () => undefined) };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/account/p3/start${opts.at ? `?at=${opts.at}` : ''}${opts.org ? `&o=${opts.org}` : ''}`]}>
        <Routes>
          <Route path="/account/p3/start" element={<OnboardingFlow reads={reads} writes={writes} personReads={PERSON_READS} personWrites={personWrites} organiserDetail upload={async () => ''} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { reads, writes };
}


// Fixed noon-UTC clock: London date labels are stable (BST ended 2026-10-25, so UTC == London).
const NOW = new Date('2026-10-30T12:00:00Z');
vi.useFakeTimers({ toFake: ['Date'], now: NOW });
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const R = (id: string, status: string, created: number, over: Partial<MyAccessRequest> = {}): MyAccessRequest => ({ requestId: `r-${id}-${created}`, organiserId: id, organiserName: `Page ${id}`, status, createdAt: daysAgo(created), resolvedAt: status === 'open' ? null : daysAgo(created - 1), ...over });

const CASES: Array<{ name: string; requests: MyAccessRequest[] | 'fail'; shown: string[]; note?: string }> = [
  { name: 'fresh decline', requests: [R('a', 'declined', 3)], shown: ['Page a'] },
  { name: 'decline with the organiser\u2019s note', requests: [R('a', 'declined', 3, { decisionNote: 'We are full' })], shown: ['Page a'], note: 'We are full' },
  { name: 'decline answered 29 days ago', requests: [R('a', 'declined', 30)], shown: ['Page a'] },
  { name: 'decline answered 31 days ago', requests: [R('a', 'declined', 32)], shown: [] },
  { name: 'decline older than 30 days', requests: [R('a', 'declined', 60)], shown: [] },
  { name: 'decline then asked again (open)', requests: [R('a', 'declined', 5), R('a', 'open', 1)], shown: [] },
  { name: 'decline then granted', requests: [R('a', 'declined', 5), R('a', 'granted', 1)], shown: [] },
  { name: 'two declines on two pages', requests: [R('a', 'declined', 5), R('b', 'declined', 3)], shown: ['Page b', 'Page a'] },
  { name: 'decline with no page name', requests: [R('a', 'declined', 3, { organiserName: null })], shown: ['An organiser'] },
  { name: 'none', requests: [], shown: [] },
  { name: 'read failed', requests: 'fail', shown: [] },
];

describe('Welcome x declined requests', () => {
  it.each(CASES)('$name', async ({ requests, shown, note }) => {
    mount({ at: 'welcome', requests });
    await screen.findByTestId('p3-ob-signedin');
    if (!shown.length) {
      await new Promise((r) => setTimeout(r, 50));
      expect(screen.queryByTestId('p3-ob-declined')).toBeNull();
      return;
    }
    await screen.findByTestId('p3-ob-declined');
    const rows = screen.getAllByTestId('p3-ob-declined-row');
    expect(rows).toHaveLength(shown.length);
    shown.forEach((name, i) => expect(rows[i].textContent).toContain(name));
    // literal date line, not the function under test (fixed clock above)
    const r0 = (requests as MyAccessRequest[]).find((r) => r.organiserName === (shown[0] === 'An organiser' ? null : shown[0]))!;
    const answeredLabel = new Date(r0.resolvedAt!).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London' });
    expect(rows[0].textContent).toContain(`${shown[0]} said no on ${answeredLabel}.`);
    expect(rows[0].textContent).toMatch(/said no on \w+day \d{1,2} \w+\./);
    if (note) expect(rows[0].textContent).toContain(note);
    // what they CAN do: the controls named exist on this screen
    const next = screen.getByTestId('p3-ob-declined-next').textContent;
    expect(next).toBe(DECLINED_NEXT);
    expect(document.body.textContent).toContain('Find your page');
    expect(screen.getByTestId('p3-ob-continue').textContent).toBe('Find your page');
  });

  it('a person who already has a page sees no declined card', async () => {
    mount({ at: 'welcome', org: 'o-granted', requests: [R('a', 'declined', 3)] });
    await screen.findByTestId('p3-ob-signedin');
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('p3-ob-declined')).toBeNull();
  });

  it('declined-card copy names only controls on the Welcome screen (no note field on P3)', async () => {
    mount({ at: 'welcome', requests: [R('a', 'declined', 3)] });
    await screen.findByTestId('p3-ob-declined');
    const lines = [screen.getByTestId('p3-ob-declined-next').textContent ?? '', DECLINED_NEXT];
    for (const line of lines) {
      expect(line).not.toMatch(/\bnote\b/i);
      expect(line).toContain('Find your page');
    }
    expect(screen.getByTestId('p3-ob-continue').textContent).toBe('Find your page');
    expect(document.querySelectorAll('textarea')).toHaveLength(0);
  });
});

afterEach(() => { cleanup(); document.body.innerHTML = ''; });
