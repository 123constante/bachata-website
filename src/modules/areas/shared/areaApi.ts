import { supabase } from '@/integrations/supabase/client';
import type { Role } from './fieldRegistry';
import type { Details } from './roleModel';

// None of the role RPCs are in the generated Database type yet (admin slice
// B-DB1 is building them; a bot regenerates the type, never hand-edited), so
// they go through ONE string-named boundary rather than an `as never` on the
// name, which check:rpc-typing forbids. Every answer is parsed; an unexpected
// shape throws, and the screen shows its normal error state.
type UntypedRpc = {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase as unknown as UntypedRpc).rpc(fn, args);

export const MALFORMED = 'malformed_answer';

export const roleDetailsQueryKey = (role: Role) => ['my-role-details', role] as const;
export const lineupQueryKey = (role: Role) => ['my-lineup-appearances', role] as const;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export interface RoleDetails { role: Role; personId: string; details: Details }

export function parseRoleDetails(role: Role, data: unknown): RoleDetails {
  if (!isObject(data) || data.role !== role || typeof data.person_id !== 'string' || !isObject(data.details)) {
    throw new Error(MALFORMED);
  }
  return { role, personId: data.person_id, details: data.details };
}

export interface SaveResult extends RoleDetails { changed: boolean; changedKeys: string[] }

export function parseSaveResult(role: Role, data: unknown): SaveResult {
  const base = parseRoleDetails(role, data);
  const row = data as Record<string, unknown>;
  if (typeof row.changed !== 'boolean' || !Array.isArray(row.changed_keys) || !row.changed_keys.every((k) => typeof k === 'string')) {
    throw new Error(MALFORMED);
  }
  return { ...base, changed: row.changed, changedKeys: row.changed_keys as string[] };
}

export interface DeclinedResult { roles: string[]; declined: string[]; changed: boolean }

export function parseDeclinedResult(data: unknown): DeclinedResult {
  if (!isObject(data) || typeof data.changed !== 'boolean') throw new Error(MALFORMED);
  const strings = (v: unknown) => (Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null);
  const roles = strings(data.roles);
  const declined = strings(data.declined);
  if (!roles || !declined) throw new Error(MALFORMED);
  return { roles, declined, changed: data.changed };
}

export interface LineupAppearance { seriesId: string; eventName: string; slug: string | null; date: string; sessionTitle: string | null }

/** Server order is kept as is (soonest first): never re-sorted here. */
export function parseLineup(data: unknown): LineupAppearance[] {
  if (data === null) return [];
  if (!Array.isArray(data)) throw new Error(MALFORMED);
  return data.map((r) => {
    if (!isObject(r) || typeof r.series_id !== 'string' || typeof r.event_name !== 'string' || typeof r.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) {
      throw new Error(MALFORMED);
    }
    return {
      seriesId: r.series_id,
      eventName: r.event_name,
      slug: typeof r.slug === 'string' && r.slug !== '' ? r.slug : null,
      date: r.date,
      sessionTitle: typeof r.session_title === 'string' && r.session_title.trim() !== '' ? r.session_title : null,
    };
  });
}

export async function fetchMyRoleDetails(role: Role): Promise<RoleDetails> {
  const { data, error } = await rpc('my_role_details_v1', { p_role: role });
  if (error) throw new Error(error.message);
  return parseRoleDetails(role, data);
}

/** Callers send ONLY changed keys (diffPatch); an empty patch never reaches here. */
export async function saveMyRole(role: Role, patch: Record<string, unknown>): Promise<SaveResult> {
  if (Object.keys(patch).length === 0) throw new Error('empty_patch');
  const { data, error } = await rpc('save_my_role_v1', { p_role: role, p_patch: patch });
  if (error) throw new Error(error.message);
  return parseSaveResult(role, data);
}

export async function setMyRoleDeclined(role: Role, declined: boolean): Promise<DeclinedResult> {
  const { data, error } = await rpc('set_my_role_declined_v1', { p_role: role, p_declined: declined });
  if (error) throw new Error(error.message);
  return parseDeclinedResult(data);
}

export async function fetchMyLineup(role: Role): Promise<LineupAppearance[]> {
  const { data, error } = await rpc('my_lineup_appearances_v1', { p_role: role });
  if (error) throw new Error(error.message);
  return parseLineup(data);
}
