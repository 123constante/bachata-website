/**
 * Hand-typed going RPCs (admin docs/handovers/going-p1-db.md, live on prod
 * since 2026-10-23). They are not in the generated Database types yet, so they
 * go through rpcLoose; every reply is parsed here, never cast through, and
 * every failure is thrown as a GoingRpcError whose `code` is a GoingErrorCode.
 *
 *   set_my_going_v1(p_occurrence_id uuid, p_going boolean)
 *     -> {occurrence_id, going, changed, going_count}
 *   get_nights_going_v1(p_occurrence_ids uuid[], p_limit int default 8)
 *     -> [{occurrence_id, going_count, people: [Person]}]   anon OK, max 200 ids
 *   get_my_going_v1() -> {upcoming: [Night], past: [Night]}
 *   get_public_dancer_extras_v1(p_profile_id) -> {..., going_next: [...]} | null
 *
 * `starts_at_local` is a London wall clock with NO zone: render as is, never
 * `new Date()` it.
 */
import { rpcLoose } from '@/integrations/supabase/rpcLoose';
import { goingErrorCode, type GoingErrorCode } from './goingState';

export const GOING_RPC = {
  set: 'set_my_going_v1',
  nights: 'get_nights_going_v1',
  mine: 'get_my_going_v1',
  dancerExtras: 'get_public_dancer_extras_v1',
} as const;

/** The database's cap on ids per get_nights_going_v1 call. */
export const NIGHTS_GOING_MAX_IDS = 200;
/** How many people a night row carries by default (p_limit). */
export const NIGHTS_GOING_DEFAULT_LIMIT = 8;

export type GoingPerson = {
  /** null = the dancer's public page is hidden: show the name, never a link. */
  dancer_profile_id: string | null;
  first_name: string;
  /** null = no photo, or the dancer has not switched "Show my photo" on. */
  photo_url: string | null;
};

export type NightGoing = {
  occurrence_id: string;
  going_count: number;
  people: GoingPerson[];
  /**
   * true = the database returned NOTHING for this id (fetchNightsGoing's
   * stand-in). get_nights_going_v1 silently drops an id that is not a P5
   * occurrence (event_occurrence_p5.id) -- e.g. the legacy occurrence id
   * get_calendar_events_v2 still carries -- so this is "unknown", never
   * "0 going": a surface shows no count for it (nightGoingKnown).
   */
  unknown?: true;
  /**
   * CLIENT-ONLY (never from the database): the going_count `people` was read
   * with, kept while an optimistic save has moved going_count and the list has
   * not been re-read yet, so "+N more" does not count the viewer as a stranger.
   * Absent = going_count.
   */
  people_count?: number;
};

/** Did the database answer for this night? false = no count may be shown. */
export const nightGoingKnown = (night: NightGoing | null | undefined): night is NightGoing =>
  Boolean(night) && night?.unknown !== true;

export type SetMyGoingResult = { occurrence_id: string; going: boolean; changed: boolean; going_count: number };

export type MyGoingNight = {
  occurrence_id: string;
  public_event_id: string | null;
  event_title: string | null;
  occurrence_date: string | null;
  /** London wall clock, no zone. */
  starts_at_local: string | null;
  venue_id: string | null;
  venue_name: string | null;
  event_lifecycle: string | null;
  night_lifecycle: string | null;
  is_cancelled: boolean;
};

export type MyGoing = { upcoming: MyGoingNight[]; past: MyGoingNight[] };

export type GoingNextNight = {
  occurrence_id: string;
  public_event_id: string | null;
  event_title: string | null;
  occurrence_date: string | null;
  starts_at_local: string | null;
};

export class GoingRpcError extends Error {
  readonly code: GoingErrorCode;
  constructor(code: GoingErrorCode, message: string) {
    super(message);
    this.name = 'GoingRpcError';
    this.code = code;
  }
}

const call = async (fn: string, args?: Record<string, unknown>): Promise<unknown> => {
  let result: Awaited<ReturnType<typeof rpcLoose>>;
  try {
    result = await rpcLoose(fn, args);
  } catch (e) {
    throw new GoingRpcError(goingErrorCode(e) === 'unknown' ? 'network' : goingErrorCode(e), String((e as Error)?.message ?? e));
  }
  if (result.error) throw new GoingRpcError(goingErrorCode(result.error), result.error.message);
  return result.data;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter(isRecord) : []);

