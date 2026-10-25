// @vitest-environment jsdom
/**
 * People arc S5: the links that hand a person to someone else point at the world they belong in.
 * - Share copies the canonical URL of the world on screen (never /people, a ?query, a #tab or another role).
 * - A wall tile opens the person's strongest world (Teacher > DJ > Dancer, a role only when its page is
 *   open), the same rule as the /people/:id canonical, with flags.personWorlds ON; OFF, as before.
 * - The tile's date line reads ", next gig Friday 23 October" to a screen reader, the same pause the chips use.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { flags } from '@/lib/featureFlags';
import { shareUrlFor } from '../frame';
import { djWallPerson, dancerWallPerson } from '../wall/model';
import { WallTile } from '../wall/WallTile';
import { ROLE_PAGE_BASE, strongestRole, type PersonRole } from '../personRoles';
import { visibleRoles } from '@/lib/searchEntities';
import type { PersonBadge } from '../badges';

const ORIGIN = 'https://www.bachatacalendar.co.uk';
const WORLDS_DEFAULT = flags.personWorlds;
const setWorlds = (on: boolean) => { (flags as { personWorlds: boolean }).personWorlds = on; };
afterEach(() => { setWorlds(WORLDS_DEFAULT); cleanup(); });

describe('Share copies the canonical URL of the visible world', () => {
  it.each<[PersonRole, string | null, string, string]>([
    ['dj', 'morcilla', '/djs/morcilla?fbclid=abc#top', `${ORIGIN}/djs/morcilla`],
    ['dancer', 'morcilla', '/dancers/morcilla', `${ORIGIN}/dancers/morcilla`],
    ['teacher', 'morcilla', '/teachers/morcilla?utm_source=wa', `${ORIGIN}/teachers/morcilla`],
    // The visible tab wins even if the address bar still says another place (a /people hash tab).
    ['dj', 'morcilla', '/people/morcilla#dj', `${ORIGIN}/djs/morcilla`],
    // No slug yet: this page, query and hash dropped.
    ['dj', null, '/djs/0a1b?x=1', `${ORIGIN}/djs/0a1b`],
  ])('%s tab, slug %s, at %s -> %s', (role, slug, at, want) => {
    expect(shareUrlFor(role, slug, { pathname: new URL(at, ORIGIN).pathname })).toBe(want);
  });
});

const B = (id: string, roles: PersonBadge['roles']): PersonBadge => ({ id, roles, djName: null, djHasUpcoming: false, nextGigDate: null });
const DJROW = (id: string) => ({ id, display_name: 'X', dj_name: 'X', first_name: null, surname: null, photo_url: null, nationality_code: null, has_upcoming_gig: false, next_gig_date: null });

// The /people/:id canonical rule, computed the same way people.tsx does, is the oracle for the wall.
const canonicalWorld = (id: string, roles: readonly PersonRole[], teacherPagesOpen: boolean) => {
  const r = strongestRole(visibleRoles(roles, teacherPagesOpen));
  return r ? `${ROLE_PAGE_BASE[r]}/${id}` : null;
};

describe('wall tile href per roles combination (flags.personWorlds ON)', () => {
  beforeEach(() => setWorlds(true));
  const combos: PersonRole[][] = [['dancer'], ['dj'], ['dj', 'dancer'], ['teacher', 'dancer'], ['teacher', 'dj'], ['teacher', 'dj', 'dancer']];
  for (const open of [false, true]) {
    for (const roles of combos) {
      if (roles.includes('dancer')) {
        it(`/dancers: ${roles.join('+')} (teacher pages ${open ? 'open' : 'closed'})`, () => {
          expect(dancerWallPerson({ id: 'p', avatar_url: null }, 'P', null, B('p', roles), open).href).toBe(canonicalWorld('p', roles, open));
        });
      }
      if (roles.includes('dj')) {
        it(`/djs: ${roles.join('+')} (teacher pages ${open ? 'open' : 'closed'})`, () => {
          expect(djWallPerson(DJROW('p'), 'P', B('p', roles), open).href).toBe(canonicalWorld('p', roles, open));
        });
      }
    }
  }
  it('a /djs row whose badge lags (no dj role) still opens the DJ world', () => {
    expect(djWallPerson(DJROW('p'), 'P', B('p', ['dancer']), false).href).toBe('/djs/p');
  });
  it('no badge (the read failed): the list page', () => {
    expect(dancerWallPerson({ id: 'p', avatar_url: null }, 'P', null, undefined, false).href).toBe('/dancers/p');
    expect(djWallPerson(DJROW('p'), 'P', undefined, false).href).toBe('/djs/p');
  });
});

describe('wall tile href with flags.personWorlds OFF is unchanged: the list page', () => {
  beforeEach(() => setWorlds(false));
  it.each<[PersonRole[]]>([[['dj', 'dancer']], [['teacher', 'dj', 'dancer']]])('%s', (roles) => {
    expect(dancerWallPerson({ id: 'p', avatar_url: null }, 'P', null, B('p', roles), true).href).toBe('/dancers/p');
    expect(djWallPerson(DJROW('p'), 'P', B('p', roles), true).href).toBe('/djs/p');
  });
});

describe('tile date line reads naturally to a screen reader', () => {
  it('name, then ", next gig <date>", then the role chips', () => {
    const p = djWallPerson({ ...DJROW('p'), dj_name: 'Mr M', has_upcoming_gig: true, next_gig_date: '2099-10-23' }, 'Mr M', B('p', ['dj']), false);
    render(<MemoryRouter><WallTile person={p} list="djs" /></MemoryRouter>);
    // The face is aria-hidden initials (or an alt="" photo): not part of the link's name.
    const link = screen.getByTestId('wall-tile').cloneNode(true) as HTMLElement;
    link.querySelector('[data-testid=wall-face]')?.remove();
    const text = (link.textContent ?? '').replace(/\s+/g, ' ');
    expect(text).toBe('Mr M, next gig Friday 23 October, DJ');
  });
});
