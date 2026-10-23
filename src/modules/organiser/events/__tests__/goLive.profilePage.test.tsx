// @vitest-environment jsdom
/**
 * RELEASE-A-WEB fix pass, finding 3 (review F1): the Go live "Complete your
 * profile" row opens the wizard ON THE PAGE the server says is incomplete
 * (series_go_live_check_v1 profile_missing[].organiser_id), not on whichever
 * page happens to be selected. Real shapes (prod, read-only counts): one owner
 * holds 3 pages, 2 incomplete; 5 live series have 2 organisers. The link
 * carries `?o=<id>`, the page choice every organiser screen already reads
 * (useOrganiserChoice); an id the person holds no seat on is ignored there.
 * Also finding 12: Go live is offered on a rejected series, as the server
 * allows (owner rejected -> live).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { Route } from 'react-router-dom';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: {}, rpc, from: () => ({ select: () => ({ is: () => ({ order: async () => ({ data: [], error: null }) }) }) }) },
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'me@x.example' }, authStatus: 'ready', session: null }) }));
vi.mock('@/modules/organiser/shared/a1Gate', () => ({ A1_APPLIED: true }));
vi.mock('@/modules/profile/organiserPublicProfile', async (orig) => ({
  ...(await orig<object>()),
  fetchOwnOrganiserEntity: async (id: string) => ({ id, name: `Page ${id}`, city_id: 'c1', avatar_url: null, bio: null, instagram: null, website: null, socials: {}, organisation_category: null, founded_year: null }),
}));
vi.mock('@/modules/organiser/shared/ownershipApi', async (orig) => ({
  ...(await orig<object>()),
  fetchContactSettings: async () => ({ contact_email: null, contact_phone: null, show_phone_publicly: true, show_email_publicly: false, claim_email: null }),
}));

import OneEvent from '../OneEvent';
import { ProfileWizardScreen } from '@/modules/organiser/wizard/ProfileWizard';
import { goLiveList, lifecycleRows } from '../lifecycleModel';
import { parseEventWorkspace } from '../eventModel';
import { parseGoLiveCheck } from '@/modules/organiser/shared/goLiveCheck';
import { PROFILE_WIZARD_PATH } from '@/modules/organiser/shared/profileProgress';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { DRAFT, FROZEN, answer, comingRun, defaultWorld, mount, series, type World } from '@/modules/organiser/flows/add/__tests__/fixtures';

const PAGE_A = 'aaaa0000-0000-4000-8000-00000000000a';
const PAGE_B = 'bbbb0000-0000-4000-8000-00000000000b';
const PAGE_C = 'cccc0000-0000-4000-8000-00000000000c';
const NOT_MINE = 'dddd0000-0000-4000-8000-00000000000d';
const back = (id: string) => `returnTo=${encodeURIComponent(ORG_PATHS.event(id))}`;

const check = (profile: unknown[]) => ({ ready: false, event_missing: [], recommended: [], profile_rule_applies: true, profile_missing: profile });
const org = (id: string, fields: string[]) => ({ area: 'organiser', organiser_id: id, fields });
const dancer = (fields: string[]) => ({ area: 'dancer', organiser_id: null, fields });

describe('goLiveList: the profile row names the page to fix (pure)', () => {
  const rows: Array<[name: string, profile: unknown[], page: string | null]> = [
    ['one organiser page incomplete', [org(PAGE_B, ['founded_year'])], PAGE_B],
    ['dancer fields only: no page in the link', [dancer(['photo'])], null],
    ['dancer first, then the page: the page', [dancer(['photo']), org(PAGE_B, ['logo'])], PAGE_B],
    ['2-organiser series, the first page complete, the second not', [org(PAGE_A, []), org(PAGE_B, ['logo'])], PAGE_B],
    ['2-organiser series, both incomplete: the first, in the server order', [org(PAGE_C, ['bio']), org(PAGE_B, ['logo'])], PAGE_C],
  ];
  it.each(rows)('%s', (_n, profile, page) => {
    const list = goLiveList(parseGoLiveCheck(check(profile)), DRAFT);
    const to = page ? `${PROFILE_WIZARD_PATH}?o=${page}&${back(DRAFT)}` : `${PROFILE_WIZARD_PATH}?${back(DRAFT)}`;
    expect(list.profile?.href).toBe(to);
  });
});

describe('lifecycleRows: Go live matches the server transitions (finding 12)', () => {
  const ws = (status: string) => parseEventWorkspace({ series: { series: { id: DRAFT, name: 'X', lifecycle_status: status, version: 1 }, program: [] }, occurrences: [] });
  it.each([
    ['draft', true, true],
    ['rejected', true, false],
    ['live', false, false],
    ['paused', false, false],
    ['ended', false, false],
    ['archived', false, false],
    ['pending_review', false, false],
  ])('%s: Go live %s, Discard %s', (status, goLive, discard) => {
    const r = lifecycleRows(ws(status));
    expect(r.goLive !== null).toBe(goLive);
    expect(r.discard !== null).toBe(discard);
  });
});

// ---- the walk: a multi-page owner, page A selected, the draft on page B ----

let world: World;
let profileMissing: unknown[];
let homeOrgs: string[];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN);
  try { window.localStorage.clear(); } catch { /* jsdom */ }
  // Page A is the remembered choice on this device (picked on Switch).
  try { window.localStorage.setItem('org-r1-chosen-page:u1', PAGE_A); } catch { /* jsdom */ }
  rpc.mockReset();
  world = defaultWorld();
  world.occs[DRAFT] = comingRun(1, 3);
  homeOrgs = [PAGE_A, PAGE_B];
  profileMissing = [org(PAGE_B, ['founded_year'])];
  answer(rpc, () => world);
  const base = rpc.getMockImplementation() as (fn: string, args: Record<string, unknown>) => Promise<unknown>;
  rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
    if (fn === 'organiser_home_v1') {
      const draft = series(DRAFT, 'Page B Draft', world.occs[DRAFT], { lifecycle_status: 'draft' });
      return {
        data: {
          today: '2026-10-20',
          organisers: homeOrgs.map((id) => ({ id, name: `Page ${id}`, slug: null, avatar_url: null, city_id: 'c1', lifecycle_status: 'live', role: 'owner', latest_decision: null, series: id === PAGE_B ? [draft] : [], team: [] })),
        },
        error: null,
      };
    }
    if (fn === 'series_go_live_check_v1') return { data: check(profileMissing), error: null };
    if (fn === 'my_profile_progress_v1') {
      return { data: { percent: 80, required_left: args.p_organiser_id === PAGE_B ? 1 : 0, publish_ready: true, declined: [],
        steps: [{ area: 'organiser', field: 'founded_year', required: true, done: args.p_organiser_id !== PAGE_B }] }, error: null };
    }
    if (fn === 'my_dancer_edit_v1') return { data: { profile_id: 'p1', user_id: 'u1', first_name: 'Ana', other_roles: ['organiser'], languages: [], favorite_styles: [], achievements: [] }, error: null };
    if (fn === 'admin_is_admin') return { data: false, error: null };
    return base(fn, args);
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const routes = (
  <>
    <Route path="/account/o/events/:seriesId" element={<OneEvent />} />
    <Route path="/account/o/complete" element={<ProfileWizardScreen />} />
  </>
);
const progressPages = () => rpc.mock.calls.filter(([fn]) => fn === 'my_profile_progress_v1').map(([, a]) => (a as { p_organiser_id: unknown }).p_organiser_id);

