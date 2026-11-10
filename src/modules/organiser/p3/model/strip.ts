/**
 * Slice 1a (organiser area v2): the ONE mapping for who-can-do-what on the
 * role strip and the Switch page list. The strip, the switcher and their tests
 * all read from here; nothing else decides a role word or a badge count.
 */
import type { HomeOrganiser, OrganiserHome } from '../../shared/selfServeApi';
import { needsOf, rowsOf } from '../data/home';
import { L } from './labels';

export type SeatRole = HomeOrganiser['role'];
/** Pages a person can hold that are not organiser pages: listed in Switch, never badged. */
export type OtherPageRole = 'teacher' | 'dj' | 'dancer';
export const OTHER_PAGE_ROLES: readonly OtherPageRole[] = ['teacher', 'dj', 'dancer'];

/** Owner or Manager; any other seat word the server sends is not shown (no contributor word). */
export function roleWordOf(role: string | null | undefined): string | null {
  return role === 'owner' || role === 'manager' ? L.strip.role[role] : null;
}

/** What the strip shows for the page open now; null = no strip (no organiser page, or a seat we do not name). */
export function stripOf(selected: Pick<HomeOrganiser, 'name' | 'role'> | null | undefined): { role: SeatRole; roleWord: string; page: string } | null {
  if (!selected) return null;
  const roleWord = roleWordOf(selected.role);
  if (!roleWord) return null;
  return { role: selected.role, roleWord, page: selected.name?.trim() || L.noName };
}

/** A series whose upcoming dates are all cancelled is not a "no dates" to-do: a cancelled event never drives a badge (defect 4). */
function countsForTodos(s: { lifecycle_status: string; upcoming_count?: number; cancelled_upcoming_count?: number }): boolean {
  if (s.lifecycle_status === 'cancelled') return false;
  const cancelledOnly = (Number(s.cancelled_upcoming_count) || 0) > 0 && (Number(s.upcoming_count) || 0) === 0;
  return !cancelledOnly;
}

/** Open to-dos on ONE organiser page: Home's Needs you items, cancelled events left out. */
export function todosOf(home: OrganiserHome, organiserId: string): number {
  const page = home.organisers.find((o) => o.id === organiserId);
  if (!page) return 0;
  const scoped: OrganiserHome = { ...home, organisers: [{ ...page, series: page.series.filter(countsForTodos) }] };
  return needsOf(rowsOf(scoped, organiserId)).length;
}

/** The Switch badge: to-dos on organiser pages OTHER than the one open. 0 = no badge. */
export function switchBadgeOf(home: OrganiserHome | undefined, openId: string | null | undefined): number {
  if (!home || !openId) return 0;
  return home.organisers.filter((o) => o.id !== openId).reduce((n, o) => n + todosOf(home, o.id), 0);
}

/** The non-organiser pages the person holds, from my_roles_v1 (active rows only), in a fixed order. */
export function otherPagesOf(rows: ReadonlyArray<{ role: string; active: boolean }> | undefined): OtherPageRole[] {
  const held = new Set((rows ?? []).filter((r) => r.active).map((r) => r.role));
  return OTHER_PAGE_ROLES.filter((r) => held.has(r));
}
