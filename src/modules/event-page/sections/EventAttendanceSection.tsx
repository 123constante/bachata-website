import type { EventPageModel } from '@/modules/event-page/types';
import { Button } from '@/components/ui/button';

type EventAttendanceSectionProps = {
  attendance: EventPageModel['attendance'];
  isPending: boolean;
  onToggle: () => void;
  isCancelled?: boolean;
};

export const EventAttendanceSection = ({ attendance, isPending, onToggle, isCancelled }: EventAttendanceSectionProps) => {
  if (!attendance.isVisible) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_35px_rgba(0,0,0,0.28)] backdrop-blur-sm">
      <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/45">Attendance</p>
      <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-3 text-xs text-white/80 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="space-y-0.5">
            <p className="font-medium text-white">Let other dancers know you'll be there</p>
            <p className="text-white/60">{attendance.goingCountLabel}</p>
          </div>

          {attendance.preview.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {attendance.preview.slice(0, 8).map((attendee) => (
                <div
                  key={attendee.id}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1"
                >
                  <div className="h-6 w-6 overflow-hidden rounded-full bg-white/[0.06]">
                    {attendee.avatarUrl ? (
                      <img src={attendee.avatarUrl} alt={attendee.displayName ?? undefined} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-white/70">
                        {(attendee.displayName || '').trim().charAt(0) || '•'}
                      </div>
                    )}
                  </div>
                  <span className="max-w-[88px] truncate text-[11px] text-white/65">{attendee.displayName}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col items-start gap-2">
          <Button
            size="sm"
            variant={attendance.currentUserStatus === 'going' && !isCancelled ? 'default' : 'outline'}
            className="h-8 rounded-full px-3 text-xs"
            onClick={onToggle}
            disabled={!attendance.canToggle || isPending || isCancelled}
          >
            {isPending ? 'Saving...' : isCancelled ? 'Event Cancelled' : attendance.ctaLabel}
          </Button>

          {!attendance.canToggle && !isCancelled && (
            <p className="text-[11px] text-white/70">Sign in to mark your attendance</p>
          )}
          {isCancelled && (
            <p className="text-[11px] text-red-400/80">This occurrence was cancelled and is no longer accepting RSVPs.</p>
          )}
        </div>
      </div>
    </section>
  );
};
