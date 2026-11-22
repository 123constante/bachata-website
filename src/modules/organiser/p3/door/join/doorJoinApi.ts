import { supabase } from '@/integrations/supabase/client';
import { parseAccept, parseMint, type AcceptAnswer, type MintAnswer } from './doorJoinModel';

/*
 * The two door-link writes. Never log the token: it is a one-time key to a door seat.
 * A thrown error means the answer is unknown (network, or an answer this site does not know).
 */
type Resp = PromiseLike<{ data: unknown; error: { message?: string } | null }>;
const db = () => supabase as unknown as { rpc(fn: string, args: Record<string, unknown>): Resp };

export async function acceptDoorSeat(token: string): Promise<AcceptAnswer> {
  const { data, error } = await db().rpc('ticket_door_seat_accept_v1', { p_token: token });
  if (error) throw new Error('door_accept_failed');
  const a = parseAccept(data);
  if (!a) throw new Error('door_accept_unknown');
  return a;
}

export async function mintDoorInvite(seriesId: string, occurrenceId: string): Promise<MintAnswer> {
  const { data, error } = await db().rpc('ticket_door_seat_invite_v1', { p_event_series_id: seriesId, p_occurrence_id: occurrenceId });
  if (error) throw new Error('door_invite_failed');
  const m = parseMint(data);
  if (!m) throw new Error('door_invite_unknown');
  return m;
}

/** The signed-in person's live door seats (my_door_seats_v1): only the night's name is used, for the header. */
export async function fetchMySeatName(seriesId: string): Promise<string | null> {
  const { data, error } = await db().rpc('my_door_seats_v1', {});
  if (error) throw new Error('door_seats_failed');
  const rows = (data as { rows?: unknown } | null)?.rows;
  if (!Array.isArray(rows)) return null;
  const hit = rows.find((r) => r && typeof r === 'object' && (r as Record<string, unknown>).event_series_id === seriesId) as Record<string, unknown> | undefined;
  return typeof hit?.series_name === 'string' ? hit.series_name : null;
}
