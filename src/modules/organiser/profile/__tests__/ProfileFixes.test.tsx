// @vitest-environment jsdom
/** Profile fixes: link rules in the sheet AND at Save (one validator), the logo row states a fact, the shared save-bar state. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LINK_PROBLEM, linkProblem } from '@/modules/organiser/shared/linkRules';

const api = vi.hoisted(() => ({ home: vi.fn(), entity: vi.fn(), save: vi.fn(), bar: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {} } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'me@x.example' }, signOut: vi.fn() }) }));
vi.mock('@/modules/organiser/shared/selfServeApi', async () => ({
  ...(await vi.importActual<object>('@/modules/organiser/shared/selfServeApi')),
  fetchOrganiserHome: api.home,
}));
vi.mock('@/modules/profile/organiserPublicProfile', async () => ({
  ...(await vi.importActual<object>('@/modules/profile/organiserPublicProfile')),
  fetchOwnOrganiserEntity: api.entity,
}));
vi.mock('@/lib/organiserProfileUpdate', async () => ({
  ...(await vi.importActual<object>('@/lib/organiserProfileUpdate')),
  saveOrganiserProfile: api.save,
}));
vi.mock('@/modules/organiser/shared/editorGuards', async () => {
  const actual = await vi.importActual<typeof import('@/modules/organiser/shared/editorGuards')>('@/modules/organiser/shared/editorGuards');
  return { ...actual, saveBarState: (...args: Parameters<typeof actual.saveBarState>) => { api.bar(...args); return actual.saveBarState(...args); } };
});

import ProfilePage from '../index';

const ORG = { id: 'org-1', name: 'Ritmo', slug: 'ritmo', avatar_url: null, city_id: 'c1', lifecycle_status: 'live', role: 'owner', latest_decision: null, series: [] };
const ENTITY = {
  id: 'org-1', name: 'Ritmo', avatar_url: null, bio: 'Salsa and bachata in Leeds', claimed_by: 'u1',
  socials: { facebook: 'ritmofb' }, city_id: 'c1', instagram: 'https://instagram.com/ritmoleeds', website: null,
  contact_email: 'me@x.example', contact_phone: '0113 000', organisation_category: 'school', founded_year: 2015,
  cities: { name: 'Leeds', slug: 'leeds' },
};

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/account/o/profile']}>
        <Routes>
          <Route path="/account/o/profile" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  api.home.mockReset().mockResolvedValue({ today: '2026-10-07', organisers: [ORG] });
  api.entity.mockReset().mockResolvedValue(ENTITY);
  api.save.mockReset().mockResolvedValue({ error: null });
  api.bar.mockReset();
});
afterEach(cleanup);

type Kind = 'instagram' | 'website' | 'facebook';
const CASES: [Kind, string, boolean][] = [
  ['instagram', 'not a handle!', false],
  ['instagram', 'https://facebook.com/ritmo', false],
  ['instagram', '@ritmo.leeds', true],
  ['instagram', 'https://instagram.com/ritmo', true],
  ['website', 'not a site', false],
  ['website', 'http://exa mple.com', false],
  ['website', 'ritmo.example', true],
  ['website', 'https://ritmo.example/tickets', true],
  ['facebook', 'my page!!', false],
  ['facebook', 'ftp://facebook.com/ritmo', false],
  ['facebook', 'ritmofb', true],
  ['facebook', 'https://facebook.com/ritmo', true],
  ['website', '', true],
];

describe('link rules (one validator: shared/linkRules)', () => {
  it.each(CASES)('%s %j: the table agrees with linkProblem (ok=%s)', (kind, value, ok) => {
    expect(linkProblem(kind, value) === null).toBe(ok);
  });

  it.each(CASES)('sheet: %s %j shows the problem inline and disables Done (ok=%s)', async (kind, value, ok) => {
    mount();
    fireEvent.click(await screen.findByTestId(`profile-${kind}`));
    fireEvent.change(await screen.findByTestId('profile-field'), { target: { value } });
    const done = screen.getByTestId('profile-sheet-done') as HTMLButtonElement;
    if (ok) {
      expect(screen.queryByTestId('profile-field-problem')).toBeNull();
      expect(done.disabled).toBe(false);
    } else {
      const problem = screen.getByTestId('profile-field-problem');
      expect(problem.textContent).toBe(LINK_PROBLEM[kind]);
      expect(problem.getAttribute('role')).toBe('alert');
      expect(screen.getByTestId('profile-field').getAttribute('aria-describedby')).toContain(problem.id);
      expect(screen.getByTestId('profile-field').getAttribute('aria-invalid')).toBe('true');
      expect(done.disabled).toBe(true);
    }
  });

  it.each(CASES)('save: a stored %s of %j is checked with the same rule before the RPC (ok=%s)', async (kind, value, ok) => {
    const entity = kind === 'facebook'
      ? { ...ENTITY, socials: { facebook: value } }
      : { ...ENTITY, [kind]: value };
    api.entity.mockResolvedValue(entity);
    mount();
    fireEvent.change(await screen.findByTestId('profile-name'), { target: { value: 'Ritmo Leeds' } });
    fireEvent.click(screen.getByTestId('profile-bar-action'));
    if (ok) {
      await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
      expect(screen.queryByTestId('profile-save-error')).toBeNull();
    } else {
      expect((await screen.findByTestId('profile-save-error')).textContent).toBe(LINK_PROBLEM[kind]);
      expect(api.save).not.toHaveBeenCalled();
    }
  });
});

describe('logo row', () => {
  it.each([
    ['https://cdn.example/logo.png', 'Added'],
    [null, 'None yet'],
  ])('avatar %j reads %j (a fact, never an action word like Set)', async (avatar, word) => {
    api.entity.mockResolvedValue({ ...ENTITY, avatar_url: avatar });
    mount();
    expect((await screen.findByTestId('profile-photo-value')).textContent).toBe(word);
  });
});

describe('save bar', () => {
  it('takes its props from the shared saveBarState with the label Save profile', async () => {
    mount();
    await screen.findByTestId('profile-bar');
    expect(api.bar).toHaveBeenCalledWith({ dirty: false, saving: false, saveLabel: 'Save profile' });
    fireEvent.change(screen.getByTestId('profile-name'), { target: { value: 'Ritmo!' } });
    expect(api.bar).toHaveBeenLastCalledWith({ dirty: true, saving: false, saveLabel: 'Save profile' });
    expect(screen.getByTestId('profile-bar-action').textContent).toContain('Save profile');
  });
});
