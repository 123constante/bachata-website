// @vitest-environment jsdom
/** More (C29), Help (C41), roles x support x the one Leave rule (plan 4.5 Consistency, S7). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const api = vi.hoisted(() => ({ home: vi.fn(), entity: vi.fn(), remove: vi.fn(), support: vi.fn(), rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: api.rpc } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'me@x.example' }, signOut: vi.fn() }) }));
vi.mock('@/modules/organiser/shared/support', () => ({ supportLinks: api.support }));
vi.mock('@/modules/organiser/shared/selfServeApi', async () => ({
  ...(await vi.importActual<object>('@/modules/organiser/shared/selfServeApi')),
  fetchOrganiserHome: api.home,
  removeOrganiserMember: api.remove,
}));
vi.mock('@/modules/profile/organiserPublicProfile', async () => ({
  ...(await vi.importActual<object>('@/modules/profile/organiserPublicProfile')),
  fetchOwnOrganiserEntity: api.entity,
}));

import MorePage from '../index';
import HelpPage from '../help';
import { HELP_ROWS } from '../help/helpRows';
import { ORG_BASE, ORG_PATHS } from '../../shell/paths';
import { draftStorageKey } from '../../edit-in-place/draftModel';
import { organiserContactSettingsQueryKey } from '../../shared/ownershipApi';
import { LAST_OWNER_NOTE } from '../../shared/teamModel';

const ORG = (role: 'owner' | 'manager') => ({ id: 'org-1', name: 'Ritmo', slug: 'ritmo', avatar_url: null, city_id: 'c1', lifecycle_status: 'live', role, latest_decision: null, series: [] });
const ENTITY = { id: 'org-1', name: 'Ritmo', avatar_url: null, bio: null, socials: null, city_id: 'c1', instagram: null, website: null, organisation_category: null, founded_year: null, cities: { name: 'Leeds', slug: 'leeds' } };

function Where() {
  const l = useLocation();
  return <p data-testid="where" data-state={JSON.stringify(l.state ?? null)}>{l.pathname}{l.search}</p>;
}

function mount(path: string = ORG_PATHS.more, client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={ORG_PATHS.more} element={<MorePage />} />
          <Route path={ORG_PATHS.help} element={<HelpPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  api.home.mockReset();
  api.entity.mockReset().mockResolvedValue(ENTITY);
  api.remove.mockReset().mockResolvedValue({ userId: 'u1', memberRole: 'manager', selfRemoved: true, removedRows: 1 });
  api.support.mockReset().mockReturnValue({ whatsapp: null, email: null });
  api.rpc.mockReset().mockResolvedValue({ data: null, error: { message: 'not mocked' } });
});
afterEach(cleanup);

const tap = (el: HTMLElement) => el.className;
const homeAs = (role: 'owner' | 'manager') => api.home.mockResolvedValue({ today: '2026-10-07', organisers: [ORG(role)] });

const CONTACT = { contact_email: 'a@x.example', contact_phone: null, show_phone_publicly: false, show_email_publicly: false, claim_email: null };
const member = (userId: string, role: 'owner' | 'manager') => ({ user_id: userId, member_role: role, is_self: userId === 'u1' });
/** The server's answers: the team read (who owns the page) and the layer's own reads and save. */
function serve(members: ReturnType<typeof member>[], myRole: 'owner' | 'manager') {
  // A contact-only save leaves the page row as it was; the contact read then returns what was saved.
  let phone: unknown = CONTACT.contact_phone;
  api.rpc.mockImplementation(async (name: string, args: { p_patch?: Record<string, unknown> }) => {
    if (name === 'organiser_team_v1') return { data: { my_role: myRole, members }, error: null };
    if (name === 'get_organiser_contact_settings_v1') return { data: { ...CONTACT, contact_phone: phone }, error: null };
    if (name === 'organiser_profile_update_p5_v1') {
      if (args.p_patch && 'contact_phone' in args.p_patch) phone = args.p_patch.contact_phone;
      return { data: { changed_keys: Object.keys(args.p_patch ?? {}), profile: ENTITY }, error: null };
    }
    return { data: null, error: { message: `unmocked ${name}` } };
  });
}

