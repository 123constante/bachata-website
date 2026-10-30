import { supabase } from '@/integrations/supabase/client';
import type { CheckIn } from './model';

/*
 * The two door reads (admin migration 20270308040000_ticket_check_in_v1, live on prod). Both
 * answer ONE jsonb value, so PostgREST's 100-row cap does not apply; the list stops at 500
 * rows itself and says so in `truncated`. Who may scan is the database's call: anyone on the
 * event's organiser team. This file never checks a role.
 */

type Resp = PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>;
const db = () => supabase as unknown as { rpc(fn: string, args: Record<string, unknown>): Resp };

/** The RPC refused because nobody is signed in (42501), as opposed to "no signal". */
export class SignedOutError extends Error {
  constructor() { super('signed_out'); this.name = 'SignedOutError'; }
}
export const isSignedOut = (e: unknown) => e instanceof SignedOutError;

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const RESULTS = new Set(['ok', 'already_in', 'wrong_event', 'not_valid', 'unknown_code', 'not_allowed']);

export function parseCheckIn(d: unknown): CheckIn {
  const r = (d ?? {}) as Record<string, unknown>;
  // an answer this screen does not know is not a "let in": show it as an unrecognised code
  const result = RESULTS.has(String(r.result)) ? (r.result as CheckIn['result']) : 'unknown_code';
  return {
    result,
    ticket_type_name: str(r.ticket_type_name),
    first_name: str(r.first_name),
    quantity: num(r.quantity),
    checked_in_at: str(r.checked_in_at),
    checked_in_by_first_name: str(r.checked_in_by_first_name),
    in_count: num(r.in_count),
    total_count: num(r.total_count),
  };
}

export async function checkInTicket(code: string, seriesId: string): Promise<CheckIn> {
  const { data, error } = await db().rpc('ticket_check_in_v1', { p_qr_token: code, p_event_series_id: seriesId });
  if (error) throw error.code === '42501' ? new SignedOutError() : error;
  return parseCheckIn(data);
}

export interface DoorRow { ticketId: string; firstName: string | null; quantity: number | null; typeName: string | null; checkedInAt: string | null }
export interface DoorList { result: 'ok' | 'not_allowed'; rows: DoorRow[]; truncated: boolean; inCount: number | null; totalCount: number | null; loadedAt: number }

/** The list answer was not one this screen knows (null, a new shape, a partial answer). */
export class DoorListShapeError extends Error {
  constructor() { super('door_list_shape'); this.name = 'DoorListShapeError'; }
}

/*
 * Only an explicit `not_allowed` is a permissions answer. Anything else that is not a whole `ok`
 * (rows a list) is a LOAD problem and throws, so the screen says Could not load and Try again,
 * never "ask the event's organiser to add you" (p3-prefix-d D1).
 */
export function parseDoorList(d: unknown, loadedAt = Date.now()): DoorList {
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw new DoorListShapeError();
  const r = d as Record<string, unknown>;
  if (r.result !== 'ok' && r.result !== 'not_allowed') throw new DoorListShapeError();
  if (r.result === 'ok' && !Array.isArray(r.rows)) throw new DoorListShapeError();
  const rows = Array.isArray(r.rows) ? (r.rows as Record<string, unknown>[]) : [];
  return {
    result: r.result,
    rows: rows.map((x) => ({
      ticketId: String(x.ticket_id),
      firstName: str(x.first_name),
      quantity: num(x.quantity_in_order),
      typeName: str(x.ticket_type_name),
      checkedInAt: str(x.checked_in_at),
    })),
    truncated: r.truncated === true,
    inCount: num(r.in_count),
    totalCount: num(r.total_count),
    loadedAt,
  };
}

export async function fetchDoorList(seriesId: string): Promise<DoorList> {
  const { data, error } = await db().rpc('ticket_door_list_v1', { p_event_series_id: seriesId });
  if (error) throw error.code === '42501' ? new SignedOutError() : error;
  return parseDoorList(data);
}

export const doorKeys = { list: (uid: string | undefined, seriesId: string) => ['p3-door-list', uid ?? null, seriesId] as const };
