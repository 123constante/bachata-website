import { AlertTriangle, CalendarDays, Clock } from 'lucide-react';
import type { EventPageModel } from '@/modules/event-page/types';

type EventScheduleSectionProps = {
  schedule: EventPageModel['schedule'];
};

// Extract HH:MM from "HH:MM", "HH:MM:SS", or full ISO timestamp "YYYY-MM-DDTHH:MM..."
const fmtTime = (value: string): string => {
  if (!value) return value;
  const tIdx = value.indexOf('T');
  const timePart = tIdx !== -1 ? value.slice(tIdx + 1) : value;
  return timePart.slice(0, 5);
};

export const EventScheduleSection = ({ schedule }: EventScheduleSectionProps) => {
  if (!schedule.isVisible) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_35px_rgba(0,0,0,0.28)] backdrop-blur-sm">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">Schedule</p>

      {schedule.isCancelled && (
        <div className="mb-3 mt-2 inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
          <span className="text-[10px] uppercase tracking-[0.15em] text-red-400">Cancelled</span>
        </div>
      )}

      <div className="mt-2 space-y-2 text-sm text-white/80">
        {schedule.dateLabel && (
          <div className="inline-flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            <span>{schedule.dateLabel}</span>
          </div>
        )}

        {schedule.timeLabel && (
          <div className="inline-flex items-center gap-2">
            <Clock className="h-4 w-4 text-white/60" />
            <span className="text-white/80">{schedule.timeLabel}</span>
            {schedule.timezoneLabel && (
              <span className="text-[11px] text-white/40">{schedule.timezoneLabel}</span>
            )}
          </div>
        )}

        {schedule.keyTimes && (
          <div className="space-y-1 pl-6 text-[12px] text-white/60">
            {schedule.keyTimes.classes && (
              <p>Classes: {fmtTime(schedule.keyTimes.classes.start)} – {fmtTime(schedule.keyTimes.classes.end)}</p>
            )}
            {schedule.keyTimes.party && (
              <p>Party: {fmtTime(schedule.keyTimes.party.start)} – {fmtTime(schedule.keyTimes.party.end)}</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
