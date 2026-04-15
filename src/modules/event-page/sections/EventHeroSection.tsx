import { useState } from 'react';
import { ArrowLeft, GraduationCap, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { EventPageModel, FestivalScheduleItem } from '@/modules/event-page/types';

type EventHeroSectionProps = {
  hero: EventPageModel['hero'];
  title: string;
  onBack: () => void;
  schedule?: FestivalScheduleItem[] | null;
};

// ---------------------------------------------------------------------------
// Schedule strip helpers
// ---------------------------------------------------------------------------

// Handle both "HH:MM" and full ISO timestamp "YYYY-MM-DDTHH:MM..."
const fmt = (time: string): string => {
  if (!time) return '';
  const tIdx = time.indexOf('T');
  const timePart = tIdx !== -1 ? time.slice(tIdx + 1) : time;
  return timePart.slice(0, 5);
};

const formatDayLabel = (day: string): string => {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return day || 'TBD';
  const d = new Date(day + 'T00:00:00');
  if (isNaN(d.getTime())) return day;
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};

type DaySummary = {
  day: string;
  classesStart: string | null;
  classesEnd: string | null;
  partyStart: string | null;
};

const buildDaySummaries = (items: FestivalScheduleItem[]): DaySummary[] => {
  const map = new Map<string, FestivalScheduleItem[]>();
  for (const item of items) {
    const key = item.day || 'TBD';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, dayItems]) => {
      const classLike = dayItems.filter((i) =>
        ['class', 'workshop', 'social', 'show', 'competition'].includes(i.type),
      );
      const parties = dayItems.filter((i) => i.type === 'party');
      classLike.sort((a, b) => a.startTime.localeCompare(b.startTime));
      parties.sort((a, b) => a.startTime.localeCompare(b.startTime));

      const ends = classLike
        .map((i) => i.endTime)
        .filter(Boolean) as string[];
      ends.sort((a, b) => b.localeCompare(a));

      return {
        day,
        classesStart: classLike[0]?.startTime ?? null,
        classesEnd: ends[0] ?? null,
        partyStart: parties[0]?.startTime ?? null,
      };
    });
};

const ScheduleStrip = ({ schedule }: { schedule: FestivalScheduleItem[] }) => {
  const days = buildDaySummaries(schedule);
  if (days.length === 0) return null;

  return (
    <div className="mt-2 flex gap-2 overflow-x-auto pb-1 px-1">
      {days.map((d) => (
        <div
          key={d.day}
          className="shrink-0 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 min-w-[110px]"
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/50 mb-1.5">
            {formatDayLabel(d.day)}
          </p>
          {(d.classesStart || d.classesEnd) && (
            <div className="flex items-center gap-1 text-[11px] text-white/80 mb-0.5">
              <GraduationCap className="h-3 w-3 shrink-0 text-blue-400" />
              <span>
                {d.classesStart ? fmt(d.classesStart) : '?'}
                {d.classesEnd ? ` – ${fmt(d.classesEnd)}` : ''}
              </span>
            </div>
          )}
          {d.partyStart && (
            <div className="flex items-center gap-1 text-[11px] text-white/80">
              <Music className="h-3 w-3 shrink-0 text-pink-400" />
              <span>{fmt(d.partyStart)}</span>
            </div>
          )}
          {!d.classesStart && !d.partyStart && (
            <p className="text-[11px] text-white/40">TBA</p>
          )}
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const EventHeroSection = ({ hero, title, onBack, schedule }: EventHeroSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.03] p-2 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
      {/* Title above the cover image */}
      <h1 className="px-2 pt-2 pb-3 text-xl font-semibold leading-snug text-white sm:text-2xl">
        {title}
      </h1>

      <div className="relative overflow-hidden rounded-xl border border-white/10">
        <button
          type="button"
          onClick={() => hero.imageUrl && setIsOpen(true)}
          onKeyDown={(event) => {
            if (!hero.imageUrl) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setIsOpen(true);
            }
          }}
          className="block w-full"
        >
          {hero.imageUrl ? (
            <img src={hero.imageUrl} alt={hero.imageAlt} className="aspect-[4/3] w-full object-cover" />
          ) : (
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-[radial-gradient(circle_at_20%_20%,_rgba(251,191,36,0.2),_rgba(17,24,39,0.95)_55%)]">
              <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),transparent_42%,rgba(255,255,255,0.03)_100%)]" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/10 text-lg font-semibold tracking-[0.16em] text-white">
                  {hero.monogram}
                </div>
              </div>
            </div>
          )}
        </button>

        <Button
          onClick={(event) => {
            event.stopPropagation();
            onBack();
          }}
          variant="ghost"
          className="absolute left-2 top-2 h-11 w-11 rounded-full bg-background/70 hover:bg-background/85 flex items-center justify-center"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Daily schedule strip below the cover */}
      {schedule && schedule.length > 0 && <ScheduleStrip schedule={schedule} />}

      {/* Lightbox – transparent background so image floats over the dimmed overlay */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-5xl border-none bg-transparent shadow-none p-2 sm:p-4">
          {hero.imageUrl && (
            <img src={hero.imageUrl} alt={hero.imageAlt} className="max-h-[85vh] w-full rounded-xl object-contain drop-shadow-2xl" />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};
