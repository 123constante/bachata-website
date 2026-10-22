// @vitest-environment jsdom
/** S9 the door (C38-C40b): the matrix over ClaimHint, the claim path's untouched imports, Ask to join -> Done, create -> Home. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { smallControls } from '../../flows/newpage/__tests__/tapTargets';

const api = vi.hoisted(() => ({ search: vi.fn(), claim: vi.fn(), request: vi.fn(), create: vi.fn(), otp: vi.fn(), verify: vi.fn(), rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { signInWithOtp: api.otp, verifyOtp: api.verify }, rpc: api.rpc },
}));
vi.mock('@/modules/organiser/shared/selfServeApi', () => ({
  searchClaimableOrganisers: api.search,
  claimOrganiser: api.claim,
  requestOrganiserAccess: api.request,
  createOrganiserProfile: api.create,
}));

import type { ClaimHint } from '@/modules/organiser/shared/claimHint';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { homeJobs } from '@/modules/organiser/jobs/homeJobs';
import { readDoneState } from '../../flows/doneState';
import { OnboardingView } from '../onboarding/OnboardingView';
import { NO_EMAIL_COPY } from '../onboarding/claimStates';

const org = (id: string, name: string, hint: ClaimHint | null) => ({ id, name, slug: id, avatar_url: null, city_id: null, hint });

function Where() {
  const l = useLocation();
  return <p data-testid="where" data-state={JSON.stringify(l.state ?? null)}>{l.pathname}</p>;
}
function mount(props: Partial<Parameters<typeof OnboardingView>[0]> = {}) {
  const onChanged = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/door']}>
        <Routes>
          <Route
            path="/door"
            element={<OnboardingView user={{ id: 'u1', email: 'me@x.example' }} mailboxProven myOrganiserIds={new Set()} requests={[]} firstRun onChanged={onChanged} {...props} />}
          />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onChanged, ...view };
}
const search = (q: string) => fireEvent.change(screen.getByTestId('onboarding-search'), { target: { value: q } });
const rowOf = async (name: string) => (await screen.findAllByTestId('onboarding-result')).find((r) => r.textContent?.includes(name))!;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-20T10:00:00Z'));
  Object.values(api).forEach((f) => f.mockReset());
  api.rpc.mockResolvedValue({ data: [{ city_id: 'c1', city_name: 'Leeds', city_slug: 'leeds', country_name: 'UK', display_name: 'Leeds, UK' }], error: null });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('C38 find your page: one row per ClaimHint', () => {
  it('no_email: the claim step is absent, the D63 line is there, ONE action (Ask to join)', async () => {
    api.search.mockResolvedValue([org('b', 'Beta', 'no_email')]);
    mount();
    search('be');
    const row = await rowOf('Beta');
    expect(NO_EMAIL_COPY).toBe('This page has no email on file yet. Ask to join and Ricky approves it, usually the same day.');
    expect(row.textContent).toContain(NO_EMAIL_COPY);
    expect(within(row).queryByTestId('onboarding-claim')).toBeNull();
    const buttons = within(row).getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toBe('Ask to join');
    fireEvent.click(buttons[0]);
    expect(await screen.findByTestId('onboarding-request-send')).toBeTruthy();
    expect(screen.queryByTestId('email-code-proof')).toBeNull();
    expect(screen.queryByTestId('onboarding-claim-confirm')).toBeNull();
  });

  it('email_matches: Claim leads to the shared EmailCodeProof when the mailbox is not proven', async () => {
    api.search.mockResolvedValue([org('a', 'Alpha', 'email_matches')]);
    api.otp.mockResolvedValue({ error: null });
    api.verify.mockResolvedValue({ error: null });
    api.claim.mockResolvedValue({ already_claimed: false });
    mount({ mailboxProven: false });
    search('al');
    const row = await rowOf('Alpha');
    expect(within(row).getAllByRole('button')).toHaveLength(1);
    fireEvent.click(within(row).getByTestId('onboarding-claim'));
    expect(await screen.findByTestId('email-code-proof')).toBeTruthy();
    fireEvent.click(await screen.findByTestId('email-code-send'));
    fireEvent.change(await screen.findByTestId('email-code-input'), { target: { value: '12345678' } });
    fireEvent.click(screen.getByTestId('email-code-verify'));
    await waitFor(() => expect(api.claim).toHaveBeenCalledWith('a'));
  });

  it('email_differs: ONE action, Ask to join; the copy says an email exists and never shows an address', async () => {
    api.search.mockResolvedValue([{ ...org('c', 'Gamma', 'email_differs'), contact_email: 'owner@secret.example' }]);
    mount();
    search('ga');
    const row = await rowOf('Gamma');
    expect(within(row).queryByTestId('onboarding-claim')).toBeNull();
    expect(within(row).getAllByRole('button')).toHaveLength(1);
    expect(row.textContent).toMatch(/email/i);
    expect(row.textContent).not.toMatch(/@/);
  });

  it('yours: ONE action, the 6a screen, then Home', async () => {
    api.search.mockResolvedValue([org('d', 'Delta', 'yours')]);
    mount();
    search('de');
    const row = await rowOf('Delta');
    const buttons = within(row).getAllByRole('button');
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    // Arc 1 flow 6a: the row opens "Delta is yours" first; its one button goes Home.
    fireEvent.click(await screen.findByTestId('onboarding-yours-home'));
    expect((await screen.findByTestId('where')).textContent).toBe(ORG_PATHS.home);
  });

  it('managed: no claim; Ask to join stays the way in', async () => {
    api.search.mockResolvedValue([org('m', 'Mu', 'managed')]);
    mount();
    search('mu');
    const row = await rowOf('Mu');
    expect(within(row).queryByTestId('onboarding-claim')).toBeNull();
    expect(within(row).getAllByRole('button')).toHaveLength(1);
    expect(within(row).getByTestId('onboarding-request')).toBeTruthy();
  });

  it('every control on the door is at least 44px', async () => {
    api.search.mockResolvedValue([org('a', 'Alpha', 'email_matches'), org('b', 'Beta', 'no_email'), org('d', 'Delta', 'yours')]);
    const { container } = mount();
    search('al');
    await screen.findAllByTestId('onboarding-result');
    expect(smallControls(container)).toEqual([]);
  });
});

describe('Ask to join -> Done', () => {
  it('sends the one request and lands on the Done screen "Asked to join <page>"', async () => {
    api.search.mockResolvedValue([org('b', 'Beta', 'no_email')]);
    api.request.mockResolvedValue({ request_id: 'r', status: 'open' });
    mount();
    search('be');
    fireEvent.click(within(await rowOf('Beta')).getByTestId('onboarding-request'));
    fireEvent.change(await screen.findByTestId('onboarding-request-note'), { target: { value: 'I run it' } });
    fireEvent.click(screen.getByTestId('onboarding-request-send'));
    await waitFor(() => expect(api.request).toHaveBeenCalledWith('b', 'I run it'));
    expect(api.request).toHaveBeenCalledTimes(1);
    const where = await screen.findByTestId('where');
    expect(where.textContent).toBe(ORG_PATHS.done);
    const state = readDoneState(JSON.parse(where.getAttribute('data-state')!));
    expect(state?.title).toBe('Asked to join Beta');
    expect(state?.message).not.toBe(state?.title);
    expect(state?.message).toMatch(/check your request/);
  });
});

describe('Create a new page -> Home', () => {
  it('name, then city = ONE create call; the page is live, so no review copy; Home reads the three first steps', async () => {
    api.create.mockResolvedValue({ organiserId: 'n1', slug: 'nova', lifecycleStatus: 'live' });
    const { onChanged } = mount();
    expect(document.body.textContent).not.toMatch(/checks new|review|draft/i);
    fireEvent.click(screen.getByTestId('onboarding-create'));
    fireEvent.change(await screen.findByTestId('onboarding-create-name'), { target: { value: 'Nova' } });
    fireEvent.click(screen.getByTestId('onboarding-create-next'));
    fireEvent.change(await screen.findByTestId('onboarding-city-search'), { target: { value: 'Le' } });
    fireEvent.click(await screen.findByTestId('onboarding-city-option'));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(api.create).toHaveBeenCalledTimes(1);
    expect((await screen.findByTestId('where')).textContent).toBe(ORG_PATHS.home);
    const fresh = { id: 'n1', name: 'Nova', slug: 'nova', avatar_url: null, city_id: 'c1', lifecycle_status: 'live', role: 'owner', latest_decision: null, series: [], team: [] };
    expect(homeJobs(fresh as never, [], '2026-10-20').map((j) => j.kind)).toEqual(['create_first_event', 'add_manager']);
  });

  it('a name searched for with no match is carried into the create name step', async () => {
    api.search.mockResolvedValue([]);
    mount();
    search('Salsa Nova');
    fireEvent.click(await screen.findByTestId('onboarding-create-from-search'));
    expect(((await screen.findByTestId('onboarding-create-name')) as HTMLInputElement).value).toBe('Salsa Nova');
  });
});

describe('the claim path reuses sessionProof.ts and EmailCodeProof.tsx unchanged', () => {
  const root = join(__dirname, '..', '..');
  const read = (rel: string) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
  const sha = (rel: string) => createHash('sha256').update(read(rel)).digest('hex');

  it('byte for byte against main (checksums pinned from origin/main c36fbaf)', () => {
    expect(sha('shared/sessionProof.ts')).toBe('a5b3134170b5890e6915789351a06b07999c2f62b165d8d7cc5ae8cef00737d5');
    // The one change since main: its spinners stop under reduced motion (F-INT B-N6). Nothing else moved.
    const proof = createHash('sha256').update(read('shared/components/EmailCodeProof.tsx').replace(/ motion-reduce:animate-none/g, '')).digest('hex');
    expect(proof).toBe('bfd2478530189f4de4190959be8861f22f642e54134fab4ebb4c4bfc64891087');
  });

  it('the sheet imports the shared component and Home imports the shared proof; no parallel copy is left', () => {
    expect(read('home/onboarding/OrganiserSheet.tsx')).toMatch(/shared\/components\/EmailCodeProof/);
    expect(read('home/index.tsx')).toMatch(/shared\/sessionProof/);
    expect(() => read('home/onboarding/EmailCode.tsx')).toThrow();
  });
});
