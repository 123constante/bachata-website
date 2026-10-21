import { rpcLoose } from '@/integrations/supabase/rpcLoose';

/**
 * my_nights_lineup_people_v1() (admin PR #910): teachers and DJs on the line-ups of the nights the caller went to.
 * NO arguments. The shape is PINNED (briefs/people-arc/RPC-MY-NIGHTS-LINEUP-PEOPLE.md); anything else is a load error.
 * Cancelled nights are already left out by the RPC (D132).
 */
export const LINEUP_PEOPLE_RPC = 'my_nights_lineup_people_v1';

export type LineupRole = 'teacher' | 'dj';
export type LineupPerson = {
  profile_id: string;
  roles: LineupRole[];
  display_name: string;
  avatar_url: string | null;
  public_path: string;
  last_night: { series_id: string; event_name: string; slug: string | null; on_date: string };
};
export type LineupPeople = { total: number; people: LineupPerson[] };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

const parsePerson = (v: unknown): LineupPerson => {
  if (!isRecord(v) || !isRecord(v.last_night) || !Array.isArray(v.roles)) throw new Error('lineup person: wrong shape');
  const roles = v.roles.filter((r): r is LineupRole => r === 'teacher' || r === 'dj');
  const n = v.last_night;
  const person = {
    profile_id: text(v.profile_id),
    display_name: text(v.display_name),
    public_path: text(v.public_path),
    series_id: text(n.series_id),
    event_name: text(n.event_name),
    on_date: text(n.on_date),
  };
  if (!person.profile_id || !person.display_name || !person.public_path?.startsWith('/') || !person.series_id || !person.event_name || !person.on_date || !/^\d{4}-\d{2}-\d{2}$/.test(person.on_date) || roles.length === 0) {
    throw new Error('lineup person: missing field');
  }
  return {
    profile_id: person.profile_id,
    roles,
    display_name: person.display_name,
    avatar_url: text(v.avatar_url),
    public_path: person.public_path,
    last_night: { series_id: person.series_id, event_name: person.event_name, slug: text(n.slug), on_date: person.on_date },
  };
};

/**
 * Review N3: ONE row per profile_id (the first wins: the RPC sorts by most recent night), so the list key never
 * collides. `total` is the RPC's count before any cap; the screen says "and N more" only when it is above the rows.
 */
export const parseLineupPeople = (data: unknown): LineupPeople => {
  if (!isRecord(data) || typeof data.total !== 'number' || !Array.isArray(data.people)) throw new Error('lineup people: wrong shape');
  const seen = new Set<string>();
  const people = data.people.map(parsePerson).filter((p) => (seen.has(p.profile_id) ? false : (seen.add(p.profile_id), true)));
  // A dropped duplicate is not a person left out, so it comes off the total too.
  return { total: data.total - (data.people.length - people.length), people };
};

export const fetchLineupPeople = async (): Promise<LineupPeople> => {
  const { data, error } = await rpcLoose(LINEUP_PEOPLE_RPC);
  if (error) throw new Error(error.message);
  return parseLineupPeople(data);
};
