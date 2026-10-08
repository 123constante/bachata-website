// @vitest-environment jsdom
/**
 * First-run polish (claim, email code, onboarding, home, create, venue picker), rendered.
 * What changed for an organiser on a phone: the email-code box never submits the form it
 * sits in, focus follows the step that replaced the button pressed, a refusal reads before
 * the panel it opened, the home stops promising events before approval, and every create
 * field is 16px. jsdom does no layout: the overflow and tap-size fixes are pinned by class.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const auth = vi.hoisted(() => ({ signInWithOtp: vi.fn(), verifyOtp: vi.fn() }));
const rpc = vi.hoisted(() => vi.fn());
const api = vi.hoisted(() => ({ search: vi.fn(), claim: vi.fn(), create: vi.fn() }));
const command = vi.hoisted(() => ({ mutateAsync: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, auth } }));
vi.mock('@/components/ui/city-picker', () => ({
  CityPicker: ({ onChange }: { onChange: (id: string) => void }) => (
    <button type="button" data-testid="city-pick" onClick={() => onChange('c1')}>London</button>
  ),
}));
vi.mock('@/modules/organiser/shared/selfServeApi', async () => {
  const actual = await vi.importActual<typeof import('@/modules/organiser/shared/selfServeApi')>('@/modules/organiser/shared/selfServeApi');
  return {
    ...actual,
    searchClaimableOrganisers: api.search,
    claimOrganiser: api.claim,
    requestOrganiserAccess: vi.fn(),
    createOrganiserProfile: api.create,
  };
});
vi.mock('@/modules/organiser/shared/useOwnerCommand', () => ({ useOwnerCommand: () => command }));
vi.mock('@/modules/organiser/shared/publicVenues', () => ({
  useVenueOptions: () => ({ data: [], isLoading: false, isError: false }),
  venueName: () => null,
}));
vi.mock('@/modules/organiser/shared/createCity', () => ({ resolveCreateCityId: vi.fn().mockResolvedValue('c1') }));
vi.mock('@/hooks/useUnsavedChangesGuard', () => ({ useUnsavedChangesGuard: () => {} }));

import { EmailCodeProof } from '@/modules/organiser/shared/components/EmailCodeProof';
import { OrganiserOnboarding } from '../components/OrganiserOnboarding';
import { PublicClaimCard } from '@/modules/organiser/shared/components/PublicClaimCard';
import { OrganiserHome } from '../components/OrganiserHome';
import { CreateEventForm } from '../components/CreateEventForm';
import { VenuePicker } from '../components/VenuePicker';
import type { HomeOrganiser } from '@/modules/organiser/shared/selfServeApi';

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrap = (ui: React.ReactNode) =>
  render(<QueryClientProvider client={client()}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);
const refusal = (code: string) => Object.assign(new Error(code), { code: 'P0001' });
const follows = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

beforeEach(() => {
  auth.signInWithOtp.mockReset().mockResolvedValue({ error: null });
  auth.verifyOtp.mockReset().mockResolvedValue({ error: null });
  rpc.mockReset();
  api.search.mockReset();
  api.claim.mockReset();
  api.create.mockReset();
  command.mutateAsync.mockReset();
});
afterEach(cleanup);

describe('EmailCodeProof inside a form', () => {
  function mountInForm() {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    const onProven = vi.fn();
    render(<form onSubmit={onSubmit}><EmailCodeProof email="a@b.example" onProven={onProven} /></form>);
    return { onSubmit, onProven };
  }

  it('sending, confirming and Enter never submit the outer form', async () => {
    const { onSubmit, onProven } = mountInForm();
    fireEvent.click(screen.getByTestId('email-code-send'));
    const input = await screen.findByTestId('email-code-input');
    fireEvent.change(input, { target: { value: '12345678' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(onProven).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId('email-code-verify'));
    await waitFor(() => expect(onProven).toHaveBeenCalledTimes(2));
    expect(onSubmit).not.toHaveBeenCalled();
    for (const id of ['email-code-verify', 'email-code-resend']) expect(screen.getByTestId(id).getAttribute('type')).toBe('button');
  });

  it('after a send: says where the code went, labels the box and puts focus in it', async () => {
    mountInForm();
    fireEvent.click(screen.getByTestId('email-code-send'));
    const input = await screen.findByTestId('email-code-input');
    await waitFor(() => expect(document.activeElement).toBe(input));
    expect(screen.getByTestId('email-code-status').textContent).toMatch(/emailed a code to a@b\.example.*spam/);
    expect(screen.getByLabelText(/code from your email/i)).toBe(input);
  });

  it('a refused code names a recovery that works during the resend cooldown', async () => {
    auth.verifyOtp.mockResolvedValue({ error: { message: 'Token has expired or is invalid' } });
    mountInForm();
    fireEvent.click(screen.getByTestId('email-code-send'));
    fireEvent.change(await screen.findByTestId('email-code-input'), { target: { value: '12345678' } });
    fireEvent.click(screen.getByTestId('email-code-verify'));
    expect((await screen.findByRole('alert')).textContent).toBe('That code did not work. Check it against the latest email, or send a new code.');
  });
});

describe('OrganiserOnboarding first run', () => {
  const ORG = { id: 'a', name: 'Alpha', slug: 'a', avatar_url: null, city_id: null, claimed_by: null, contact_email: 'me@x.example' };
  const mount = (mailboxProven = true) =>
    wrap(
      <OrganiserOnboarding user={{ id: 'u1', email: 'me@x.example' }} mailboxProven={mailboxProven} myOrganiserIds={new Set()}
        requestedIds={new Set()} firstRun onChanged={vi.fn()} />,
    );
  const search = (value: string) => fireEvent.change(screen.getByTestId('organiser-search'), { target: { value } });

  it('opening a panel moves focus into it and hides the opener; Esc hands focus back', async () => {
    api.search.mockResolvedValue([ORG]);
    mount();
    search('al');
    fireEvent.click(await screen.findByTestId('claim-open'));
    expect(screen.queryByTestId('claim-open')).toBeNull();
    expect(document.activeElement).toBe(screen.getByTestId('claim-confirm'));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('claim-open')));
  });

  it('a refused claim shows its reason above the request panel it turned into', async () => {
    api.search.mockResolvedValue([ORG]);
    api.claim.mockRejectedValue(refusal('email_mismatch'));
    mount();
    search('al');
    fireEvent.click(await screen.findByTestId('claim-open'));
    fireEvent.click(screen.getByTestId('claim-confirm'));
    const error = await screen.findByTestId('onboarding-error-a');
    const note = screen.getByTestId('request-note');
    expect(follows(error, note)).toBe(true);
    await waitFor(() => expect(document.activeElement).toBe(note));
    expect(screen.queryByTestId('claim-open')).toBeNull();
  });

  it('no match: says so plainly and offers the create inline', async () => {
    api.search.mockResolvedValue([]);
    mount();
    search('Zzyzx');
    expect((await screen.findByTestId('organiser-no-match')).textContent).toBe(
      'No organiser matches “Zzyzx”. Check the spelling, or create it as a new organiser.',
    );
    expect(screen.getByTestId('organiser-search-status').textContent).toBe('0 organisers found');
  });

  it('the create form says what it still needs while its button is disabled', async () => {
    api.search.mockResolvedValue([]);
    mount();
    fireEvent.click(screen.getByTestId('create-open'));
    expect(document.activeElement).toBe(screen.getByTestId('create-name'));
    expect(screen.getByTestId('create-org-missing').textContent).toBe('To create it, add the organiser name and the city.');
    fireEvent.change(screen.getByTestId('create-name'), { target: { value: 'Ana' } });
    expect(screen.getByTestId('create-org-missing').textContent).toBe('To create it, add the city.');
    fireEvent.click(screen.getByTestId('city-pick'));
    expect(screen.queryByTestId('create-org-missing')).toBeNull();
  });

  it('a create refused for an unproven mailbox finishes by itself once the code is confirmed', async () => {
    api.search.mockResolvedValue([]);
    api.create.mockRejectedValueOnce(refusal('mailbox_unproven')).mockResolvedValueOnce({ organiserId: 'new' });
    mount(false);
    fireEvent.click(screen.getByTestId('create-open'));
    fireEvent.change(screen.getByTestId('create-name'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByTestId('city-pick'));
    fireEvent.click(screen.getByTestId('create-submit'));
    fireEvent.click(await screen.findByTestId('email-code-send'));
    expect(api.create).toHaveBeenCalledTimes(1);
    fireEvent.change(await screen.findByTestId('email-code-input'), { target: { value: '12345678' } });
    fireEvent.click(screen.getByTestId('email-code-verify'));
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(2));
  });
});

describe('PublicClaimCard focus and order', () => {
  const ORG = { id: 'o1', name: 'Ritmo', claimedBy: null, contactEmail: 'me@x.example' };
  const mount = () =>
    wrap(<PublicClaimCard enabled organiser={ORG} user={{ id: 'u', email: 'me@x.example' }} mailboxProven returnTo="/organisers/ritmo" onChanged={vi.fn()} />);

  it('focus moves into the opened panel, then onto the outcome; the outcome link is a 44px target', async () => {
    api.claim.mockResolvedValue({ already_claimed: false });
    mount();
    fireEvent.click(screen.getByTestId('public-claim-open'));
    expect(document.activeElement).toBe(screen.getByTestId('public-claim-confirm'));
    fireEvent.click(screen.getByTestId('public-claim-confirm'));
    const done = await screen.findByTestId('public-claim-done');
    await waitFor(() => expect(document.activeElement).toBe(done));
    expect(screen.getByTestId('public-claim-go').className).toContain('min-h-[44px]');
  });

  it('a refusal reads before the request panel and is not repeated inside it', async () => {
    api.claim.mockRejectedValue(refusal('email_mismatch'));
    mount();
    fireEvent.click(screen.getByTestId('public-claim-open'));
    fireEvent.click(screen.getByTestId('public-claim-confirm'));
    const error = await screen.findByTestId('public-claim-error');
    expect(follows(error, screen.getByTestId('public-request-panel'))).toBe(true);
    expect(screen.getByTestId('public-request-panel').textContent).not.toMatch(/different contact email/);
  });
});

describe('OrganiserHome first-run wording and layout', () => {
  const organiser = (lifecycle_status: string, series: unknown[] = []) =>
    ({ id: 'o1', name: 'Casa Bachata', slug: 'casa', role: 'owner', lifecycle_status, series, latest_decision: null }) as unknown as HomeOrganiser;
  const mount = (o: HomeOrganiser) => wrap(<OrganiserHome organiser={o} today="2026-10-05" onSentForReview={() => {}} />);

  it('a draft is not promised events before approval, and its empty state does not send it to a refusal', () => {
    mount(organiser('draft'));
    expect(screen.getByTestId('next-step-card').textContent).not.toMatch(/meanwhile/);
    expect(screen.getByTestId('home-empty').textContent).toMatch(/Once the team approves Casa Bachata/);
    expect(screen.getByTestId('home-empty').textContent).not.toMatch(/Tap New event/);
  });

  it('a rejected organiser is asked to send it again', () => {
    mount(organiser('rejected'));
    expect(screen.getByTestId('next-step-title').textContent).toBe('Next: send Casa Bachata for review again.');
  });

  it('a live organiser still gets the "Tap New event" empty state; series cards can shrink inside the grid', () => {
    const s = { id: 's1', name: 'A very long series name '.repeat(6), slug: 's', format: null, category: null, lifecycle_status: 'live',
      default_local_start_time: null, upcoming_count: 0, next_dates: [], latest_decision: null };
    cleanup();
    mount(organiser('live'));
    expect(screen.getByTestId('home-empty').textContent).toMatch(/Tap New event/);
    cleanup();
    mount(organiser('live', [s]));
    expect(screen.getByTestId('series-card').className).toContain('min-w-0');
    expect(screen.getByTestId('series-open').className).not.toContain('truncate');
  });
});

describe('CreateEventForm first run', () => {
  const org = (over: Record<string, unknown>) =>
    ({ id: 'org-1', name: 'Ritmo', slug: 'r', avatar_url: null, city_id: null, lifecycle_status: 'live', role: 'owner', latest_decision: null, series: [], ...over }) as unknown as HomeOrganiser;

  it('says a not-yet-approved organiser cannot add events BEFORE the form, not after it', () => {
    wrap(<CreateEventForm organisers={[org({ lifecycle_status: 'draft' })]} initialOrganiserId={null} today="2026-10-04" />);
    const blocked = screen.getByTestId('create-blocked');
    expect(follows(blocked, screen.getByTestId('kind-weekly_class'))).toBe(true);
  });

  it('every text field is 16px on a phone, and a refusal shows in the sticky action bar', async () => {
    command.mutateAsync.mockRejectedValue(Object.assign(new Error('permission_denied: nope'), { code: 'P0001' }));
    wrap(<CreateEventForm organisers={[org({})]} initialOrganiserId={null} today="2026-10-04" />);
    const fields = screen.getByTestId('create-fields').querySelectorAll('input, select, textarea');
    expect(fields.length).toBeGreaterThan(0);
    for (const el of fields) {
      // text-base is ~13.6px on a 390px phone (fluid root); only an explicit 16px stops iOS focus-zoom.
      expect(el.className).toContain('text-[16px]');
      expect(el.className).toContain('md:text-[16px]');
      expect(el.className).not.toMatch(/text-base|md:text-sm/);
    }
    fireEvent.click(screen.getByTestId('kind-party'));
    fireEvent.change(document.getElementById('create-name')!, { target: { value: 'Party' } });
    fireEvent.change(document.getElementById('create-date')!, { target: { value: '2026-10-10' } });
    fireEvent.change(document.getElementById('create-start')!, { target: { value: '21:00' } });
    await act(async () => { fireEvent.click(screen.getByTestId('save-draft')); });
    const error = await screen.findByTestId('create-error');
    expect(screen.getByTestId('create-actions').contains(error)).toBe(true);
  });
});

describe('VenuePicker first run', () => {
  it('with no venue yet the open toggle reads Close, and the venue request fields have visible labels', () => {
    wrap(<VenuePicker id="v" value={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Change venue'));
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
    expect(document.activeElement?.id).toBe('v');
    fireEvent.change(document.getElementById('v')!, { target: { value: 'Nowhere Hall' } });
    fireEvent.click(screen.getByTestId('venue-request-open'));
    expect((screen.getByLabelText('Venue name') as HTMLInputElement).value).toBe('Nowhere Hall');
    expect(screen.getByLabelText('Link to the venue')).toBe(screen.getByTestId('venue-request-link'));
    expect(screen.getByLabelText('Your phone number').getAttribute('autocomplete')).toBe('tel');
  });
});
