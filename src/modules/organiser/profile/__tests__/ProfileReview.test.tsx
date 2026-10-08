// @vitest-environment jsdom
/** Profile lifecycle + Send for review + city row (F1). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const api = vi.hoisted(() => ({ home: vi.fn(), entity: vi.fn(), save: vi.fn(), submit: vi.fn(), cities: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {} } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'me@x.example' }, signOut: vi.fn() }) }));
vi.mock('@/modules/organiser/shared/selfServeApi', async () => ({
  ...(await vi.importActual<object>('@/modules/organiser/shared/selfServeApi')),
  fetchOrganiserHome: api.home,
  submitOrganiserProfile: api.submit,
}));
vi.mock('@/modules/profile/organiserPublicProfile', async () => ({
  ...(await vi.importActual<object>('@/modules/profile/organiserPublicProfile')),
  fetchOrganiserEntity: api.entity,
}));
vi.mock('@/lib/organiserProfileUpdate', async () => ({
  ...(await vi.importActual<object>('@/lib/organiserProfileUpdate')),
  saveOrganiserProfile: api.save,
}));
vi.mock('../../home/onboarding/citySearch', () => ({ searchCities: api.cities }));

import ProfilePage from '../index';
import { reviewStatus, sendBlockers } from '../reviewModel';

const decision = (reason: string | null) => ({ action: 'rejected', from_state: 'pending_review', to_state: 'rejected', reason, created_at: '2026-10-01T10:00:00Z' });
const org = (lifecycle_status: string, extra: object = {}) => ({
  id: 'org-1', name: 'Ritmo', slug: 'ritmo', avatar_url: null, city_id: 'c1', lifecycle_status, role: 'owner', latest_decision: null, series: [], ...extra,
});
const ENTITY = {
  id: 'org-1', name: 'Ritmo', avatar_url: null, bio: '', claimed_by: 'u1', socials: null, city_id: 'c1', instagram: null, website: null,
  contact_email: 'me@x.example', contact_phone: null, organisation_category: null, founded_year: null, cities: { name: 'Leeds', slug: 'leeds' },
};

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/account/o/profile']}>
        <Routes><Route path="/account/o/profile" element={<ProfilePage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const homeWith = (o: object) => api.home.mockResolvedValue({ today: '2026-10-07', organisers: [o] });
const sendButton = async () => (await screen.findByTestId('profile-send-review')) as HTMLButtonElement;

beforeEach(() => {
  homeWith(org('draft'));
  api.entity.mockReset().mockResolvedValue(ENTITY);
  api.save.mockReset().mockResolvedValue({ error: null });
  api.submit.mockReset().mockResolvedValue({ organiserId: 'org-1', fromState: 'draft', lifecycleStatus: 'pending_review' });
  api.cities.mockReset().mockResolvedValue([{ id: 'c2', label: 'Bristol, United Kingdom' }]);
});
afterEach(cleanup);

describe('status copy per state', () => {
  it.each([
    ['draft', null, 'Draft', 'Only you can see this organiser until the team approves it.', true],
    ['pending_review', null, 'In review', 'The team is looking at it.', false],
    ['rejected', decision('Add your Instagram'), 'Changes needed', 'The team asked for changes: Add your Instagram', true],
    ['rejected', decision(null), 'Changes needed', 'The team asked for changes.', true],
    ['live', null, 'Live', 'Live on the site.', false],
  ])('%s (%o)', async (state, latest, tag, sentence, canSend) => {
    homeWith(org(state, { latest_decision: latest }));
    mount();
    expect((await screen.findByTestId('profile-status-tag')).textContent).toBe(tag);
    expect(screen.getByTestId('profile-status-sentence').textContent).toBe(sentence);
    expect(!!screen.queryByTestId('profile-send-review')).toBe(canSend);
  });

  it('model: other states get the label and no send', () => {
    expect(reviewStatus('paused', null)).toEqual({ label: 'Paused', tone: 'neutral', sentence: null, canSend: false });
  });
});

describe('send for review', () => {
  it('is a GhostButton (the Save bar keeps the one primary) and is enabled when complete', async () => {
    mount();
    const b = await sendButton();
    expect(b.disabled).toBe(false);
    expect(b.className).not.toContain('bg-[var(--btn)]');
    expect(screen.queryByTestId('profile-send-blocked')).toBeNull();
  });

  it('says "again" for changes needed', async () => {
    homeWith(org('rejected', { latest_decision: decision('x') }));
    mount();
    expect((await sendButton()).textContent).toBe('Send for review again');
  });

  it('confirm, then submit_organiser_profile_v1, then announces and shows In review', async () => {
    mount();
    fireEvent.click(await sendButton());
    expect(api.submit).not.toHaveBeenCalled();
    expect(screen.getByTestId('profile-send-confirm').textContent).toContain('Send Ritmo to the Bachata Calendar team for review?');
    homeWith(org('pending_review'));
    fireEvent.click(screen.getByTestId('profile-send-yes'));
    await waitFor(() => expect(api.submit).toHaveBeenCalledWith('org-1'));
    await waitFor(() => expect(screen.getByText('Sent for review.')).toBeTruthy());
    await waitFor(() => expect(screen.getByTestId('profile-status-tag').textContent).toBe('In review'));
    expect(screen.queryByTestId('profile-send-review')).toBeNull();
  });

  it('No, not yet closes the question without sending', async () => {
    mount();
    fireEvent.click(await sendButton());
    fireEvent.click(screen.getByTestId('profile-send-no'));
    expect(screen.queryByTestId('profile-send-confirm')).toBeNull();
    expect(api.submit).not.toHaveBeenCalled();
  });

  it('a refusal shakes and shows the selfServeErrors copy, and the explanation outlives the button', async () => {
    api.submit.mockRejectedValue({ message: 'invalid_state' });
    mount();
    fireEvent.click(await sendButton());
    homeWith(org('pending_review'));
    fireEvent.click(screen.getByTestId('profile-send-yes'));
    expect((await screen.findByTestId('profile-send-error')).textContent).toBe('Nothing to send: this organiser is already in review, live, or no longer active.');
    await waitFor(() => expect(screen.getByTestId('profile-status-body').className).toMatch(/shake/));
    await waitFor(() => expect(screen.getByTestId('profile-status-tag').textContent).toBe('In review'));
    expect(screen.getByTestId('profile-send-error')).toBeTruthy();
  });

  it('an unknown refusal shows the generic line', async () => {
    api.submit.mockRejectedValue(new Error('boom: raw text'));
    mount();
    fireEvent.click(await sendButton());
    fireEvent.click(screen.getByTestId('profile-send-yes'));
    expect((await screen.findByTestId('profile-send-error')).textContent).toBe('Something went wrong. Please try again.');
  });

  it('disabled with the reason while there are unsaved changes', async () => {
    mount();
    fireEvent.change(await screen.findByTestId('profile-name'), { target: { value: 'Ritmo Leeds' } });
    const b = await sendButton();
    expect(b.disabled).toBe(true);
    expect(screen.getByTestId('profile-send-blocked').textContent).toBe('Save your changes first.');
    expect(b.getAttribute('aria-describedby')).toBe(screen.getByTestId('profile-send-blocked').id);
  });

  it('disabled and lists the missing city when the stored profile has none', async () => {
    api.entity.mockResolvedValue({ ...ENTITY, city_id: null, cities: null });
    mount();
    expect((await sendButton()).disabled).toBe(true);
    expect(screen.getByTestId('profile-send-blocked').textContent).toBe('Missing: City.');
  });

  it('model lists every missing field and the unsaved note', () => {
    expect(sendBlockers({ name: ' ', cityId: null, dirty: true })).toEqual(['Missing: Organiser name, City.', 'Save your changes first.']);
    expect(sendBlockers({ name: 'Ritmo', cityId: 'c1', dirty: false })).toEqual([]);
  });
});

describe('city row', () => {
  it('searches cities in the sheet, picks one, saves it, and then Send for review is enabled', async () => {
    api.entity.mockResolvedValue({ ...ENTITY, city_id: null, cities: null });
    mount();
    expect((await screen.findByTestId('profile-city-value')).textContent).toBe('Add');
    fireEvent.click(screen.getByTestId('profile-city'));
    fireEvent.change(await screen.findByTestId('profile-city-search'), { target: { value: 'Bri' } });
    fireEvent.click(await screen.findByTestId('profile-city-option', {}, { timeout: 2000 }));
    expect(api.cities).toHaveBeenCalledWith('Bri');
    expect(screen.getByTestId('profile-city-value').textContent).toBe('Bristol, United Kingdom');
    expect(screen.getByTestId('profile-send-blocked').textContent).toBe('Missing: City. Save your changes first.');
    fireEvent.click(screen.getByTestId('profile-bar-action'));
    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
    expect(api.save.mock.calls[0][3]).toBe('c2');
    await waitFor(() => expect((screen.getByTestId('profile-send-review') as HTMLButtonElement).disabled).toBe(false));
  });

  it('shows a plain line when no city matches', async () => {
    api.cities.mockResolvedValue([]);
    mount();
    fireEvent.click(await screen.findByTestId('profile-city'));
    fireEvent.change(await screen.findByTestId('profile-city-search'), { target: { value: 'Zzz' } });
    expect((await screen.findByTestId('profile-city-none', {}, { timeout: 2000 })).textContent).toBe('No city matches. Check the spelling.');
  });
});
