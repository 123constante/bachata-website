import { supabase } from '@/integrations/supabase/client';
import { MALFORMED, setMyRoleDeclined } from '../shared/areaApi';

// my_roles_v1, my_role_intent_v1 and set_my_role_intent_v1 are not in the
// generated Database type yet (Release B admin PR, not applied), so they go
// through ONE string-named boundary, the same as ../shared/areaApi. Every
// answer is parsed; an unexpected shape throws and the screen shows its error.
type UntypedRpc = {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase as unknown as UntypedRpc).rpc(fn, args);

export type AreaRole = 'dancer' | 'organiser' | 'teacher' | 'dj';
export const AREA_ROLES: readonly AreaRole[] = ['dancer', 'organiser', 'teacher', 'dj'];
const IS_ROLE: ReadonlySet<string> = new Set(AREA_ROLES);

/** One my_roles_v1 row. Organiser `active` is the server's seat rule (C12): never person_roles.organising. */
export interface RoleRow { role: AreaRole; active: boolean; complete: boolean }

export const myRolesQueryKey = ['my-roles'] as const;
export const myRoleIntentQueryKey = ['my-role-intent'] as const;

/** `returns table(role, active, complete)`: an array. A role the server does not know is left out, never shown as a code. */
export function parseMyRoles(data: unknown): RoleRow[] {
  if (data === null) return [];
  if (!Array.isArray(data)) throw new Error(MALFORMED);
  const rows: RoleRow[] = [];
  for (const r of data) {
    const o = r as Record<string, unknown> | null;
    if (!o || typeof o !== 'object' || typeof o.role !== 'string' || typeof o.active !== 'boolean' || typeof o.complete !== 'boolean') {
      throw new Error(MALFORMED);
    }
    if (IS_ROLE.has(o.role)) rows.push({ role: o.role as AreaRole, active: o.active, complete: o.complete });
  }
  return rows;
}

export async function fetchMyRoles(): Promise<RoleRow[]> {
  const { data, error } = await rpc('my_roles_v1');
  if (error) throw new Error(error.message);
  return parseMyRoles(data);
}

export interface RoleIntent { roles: string[]; declined: string[] }

export function parseRoleIntent(data: unknown): RoleIntent {
  const o = data as Record<string, unknown> | null;
  const strings = (v: unknown) => (Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null);
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error(MALFORMED);
  // No row yet: the server may send nulls; both read as empty.
  const roles = o.roles === null || o.roles === undefined ? [] : strings(o.roles);
  const declined = o.declined === null || o.declined === undefined ? [] : strings(o.declined);
  if (!roles || !declined) throw new Error(MALFORMED);
  return { roles, declined };
}

export async function fetchMyRoleIntent(): Promise<RoleIntent> {
  const { data, error } = await rpc('my_role_intent_v1');
  if (error) throw new Error(error.message);
  return parseRoleIntent(data);
}

export async function setMyRoleIntent(roles: string[]): Promise<void> {
  const { error } = await rpc('set_my_role_intent_v1', { p_roles: roles });
  if (error) throw new Error(error.message);
}

export interface RoleWriters {
  fetchIntent: typeof fetchMyRoleIntent;
  setIntent: typeof setMyRoleIntent;
  setDeclined: (role: 'teacher' | 'dj', declined: boolean) => Promise<unknown>;
}

export const REAL_ROLE_WRITERS: RoleWriters = { fetchIntent: fetchMyRoleIntent, setIntent: setMyRoleIntent, setDeclined: setMyRoleDeclined };

/**
 * The "Do you teach? / Do you DJ?" answer from Your areas, through the B-DB1
 * writers. Diff-first: Yes adds the role to the intent and lifts a No; No
 * records the No. What the server already holds is not sent again.
 * Returns how many writes went out (0 for an answer that changes nothing).
 */
export async function answerDoYou(role: 'teacher' | 'dj', yes: boolean, w: RoleWriters = REAL_ROLE_WRITERS): Promise<number> {
  const intent = await w.fetchIntent();
  const isDeclined = intent.declined.includes(role);
  let writes = 0;
  if (yes) {
    if (!intent.roles.includes(role)) {
      await w.setIntent([...intent.roles, role]);
      writes += 1;
    }
    if (isDeclined) {
      await w.setDeclined(role, false);
      writes += 1;
    }
  } else if (!isDeclined) {
    await w.setDeclined(role, true);
    writes += 1;
  }
  return writes;
}
