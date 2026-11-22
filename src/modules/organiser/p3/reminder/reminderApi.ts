import { supabase } from '@/integrations/supabase/client';
import { parseReminder, type ReminderParse } from './reminderModel';

/* The generated types do not carry these RPCs yet, so the client is cast locally (never hand-edit types.ts). */
type Resp = PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc = (fn: string, args: Record<string, unknown>): Resp => (supabase as unknown as { rpc(f: string, a: Record<string, unknown>): Resp }).rpc(fn, args);

async function call(fn: string, args: Record<string, unknown>): Promise<ReminderParse> {
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error(error.message);
  return parseReminder(data);
}

export const readReminder = (occurrenceId: string) => call('organiser_night_reminder_get_v1', { p_occurrence_id: occurrenceId });
export const setReminder = (occurrenceId: string, enabled: boolean) => call('organiser_night_reminder_set_v1', { p_occurrence_id: occurrenceId, p_enabled: enabled });
