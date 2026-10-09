// @vitest-environment jsdom
/**
 * Owner, 2026-10-08: closing a profile link sheet (the X) with an INVALID entry
 * throws the typed text away and puts back the value the field had when it
 * opened: no stuck invalid draft, no dirty flag, Save stays off. Valid and blank
 * entries behave as before. Same mapping as the event editor's ticket and video
 * sheets (shared/linkRules linkOnClose; events/__tests__/linkSheetClose.matrix.test.tsx).
 * Matrix: Instagram, website, Facebook x saved/blank x valid/invalid/empty x close/Done.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LINK_ENTRIES } from '../../__tests__/shapes/linkEntries';

const api = vi.hoisted(() => ({ home: vi.fn(), entity: vi.fn(), save: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {} } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'me@x.example' }, signOut: vi.fn() }) }));
vi.mock('@/modules/organiser/shared/selfServeApi', async () => ({
  ...(await vi.importActual<object>('@/modules/organiser/shared/selfServeApi')),
  fetchOrganiserHome: api.home,
}));
vi.mock('@/modules/profile/organiserPublicProfile', async () => ({
  ...(await vi.importActual<object>('@/modules/profile/organiserPublicProfile')),
  fetchOrganiserEntity: api.entity,
}));
vi.mock('@/lib/organiserProfileUpdate', async () => ({
  ...(await vi.importActual<object>('@/lib/organiserProfileUpdate')),
  saveOrganiserProfile: api.save,
}));

import ProfilePage from '../index';

const ORG = { id: 'org-1', name: 'Ritmo', slug: 'ritmo', avatar_url: null, city_id: 'c1', lifecycle_status: 'live', role: 'owner', latest_decision: null, series: [] };
type Kind = 'instagram' | 'website' | 'facebook';

function entityWith(saved: Record<Kind, string>) {
  return {
    id: 'org-1', name: 'Ritmo', avatar_url: null, bio: 'Salsa and bachata in Leeds', claimed_by: 'u1',
    socials: saved.facebook ? { facebook: saved.facebook } : {}, city_id: 'c1',
    instagram: saved.instagram || null, website: saved.website || null,
    contact_email: 'me@x.example', contact_phone: null, organisation_category: 'school', founded_year: 2015,
    cities: { name: 'Leeds', slug: 'leeds' },
  };
}

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
  api.save.mockReset().mockResolvedValue({ error: null });
});
afterEach(cleanup);

const saveOff = () => (screen.getByTestId('profile-bar-action') as HTMLButtonElement).disabled;
const done = () => screen.getByTestId('profile-sheet-done') as HTMLButtonElement;
type Entry = 'valid' | 'invalid' | 'empty';

describe('profile link sheets: closing with an invalid entry restores the saved value', () => {
  for (const kind of ['instagram', 'website', 'facebook'] as Kind[]) {
    for (const savedState of ['saved', 'blank'] as const) {
      for (const e of ['valid', 'invalid', 'empty'] as Entry[]) {
        for (const how of ['close', 'done'] as const) {
          it(`${kind}: saved ${savedState}, ${e} entry, ${how}`, async () => {
            const before = savedState === 'saved' ? LINK_ENTRIES[kind].saved : '';
            const saved = { instagram: LINK_ENTRIES.instagram.saved, website: LINK_ENTRIES.website.saved, facebook: LINK_ENTRIES.facebook.saved, [kind]: before };
            api.entity.mockReset().mockResolvedValue(entityWith(saved));
            mount();
            const typed = e === 'empty' ? '' : LINK_ENTRIES[kind][e];
            fireEvent.click(await screen.findByTestId(`profile-${kind}`));
            expect(saveOff()).toBe(true);
            fireEvent.change(await screen.findByTestId('profile-field'), { target: { value: typed } });
            if (how === 'done') {
              expect(done().disabled).toBe(e === 'invalid');
              if (e === 'invalid') return; // Done cannot be pressed: the sheet stays open with the reason.
              fireEvent.click(done());
            } else {
              fireEvent.click(screen.getByTestId('profile-sheet-close'));
            }
            const kept = e === 'invalid' ? before : typed;
            expect(saveOff()).toBe(kept === before);
            fireEvent.click(screen.getByTestId(`profile-${kind}`));
            expect((await screen.findByTestId('profile-field') as HTMLInputElement).value).toBe(kept);
            expect(screen.queryByTestId('profile-field-problem')).toBeNull();
            expect(done().disabled).toBe(false);
          });
        }
      }
    }
  }

  it('an invalid entry closed with the X never reaches Save', async () => {
    api.entity.mockReset().mockResolvedValue(entityWith({ instagram: LINK_ENTRIES.instagram.saved, website: '', facebook: '' }));
    mount();
    fireEvent.click(await screen.findByTestId('profile-instagram'));
    fireEvent.change(await screen.findByTestId('profile-field'), { target: { value: 'not a handle!' } });
    fireEvent.click(screen.getByTestId('profile-sheet-close'));
    fireEvent.change(screen.getByTestId('profile-name'), { target: { value: 'Ritmo Leeds' } });
    fireEvent.click(screen.getByTestId('profile-bar-action'));
    await vi.waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
    expect(api.save.mock.calls[0][2].instagram).toBe(LINK_ENTRIES.instagram.saved);
    expect(screen.queryByTestId('profile-save-error')).toBeNull();
  });
});
