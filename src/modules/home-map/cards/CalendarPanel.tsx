// Festival Map -- shared "Calendar" panel: a month grid with category dots.
// Tap a day to open the DayDetailModal (same rich view as the /parties page).
// New UI (not the exempt DayDetailModal) so density rules apply. Used by both the
// mobile sheet (SheetCalendarTab) and the desktop list rail (DesktopMapHome).

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UseMapListResult } from '../useMapList';
import { buildMonthCells, formatDayLabel } from '../mapListDerivations';
import { todayStr } from '../mapTypes';
import { CategoryDot, EventRow, EmptyState, RemoteFestivalRow } from './cards';
import { DayDetailModal } from '@/components/calendar/DayDetailModal';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { transformCalendarEvents } from '@/components/calendar/calendarUtils';
import { useCity } from '@/contexts/CityContext';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function CalendarPanel({
  state,
  seedDefault = false,
}: {
  state: UseMapListResult;
  /** Desktop's tall rail looks empty with no day picked, so seed a default day
   *  on mount (audit #14). The short mobile sheet leaves it unset. */
  seedDefault?: boolean;
}) {
  const today = todayStr();
  const { citySlug } = useCity();
  const [modalOpen, setModalOpen] = useState(false);

  // Seed the soonest day that has events (else today) once per Calendar entry
  // when asked (desktop). Runs on mount only, so a manual Clear is respected.
  useEffect(() => {
    if (!seedDefault || state.day) return;
    const dates = [...state.calendarDays.keys()].filter((d) => d >= today).sort();
    state.setDay(dates[0] ?? today);
    setModalOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once on mount
  }, []);

  // View month: seed from the selected day, else the current month.
  const [view, setView] = useState(() => {
    const seed = state.day ?? today;
    const m = /^(\d{4})-(\d{2})/.exec(seed);
    return m ? { y: Number(m[1]), m: Number(m[2]) - 1 } : { y: 2026, m: 0 };
  });

  const step = (delta: number) => {
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };

  const grid = buildMonthCells(view.y, view.m, state.calendarDays, today, state.day);

  // Fetch rich event data for the displayed month (powers DayDetailModal).
  const rangeStart = new Date(view.y, view.m, 1);
  const rangeEnd = new Date(view.y, view.m + 1, 0, 23, 59, 59);
  const { data: rawEvents = [], isLoading: eventsLoading } = useCalendarEvents({
    rangeStart,
    rangeEnd,
    citySlug,
  });
  const allItems = transformCalendarEvents(rawEvents);

  // Day number extracted from "YYYY-MM-DD" for DayDetailModal (view tracks month/year).
  const modalDay: number | null = (() => { if (!state.day) return null; const d = parseInt(state.day.slice(8, 10), 10); return d >= 1 ? d : null; })();

  const handleDateClick = (date: string, isSelected: boolean) => {
    if (isSelected) {
      setModalOpen(false);
      state.setDay(null);
    } else {
      state.setDay(date);
      setModalOpen(true);
    }
  };

  const handleClose = () => {
    setModalOpen(false);
    state.setDay(null);
  };

  // Keep view month in sync when modal's prev/next nav crosses a month boundary.
  const handleChangeDate = (newDate: Date) => {
    state.setDay(newDate.toISOString().slice(0, 10));
    setView({ y: newDate.getFullYear(), m: newDate.getMonth() });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Previous month"
          className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-sm font-bold">{grid.label}</span>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Next month"
          className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {DOW.map((d) => (
          <span key={d} className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            {d}
          </span>
        ))}
        {grid.weeks.flat().map((cell, i) =>
          cell.date == null ? (
            <span key={`b${i}`} aria-hidden="true" />
          ) : cell.isPast && cell.cats.length === 0 ? (
            <span
              key={cell.date}
              aria-hidden="true"
              className="flex aspect-square items-center justify-center rounded-lg text-xs font-bold text-muted-foreground/40"
            >
              {cell.day}
            </span>
          ) : (
            <button
              key={cell.date}
              type="button"
              onClick={() => handleDateClick(cell.date!, cell.isSelected)}
              aria-label={`${formatDayLabel(cell.date)}${cell.cats.length ? ', has events' : ''}${cell.isToday ? ', today' : ''}`}
              aria-pressed={cell.isSelected}
              className={cn(
                'relative flex aspect-square flex-col items-center justify-center rounded-lg text-xs',
                cell.isSelected
                  ? 'bg-primary text-white'
                  : cell.cats.length
                    ? 'bg-muted/50 hover:bg-muted'
                    : 'text-muted-foreground',
                cell.isToday && !cell.isSelected ? 'ring-1 ring-primary' : '',
              )}
            >
              <span className="font-bold">{cell.day}</span>
              {cell.cats.length > 0 && (
                <span className="mt-0.5 flex gap-0.5">
                  {cell.cats.slice(0, 3).map((c) => (
                    <CategoryDot key={c} category={c} className="h-1 w-1" />
                  ))}
                </span>
              )}
            </button>
          ),
        )}
      </div>

      {state.day && !modalOpen ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between px-1 pt-1">
            <span className="text-sm font-bold">{formatDayLabel(state.day)}</span>
            <button
              type="button"
              onClick={handleClose}
              className="text-xs font-bold text-primary"
            >
              Clear
            </button>
          </div>
          {state.listEvents.length === 0 ? (
            <EmptyState>Nothing listed for this day yet.</EmptyState>
          ) : (
            state.listEvents.map((e) =>
              e.occurrence_id.startsWith('remote-') ? (
                <RemoteFestivalRow key={e.occurrence_id} event={e} />
              ) : (
                <EventRow
                  key={e.occurrence_id}
                  event={e}
                  selected={state.selected === e.occurrence_id}
                  onSelect={state.fromCard}
                  onHover={state.setHovered}
                />
              )
            )
          )}
        </div>
      ) : !state.day ? (
        <p className="px-1 pt-1 text-center text-sm text-primary">
          Tap a date to see what&rsquo;s on &mdash; the map updates too.
        </p>
      ) : null}

      <DayDetailModal
        selectedDay={modalOpen && modalDay !== null ? modalDay : null}
        currentMonth={view.m}
        currentYear={view.y}
        parentCategory="all"
        events={allItems}
        onClose={handleClose}
        onChangeDate={handleChangeDate}
        eventsLoading={eventsLoading}
      />
    </div>
  );
}
