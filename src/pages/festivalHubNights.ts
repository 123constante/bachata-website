import { supabase } from '@/integrations/supabase/client';

/**
 * The ONE night of each festival card on the hub (Going P2), so the card can
 * say who is going. A festival series holds exactly one date (admin trigger
 * _assert_festival_holds_one_date_v1), so going = that occurrence.
 *
 * Why event_view_p5 and not the festivals list or get_calendar_events_v2: going
 * is keyed by the P5 occurrence id (event_occurrence_p5.id) and
 * get_nights_going_v1 silently DROPS any other id. The list RPC carries no
 * occurrence id; the calendar RPCs carry COALESCE(legacy_occurrence_id, p5 id),
 * a legacy id for 7 of 7 festivals on prod (2026-10-23). event_view_p5
 * snapshot_compat (anon, the event page's own read) returns the P5 id for all 5
 * upcoming festivals. event_occurrence_p5 itself is admin-only under RLS.
 */
export type FestivalNight = {
  festivalId: string;
  /** P5 occurrence id. */
  occurrenceId: string;
  /** Read as stored, as the event page does (never `new Date()` for the night rule). */
  startsAtLocal: string | null;
  endsAtLocal: string | null;
  isCancelled: boolean;
  /** The series is live (paused / ended take no names). */
  eventLive: boolean;
};

export const festivalNightQueryKey = (festivalId: string) => ['festival-hub-night', festivalId] as const;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

/** snapshot_compat payload -> the night, or null (not visible / no date). */
export const parseFestivalNight = (festivalId: string, snap: unknown): FestivalNight | null => {
  if (!isRecord(snap)) return null;
  const id = str(snap.occurrence_id);
  if (!id) return null;
  const eff = isRecord(snap.occurrence_effective) && str(snap.occurrence_effective.occurrence_id) === id
    ? snap.occurrence_effective
    : (Array.isArray(snap.occurrences) ? snap.occurrences : []).find(
      (o): o is Record<string, unknown> => isRecord(o) && str(o.occurrence_id) === id,
    ) ?? null;
  const event = isRecord(snap.event) ? snap.event : {};
  return {
    festivalId,
    occurrenceId: id,
    startsAtLocal: eff ? str(eff.starts_at) : null,
    endsAtLocal: eff ? str(eff.ends_at) : null,
    isCancelled: eff?.is_cancelled === true,
    eventLive: str(event.lifecycle_status) === 'live',
  };
};

export const fetchFestivalNight = async (festivalId: string): Promise<FestivalNight | null> => {
  // Typed call (check:rpc-typing): Args are Json, and the Json result is parsed
  // by parseFestivalNight, which accepts unknown.
  const { data, error } = await supabase.rpc('event_view_p5', {
    p_target: { series_id: festivalId },
    p_viewer: { role: 'anon', shape: 'snapshot_compat' },
  });
  if (error) throw error;
  return parseFestivalNight(festivalId, data);
};
