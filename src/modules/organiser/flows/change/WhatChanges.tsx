import { useNavigate } from 'react-router-dom';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { DateStep } from './DateStep';
import { StepList, StepRow } from './parts';

/** C4: what changes. Three rows; a tap advances (D35). */
export default function WhatChanges() {
  const navigate = useNavigate();
  return (
    <DateStep back={(s) => ORG_PATHS.changeEvent(s)}>
      {({ seriesId, occurrenceId }) => (
        <StepList testId="change-what">
          <StepRow testId="change-time" label="Change the time" onClick={() => navigate(ORG_PATHS.changeTime(seriesId, occurrenceId))} />
          <StepRow testId="change-venue" label="Different venue this date only" onClick={() => navigate(ORG_PATHS.changeVenue(seriesId, occurrenceId))} />
          <StepRow testId="change-day" label="Move to another day" onClick={() => navigate(ORG_PATHS.changeDay(seriesId, occurrenceId))} />
        </StepList>
      )}
    </DateStep>
  );
}