// SH-4: only the SOLE owner is refused (remove_organiser_member_v1 last_owner); a co-owner may leave.
describe('Leave follows the server rule: only the sole owner hands over first', () => {
  it.each([
    { row: 'sole owner', role: 'owner' as const, members: [member('u1', 'owner')], leave: false, handOver: true },
    { row: 'owner with a co-owner', role: 'owner' as const, members: [member('u1', 'owner'), member('u2', 'owner')], leave: true, handOver: true },
    { row: 'manager', role: 'manager' as const, members: [member('u2', 'owner'), member('u1', 'manager')], leave: true, handOver: false },
  ])('$row', async ({ role, members, leave: canLeave, handOver }) => {
    homeAs(role);
    serve(members, role);
    mount();
    const leave = await screen.findByTestId('more-leave');
    await waitFor(() => expect(api.rpc.mock.calls.some(([n]) => n === 'organiser_team_v1')).toBe(true));
    await waitFor(() => expect(leave.getAttribute('aria-disabled')).toBe(canLeave ? null : 'true'));
    expect(screen.queryByTestId('more-hand-over') !== null).toBe(handOver);
    expect(screen.queryByTestId('more-leave-reason')?.textContent ?? null).toBe(canLeave ? null : 'Hand over first');
    fireEvent.click(leave);
    if (!canLeave) {
      expect(screen.queryByTestId('more-leave-sheet')).toBeNull();
      expect(api.remove).not.toHaveBeenCalled();
      return;
    }
    fireEvent.click(await screen.findByTestId('more-leave-yes'));
    await waitFor(() => expect(api.remove).toHaveBeenCalledTimes(1));
    expect(api.remove).toHaveBeenCalledWith('org-1', 'u1');
    expect((await screen.findByTestId('where')).textContent).toBe(ORG_PATHS.done);
  });
});

describe('Leave when the team read fails', () => {
  it('the server decides: Leave works, and its last_owner refusal is the copy shown', async () => {
    homeAs('owner');
    api.remove.mockRejectedValue({ message: 'last_owner', code: 'P0001' });
    mount();
    const leave = await screen.findByTestId('more-leave');
    await waitFor(() => expect(leave.getAttribute('aria-disabled')).toBeNull());
    fireEvent.click(leave);
    fireEvent.click(await screen.findByTestId('more-leave-yes'));
    expect((await screen.findByTestId('more-leave-error')).textContent).toBe(LAST_OWNER_NOTE);
  });
});

