// @vitest-environment jsdom
/**
 * W2-C: the role page's Back row + role switcher (owner pick N-A), table-driven over the prod
 * role shapes x the page it sits on x the teacher flag. The same fact reads the same on the wall,
 * the hub and the switcher: labels, links and colours come from the ONE mapping (roleTagsFor,
 * CHIP), never a second copy. A role with no page never gets a pill; one role = no pills;
 * flags.personHub OFF = today's Also row, unchanged.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { flags } from '@/lib/featureFlags';
import type { PersonRole } from '@/lib/searchEntities';
import { roleTagsFor, type PersonBadge } from '../badges';
import { BAR_BACKGROUND, BAR_FADE, backLabel, roleSwitchModel, TAP } from '../roleSwitch';
import { RoleSwitchView } from '../RoleSwitchBar';
import { RoleChip } from '../wall/RoleChip';
import { CHIP, WALL } from '../wall/tokens';

const h = vi.hoisted(() => ({ roles: [] as PersonRole[], name: 'Marta Silva' as string | null, answered: true, gone: false }));
vi.mock('../badges', async (orig) => {
  const real = await orig<typeof import('../badges')>();
  return {
    ...real,
    usePeopleBadges: () => ({
      badges: h.roles.length ? new Map([['p1', { id: 'p1', roles: h.roles, djName: 'DJ Roger', djHasUpcoming: false, nextGigDate: null }]]) : new Map(),
      isLoading: false,
      isError: false,
    }),
  };
});
vi.mock('../usePersonRoles', () => ({
  usePersonSnapshot: () => ({ snapshot: h.answered && !h.gone ? { name: h.name, roles: h.roles } : null, answered: h.answered }),
}));

import { AlsoRoles } from '../AlsoRoles';

const setHub = (on: boolean) => { (flags as { personHub: boolean }).personHub = on; };
const setTeacher = (on: boolean) => { (flags as { teacherDetail: boolean }).teacherDetail = on; };
afterEach(() => { cleanup(); setHub(false); setTeacher(false); h.roles = []; h.name = 'Marta Silva'; h.answered = true; h.gone = false; });

const b = (roles: PersonRole[]): PersonBadge => ({ id: 'p1', roles, djName: 'DJ Roger', djHasUpcoming: false, nextGigDate: null });
// The S0 prod shapes (same set as the Also bar's table).
const SHAPES: [string, PersonRole[]][] = [
  ['dancer only', ['dancer']],
  ['dj only', ['dj']],
  ['teacher only', ['teacher']],
  ['dancer+dj', ['dj', 'dancer']],
  ['dancer+teacher', ['teacher', 'dancer']],
  ['dj+teacher', ['teacher', 'dj']],
  ['dancer+dj+teacher', ['teacher', 'dj', 'dancer']],
  ['no public role', []],
];
const PAGES: PersonRole[] = ['dancer', 'dj', 'teacher'];

describe.each(SHAPES)('%s', (_n, roles) => {
  describe.each(PAGES)('on the %s page', (current) => {
    it.each([false, true])('teacher pages open=%s', (open) => {
      const m = roleSwitchModel({ badge: b(roles), current, slugOrId: 'marta', name: 'Marta Silva', teacherPagesOpen: open });
      // Back goes to /people/<slug>, and only a person with two or more HELD roles, one of them with an open
      // page, sees the hub there; everyone else is 302'd straight back to this page (W2-D), and no open role
      // page = a 404. So no hub = no bar (the page keeps its own Back), never a Back link that loops or 404s.
      const hub = roles.length >= 2 && (roles.includes('dancer') || roles.includes('dj') || open);
      if (!hub) { expect(m).toBeNull(); return; }
      expect(m).not.toBeNull();
      expect(m!.back).toEqual({ href: '/people/marta', label: 'Back to Marta Silva' });
      // The ONE mapping, with the page the visitor is on counted as one of their roles.
      // Links carry the slug the page was opened with (every role page resolves it on dancer_profiles).
      const want = roleTagsFor({ ...b([...new Set([...roles, current])]), id: 'marta' }, { teacherPagesOpen: open }).filter((t) => t.href);
      if (want.length < 2) { expect(m!.pills).toEqual([]); return; }
      expect(m!.pills.map((p) => p.label)).toEqual(want.map((t) => t.label));
      expect(m!.pills.map((p) => p.href)).toEqual(want.map((t) => t.href));
      expect(m!.pills.filter((p) => p.current).map((p) => p.role)).toEqual(want.some((t) => t.role === current) ? [current] : []);
      if (!open) expect(m!.pills.some((p) => p.role === 'teacher')).toBe(false);
    });
  });
});

describe('Back label', () => {
  it.each([
    ['Marta Silva', 'Back to Marta Silva'],
    ['  Ana  ', 'Back to Ana'],
    ['', 'Back to profile'],
    [null, 'Back to profile'],
    [undefined, 'Back to profile'],
  ])('%j -> %s', (name, want) => expect(backLabel(name as string | null | undefined)).toBe(want));
  it('no badge or no id = no bar', () => {
    expect(roleSwitchModel({ badge: undefined, current: 'dj', slugOrId: 'x', name: 'A', teacherPagesOpen: false })).toBeNull();
    expect(roleSwitchModel({ badge: b(['dj']), current: 'dj', slugOrId: null, name: 'A', teacherPagesOpen: false })).toBeNull();
  });
});

const view = (roles: PersonRole[], current: PersonRole, name = 'Marta Silva') => {
  const m = roleSwitchModel({ badge: b(roles), current, slugOrId: 'marta', name, teacherPagesOpen: false });
  render(<MemoryRouter><RoleSwitchView model={m!} /></MemoryRouter>);
};

describe('the rendered bar', () => {
  it('two roles: back row + one pill per page, current filled in its role colour, the other a role-colour dot', () => {
    view(['dj', 'dancer'], 'dj');
    const pills = screen.getAllByTestId('role-pill');
    expect(pills.map((p) => p.textContent)).toEqual(['DJ', 'Dancer']);
    expect(pills[0].getAttribute('aria-current')).toBe('page');
    expect(pills[1].getAttribute('aria-current')).toBeNull();
    expect(pills[0].style.background).toBe(rgb(CHIP.dj.bg));
    expect(pills[0].style.color).toBe(rgb(CHIP.dj.text));
    expect(pills[0].querySelector('[data-testid="role-dot"]')).toBeNull();
    expect((pills[1].querySelector('[data-testid="role-dot"]') as HTMLElement).style.background).toBe(rgb(CHIP.dancer.bg));
  });

  it('one role with a page (DJ + closed Teacher): the back row only, no pills', () => {
    view(['teacher', 'dj'], 'dj');
    expect(screen.getByTestId('role-switch-back').textContent).toBe('Back to Marta Silva');
    expect(screen.queryByRole('navigation', { name: 'Roles' })).toBeNull();
    expect(screen.queryAllByTestId('role-pill')).toHaveLength(0);
  });

  it('every control is at least 44px tall; a long name ellipsises on one line', () => {
    view(['teacher', 'dj', 'dancer'], 'dancer', 'Maria Fernanda de los Santos Villanueva-Echeverria');
    const back = screen.getByTestId('role-switch-back');
    for (const el of [back, ...screen.getAllByTestId('role-pill')]) expect(parseInt(el.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
    expect(TAP).toBeGreaterThanOrEqual(44);
    expect(back.querySelector('span')!.className).toContain('truncate');
    expect(back.className).toContain('max-w-full');
  });

  it.each(['dj', 'dancer', 'teacher'] as const)('the %s pill reads and colours like the wall chip (one mapping)', (role) => {
    render(<MemoryRouter><RoleChip role={role} label={roleTagsFor(b([role]), { teacherPagesOpen: true })[0].label} /></MemoryRouter>);
    const chip = screen.getByTestId('role-chip');
    const m = roleSwitchModel({ badge: b(['teacher', 'dj', 'dancer']), current: role, slugOrId: 'marta', name: 'M', teacherPagesOpen: true });
    render(<MemoryRouter><RoleSwitchView model={m!} /></MemoryRouter>);
    const pill = screen.getAllByTestId('role-pill').find((p) => p.dataset.role === role)!;
    expect(pill.textContent).toBe(chip.textContent!.replace(', ', ''));
    expect(pill.style.background).toBe(chip.style.background);
  });

  it('no second copy of the role words or colours in the switcher files', () => {
    for (const f of ['roleSwitch.ts', 'RoleSwitchBar.tsx']) {
      const src = readFileSync(path.join(process.cwd(), 'src/modules/person-page', f), 'utf8');
      expect(src).not.toMatch(/['"](Teacher|DJ|Dancer)['"]/);
      expect(src).not.toMatch(/#[0-9A-Fa-f]{6}/);
    }
  });
});

describe('AlsoRoles behind flags.personHub', () => {
  const show = (current: PersonRole) =>
    render(<MemoryRouter><div data-testid="host"><AlsoRoles current={current} id="p1" slug="marta" className="pb-2" /></div></MemoryRouter>);

  it('OFF: today\'s Also row, no switcher', () => {
    h.roles = ['dj', 'dancer'];
    show('dancer');
    expect(screen.getByTestId('also-bar').textContent).toBe('DJ \u00b7 Roger');
    expect(screen.queryByTestId('role-switch')).toBeNull();
  });

  it('ON: the switcher replaces the Also row (dancer page gets it through AlsoRoles, no dancer file edited)', () => {
    setHub(true);
    h.roles = ['dj', 'dancer'];
    show('dancer');
    expect(screen.queryByTestId('also-bar')).toBeNull();
    expect(screen.getByTestId('role-switch-back').getAttribute('href')).toBe('/people/marta');
    expect(screen.getAllByTestId('role-pill').map((p) => p.textContent)).toEqual(['DJ', 'Dancer']);
    expect(screen.getAllByTestId('role-pill').map((p) => p.getAttribute('href'))).toEqual(['/djs/marta', '/dancers/marta']);
  });

  it('ON: the bar fades in and out (soft seam onto the page under it), bled to the page edge', () => {
    setHub(true);
    h.roles = ['dj', 'dancer'];
    show('dancer');
    const bar = screen.getByTestId('role-switch');
    // jsdom drops a calc() background, so the ground is asserted on the one constant the bar uses.
    expect(BAR_BACKGROUND).toBe(
      `linear-gradient(to bottom, rgba(30, 20, 16, 0) 0px, ${WALL.page} ${BAR_FADE.top}px, ` +
      `${WALL.page} calc(100% - ${BAR_FADE.bottom}px), rgba(30, 20, 16, 0) 100%)`,
    );
    expect(bar.style.paddingTop).toBe(`${BAR_FADE.top}px`);
    expect(bar.style.paddingBottom).toBe(`${BAR_FADE.bottom}px`);
    expect(bar.className).toContain('-mx-4');
  });

  it('ON: nothing until the person read answers (SSR and first paint match)', () => {
    setHub(true);
    h.roles = ['dj', 'dancer'];
    h.answered = false;
    show('dancer');
    expect(screen.getByTestId('host').innerHTML).toBe('');
  });

  it('ON: the person read says no public person (the hub would 404): no bar, no Back link into a 404', () => {
    setHub(true);
    h.roles = ['dj', 'dancer'];
    h.gone = true;
    show('dancer');
    expect(screen.getByTestId('host').innerHTML).toBe('');
  });

  it('ON: a teacher role never gets a pill while the teacher pages are closed', () => {
    setHub(true);
    h.roles = ['teacher', 'dancer'];
    show('dancer');
    expect(screen.getByTestId('role-switch-back')).toBeTruthy();
    expect(screen.queryAllByTestId('role-pill')).toHaveLength(0);
  });
});

function rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
}
