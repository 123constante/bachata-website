import { useState } from 'react';
import { TAKEN_OFF_LABEL } from '@/modules/organiser/shared/editorGuards';
import { commandErrorMessage } from '@/modules/organiser/shared/selfServeErrors';
import type { WorkspaceDate, WorkspaceSeries } from '@/modules/organiser/shared/seriesModel';
import { AnnounceRegion, Card, DateChip, useAnnounce } from '../ui';
import { shortDate } from './eventModel';
import { useRunCommands } from './eventsApi';
import { takenOffView, type TakenOffRow } from './takenOff';

/**
 * Future dates taken off the series (break weeks, removed dates), each with Put
 * back: series.unskip_date when the weekly rule still makes the date, else
 * series.add_date. Hidden when there are none. When Put back cannot work
 * (ended / archived, unsaved edits, the 30-date cap) every button is off and
 * the reason shows under the list.
 */
export function DatesTakenOff({ series, dates, today, lock, dirty, canChooseEnd }: {
  series: WorkspaceSeries; dates: WorkspaceDate[]; today: string; lock: string | null; dirty: boolean; canChooseEnd: boolean;
}) {
  const run = useRunCommands(series.id);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ date: string; message: string } | null>(null);
  const [message, announce] = useAnnounce();
  const view = takenOffView({ series, dates, today, lock, dirty, canChooseEnd });
  if (!view.rows.length) return null;

  const putBack = async (row: TakenOffRow) => {
    setBusy(row.date);
    setError(null);
    try {
      await run([row.command], series.version);
      announce(`${shortDate(row.date, today)} is back on the list.`);
    } catch (err) {
      setError({ date: row.date, message: commandErrorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

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
                <button type="button" disabled={!!view.blocked || busy !== null} onClick={() => void putBack(row)}
                  aria-label={view.blocked ? `Put back ${label} (${view.blocked})` : `Put back ${label}`}
                  data-testid="org-taken-off-put-back"
                  className="h-[44px] shrink-0 rounded-[12px] px-[12px] text-[15px] font-semibold text-[var(--gold)] disabled:text-[var(--mut)]">
                  {busy === row.date ? 'Putting back…' : 'Put back'}
                </button>
              </div>
              {error?.date === row.date && (
                <p role="alert" className="px-[16px] pb-[12px] text-[14px] text-[var(--danger)]" data-testid="org-taken-off-error">{error.message}</p>
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
