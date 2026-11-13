import { supabase } from '@/integrations/supabase/client';
import { parseRead, type GuestCounts, type GuestRead, type GuestTab } from './guestListModel';

/*
 * The organiser guest-list RPCs of admin #1577 (NOT applied to prod until the owner says so). The generated types do not
 * have them yet, so the client is cast locally (do not hand-edit src/integrations/supabase/types.ts). Every call is
 * behind flags.organiserGuestListLive: nothing here runs while it is off.
 */
type Resp = PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc = (fn: string, args: Record<string, unknown>): Resp => (supabase as unknown as { rpc(f: string, a: Record<string, unknown>): Resp }).rpc(fn, args);

export type Outcome = { ok: true; changed?: boolean; counts?: GuestCounts } | { ok: false; reason: string };

const asOutcome = (raw: unknown): Outcome => {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (r.ok !== true) return { ok: false, reason: typeof r.reason === 'string' ? r.reason : 'unknown' };
  const c = r.counts && typeof r.counts === 'object' ? (r.counts as Record<string, unknown>) : null;
  return { ok: true, changed: typeof r.changed === 'boolean' ? r.changed : undefined, counts: c ? { names: Number(c.names) || 0, inCount: Number(c.in) || 0, placesLeft: null } : undefined };
};

async function call(fn: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

export async function readNight(occurrenceId: string, tab: GuestTab, query: string, limit: number): Promise<GuestRead> {
  return parseRead(await call('organiser_guest_list_night_v1', { p_occurrence_id: occurrenceId, p_view: tab === 'door' ? 'door' : 'names', p_query: query.trim() || null, p_limit: limit, p_offset: 0 }));
}
export const setNight = async (occurrenceId: string, enabled: boolean, capacity: number | null, cutoff: string | null): Promise<Outcome> =>
  asOutcome(await call('organiser_guest_list_set_night_v1', { p_occurrence_id: occurrenceId, p_enabled: enabled, p_capacity_max: capacity, p_cutoff_time: cutoff }));
export const addName = async (occurrenceId: string, name: string, everyWeek: boolean): Promise<Outcome> =>
  asOutcome(await call('organiser_guest_list_add_v1', { p_occurrence_id: occurrenceId, p_first_name: name, p_every_week: everyWeek }));
export const removeName = async (entryId: string, occurrenceId: string): Promise<Outcome> =>
  asOutcome(await call('organiser_guest_list_remove_v1', { p_entry_id: entryId, p_occurrence_id: occurrenceId }));
export const restoreName = async (entryId: string, occurrenceId: string): Promise<Outcome> =>
  asOutcome(await call('organiser_guest_list_restore_v1', { p_entry_id: entryId, p_occurrence_id: occurrenceId }));
export const checkIn = async (entryId: string, occurrenceId: string): Promise<Outcome> =>
  asOutcome(await call('organiser_check_in_guest_v1', { p_entry_id: entryId, p_occurrence_id: occurrenceId }));
export const undoCheckIn = async (entryId: string, occurrenceId: string): Promise<Outcome> =>
  asOutcome(await call('organiser_undo_check_in_guest_v1', { p_entry_id: entryId, p_occurrence_id: occurrenceId }));

export type ScanOutcome = { ok: true; firstName: string; alreadyIn: boolean; counts?: GuestCounts } | { ok: false; reason: string; firstName?: string };
export async function scan(occurrenceId: string, token: string): Promise<ScanOutcome> {
  const r = (await call('organiser_guest_list_scan_v1', { p_occurrence_id: occurrenceId, p_qr_token: token })) as Record<string, unknown> | null;
  if (!r || r.ok !== true) return { ok: false, reason: typeof r?.reason === 'string' ? r.reason : 'unknown', firstName: typeof r?.first_name === 'string' ? r.first_name : undefined };
  return { ok: true, firstName: String(r.first_name ?? ''), alreadyIn: r.already_in === true, counts: asOutcome(r).ok ? (asOutcome(r) as { counts?: GuestCounts }).counts : undefined };
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
/** A QR may hold the bare token or a link that ends in it. */
export const tokenOf = (raw: string): string | null => UUID.exec(raw)?.[0].toLowerCase() ?? null;
