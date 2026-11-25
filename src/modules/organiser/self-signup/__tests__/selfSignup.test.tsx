// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  DEBOUNCE_MS, GENERIC_FAILURE, outcomeCopy, parseNameMatches, parseOnboardResult, refusalView, shouldSearchMatches,
} from '../selfSignupModel';

const onboard = vi.fn();
const flag = vi.fn();
vi.mock('../selfSignupApi', () => ({
  fetchFlagOn: () => flag(),
  fetchNameMatches: vi.fn(async () => [{ organiserId: 'org1', displayName: 'Salsa Club', city: 'London', claimed: false, emailMatch: true }]),
  onboardOrganiser: (...a: unknown[]) => onboard(...a),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'a@b.co' }, authStatus: 'ready' }) }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/lib/breadcrumbs', () => ({ buildBreadcrumbs: () => [] }));
vi.mock('@/modules/organiser/shared/components/EmailCodeProof', () => ({ EmailCodeProof: () => null }));
vi.mock('@/modules/organiser/claim-link/AboutYouScreen', () => ({ default: () => null }));
vi.mock('@/modules/organiser/home/onboarding/citySearch', () => ({ searchCities: vi.fn(async () => [{ id: 'c1', label: 'London, UK' }]) }));
vi.mock('@/pages/NotFound', () => ({ default: () => <div>not found</div> }));

describe('model', () => {
  it('debounce gating needs 2+ letters and a city', () => {
    expect(DEBOUNCE_MS).toBe(350);
    expect(shouldSearchMatches('a', 'c')).toBe(false);
    expect(shouldSearchMatches(' a ', 'c')).toBe(false);
    expect(shouldSearchMatches('ab', null)).toBe(false);
    expect(shouldSearchMatches('ab', 'c')).toBe(true);
  });
  it('matches: ok:false and junk show nothing; only safe fields kept', () => {
    expect(parseNameMatches({ ok: false, reason: 'flag_off' })).toEqual([]);
    expect(parseNameMatches(null)).toEqual([]);
    const [m] = parseNameMatches({ ok: true, items: [{ organiser_id: 'o', display_name: 'X', city: 'L', claimed: true, email_match: true, email: 'secret' }] });
    expect(m).toEqual({ organiserId: 'o', displayName: 'X', city: 'L', claimed: true, emailMatch: true });
  });
  it('outcome copy', () => {
    expect(outcomeCopy('claimed', 'X')).toBe('X is yours.');
    expect(outcomeCopy('created_claim_waiting', 'X')).toBe('Your page is live. The team is checking your claim of X; keep going.');
    expect(outcomeCopy('created', 'X')).toBe('Your page is live.');
  });
  it('parses onboard results', () => {
    expect(parseOnboardResult({ ok: true, outcome: 'created', organiser_id: 'o', slug: 's', display_name: 'X' })).toMatchObject({ kind: 'success', outcome: 'created' });
    expect(parseOnboardResult({ ok: false, reason: 'name_taken' })).toEqual({ kind: 'refused', reason: 'name_taken' });
    expect(parseOnboardResult({ ok: true, outcome: 'weird', organiser_id: 'o' })).toEqual({ kind: 'failed' });
    expect(parseOnboardResult(undefined)).toEqual({ kind: 'failed' });
  });
  it('refusal mapping', () => {
    expect(refusalView('flag_off').action).toBe('not_found');
    expect(refusalView('email_not_proven').action).toBe('back_to_email');
    expect(refusalView('name_taken').message).toBe('That name is taken in this city. Try adding a word.');
    expect(refusalView('already_owns_page').action).toBe('own_page');
    for (const r of ['limit_reached', 'suspended', 'not_live', 'page_already_owned', 'page_already_member', 'claim_target_not_found', 'not_publishable', 'city_not_found', 'name_or_city_missing', 'name_invalid']) {
      const v = refusalView(r);
      expect(v.action).toBe('back');
      expect(v.message).not.toContain(r);
      expect(v.message.length).toBeGreaterThan(0);
    }
    expect(refusalView('something_new')).toEqual({ action: 'retry', message: GENERIC_FAILURE });
  });
});

describe('page', () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    flag.mockReset();
    flag.mockResolvedValue(true);
    onboard.mockReset();
    onboard.mockResolvedValue({ kind: 'success', outcome: 'claimed', organiserId: 'org1', slug: 's', displayName: 'Salsa Club' });
  });

  async function fill() {
    const { default: Page } = await import('../SelfSignupPage');
    const { MemoryRouter } = await import('react-router-dom');
    render(<MemoryRouter><Page /></MemoryRouter>);
    fireEvent.change(await screen.findByTestId('signup-name'), { target: { value: 'Salsa Club' } });
    fireEvent.change(screen.getByTestId('signup-city'), { target: { value: 'Lon' } });
    fireEvent.click(await screen.findByTestId('signup-city-option'));
    await screen.findByTestId('signup-match-card');
  }

  it('flag off = NotFound; flag on = email step', async () => {
    const { default: Page } = await import('../SelfSignupPage');
    const { MemoryRouter } = await import('react-router-dom');
    flag.mockResolvedValue(false);
    const a = render(<MemoryRouter><Page /></MemoryRouter>);
    expect(await screen.findByText('not found')).toBeTruthy();
    expect(screen.queryByTestId('signup-step')).toBeNull();
    a.unmount();
    flag.mockResolvedValue(true);
    render(<MemoryRouter><Page /></MemoryRouter>);
    expect(await screen.findByTestId('signup-step')).toBeTruthy();
  });

  it('card shows; submit passes the claim target only after Yes', async () => {
    await fill();
    expect(screen.getByText(/Its contact email matches yours\./)).toBeTruthy();
    fireEvent.click(screen.getByTestId('signup-yes'));
    fireEvent.click(screen.getByTestId('signup-submit'));
    await waitFor(() => expect(onboard).toHaveBeenCalledWith('Salsa Club', 'c1', 'org1', null));
  });

  it('No, mine is different clears the claim target', async () => {
    await fill();
    fireEvent.click(screen.getByTestId('signup-yes'));
    fireEvent.click(screen.getByTestId('signup-no'));
    expect(screen.queryByTestId('signup-match-card')).toBeNull();
    fireEvent.click(screen.getByTestId('signup-submit'));
    fireEvent.click(screen.getByTestId('signup-event-skip'));
    await waitFor(() => expect(onboard).toHaveBeenCalledWith('Salsa Club', 'c1', null, null));
  });

  it('without Yes the claim target is null', async () => {
    await fill();
    fireEvent.click(screen.getByTestId('signup-submit'));
    fireEvent.click(screen.getByTestId('signup-event-skip'));
    await waitFor(() => expect(onboard).toHaveBeenCalledWith('Salsa Club', 'c1', null, null));
  });
});
