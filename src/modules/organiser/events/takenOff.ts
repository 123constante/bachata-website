// "Dates taken off": the future dates an organiser took off a series (a break
// week, or a removed date) and can put back, and why Put back is off.
// Pure: London calendar keys (YYYY-MM-DD) only, no React, no client.

// The section's name and the "put it back" copy live in shared/editorGuards
// (TAKEN_OFF_LABEL, PUT_BACK_WHERE) so the date sheet reads the same words.

import { addDateCommand, unskipDateCommand, type OwnerCommand } from '@/modules/organiser/shared/seriesCommands';
import { isRuleDate, removedUpcoming, type WorkspaceDate, type WorkspaceSeries } from '@/modules/organiser/shared/seriesModel';
import { MAX_UPCOMING } from './dateCap';

/** Upcoming dates dancers see (not cancelled): the count the 30-date cap is read against. */
export const listedUpcomingCount = (dates: WorkspaceDate[], today: string) =>
  dates.filter((d) => d.occurrence_date >= today && d.lifecycle_status !== 'cancelled').length;

export interface TakenOffRow {
  date: string;
  /** The weekly rule still generates this date, so it goes back as series.unskip_date; otherwise series.add_date. */
  ruleDate: boolean;
  command: OwnerCommand;
}

export interface TakenOffView {
  /** Future dates taken off, soonest first (past ones cannot be put back). Empty: the section is hidden. */
  rows: TakenOffRow[];
  /** Why Put back cannot work right now, in words that say what to do; null when it can. */
  blocked: string | null;
}

export interface TakenOffInput {
  series: Pick<WorkspaceSeries, 'removed_dates' | 'recurrence_rule' | 'default_start_date' | 'created_at'>;
  dates: WorkspaceDate[];
  today: string;
  /** eventLock(): ended / archived, the server refuses every owner write. */
  lock: string | null;
  /** The editor holds edits that are not saved yet. */
  dirty: boolean;
  /** The Date card offers an end the organiser can pick (a weekly rule this screen edits). */
  canChooseEnd: boolean;
}

/** Why one more listed date would go over the cap; null when there is room. */
export function capBlock(listed: number, canChooseEnd: boolean): string | null {
  if (listed < MAX_UPCOMING) return null;
  const fix = canChooseEnd ? 'Choose an earlier end in the Date card above to make room.' : 'Take another date off first to make room.';
  return `${listed} upcoming dates are listed and the most is ${MAX_UPCOMING}, so a date cannot go back yet. ${fix}`;
}

export function takenOffView(input: TakenOffInput): TakenOffView {
  const listed = new Set(input.dates.map((d) => d.occurrence_date));
  const rows = removedUpcoming({ removed_dates: input.series.removed_dates } as WorkspaceSeries, input.today)
    .filter((date, i, all) => all.indexOf(date) === i && !listed.has(date))
    .map((date) => {
      const ruleDate = isRuleDate(date, input.series);
      return { date, ruleDate, command: ruleDate ? unskipDateCommand(date) : addDateCommand(date) };
    });
  const blocked = input.lock
    ?? (input.dirty ? 'Save your changes first, then put a date back.' : null)
    ?? capBlock(listedUpcomingCount(input.dates, input.today), input.canChooseEnd);
  return { rows, blocked };
}