export const parsePerson = (v: Record<string, unknown>): GoingPerson | null => {
  const first = str(v.first_name)?.trim();
  if (!first) return null;
  return { dancer_profile_id: str(v.dancer_profile_id), first_name: first, photo_url: str(v.photo_url) };
};

export const parseNightGoing = (v: Record<string, unknown>): NightGoing | null => {
  const id = str(v.occurrence_id);
  if (!id) return null;
  const people = list(v.people).map(parsePerson).filter((p): p is GoingPerson => p !== null);
  // The count is never below the people shown (a stale count must not give "+-1 more").
  return { occurrence_id: id, going_count: Math.max(num(v.going_count), people.length), people };
};

const parseMyNight = (v: Record<string, unknown>): MyGoingNight | null => {
  const id = str(v.occurrence_id);
  if (!id) return null;
  return {
    occurrence_id: id,
    public_event_id: str(v.public_event_id),
    event_title: str(v.event_title),
    occurrence_date: str(v.occurrence_date),
    starts_at_local: str(v.starts_at_local),
    venue_id: str(v.venue_id),
    venue_name: str(v.venue_name),
    event_lifecycle: str(v.event_lifecycle),
    night_lifecycle: str(v.night_lifecycle),
    is_cancelled: v.is_cancelled === true,
  };
};

export const parseMyGoing = (v: unknown): MyGoing => {
  const r = isRecord(v) ? v : {};
  const nights = (x: unknown) => list(x).map(parseMyNight).filter((n): n is MyGoingNight => n !== null);
  return { upcoming: nights(r.upcoming), past: nights(r.past) };
};

/** going_next of get_public_dancer_extras_v1 (max 3); [] when absent or hidden. */
export const parseGoingNext = (extras: unknown): GoingNextNight[] => {
  if (!isRecord(extras)) return [];
  return list(extras.going_next)
    .map((v) => {
      const id = str(v.occurrence_id);
      if (!id) return null;
      return {
        occurrence_id: id,
        public_event_id: str(v.public_event_id),
        event_title: str(v.event_title),
        occurrence_date: str(v.occurrence_date),
        starts_at_local: str(v.starts_at_local),
      };
    })
    .filter((n): n is GoingNextNight => n !== null);
};

/** Say going / not going for ONE night. */
export const setMyGoing = async (occurrenceId: string, going: boolean): Promise<SetMyGoingResult> => {
  const data = await call(GOING_RPC.set, { p_occurrence_id: occurrenceId, p_going: going });
  const r = isRecord(data) ? data : {};
  return {
    occurrence_id: str(r.occurrence_id) ?? occurrenceId,
    going: typeof r.going === 'boolean' ? r.going : going,
    changed: r.changed === true,
    going_count: num(r.going_count),
  };
};

/**
 * Count + people for many nights, ONE request per 200 ids (the database cap),
 * in parallel. Every asked id gets an entry: a night the reply leaves out is 0
 * going with nobody AND marked `unknown` (not a P5 occurrence id): a surface
 * that may be handed legacy ids (the calendar) checks nightGoingKnown first.
 */
export const fetchNightsGoing = async (
  occurrenceIds: readonly string[],
  limit: number = NIGHTS_GOING_DEFAULT_LIMIT,
): Promise<Record<string, NightGoing>> => {
  const ids = [...new Set(occurrenceIds.filter(Boolean))];
  const out: Record<string, NightGoing> = {};
  for (const id of ids) out[id] = { occurrence_id: id, going_count: 0, people: [], unknown: true };
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += NIGHTS_GOING_MAX_IDS) chunks.push(ids.slice(i, i + NIGHTS_GOING_MAX_IDS));
  const replies = await Promise.all(chunks.map((c) => call(GOING_RPC.nights, { p_occurrence_ids: c, p_limit: limit })));
  for (const reply of replies) {
    for (const row of list(reply)) {
      const night = parseNightGoing(row);
      if (night && night.occurrence_id in out) out[night.occurrence_id] = night;
    }
  }
  return out;
};

/** The signed-in viewer's nights (upcoming + past). */
export const fetchMyGoing = async (): Promise<MyGoing> => parseMyGoing(await call(GOING_RPC.mine));
