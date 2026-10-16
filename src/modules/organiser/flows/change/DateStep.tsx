import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { dayLabel } from '@/modules/organiser/shared/dateList';
import type { DateDetail, SeriesWorkspace, WorkspaceDate } from '@/modules/organiser/shared/seriesModel';
import { useChangeDate } from './useChange';
import { Failed, Loading, Missing, Refusal, Step } from './parts';

export interface DateStepReady {
  seriesId: string;
  occurrenceId: string;
  today: string;
  ws: SeriesWorkspace;
  date: WorkspaceDate;
  detail: DateDetail;
}

/**
 * The frame of C4/C5/C5b/C5c: reads the date, refuses a past/closed/cancelled
 * one (dateLock text verbatim) or one that is not this login's, and renders
 * the step only for a date that can change.
 */
export function DateStep({ title, back, needsDetail = true, children }: {
  title?: (date: string) => ReactNode;
  back: (seriesId: string, occurrenceId: string) => string;
  needsDetail?: boolean;
  children: (ready: DateStepReady) => ReactNode;
}) {
  const { seriesId = '', occurrenceId = '' } = useParams();
  const d = useChangeDate(seriesId, occurrenceId);
  const date = d.gate?.kind === 'ok' ? d.gate.date : null;

  let body: ReactNode;
  if (d.failed) body = <Failed onRetry={d.retry} />;
  else if (!d.gate || !d.ws.data) body = <Loading />;
  else if (d.gate.kind === 'missing' || !d.series) body = <Missing />;
  else if (d.gate.kind === 'refused') body = <Refusal text={d.gate.text} seriesId={seriesId} />;
  else if (needsDetail && !d.detail.data) body = <Loading />;
  else if (date && d.detail.data) body = children({ seriesId, occurrenceId, today: d.today, ws: d.ws.data, date, detail: d.detail.data });
  else body = <Loading />;

  return (
    <Step title={date ? (title ? title(date.occurrence_date) : dayLabel(date.occurrence_date)) : 'Change a date'} back={back(seriesId, occurrenceId)}>
      {body}
    </Step>
  );
}