// SH-3: a return to /more inside the contact read's 60 s window must still land a save on Done.
describe('a contact-only save after a quick return', () => {
  it('lands on Done "Saved" when the contact read was already cached', async () => {
    homeAs('owner');
    serve([member('u1', 'owner')], 'owner');
    window.localStorage.setItem(draftStorageKey('org-1'), JSON.stringify({ v: 1, fields: { contact_phone: '+44 7700 900123' } }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(organiserContactSettingsQueryKey('org-1', 'u1'), CONTACT);
    mount(ORG_PATHS.more, client);
    const bar = await screen.findByTestId('eip-bar');
    fireEvent.click(within(bar).getByRole('button', { name: 'Save' }));
    const where = await screen.findByTestId('where', {}, { timeout: 2000 });
    expect(where.textContent).toBe(ORG_PATHS.done);
    expect(JSON.parse(where.getAttribute('data-state')!)).toMatchObject({ message: 'Saved' });
  });

  it('a STALE cached read that the mount refetch changes is a load, not a save', async () => {
    homeAs('owner');
    serve([member('u1', 'owner')], 'owner');
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // Two minutes old, and someone else has since set a phone: the refetch differs.
    client.setQueryData(organiserContactSettingsQueryKey('org-1', 'u1'), { ...CONTACT, contact_phone: '07700 900999' }, { updatedAt: Date.now() - 120_000 });
    mount(ORG_PATHS.more, client);
    await waitFor(() => expect(api.rpc.mock.calls.filter(([n]) => n === 'get_organiser_contact_settings_v1')).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('where')).toBeNull();
    expect(screen.getByTestId('org-page-more')).toBeTruthy();
  });
});

describe('roles x Leave / Hand over', () => {
  it('owner: Hand over present and linked; Leave aria-disabled with the visible reason and sends nothing', async () => {
    homeAs('owner');
    serve([member('u1', 'owner')], 'owner');
    mount();
    const leave = await screen.findByTestId('more-leave');
    await waitFor(() => expect(api.rpc.mock.calls.some(([n]) => n === 'organiser_team_v1')).toBe(true));
    expect(leave.getAttribute('aria-disabled')).toBe('true');
    const reason = screen.getByTestId('more-leave-reason');
    expect(reason.textContent).toBe('Hand over first');
    expect(leave.getAttribute('aria-describedby')).toBe(reason.id);
    fireEvent.click(leave);
    expect(screen.queryByTestId('more-leave-sheet')).toBeNull();
    expect(api.remove).not.toHaveBeenCalled();
    expect(screen.getByTestId('more-hand-over').getAttribute('href')).toBe(ORG_PATHS.handover);
  });

  it('manager: Hand over absent; Leave enabled, confirms, sends ONE remove for themself and lands on Done', async () => {
    homeAs('manager');
    mount();
    const leave = await screen.findByTestId('more-leave');
    expect(leave.getAttribute('aria-disabled')).toBeNull();
    expect(screen.queryByTestId('more-hand-over')).toBeNull();
    expect(screen.queryByTestId('more-leave-reason')).toBeNull();
    fireEvent.click(leave);
    expect(api.remove).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByTestId('more-leave-yes'));
    await waitFor(() => expect(api.remove).toHaveBeenCalledTimes(1));
    expect(api.remove).toHaveBeenCalledWith('org-1', 'u1');
    const where = await screen.findByTestId('where');
    expect(where.textContent).toBe(ORG_PATHS.done);
    expect(JSON.parse(where.getAttribute('data-state')!)).toMatchObject({ message: 'You left Ritmo' });
  });
});

describe('support rows follow the env (D7)', () => {
  it('absent: no support rows at all', async () => {
    homeAs('owner');
    mount();
    await screen.findByTestId('more-help');
    expect(screen.queryByTestId('more-support-whatsapp')).toBeNull();
    expect(screen.queryByTestId('more-support-email')).toBeNull();
  });

  it('set: each row links to its value', async () => {
    api.support.mockReturnValue({ whatsapp: 'https://wa.me/447700900123', email: 'help@x.example' });
    homeAs('manager');
    mount();
    expect((await screen.findByTestId('more-support-whatsapp')).getAttribute('href')).toBe('https://wa.me/447700900123');
    expect(screen.getByTestId('more-support-email').getAttribute('href')).toBe('mailto:help@x.example');
  });
});

describe('every row names a control that exists', () => {
  it.each(['owner', 'manager'] as const)('%s: links, 44px+ targets, no tab / swipe / menu copy', async (role) => {
    homeAs(role);
    const { container } = mount();
    await screen.findByTestId('more-help');
    expect(screen.getByTestId('more-add-page').getAttribute('href')).toBe(`${ORG_PATHS.home}?add=1`);
    expect(screen.getByTestId('more-help').getAttribute('href')).toBe(ORG_PATHS.help);
    expect(screen.getByTestId('more-account-settings').getAttribute('href')).toBe('/account/settings');
    expect(screen.getByTestId('more-privacy').getAttribute('href')).toBe('/privacy');
    expect(screen.getByTestId('more-terms').getAttribute('href')).toBe('/terms');
    expect(container.textContent ?? '').not.toMatch(/\b(tab|swipe|menu)\b/i);
    for (const el of container.querySelectorAll<HTMLElement>('a, button')) {
      if (el.closest('[data-eip-layer], [data-testid="more-contact"]')) continue;
      expect(tap(el)).toMatch(/\b(min-)?h-\[(4[4-9]|5\d)px\]/);
    }
  });

  // SH-6: a login with no page loaded (no `selected`) still has Add a page.
  it('Add a page shows with no page selected (a login with no pages)', async () => {
    api.home.mockResolvedValue({ today: '2026-10-07', organisers: [] });
    mount();
    const add = await screen.findByTestId('more-add-page');
    expect(add.getAttribute('href')).toBe(`${ORG_PATHS.home}?add=1`);
    expect(screen.queryByTestId('more-leave')).toBeNull();
    expect(screen.queryByTestId('more-hand-over')).toBeNull();
  });

  it('Add a page is for every login: never disabled', async () => {
    homeAs('owner');
    mount();
    const add = await screen.findByTestId('more-add-page');
    expect(add.getAttribute('aria-disabled')).toBeNull();
    expect(add.tagName).toBe('A');
  });
});

describe('Help (C41)', () => {
  it('is a short list of job names, each a link into its flow, with no paragraphs', async () => {
    homeAs('owner');
    const { container } = mount(ORG_PATHS.help);
    for (const row of HELP_ROWS) {
      const a = await screen.findByTestId(`help-${row.id}`);
      expect(a.className).toMatch(/min-h-\[52px\]/);
    }
    expect(container.querySelectorAll('p')).toHaveLength(0);
  });

  // SH-7a: the destinations pinned literally, not read back from the same table.
  it.each([
    ['change', 'Change a date', `${ORG_BASE}/change`],
    ['add', 'Add a date', `${ORG_BASE}/add`],
    ['cancel', 'Cancel a date', `${ORG_BASE}/cancel`],
    ['new', 'New event', `${ORG_BASE}/new/what`],
    ['page', 'Edit your page', `${ORG_BASE}/page`],
    ['team', 'Team', `${ORG_BASE}/team`],
    ['handover', 'Hand over', `${ORG_BASE}/handover`],
  ])('%s: "%s" goes to %s', async (id, label, to) => {
    homeAs('owner');
    mount(ORG_PATHS.help);
    const a = await screen.findByTestId(`help-${id}`);
    expect(a.textContent).toBe(label);
    expect(a.getAttribute('href')).toBe(to);
  });

  it('has exactly the pinned rows', () => {
    expect(HELP_ROWS.map((r) => r.id)).toEqual(['change', 'add', 'cancel', 'new', 'page', 'team', 'handover']);
  });
});
