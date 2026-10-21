import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { FIELD_CLASS, GhostButton } from '../../ui';
import { endOptions, startOptions } from '../../sessions/sessionsModel';
import {
  addDay,
  addDayReason,
  canAddDay,
  canRemoveDay,
  hoursProblem,
  nightDate,
  removeDay,
  removeDayReason,
  setNightHours,
  sameHoursEveryNight,
  type FestivalDraft,
} from './festivalModel';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const dayWord = (key: string): string => {
  const d = new Date(`${key}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? key : `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()}`;
};

export interface FestivalNightsProps {
  draft: FestivalDraft;
  onChange: (next: FestivalDraft) => void;
}

/** Every night with its own party hours. Tap a night to change it; the open one offers "Use these hours every night". */
export function FestivalNights({ draft, onChange }: FestivalNightsProps) {
  const [open, setOpen] = useState<number | null>(null);
  const addWhy = addDayReason(draft);
  const removeWhy = removeDayReason(draft);
  return (
    <div className="space-y-[8px]" data-testid="festival-nights">
      {draft.nights.map((n, i) => {
        const problem = hoursProblem(n.start, n.end);
        const isOpen = open === i;
        return (
          <div key={n.id} className="rounded-[var(--r-card,16px)] border border-[var(--line)] bg-[var(--card)]" data-testid={`festival-night-${i}`}>
            <button
              type="button"
              className="flex min-h-[52px] w-full items-center justify-between gap-[12px] px-[12px] py-[8px] text-left"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
              data-testid={`festival-night-${i}-toggle`}
            >
              <span className="text-[16px] font-semibold text-[var(--fg)]">{dayWord(nightDate(draft, i))}</span>
              <span className="text-[16px] text-[var(--mut)]" data-testid={`festival-night-${i}-hours`}>{n.start}&ndash;{n.end}</span>
            </button>
            {isOpen && (
              <div className="space-y-[8px] border-t border-[var(--line)] p-[12px]">
                <div className="grid grid-cols-2 gap-[8px]">
                  <label className="space-y-[4px] text-[13px] font-semibold text-[var(--mut)]">Party starts
                    <select className={`${FIELD_CLASS} h-[48px]`} value={n.start} data-testid={`festival-night-${i}-start`}
                      onChange={(e) => {
                        const start = e.target.value;
                        const keep = endOptions(start).some((o) => o.value === n.end) ? n.end : endOptions(start, n.end)[7]?.value ?? n.end;
                        onChange(setNightHours(draft, i, { start, end: keep }));
                      }}>
                      {startOptions(n.start).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                  <label className="space-y-[4px] text-[13px] font-semibold text-[var(--mut)]">Party ends
                    <select className={`${FIELD_CLASS} h-[48px]`} value={n.end} data-testid={`festival-night-${i}-end`}
                      onChange={(e) => onChange(setNightHours(draft, i, { start: n.start, end: e.target.value }))}>
                      {endOptions(n.start, n.end).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                </div>
                {problem && <p role="alert" className="text-[13px] text-[var(--danger)]">{problem}</p>}
                {draft.nights.length > 1 && (
                  <GhostButton size="sm" onClick={() => onChange(sameHoursEveryNight(draft, i))} testId={`festival-night-${i}-all`}>Use these hours every night</GhostButton>
                )}
                <GhostButton size="sm" disabled={!canRemoveDay(draft)} onClick={() => { setOpen(null); onChange(removeDay(draft, i)); }} testId={`festival-night-${i}-remove`}>
                  <Minus aria-hidden="true" className="h-[18px] w-[18px]" />Remove this day
                </GhostButton>
                {removeWhy && <p className="text-center text-[13px] text-[var(--mut)]">{removeWhy}</p>}
              </div>
            )}
          </div>
        );
      })}
      <GhostButton disabled={!canAddDay(draft)} onClick={() => onChange(addDay(draft))} testId="festival-add-day">
        <Plus aria-hidden="true" className="h-[18px] w-[18px]" />Add a day
      </GhostButton>
      {addWhy && <p className="text-center text-[13px] text-[var(--mut)]">{addWhy}</p>}
    </div>
  );
}
