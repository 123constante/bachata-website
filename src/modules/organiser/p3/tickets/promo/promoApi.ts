import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CreateArgs, PromoCode, PromoKind, PromoPatch } from './promoModel';

/**
 * The promo-code wire (admin PR #1125). Reads: ticket_promo_list_v1. Writes:
 * ticket_promo_create_v1, ticket_promo_update_v1 (both open with the onboarding S8 gate,
 * except an update that only turns a code off). Not in the generated types.ts yet, so
 * through the same untyped rpc boundary as ticketsApi.ts. Everything past this file is camelCase.
 */
type Resp = PromiseLike<{ data: unknown; error: { message: string } | null }>;
const db = () => supabase as unknown as { rpc(fn: string, args?: Record<string, unknown>): Resp };

export const promoKeys = {
  list: (seriesId: string) => ['org-tickets', 'promo', seriesId] as const,
};

/** reason is null when ok; rows is [] when refused. */
export type ListResult = { ok: boolean; reason: string | null; rows: PromoCode[] };
export type WriteResult = { ok: boolean; reason: string | null };

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : num(v));
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

export const parsePromoRow = (r: Record<string, unknown>): PromoCode => ({
  id: String(r.id),
  code: String(r.code ?? ''),
  kind: (r.kind === 'fixed' ? 'fixed' : 'percent') as PromoKind,
  value: num(r.value),
  maxUses: numOrNull(r.max_uses),
  usedCount: num(r.used_count),
  expiresAt: strOrNull(r.expires_at),
  active: r.active === true,
  createdAt: strOrNull(r.created_at),
  paidOrders: num(r.paid_orders),
});

const obj = (d: unknown): Record<string, unknown> => (d && typeof d === 'object' ? (d as Record<string, unknown>) : {});

export const parseList = (data: unknown): ListResult => {
  const d = obj(data);
  if (d.ok !== true) return { ok: false, reason: strOrNull(d.reason), rows: [] };
  const rows = Array.isArray(d.rows) ? d.rows : [];
  return { ok: true, reason: null, rows: rows.map((r) => parsePromoRow(obj(r))) };
};

export const parseWrite = (data: unknown): WriteResult => {
  const d = obj(data);
  return d.ok === true ? { ok: true, reason: null } : { ok: false, reason: strOrNull(d.reason) };
};

export async function fetchPromoCodes(seriesId: string): Promise<ListResult> {
  const { data, error } = await db().rpc('ticket_promo_list_v1', { p_event_series_id: seriesId });
  if (error) throw error;
  return parseList(data);
}

export async function createPromo(organiserId: string, seriesId: string, a: CreateArgs): Promise<WriteResult> {
  const { data, error } = await db().rpc('ticket_promo_create_v1', {
    p_event_series_id: seriesId,
    p_organiser_id: organiserId,
    p_code: a.code,
    p_kind: a.kind,
    p_value: a.value,
    p_max_uses: a.maxUses,
    p_expires_at: a.expiresAt,
  });
  if (error) throw error;
  return parseWrite(data);
}

export async function updatePromo(id: string, patch: PromoPatch): Promise<WriteResult> {
  const { data, error } = await db().rpc('ticket_promo_update_v1', { p_id: id, p_patch: patch });
  if (error) throw error;
  return parseWrite(data);
}

/** The event's codes. Lives here, not in ../data.ts, so the code rides only in the lazy promo chunk. */
export function usePromoCodes(seriesId: string) {
  return useQuery({ queryKey: promoKeys.list(seriesId), queryFn: () => fetchPromoCodes(seriesId), staleTime: 30_000 });
}