describe('the profile row opens the wizard on the page the server named', () => {
  it('multi-page owner: page A selected, the draft on page B -> the link carries B and the wizard opens B', async () => {
    mount(ORG_PATHS.event(DRAFT), routes);
    const row = await screen.findByTestId('org-life-profile');
    expect(row.getAttribute('href')).toBe(`${PROFILE_WIZARD_PATH}?o=${PAGE_B}&${back(DRAFT)}`);
    rpc.mockClear();
    fireEvent.click(row);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(`${PROFILE_WIZARD_PATH}?o=${PAGE_B}&${back(DRAFT)}`));
    await waitFor(() => expect(progressPages().length).toBeGreaterThan(0));
    expect(new Set(progressPages())).toEqual(new Set([PAGE_B]));
  });

  it('a 2-organiser series: the first incomplete page in the server order is the one opened', async () => {
    homeOrgs = [PAGE_A, PAGE_B, PAGE_C];
    profileMissing = [dancer(['photo']), org(PAGE_A, []), org(PAGE_C, ['logo']), org(PAGE_B, ['bio'])];
    mount(ORG_PATHS.event(DRAFT), routes);
    const row = await screen.findByTestId('org-life-profile');
    expect(row.getAttribute('href')).toBe(`${PROFILE_WIZARD_PATH}?o=${PAGE_C}&${back(DRAFT)}`);
  });

  it('the wizard ignores a page id the person holds no seat on (stays on the remembered page)', async () => {
    mount(`${PROFILE_WIZARD_PATH}?o=${NOT_MINE}`, routes);
    await waitFor(() => expect(progressPages().length).toBeGreaterThan(0));
    expect(progressPages()).not.toContain(NOT_MINE);
    expect(new Set(progressPages())).toEqual(new Set([PAGE_A]));
  });
});
