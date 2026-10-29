import { runSeriesCommand } from '../../shared/selfServeApi';
import { envelope, type OwnerCommand } from '../../shared/seriesCommands';

/**
 * P3 W3c-1: the Repeat preview. series.set_recurrence with dry_run:true through series_command_p5:
 * the handler does the whole write, reads what it did and rolls it back; the dispatcher returns
 * before the version bump and the audit row (apply_aggregate_write_p5, read on prod 2026-10-28).
 * Resolves to the handler's answer (CommandResponse.data); a refusal throws like a save would.
 */
export async function previewRepeat(seriesId: string, version: number | null, command: OwnerCommand): Promise<unknown> {
  const res = await runSeriesCommand(envelope(seriesId, version, command));
  return res?.data ?? null;
}

export type PreviewRepeat = (command: OwnerCommand) => Promise<unknown>;
