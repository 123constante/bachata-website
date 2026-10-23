// THE one people-badges mapping (W1 slice S0): roles, links and names for a person on
// every public surface. Data comes from get_public_people_badges_v1 (anon, max 300 ids).
// The vocabulary (Teacher / DJ / Dancer, their order) is the ONE copy in
// src/lib/searchEntities.ts; hrefs reuse hrefFor there. No second copy of either.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { hrefFor, orderedRoles, ROLE_LABEL, ROLE_ORDER, type PersonRole } from '@/lib/searchEntities';

export type PersonBadge = {
  id: string;
  roles: PersonRole[];
  djName: string | null;
  djHasUpcoming: boolean;
  nextGigDate: string | null;
};
export type RoleTag = { role: PersonRole; label: string; href: string | null };
export type BadgeOpts = { teacherPagesOpen: boolean };

const CHUNK = 300;
const MIDDOT = '\u00b7';

// The RPC answers with the public vocabulary (teacher / dj / dancer); the person_roles
// spellings are accepted too so a raw value can never be dropped by accident.
const ROLE_ALIAS: Record<string, PersonRole> = {
  teacher: 'teacher', teaching: 'teacher',
  dj: 'dj', djing: 'dj',
  dancer: 'dancer', dancing: 'dancer',
};

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

/** Tolerant of null / garbage: anything that is not an array of {id} rows yields nothing for that row. */
export function parseBadges(raw: unknown): Map<string, PersonBadge> {
  const out = new Map<string, PersonBadge>();
  if (!Array.isArray(raw)) return out;
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const id = str(r.id);
    if (!id) continue;
    const mapped = Array.isArray(r.roles)
      ? r.roles.map((x) => (typeof x === 'string' ? ROLE_ALIAS[x] : undefined)).filter((x): x is PersonRole => !!x)
      : [];
    out.set(id, {
      id,
      roles: orderedRoles(mapped),
      djName: str(r.dj_name),
      djHasUpcoming: r.dj_has_upcoming === true,
      nextGigDate: str(r.next_gig_date),
    });
  }
  return out;
}

async function fetchBadges(ids: string[]): Promise<Map<string, PersonBadge>> {
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: string, args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));
  const results = await Promise.all(
    chunks.map(async (p_ids) => {
      const { data, error } = await rpc('get_public_people_badges_v1', { p_ids });
      if (error) throw new Error(error.message);
      return parseBadges(data);
    }),
  );
  const all = new Map<string, PersonBadge>();
  for (const m of results) m.forEach((v, k) => all.set(k, v));
  return all;
}

const EMPTY: Map<string, PersonBadge> = new Map();

/** Chunks of 300; ids are de-duplicated and sorted for the cache key. Empty ids = no request. */
export function usePeopleBadges(ids: readonly string[]): { badges: Map<string, PersonBadge>; isLoading: boolean; isError: boolean } {
  const key = useMemo(() => Array.from(new Set(ids.filter(Boolean))).sort(), [ids]);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['people-badges', key],
    queryFn: () => fetchBadges(key),
    enabled: key.length > 0,
    staleTime: 5 * 60 * 1000,
  });
  return { badges: data ?? EMPTY, isLoading: key.length > 0 && isLoading, isError: key.length > 0 && isError };
}

/** /djs/:id, /dancers/:id, /teachers/:id (the last only while the teacher pages are open). */
export function hrefForRole(role: 'dj' | 'dancer', id: string, opts: BadgeOpts): string;
export function hrefForRole(role: PersonRole, id: string, opts: BadgeOpts): string | null;
export function hrefForRole(role: PersonRole, id: string, opts: BadgeOpts): string | null {
  if (role === 'teacher' && !opts.teacherPagesOpen) return null;
  return hrefFor(role, id);
}

// The DJ label never repeats the word: "DJ El Rugido" -> "DJ \u00b7 El Rugido" (review 7b).
// Label only: tile names and the DJ page keep the full stage name (nameFor).
const stageLabel = (djName: string | null): string => {
  const bare = djName?.replace(/^dj\s+/i, '').trim();
  return bare ? `${ROLE_LABEL.dj} ${MIDDOT} ${bare}` : ROLE_LABEL.dj;
};

/** One tag per role in ROLE_ORDER. The Teacher tag still shows while pages are closed, as plain text. */
export function roleTagsFor(
  badge: PersonBadge,
  opts: BadgeOpts & { withStageName?: boolean; exclude?: PersonRole },
): RoleTag[] {
  return ROLE_ORDER.filter((r) => badge.roles.includes(r) && r !== opts.exclude).map((role) => ({
    role,
    label: role === 'dj' && opts.withStageName ? stageLabel(badge.djName) : ROLE_LABEL[role],
    href: hrefForRole(role, badge.id, opts),
  }));
}

/** The stage name leads only on DJ things; the real name everywhere else. */
export function nameFor(context: 'dj' | 'other', person: { name: string; djName?: string | null }): string {
  return context === 'dj' && person.djName ? person.djName : person.name;
}

/** Never dead-ends: DJ page, else dancer page, else teacher page only if open, else no link. */
export function linkFor(badge: PersonBadge | undefined, opts: BadgeOpts): string | null {
  const role = linkRoleFor(badge, opts);
  return badge && role ? hrefForRole(role, badge.id, opts) : null;
}

/** The role whose page linkFor opens (the profile type a click on that link is), or null. */
export function linkRoleFor(badge: PersonBadge | undefined, opts: BadgeOpts): PersonRole | null {
  if (!badge) return null;
  for (const role of ['dj', 'dancer', 'teacher'] as const) {
    if (badge.roles.includes(role) && hrefForRole(role, badge.id, opts)) return role;
  }
  return null;
}

/** A DJ with an upcoming gig leads; else dancer; else DJ; else teacher. */
export function leadRole(badge: PersonBadge): PersonRole | null {
  if (badge.roles.includes('dj') && badge.djHasUpcoming) return 'dj';
  for (const r of ['dancer', 'dj', 'teacher'] as const) if (badge.roles.includes(r)) return r;
  return null;
}
