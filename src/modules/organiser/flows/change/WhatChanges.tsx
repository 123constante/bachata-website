import { useNavigate, useParams } from 'react-router-dom';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { isRuleDate } from '@/modules/organiser/shared/seriesModel';
import { notEditableCopy } from '@/modules/organiser/shared/programmeModel';
import { TAKE_OFF } from '@/modules/organiser/shared/copy';
import { cancelFromChangePath } from '@/modules/organiser/flows/cancel/cancelModel';
import { useEventWorkspace, useNextDateProgramme } from '@/modules/organiser/events/eventsApi';
import { useRebuildSwitch } from '@/modules/organiser/shell/rebuildSwitch';
import { DateStep } from './DateStep';
import { DETAIL_LABEL, FESTIVAL_TIME, isFestival, type DetailField } from './changeModel';
import { StepList, StepRow } from './parts';

const DETAILS: DetailField[] = ['note', 'ticket', 'picture'];
export const OFF_ONLY_RULE = 'Only a date of the weekly repeat can be taken off. Cancel it instead.';

/**
 * C4: what changes on this one date. A tap advances (D35). Everything an
 * owner/manager may do to a date on prod (PARITY-GAP C13 C19 C21-C26 C59
 * C60). There is no "move to another day" (owner decision 2026-10-20, C20):
 * a weekly night has an identity; cancel a date and add a new one.
 */
export default function WhatChanges() {
  const navigate = useNavigate();
  // ER-FIX2-S6 (F-C9-5, duplicates): on the rebuilt screens the date page owns
  // the time (Night starts), copy and cancel; Take this date off is gone (rule 9).
  const { seriesId: routeSeriesId = '' } = useParams();
  const eventWs = useEventWorkspace(routeSeriesId);
  const rebuilt = useRebuildSwitch(eventWs.data?.organiserIds ?? null);
  // Never a flash of the old rows while the switch is still being read.
  const oldRows = !rebuilt && !eventWs.isLoading;
  return (
    <DateStep back={(s) => ORG_PATHS.changeEvent(s)}>
      {({ seriesId, occurrenceId, ws, date }) => {
        // The same fact the date page reads for its "Take this date off" row (dates/index.tsx).
        const ruleDate = isRuleDate(date.occurrence_date, ws.series);
        const festival = isFestival(ws.series);
        return (
          <>
            <StepList testId="change-what">
              <LineupRow seriesId={seriesId} occurrenceId={occurrenceId} />
              {/* F-PAR-final N2: set_time refuses a festival; Sessions and line-up above is the way on. */}
              {oldRows && (
                <StepRow testId="change-time" label="Change the time" sub={festival ? FESTIVAL_TIME : undefined} disabled={festival}
                  onClick={() => navigate(ORG_PATHS.changeTime(seriesId, occurrenceId))} />
              )}
              <StepRow testId="change-venue" label="Different venue this date only" onClick={() => navigate(ORG_PATHS.changeVenue(seriesId, occurrenceId))} />
              {DETAILS.map((f) => (
                <StepRow key={f} testId={`change-${f}`} label={DETAIL_LABEL[f]} onClick={() => navigate(ORG_PATHS.changeDetail(seriesId, occurrenceId, f))} />
              ))}
              {oldRows && <StepRow testId="change-copy" label="Copy changes from another date" onClick={() => navigate(ORG_PATHS.changeCopy(seriesId, occurrenceId))} />}
            </StepList>
            <StepList testId="change-what-off">
              {oldRows && <StepRow
                testId="change-off"
                label={TAKE_OFF.label}
                sub={ruleDate ? TAKE_OFF.sub : OFF_ONLY_RULE}
                disabled={!ruleDate}
                onClick={() => navigate(ORG_PATHS.changeOff(seriesId, occurrenceId))}
              />}
              <StepRow
                testId="change-cancel"
                label="Cancel this date"
                sub="Dancers see Cancelled and your reason."
                onClick={() => navigate(cancelFromChangePath(seriesId, occurrenceId))}
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
