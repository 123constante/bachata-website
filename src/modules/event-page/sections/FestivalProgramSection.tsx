import { CalendarDays, Music } from 'lucide-react';
import { useState } from 'react';
import type { FestivalScheduleItem } from '@/modules/event-page/types';

type FestivalProgramSectionProps = {
  schedule: FestivalScheduleItem[] | null;
};

const typeColorMap: Record<string, string> = {
  class: 'bg-blue-500/15 text-blue-400',
  workshop: 'bg-blue-500/15 text-blue-400',
  social: 'bg-purple-500/15 text-purple-400',
  show: 'bg-amber-500/15 text-amber-400',
  party: 'bg-pink-500/15 text-pink-400',
  competition: 'bg-red-500/15 text-red-400',
};

// Handle both "HH:MM" and full ISO timestamp "YYYY-MM-DDTHH:MM..."
const formatTime = (time: string): string => {
  if (!time) return '';
  const tIdx = time.indexOf('T');
  const timePart = tIdx !== -1 ? time.slice(tIdx + 1) : time;
  return timePart.slice(0, 5);
};

/** Group program items by day and sort within each day by startTime */
const groupByDay = (items: FestivalScheduleItem[]) => {
  const map = new Map<string, FestivalScheduleItem[]>();
  for (const item of items) {
    const key = item.day || 'TBD';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  const sorted = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [, dayItems] of sorted) {
    dayItems.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }
  return sorted;
};

const formatDayLabel = (day: string): string => {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return day || 'TBD';
  const d = new Date(day + 'T00:00:00');
  if (isNaN(d.getTime())) return day;
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};

// Remove trailing " N" from auto-generated default names like "Class 1", "Party 2"
const normalizeSessionTitle = (title: string): string =>
  /^(class|party|workshop|social|show|competition)\s+\d+$/i.test(title.trim())
    ? title.trim().replace(/\s+\d+$/, '')
    : title;

export const FestivalProgramSection = ({ schedule }: FestivalProgramSectionProps) => {
  if (!schedule || schedule.length === 0) return null;

  const grouped = groupByDay(schedule);
  const firstDay = grouped[0]?.[0];
  const [selectedDay, setSelectedDay] = useState<string | null>(firstDay ?? null);

  // Update selected day if it's null and we have days
  const effectiveSelectedDay = selectedDay || firstDay;
  const currentDayItems = grouped.find(([day]) => day === effectiveSelectedDay)?.[1] || [];
  const classItems = currentDayItems.filter(item => 
    ['class', 'workshop', 'social', 'show', 'competition'].includes(item.type)
  );
  const partyItems = currentDayItems.filter(item => item.type === 'party');

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_35px_rgba(0,0,0,0.28)] backdrop-blur-sm">
      <p className="mb-4 text-[10px] uppercase tracking-[0.18em] text-white/45">Schedule</p>
      
      {/* Date selector tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-2">
        {grouped.map(([day]) => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`px-3 py-2 rounded-lg text-xs font-medium shrink-0 transition-all ${
              effectiveSelectedDay === day
                ? 'bg-pink-500/30 text-pink-200 border border-pink-400/50'
                : 'bg-white/10 text-white/60 border border-white/10 hover:bg-white/15'
            }`}
          >
            {formatDayLabel(day)}
          </button>
        ))}
      </div>

      {/* Classes and Parties - Two Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Classes Column */}
        <div>
          <h3 className="text-xs font-medium text-white/70 mb-3 flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 text-blue-400" />
            Classes & Workshops
          </h3>
          <div className="space-y-2">
            {classItems.length > 0 ? (
              classItems.map((item, idx) => {
                const colorClass = typeColorMap[item.type] ?? 'bg-white/10 text-white/60';
                return (
                  <div key={`${effectiveSelectedDay}-class-${idx}`} className="rounded-lg bg-white/5 p-3 border border-white/5">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${colorClass}`}>
                        {item.type}
                      </span>
                      <p className="text-[11px] tabular-nums text-white/50 shrink-0">
                        {formatTime(item.startTime)}
                        {item.endTime ? ` – ${formatTime(item.endTime)}` : ''}
                      </p>
                    </div>
                    {item.title && <p className="text-sm text-white/85">{normalizeSessionTitle(item.title)}</p>}
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-white/40 italic">No classes scheduled</p>
            )}
          </div>
        </div>

        {/* Parties Column */}
        <div>
          <h3 className="text-xs font-medium text-white/70 mb-3 flex items-center gap-2">
            <Music className="h-3.5 w-3.5 text-pink-400" />
            Parties
          </h3>
          <div className="space-y-2">
            {partyItems.length > 0 ? (
              partyItems.map((item, idx) => {
                const colorClass = typeColorMap[item.type] ?? 'bg-white/10 text-white/60';
                return (
                  <div key={`${effectiveSelectedDay}-party-${idx}`} className="rounded-lg bg-white/5 p-3 border border-white/5">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${colorClass}`}>
                        {item.type}
                      </span>
                      <p className="text-[11px] tabular-nums text-white/50 shrink-0">
                        {formatTime(item.startTime)}
                        {item.endTime ? ` – ${formatTime(item.endTime)}` : ''}
                      </p>
                    </div>
                    {item.title && <p className="text-sm text-white/85">{normalizeSessionTitle(item.title)}</p>}
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-white/40 italic">No parties scheduled</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
