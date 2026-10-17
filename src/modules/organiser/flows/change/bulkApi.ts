import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { newIdempotencyKey, type BulkCommand } from '@/modules/organiser/shared/seriesCommands';
import type { CommandResponse } from '@/modules/organiser/shared/selfServeApi';

/**
 * C58: several dates of ONE series in one call. The server takes the series
 * as the target (checked against its version), changes only the scheduled,
 * coming dates among the ids and returns them as data.affected_ids.
 */
export async function runBulkCommand(seriesId: string, version: number, command: BulkCommand, key = newIdempotencyKey()) {
  const env = { target_id: seriesId, expected_version: version, idempotency_key: key, command };
  const { data, error } = await supabase.rpc('admin_bulk_occurrence_command_p5', { p_envelope: env as unknown as Json });
  if (error) throw error;
  const res = (data ?? { ok: true }) as unknown as CommandResponse;
  const ids = res.data?.affected_ids;
  return { ...res, affectedIds: Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [] };
}
