// @vitest-environment jsdom
/** Page (C27): the facts as rows over the EXISTING edit-in-place sheets; Save only when something differs. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const api = vi.hoisted(() => ({ home: vi.fn(), entity: vi.fn(), rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: api.rpc, from: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'me@x.example' }, signOut: vi.fn() }) }));
vi.mock('@/modules/organiser/shared/selfServeApi', async () => ({
  ...(await vi.importActual<object>('@/modules/organiser/shared/selfServeApi')),
  fetchOrganiserHome: api.home,
}));
vi.mock('@/modules/profile/organiserPublicProfile', async () => ({
  ...(await vi.importActual<object>('@/modules/profile/organiserPublicProfile')),
  fetchOwnOrganiserEntity: api.entity,
}));

import PageScreen from '../index';
import { ORG_PATHS } from '../../shell/paths';

const ORG = { id: 'org-1', name: 'Ritmo', slug: 'ritmo', avatar_url: null, city_id: 'c1', lifecycle_status: 'live', role: 'owner', latest_decision: null, series: [] };
const ENTITY = {
  id: 'org-1', name: 'Ritmo', avatar_url: null, bio: 'Salsa and bachata in Leeds', socials: null, city_id: 'c1',
  instagram: '@ritmoleeds', website: null, organisation_category: 'school', founded_year: 2015, cities: { name: 'Leeds', slug: 'leeds' },
};

function Where() {
  const l = useLocation();
  return <p data-testid="where" data-state={JSON.stringify(l.state ?? null)}>{l.pathname}</p>;
}

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[ORG_PATHS.page]}>
        <Routes>
          <Route path={ORG_PATHS.page} element={<PageScreen />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  api.home.mockReset().mockResolvedValue({ today: '2026-10-07', organisers: [ORG] });
  api.entity.mockReset().mockResolvedValue(ENTITY);
  api.rpc.mockReset().mockImplementation(async (name: string, args: { p_patch?: Record<string, unknown> }) => {
    if (name === 'get_organiser_contact_settings_v1') return { data: { contact_email: 'a@x.example', contact_phone: null, show_phone_publicly: false, show_email_publicly: false, claim_email: null }, error: null };
    if (name === 'organiser_team_v1') return { data: { my_role: 'owner', members: [] }, error: null };
    if (name === 'organiser_profile_update_p5_v1') return { data: { changed_keys: Object.keys(args.p_patch ?? {}), profile: { ...ENTITY, ...(args.p_patch ?? {}) } }, error: null };
    return { data: null, error: { message: `unmocked ${name}` } };
  });
});
afterEach(cleanup);

const pencil = (field: string) => waitFor(() => { const p = document.querySelector<HTMLButtonElement>(`[data-eip-pencil="${field}"]`); if (!p) throw new Error(`no ${field} pencil`); return p; });
const saves = () => api.rpc.mock.calls.filter(([n]) => n === 'organiser_profile_update_p5_v1');

describe('every fact is a row that opens the existing sheet', () => {
  it.each(['avatar_url', 'name', 'city', 'founded_year', 'organisation_category', 'bio', 'instagram', 'facebook', 'website'])('%s', async (field) => {
    mount();
    fireEvent.click(await pencil(field));
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });

  it('shows the stored values and a Live chip, and no review card or status copy (D22)', async () => {
    mount();
    expect((await screen.findByTestId('page-name')).textContent).toBe('Ritmo');
    expect(screen.getByTestId('page-about').textContent).toContain('Salsa and bachata in Leeds');
    expect(screen.getByTestId('page-live-chip').textContent).toBe('Live');
    expect(screen.queryByText(/send for review/i)).toBeNull();
    expect(screen.queryByTestId('profile-send-review')).toBeNull();
  });

  it('links to Team (6 owns /team)', async () => {
    mount();
    expect((await screen.findByTestId('page-team-link')).getAttribute('href')).toBe(ORG_PATHS.team);
  });
});

describe('Save (the layer\'s one)', () => {
  it('an untouched page has no Save bar; nothing is sent', async () => {
    mount();
    await pencil('bio');
    expect(screen.queryByTestId('eip-bar')).toBeNull();
    expect(saves()).toHaveLength(0);
  });

  it('a changed value is drafted, then ONE save lands on Done "Saved"', async () => {
    mount();
    fireEvent.click(await pencil('bio'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'We dance on Tuesdays.' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(saves()).toHaveLength(0);
    expect((await screen.findByTestId('page-about')).textContent).toContain('We dance on Tuesdays.');
    fireEvent.click(within(await screen.findByTestId('eip-bar')).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(saves()).toHaveLength(1));
    const where = await screen.findByTestId('where');
    expect(where.textContent).toBe(ORG_PATHS.done);
    expect(JSON.parse(where.getAttribute('data-state')!)).toMatchObject({ message: 'Saved' });
  });

  it('putting a value back to what is stored leaves nothing to save', async () => {
    mount();
    fireEvent.click(await pencil('bio'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: ENTITY.bio } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByTestId('eip-bar')).toBeNull();
    expect(saves()).toHaveLength(0);
  });
});

describe('source: the old review UI and hand-built state are gone', () => {
  const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? (d.name === '__tests__' ? [] : files(join(dir, d.name))) : /\.tsx?$/.test(d.name) ? [join(dir, d.name)] : []));
  const root = join(process.cwd(), 'src', 'modules', 'organiser');
  const all = files(root);

  it('no ReviewCard / reviewModel import and no "Send for review" string in page/, more/ or flows/fix/', () => {
    for (const f of all.filter((p) => /[\\/](page|more|fix)[\\/]/.test(p))) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/ReviewCard|reviewModel|useSendForReview|Send for review/);
    }
  });

  it('page/ reaches the sheets only through edit-in-place (import identity)', () => {
    const src = readFileSync(join(root, 'page', 'useOwnPage.tsx'), 'utf8');
    expect(src).toContain("import('../edit-in-place/EditInPlaceLayer')");
  });

  it('ORG_PATHS.newEvent has no caller left (events/ is S5\'s and swaps its own)', () => {
    const hits = all.filter((f) => !/[\\/](shell[\\/]paths\.ts|events[\\/])/.test(f) && /ORG_PATHS\.newEvent\b/.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });

  it('the Create event link keeps ?o=<id> and points at /new/what', () => {
    const src = readFileSync(join(root, 'edit-in-place', 'parts.tsx'), 'utf8');
    expect(src).toContain('`${ORG_PATHS.newWhat}?o=${encodeURIComponent(organiserId)}`');
  });
});
