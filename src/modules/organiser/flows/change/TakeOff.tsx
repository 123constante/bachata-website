import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { skipDateCommand } from '@/modules/organiser/shared/seriesCommands';
import { isRuleDate } from '@/modules/organiser/shared/seriesModel';
import { dayLabel } from '@/modules/organiser/shared/dateList';
import { PrimaryButton } from '@/modules/organiser/ui';
import { DateStep, type DateStepReady } from './DateStep';
import { useChangeSend } from './useChange';
import { Refusal } from './parts';
import { TAKE_OFF } from '@/modules/organiser/shared/copy';
import { OFF_ONLY_RULE } from './WhatChanges';
import { EventConflict } from '../event/parts';

export const offDoneMessage = (date: string) => TAKE_OFF.done(dayLabel(date));

/**
 * C24: take this rule date off (series.skip_date, to the EVENT at its
 * version). Dancers see no cancellation; the date comes back from "Dates
 * taken off". Only a date of a weekly repeat can be skipped.
 */
export default function TakeOff() {
  return (
    <DateStep back={ORG_PATHS.changeDate} title={() => TAKE_OFF.label}>
      {(ready) => <Confirm key={ready.occurrenceId} {...ready} />}
    </DateStep>
  );
}

function Confirm({ seriesId, occurrenceId, date, ws }: DateStepReady) {
  const { sendAll, busy, conflict, error } = useChangeSend(seriesId, occurrenceId);
  if (conflict) return <EventConflict seriesId={seriesId} testId="change-conflict" />;
  if (!isRuleDate(date.occurrence_date, ws.series)) return <Refusal text={OFF_ONLY_RULE} seriesId={seriesId} />;
  return (
    <div className="flex flex-col gap-3" data-testid="change-off-screen">
      <p className="text-[16px] font-bold text-[var(--fg)]">{dayLabel(date.occurrence_date)}</p>
      <p className="text-[14px] text-[var(--mut)]">It disappears from the calendar. Dancers see no cancellation.</p>
      {error && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="change-error-message">{error}</p>}
      <PrimaryButton testId="change-off-confirm" loading={busy}
        onClick={() => void sendAll([skipDateCommand(occurrenceId)], ws.series.version, offDoneMessage(date.occurrence_date), 'series')}>
        {TAKE_OFF.confirm}
      </PrimaryButton>
    </div>
  );
}
