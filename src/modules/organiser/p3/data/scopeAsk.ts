import { supabase } from '@/integrations/supabase/client';
import { newIdempotencyKey } from '../../shared/seriesCommands';
import { previewKeysOf, type PreviewDate, type PreviewTotals, type ScopeField } from '../model/scopeAsk';

/**
 * The two scope-ask RPCs (admin 20270310070000_p3_scope_ask_v1, applied on prod):
 * series_scope_change_preview_v1 (read-only counts) and series_scoped_change_p5 (the command).
 * Neither is in the generated Database types yet, so they go through one narrow caller, like the
 * programme RPCs in shared/selfServeApi. Replies carry counts and dates only; nothing here logs
 * a reply or any URL the person typed.
 */
type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
const call: Rpc = (fn, args) => (supabase.rpc as unknown as Rpc)(fn, args);

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const strs = (v: unknown): string[] | null => (Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null);
const bad = (what: string) => new Error(`scope_ask_malformed_reply: ${what}`);

export interface ScopePreview { totals: PreviewTotals; dates: PreviewDate[] }

export async function previewScope(seriesId: string, fields: readonly ScopeField[]): Promise<ScopePreview> {
  const { data, error } = await call('series_scope_change_preview_v1', { p_series_id: seriesId, p_fields: previewKeysOf(fields) });
  if (error) throw error;
  if (!isObj(data) || !isObj(data.totals) || !Array.isArray(data.dates)) throw bad('preview');
  const t = data.totals;
  const [dates, applied, kept, inherits] = [num(t.dates), num(t.applied), num(t.kept), num(t.curated_but_inherits)];
  if (dates === null || applied === null || kept === null || inherits === null) throw bad('totals');
  const list = data.dates.map((x): PreviewDate => {
    if (!isObj(x) || typeof x.occurrence_id !== 'string' || typeof x.occurrence_date !== 'string') throw bad('date');
    return { occurrence_id: x.occurrence_id, occurrence_date: x.occurrence_date, kept_fields: strs(x.kept_fields) ?? [], applied_fields: strs(x.applied_fields) ?? [] };
  });
  return { totals: { dates, applied, kept, curated_but_inherits: inherits }, dates: list };
}

export interface ScopedRequest {
  scope: 'all_dates' | 'this_date';
  seriesId: string;
  occurrenceId?: string;
  changes: Record<string, unknown>;
  /** The series version for all dates, the date's version for one date; null leaves it out. */
  expectedVersion: number | null;
}

/** The envelope exactly as docs/design/scope-ask-api.md (admin) documents it. */
export function buildScopedEnvelope(r: ScopedRequest, key: string): Record<string, unknown> {
  const keys = Object.keys(r.changes);
  if (!keys.length) throw new Error('scoped change needs a change');
  if (keys.includes('venue_id') !== keys.includes('city_id')) throw new Error('venue_id and city_id travel together');
  if (r.scope === 'this_date' && !r.occurrenceId) throw new Error('this_date needs occurrence_id');
  return {
    series_id: r.seriesId,
    scope: r.scope,
    ...(r.scope === 'this_date' ? { occurrence_id: r.occurrenceId } : {}),
    changes: r.changes,
    idempotency_key: key,
    ...(typeof r.expectedVersion === 'number' && r.expectedVersion > 0 ? { expected_version: r.expectedVersion } : {}),
  };
}

export interface KeptDate { occurrence_id: string; occurrence_date: string; fields: string[] }
export interface ScopedReply { appliedDates: string[]; keptDates: KeptDate[]; newVersion: number | null }

export async function sendScoped(r: ScopedRequest, key: string): Promise<ScopedReply> {
  const { data, error } = await call('series_scoped_change_p5', { p_envelope: buildScopedEnvelope(r, key) });
  if (error) throw error;
  if (!isObj(data)) throw bad('reply');
  const applied = strs(data.applied_dates);
  if (!applied || !Array.isArray(data.kept_dates)) throw bad('lists');
  const kept = data.kept_dates.map((x): KeptDate => {
    if (!isObj(x) || typeof x.occurrence_id !== 'string') throw bad('kept');
    return { occurrence_id: x.occurrence_id, occurrence_date: typeof x.occurrence_date === 'string' ? x.occurrence_date : '', fields: strs(x.fields) ?? [] };
  });
  return { appliedDates: applied, keptDates: kept, newVersion: isObj(data.result) ? num(data.result.new_version) : null };
}

/**
 * The idempotency key of a scoped write, held until the write lands or the person taps "Start
 * again": the same request (`sig`) gets the same key, so a retry after a dropped connection is
 * the same write; a different request, or none held, gets a new one.
 */
export interface HeldKey { sig: string; key: string }
export function heldKey(held: HeldKey | null, sig: string): HeldKey {
  return held && held.sig === sig ? held : { sig, key: newIdempotencyKey() };
}
