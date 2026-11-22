/**
 * Slice 1a (organiser area v2): the role strip and Switch badge, every person type x cell.
 * One mapping (model/strip.ts) drives the strip, the switcher and these rows.
 */
import { describe, expect, it } from 'vitest';
import { caughtUp, home, page, series, twoTodos } from './fixtures.strip';
import type { OrganiserHome } from '@/modules/organiser/shared/selfServeApi';
import { otherPagesOf, roleWordOf, stripOf, switchBadgeOf, todosOf } from '../../model/strip';

// R4 is the only organiser UI and draws no role strip: the rendered rows went with the old P3 shell.
// The shared mapping still drives the switcher (switch/index.tsx) and R4's To do badge.

// ---- the shared mapping, table-driven ----
const A = 'a';
const cases: Array<[string, OrganiserHome, string | null, { role: string | null; page: string | null; badge: number }]> = [
  ['P1 owner, 1 page, own to-dos', home(page(A, 'Ritmo', 'owner', [twoTodos()])), A, { role: 'Owner', page: 'Ritmo', badge: 0 }],
  ['P1 owner, 0 events', home(page(A, 'Ritmo', 'owner')), A, { role: 'Owner', page: 'Ritmo', badge: 0 }],
  ['P2 two pages, the other has 2 to-dos', home(page(A, 'Ritmo', 'owner', [twoTodos()]), page('b', 'Latino', 'owner', [twoTodos(), caughtUp()])), A, { role: 'Owner', page: 'Ritmo', badge: 2 }],
  ['P2 three pages, to-dos on one other page only', home(page(A, 'Ritmo', 'owner'), page('b', 'Latino', 'owner', [caughtUp()]), page('c', 'Sabor', 'manager', [series({ cover: false })])), A, { role: 'Owner', page: 'Ritmo', badge: 1 }],
  ['P2 the other page is paused with many events, all caught up', home(page(A, 'Ritmo', 'owner'), page('b', 'Latino', 'owner', [caughtUp(), caughtUp(), caughtUp()], 'paused')), A, { role: 'Owner', page: 'Ritmo', badge: 0 }],
  ['P4 manager', home(page(A, 'Ritmo', 'manager', [caughtUp()])), A, { role: 'Manager', page: 'Ritmo', badge: 0 }],
  ['P7 caught up on every page', home(page(A, 'Ritmo', 'owner', [caughtUp()]), page('b', 'Latino', 'owner', [caughtUp()])), A, { role: 'Owner', page: 'Ritmo', badge: 0 }],
  ['P13 door + manager: Manager for that page only', home(page(A, 'Ritmo', 'manager'), page('b', 'Latino', 'owner')), A, { role: 'Manager', page: 'Ritmo', badge: 0 }],
  ['P5 claim pending / P12 interim seat / P14 no organiser page', home(), null, { role: null, page: null, badge: 0 }],
  ['E15 the other page has only cancelled dates: no badge', home(page(A, 'Ritmo', 'owner'), page('b', 'Latino', 'owner', [series({ upcoming: 0, cancelled: 2, format: 'recurring' })])), A, { role: 'Owner', page: 'Ritmo', badge: 0 }],
  ['E15 a cancelled event: no badge', home(page(A, 'Ritmo', 'owner'), page('b', 'Latino', 'owner', [series({ lifecycle: 'cancelled', cover: false })])), A, { role: 'Owner', page: 'Ritmo', badge: 0 }],
];

describe('strip mapping (model/strip.ts)', () => {
  it.each(cases)('%s', (_name, h, openId, want) => {
    const open = h.organisers.find((o) => o.id === openId) ?? null;
    const strip = stripOf(open);
    expect(strip?.roleWord ?? null).toBe(want.role);
    expect(strip?.page ?? null).toBe(want.page);
    expect(switchBadgeOf(h, openId)).toBe(want.badge);
  });

  it('the open page never counts toward its own badge', () => {
    const h = home(page(A, 'Ritmo', 'owner', [twoTodos()]), page('b', 'Latino', 'owner'));
    expect(todosOf(h, A)).toBe(2);
    expect(switchBadgeOf(h, A)).toBe(0);
    expect(switchBadgeOf(h, 'b')).toBe(2);
  });

  it('role word is Owner or Manager only: no contributor word', () => {
    expect(roleWordOf('owner')).toBe('Owner');
    expect(roleWordOf('manager')).toBe('Manager');
    expect(roleWordOf('contributor')).toBeNull();
    expect(stripOf(page(A, 'Ritmo', 'contributor'))).toBeNull();
  });

  it('other pages: teacher, DJ, dancer from active my_roles_v1 rows; organiser never listed here', () => {
    expect(otherPagesOf([{ role: 'dancer', active: true }, { role: 'organiser', active: true }, { role: 'dj', active: true }, { role: 'teacher', active: true }])).toEqual(['teacher', 'dj', 'dancer']);
    expect(otherPagesOf([{ role: 'teacher', active: false }])).toEqual([]);
    expect(otherPagesOf(undefined)).toEqual([]);
  });
});
