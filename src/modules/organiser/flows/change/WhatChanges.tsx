import { useNavigate } from 'react-router-dom';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { isRuleDate } from '@/modules/organiser/shared/seriesModel';
import { notEditableCopy } from '@/modules/organiser/shared/programmeModel';
import { A1_APPLIED } from '@/modules/organiser/shared/a1Gate';
import { useNextDateProgramme } from '@/modules/organiser/events/eventsApi';
import { DateStep } from './DateStep';
import { DETAIL_LABEL, type DetailField } from './changeModel';
import { StepList, StepRow } from './parts';

const DETAILS: DetailField[] = ['note', 'ticket', 'picture'];
export const OFF_ONLY_RULE = 'Only a date of the weekly repeat can be taken off. Cancel it instead.';

/**
 * C4: what changes on this one date. A tap advances (D35). Everything an
 * owner/manager may do to a date on prod (PARITY-GAP C13 C19 C21-C26 C59
 * C60); Move waits on admin A1 (C20), so its row is hidden until then.
 */
export default function WhatChanges() {
  const navigate = useNavigate();
  return (
    <DateStep back={(s) => ORG_PATHS.changeEvent(s)}>
      {({ seriesId, occurrenceId, ws, date }) => {
        // The same fact the date page reads for "Break this week" (dates/index.tsx).
        const ruleDate = isRuleDate(date.occurrence_date, ws.series);
        return (
          <>
            <StepList testId="change-what">
              <LineupRow seriesId={seriesId} occurrenceId={occurrenceId} />
              <StepRow testId="change-time" label="Change the time" onClick={() => navigate(ORG_PATHS.changeTime(seriesId, occurrenceId))} />
              <StepRow testId="change-venue" label="Different venue this date only" onClick={() => navigate(ORG_PATHS.changeVenue(seriesId, occurrenceId))} />
              {DETAILS.map((f) => (
                <StepRow key={f} testId={`change-${f}`} label={DETAIL_LABEL[f]} onClick={() => navigate(ORG_PATHS.changeDetail(seriesId, occurrenceId, f))} />
              ))}
              <StepRow testId="change-copy" label="Copy changes from another date" onClick={() => navigate(ORG_PATHS.changeCopy(seriesId, occurrenceId))} />
              {A1_APPLIED && (
                <StepRow testId="change-day" label="Move to another day" onClick={() => navigate(ORG_PATHS.changeDay(seriesId, occurrenceId))} />
              )}
            </StepList>
            <StepList testId="change-what-off">
              <StepRow
                testId="change-off"
                label="Take this date off"
                sub={ruleDate ? 'Skip it. No cancellation shows.' : OFF_ONLY_RULE}
                disabled={!ruleDate}
                onClick={() => navigate(ORG_PATHS.changeOff(seriesId, occurrenceId))}
              />
              <StepRow
                testId="change-cancel"
                label="Cancel this date"
                sub="Dancers see Cancelled and your reason."
                onClick={() => navigate(ORG_PATHS.cancelDate(seriesId, occurrenceId))}
              />
            </StepList>
          </>
        );
      }}
    </DateStep>
  );
}

/**
 * Sessions and line-up of THIS date (the date editor). When the editor will
 * refuse the date (multi-day, cancelled, past) the row still opens it, read
 * only, and says why here first.
 */
function LineupRow({ seriesId, occurrenceId }: { seriesId: string; occurrenceId: string }) {
  const navigate = useNavigate();
  const programme = useNextDateProgramme(occurrenceId);
  const refused = programme.data && !programme.data.editable ? notEditableCopy(programme.data.notEditableReason) : null;
  return (
    <StepRow
      testId="change-lineup"
      label="Sessions and line-up"
      sub={refused ?? 'Times, classes, teachers and DJs of this date'}
      onClick={() => navigate(ORG_PATHS.dateLineup(seriesId, occurrenceId))}
    />
  );
}
