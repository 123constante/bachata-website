import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { TAKEN_OFF_LABEL } from '@/modules/organiser/shared/editorGuards';
import { eventWorkspaceQueryKey } from '@/modules/organiser/shared/runCommands';
import type { WorkspaceDate, WorkspaceSeries } from '@/modules/organiser/shared/seriesModel';
import { useFlowSend } from '@/modules/organiser/flows/add/useFlow';
import { EventConflict } from '@/modules/organiser/flows/event/parts';
import { AnnounceRegion, Card, DateChip, useAnnounce } from '../ui';
import { shortDate } from './eventModel';
import { takenOffView, type TakenOffRow } from './takenOff';

interface TakenOffProps {
  series: WorkspaceSeries; dates: WorkspaceDate[]; today: string; lock: string | null; dirty: boolean; canChooseEnd: boolean;
}

/**
 * Future dates taken off the series (break weeks, removed dates), each with Put
 * back: series.unskip_date when the weekly rule still makes the date, else
 * series.add_date. Hidden when there are none. When Put back cannot work
 * (ended / archived, unsaved edits, the 30-date cap) every button is off and
 * the reason shows under the list.
 *
 * A-S1: Put back sends through useFlowSend like every other write: a retry of
 * the same date reuses its idempotency key (held in a ref), so a lost reply is
 * replayed, not hit as version_conflict; a conflict shows the one R3-7 view.
 * Its "Open the event" lands on this same route with a new location key, which
 * remounts the section, so it reads the event again.
 */
export function DatesTakenOff(props: TakenOffProps) {
  const { key } = useLocation();
  return <TakenOff key={key} {...props} />;
}

function TakenOff({ series, dates, today, lock, dirty, canChooseEnd }: TakenOffProps) {
  const queryClient = useQueryClient();
  const flow = useFlowSend(series.id);
  // The row last tried: its button says it is busy, and its error shows under it.
  const [tried, setTried] = useState<string | null>(null);
  const [message, announce] = useAnnounce();
  const view = takenOffView({ series, dates, today, lock, dirty, canChooseEnd });
  if (!view.rows.length) return null;
  if (flow.conflict) return <EventConflict seriesId={series.id} />;

  const putBack = (row: TakenOffRow) => flow.run(async () => {
    setTried(row.date);
    const res = await flow.send(series.id, series.version, row.command);
    void queryClient.invalidateQueries({ queryKey: eventWorkspaceQueryKey(series.id) });
    if (res) announce(`${shortDate(row.date, today)} is back on the list.`);
  });

  return (
    <section aria-label={TAKEN_OFF_LABEL} data-testid="org-taken-off">
      <Card label={`${TAKEN_OFF_LABEL} (${view.rows.length})`}>
        {view.rows.map((row) => {
          const label = shortDate(row.date, today);
          return (
            <div key={row.date} data-testid="org-taken-off-row" data-date={row.date}>
              <div className="flex min-h-[60px] items-center gap-[12px] px-[16px] py-[8px]">
                <DateChip date={row.date} />
                <span className="min-w-0 flex-1 truncate text-[15px] text-[var(--fg)]">{label}</span>
                <button type="button" disabled={!!view.blocked || flow.busy} onClick={() => void putBack(row)}
                  aria-label={view.blocked ? `Put back ${label} (${view.blocked})` : `Put back ${label}`}
                  data-testid="org-taken-off-put-back"
                  className="h-[44px] shrink-0 rounded-[12px] px-[12px] text-[15px] font-semibold text-[var(--gold)] disabled:text-[var(--mut)]">
                  {flow.busy && tried === row.date ? <>Putting back&hellip;</> : 'Put back'}
                </button>
              </div>
              {flow.error && tried === row.date && (
                <p role="alert" className="px-[16px] pb-[12px] text-[14px] text-[var(--danger)]" data-testid="org-taken-off-error">{flow.error}</p>
              )}
            </div>
          );
        })}
        {view.blocked && (
          <p className="px-[16px] py-[12px] text-[13px] text-[var(--mut)]" data-testid="org-taken-off-reason">{view.blocked}</p>
        )}
      </Card>
      <AnnounceRegion message={message} testId="org-taken-off-announce" />
    </section>
  );
}
