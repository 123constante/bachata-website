// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PersonRole } from '../personRoles';
import type { PersonSnapshot } from '../reads';
import { useEmbeddedProfile } from '@/lib/embeddedProfile';

vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
// Each tab body stands in for the real role page; it reports whether it is embedded.
const Body = (label: string) => () => <div data-testid={`body-${label}`}>{label}:{String(useEmbeddedProfile())}</div>;
vi.mock('@/pages/TeacherProfile', () => ({ default: Body('teacher') }));
vi.mock('@/pages/DJProfile', () => ({ default: Body('dj') }));
const DancerBody = ({ publicPage }: { publicPage?: unknown }) => (
  <div data-testid="body-dancer">dancer:{String(useEmbeddedProfile())}:{publicPage ? 'v2' : 'classic'}</div>
);
vi.mock('@/pages/DancerProfile', () => ({ default: DancerBody }));

import PersonPage from '../PersonPage';

const person = (roles: PersonRole[], over: Partial<PersonSnapshot> = {}): PersonSnapshot => ({
  id: 'p1', name: 'Ana G', avatarUrl: null, city: 'London', instagramUrl: 'https://instagram.com/ana_g', roles, djPhoto: null, ...over,
});

const mount = (p: PersonSnapshot, slugOrId = 'ana-g', publicPage?: { extras: never } | null) =>
  render(<MemoryRouter><PersonPage person={p} slugOrId={slugOrId} publicPage={publicPage} /></MemoryRouter>);

beforeEach(() => { window.location.hash = ''; });
afterEach(cleanup);

const tabs = () => screen.queryAllByRole('tab').map((t) => t.textContent);

describe('PersonPage', () => {
  it.each([
    [['teacher', 'dj', 'dancer'], ['Teaching', 'DJ', 'Dancing'], 'Teacher · DJ · Dancer'],
    [['dj', 'dancer'], ['DJ', 'Dancing'], 'DJ · Dancer'],
    [['teacher', 'dancer'], ['Teaching', 'Dancing'], 'Teacher · Dancer'],
    [['teacher', 'dj'], ['Teaching', 'DJ'], 'Teacher · DJ'],
  ] as Array<[PersonRole[], string[], string]>)('roles %j: tab order, chips', (roles, expectedTabs, chips) => {
    mount(person(roles));
    expect(tabs()).toEqual(expectedTabs);
    expect(screen.getByTestId('role-chips').textContent).toBe(chips);
  });

  it.each([
    ['teacher', 'Teacher', 'Open full teacher page', '/teachers/ana-g'],
    ['dj', 'DJ', 'Open full DJ page', '/djs/ana-g'],
    ['dancer', 'Dancer', 'Open full dancer page', '/dancers/ana-g'],
  ] as Array<[PersonRole, string, string, string]>)('one role (%s): no tab bar, one body, link to the old page', async (role, chip, linkText, href) => {
    mount(person([role]));
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.getByTestId('role-chips').textContent).toBe(chip);
    expect(await screen.findByTestId(`body-${role}`)).toBeTruthy();
    expect(screen.getByRole('link', { name: linkText }).getAttribute('href')).toBe(href);
  });

  it('the name appears once, as the only h1', () => {
    mount(person(['teacher', 'dj']));
    expect(screen.getAllByText('Ana G')).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('city and Instagram show as on the old pages', () => {
    mount(person(['teacher']));
    expect(screen.getByText('London')).toBeTruthy();
    const ig = screen.getByRole('link', { name: '@ana_g' });
    expect(ig.getAttribute('href')).toBe('https://instagram.com/ana_g');
  });

  it('opens the first tab by default and the tab bodies are embedded', async () => {
    mount(person(['teacher', 'dj', 'dancer']));
    expect(await screen.findByText('teacher:true')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Teaching' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByTestId('body-dj')).toBeNull();
  });

  it.each([['#dj', 'dj'], ['#dancing', 'dancer'], ['#teaching', 'teacher']])('hash %s opens the %s tab', async (hash, role) => {
    window.location.hash = hash;
    mount(person(['teacher', 'dj', 'dancer']));
    expect(await screen.findByTestId(`body-${role}`)).toBeTruthy();
  });

  it('a hash for a role the person lacks falls back to the first tab', async () => {
    window.location.hash = '#teaching';
    mount(person(['dj', 'dancer']));
    expect(await screen.findByTestId('body-dj')).toBeTruthy();
  });

  it('clicking a tab switches the body, writes the hash, and swaps the full-page link', async () => {
    mount(person(['teacher', 'dj']));
    await screen.findByTestId('body-teacher');
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'DJ' })); });
    expect(await screen.findByTestId('body-dj')).toBeTruthy();
    expect(window.location.hash).toBe('#dj');
    expect(screen.getByRole('link', { name: 'Open full DJ page' }).getAttribute('href')).toBe('/djs/ana-g');
  });

  it('a hash change (a link to another tab) switches the tab', async () => {
    mount(person(['teacher', 'dj']));
    await screen.findByTestId('body-teacher');
    await act(async () => { window.location.hash = '#dj'; window.dispatchEvent(new HashChangeEvent('hashchange')); });
    expect(await screen.findByTestId('body-dj')).toBeTruthy();
  });

  it('tap targets are at least 44px: tabs, back, full-page link', () => {
    mount(person(['teacher', 'dj']));
    for (const el of [...screen.getAllByRole('tab'), screen.getByRole('button', { name: 'Back' }), screen.getByRole('link', { name: 'Open full teacher page' })]) {
      expect(el.className).toMatch(/(min-h|h)-\[44px\]/);
    }
  });

  it('no photo: an initial, not a broken image; long name wraps', () => {
    mount(person(['dancer'], { name: 'Maria-Fernanda Alejandra de los Santos Quinonez Villalobos' }));
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 }).className).toMatch(/break-words/);
  });
});

describe('PersonPage: the Dancing tab and the v2 public page (S2b2)', () => {
  const V2 = { extras: {} as never };
  it('v2 open: the dancer body gets the loader\'s publicPage', async () => {
    mount(person(['dancer']), 'ana-g', V2);
    expect(await screen.findByText('dancer:true:v2')).toBeTruthy();
  });
  it.each([[undefined], [null]])('flag closed or read failed (%s): the classic body, as today', async (pp) => {
    mount(person(['dancer']), 'ana-g', pp);
    expect(await screen.findByText('dancer:true:classic')).toBeTruthy();
  });
  it('the name is still shown once with v2 on', async () => {
    mount(person(['dj', 'dancer']), 'ana-g', V2);
    expect(screen.getAllByText('Ana G')).toHaveLength(1);
  });
});
