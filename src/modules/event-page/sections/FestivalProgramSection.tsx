import { CalendarDays, Music } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  FestivalArtist,
  FestivalScheduleItem,
  FestivalSessionLevel,
} from '@/modules/event-page/types';

type FestivalProgramSectionProps = {
  schedule: FestivalScheduleItem[] | null;
};

// ─── Level → rank text ───────────────────────────────────────────────────────
const LEVEL_LABEL_SHORT: Record<FestivalSessionLevel, string> = {
  beginner: 'Beg', improver: 'Imp', intermediate: 'Int', advanced: 'Adv', open_level: 'Open',
};
const LEVEL_LABEL_FULL: Record<FestivalSessionLevel, string> = {
  beginner: 'Beginner', improver: 'Improver', intermediate: 'Intermediate', advanced: 'Advanced', open_level: 'Open Level',
};
const LEVEL_ORDER: FestivalSessionLevel[] = ['beginner', 'improver', 'intermediate', 'advanced', 'open_level'];

const TYPE_LABEL: Record<string, string> = {
  workshop:    'Workshop',
  bootcamp:    'Bootcamp',
  masterclass: 'Masterclass',
  class:       'Class',
  show:        'Show',
  competition: 'Competition',
  social:      'Social',
};

// Default-title detection — suppresses redundant "Workshop", "Class 1",
// "Masterclass 2" titles so the rank text + type caption do the work.
const isDefaultTitle = (title: string): boolean =>
  /^(class|classes|workshop|bootcamp|masterclass|masterclasses|show|competition|social|party)(\s+\d+)?$/i
    .test(title.trim());

// Rank-card headline. Mirrors bento ScheduleBlock's rankFor but adapted to
// FestivalScheduleItem (which has a wider type vocabulary). When no level is
// set on a class-shaped session, fall back to a friendly type word so the card
// still has a serif anchor.
const rankFor = (item: FestivalScheduleItem): { text: string; muted: boolean } => {
  if (item.type === 'masterclass') return { text: 'Master', muted: false };
  if (item.type === 'show')        return { text: 'Show',   muted: false };
  if (item.type === 'competition') return { text: 'Comp',   muted: false };
  if (item.type === 'social')      return { text: 'Social', muted: false };

  // Class / workshop / bootcamp → level is the headline when set.
  // Open Level wins over everything else if present (UI keeps it exclusive).
  if (item.levels.includes('open_level')) return { text: 'Open Level', muted: false };
  if (item.levels.length === 4) return { text: 'All',   muted: false };
  if (item.levels.length === 1) return { text: LEVEL_LABEL_FULL[item.levels[0]], muted: false };
  if (item.levels.length >= 2) {
    const sorted = [...item.levels].sort(
      (a, b) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b),
    );
    return { text: sorted.map((l) => LEVEL_LABEL_SHORT[l]).join('/'), muted: false };
  }
  // No level — fall back to type word, muted to flag "level not specified".
  return { text: TYPE_LABEL[item.type] ?? 'Class', muted: true };
};

const rankTooltip = (item: FestivalScheduleItem): string => {
  if (item.type === 'masterclass') return 'Masterclass — premium session with a master instructor';
  if (item.levels.length === 0)    return 'Level not specified';
  if (item.levels.includes('open_level')) return 'Open Level — suitable for all dancers';
  if (item.levels.length === 4)    return 'All four levels';
  return item.levels.map((l) => LEVEL_LABEL_FULL[l]).join(', ');
};

// ─── Time helpers ────────────────────────────────────────────────────────────

// Handle "HH:MM" or full ISO timestamp "YYYY-MM-DDTHH:MM..."
const formatTime = (time: string): string => {
  if (!time) return '';
  const tIdx = time.indexOf('T');
  const timePart = tIdx !== -1 ? time.slice(tIdx + 1) : time;
  return timePart.slice(0, 5);
};

const formatTime12 = (time: string): string => {
  const hhmm = formatTime(time);
  if (!hhmm) return '';
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  if (Number.isNaN(h)) return hhmm;
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${mStr ?? '00'} ${ampm}`;
};

const formatDayLabel = (day: string): string => {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return day || 'TBD';
  const d = new Date(day + 'T00:00:00');
  if (isNaN(d.getTime())) return day;
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};

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

// ─── Avatar ──────────────────────────────────────────────────────────────────
//
// 64 px headshots, brass-on-dark fallback. Mirrors the bento PersonLink so the
// human element is the dominant scan target on each card.

const ArtistLink = ({ artist }: { artist: FestivalArtist }) => {
  const initial = (artist.displayName || '?').charAt(0).toUpperCase();
  const body = (
    <>
      <div
        className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-[1.5px] text-[22px] font-bold border-white/10"
        style={{
          background: artist.avatarUrl ? undefined : 'rgba(255,255,255,0.04)',
          color: 'rgb(251 146 60)',
        }}
      >
        {artist.avatarUrl ? (
          <img src={artist.avatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span>{initial}</span>
        )}
      </div>
      <div
        className="max-w-[80px] truncate text-center text-[10px] leading-[1.1] text-white/80"
        title={artist.displayName ?? ''}
      >
        {artist.displayName}
      </div>
    </>
  );
  if (!artist.href) {
    return (
      <div className="flex w-[72px] flex-col items-center gap-[4px]" aria-label={artist.displayName ?? ''}>
        {body}
      </div>
    );
  }
  return (
    <Link
      to={artist.href}
      className="flex w-[72px] flex-col items-center gap-[4px] transition-transform duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
    >
      {body}
    </Link>
  );
};

// ─── Class / workshop / masterclass card ─────────────────────────────────────
//
// Layout: time on the right of a small header, type caption below the rank,
// title (if non-default), room, then the row of instructor avatars.

const FestivalRankCard = ({
  item,
  highlightParallel,
}: {
  item: FestivalScheduleItem;
  highlightParallel: boolean;
}) => {
  const rank = rankFor(item);
  const showTitle = !isDefaultTitle(item.title) && item.title.trim().length > 0;
  const typeLabel = TYPE_LABEL[item.type] ?? item.type;
  const hasInstructors = item.instructors.length > 0;

  return (
    <div
      className={`rounded-lg p-3 border bg-white/5 ${
        highlightParallel ? 'border-cyan-500/25' : 'border-white/5'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <p className="text-[11px] tabular-nums text-white/60">
          {formatTime(item.startTime)}
          {item.endTime ? ` – ${formatTime(item.endTime)}` : ''}
        </p>
        {highlightParallel && (
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider
                bg-cyan-500/15 text-cyan-300 border border-cyan-500/25"
            title="Multiple sessions running at this time"
          >
            Parallel
          </span>
        )}
      </div>

      <div className="text-center">
        <div
          className="font-medium leading-none"
          style={{
            fontFamily: '"Fraunces", Georgia, serif',
            fontSize: '24px',
            letterSpacing: '0.02em',
            color: rank.muted ? 'rgba(255,255,255,0.45)' : 'rgb(251 146 60)',
          }}
          title={rankTooltip(item)}
        >
          {rank.text}
        </div>

        <div className="mt-[4px] font-mono text-[9px] uppercase tracking-[0.14em] text-white/45">
          {typeLabel}
        </div>

        {showTitle && (
          <div
            className="mt-[6px] text-[13px] leading-[1.2] text-white/85"
            style={{ fontFamily: '"Fraunces", Georgia, serif' }}
          >
            {item.title}
          </div>
        )}

        {item.venueRoom && (
          <div className="mt-[2px] text-[10px] text-white/45">{item.venueRoom}</div>
        )}

        {hasInstructors && (
          <div className="mt-[10px] flex flex-wrap justify-center gap-[8px]">
            {item.instructors.map((a, i) => (
              <ArtistLink key={`${a.id ?? 'x'}-${i}`} artist={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Party card ──────────────────────────────────────────────────────────────

const FestivalPartyCard = ({ item }: { item: FestivalScheduleItem }) => {
  const showTitle = !isDefaultTitle(item.title) && item.title.trim().length > 0;
  const range =
    item.startTime && item.endTime
      ? `${formatTime12(item.startTime)} – ${formatTime12(item.endTime)}`
      : formatTime12(item.startTime);

  return (
    <div className="rounded-lg p-3 border border-white/5 bg-white/5 text-center">
      {range && (
        <p className="text-[12px] font-semibold text-white/85 tabular-nums mb-2">{range}</p>
      )}

      <div
        className="text-[16px] leading-[1.15] text-white/90"
        style={{ fontFamily: '"Fraunces", Georgia, serif', fontWeight: 500 }}
      >
        {showTitle ? item.title : 'Party'}
      </div>

      {item.venueRoom && (
        <div className="mt-[2px] text-[10px] text-white/45">{item.venueRoom}</div>
      )}

      {item.djs.length > 0 && (
        <>
          <div className="mt-[8px] font-mono text-[9px] uppercase tracking-[0.14em] text-white/45">
            DJ
          </div>
          <div className="mt-[6px] flex flex-wrap justify-center gap-[8px]">
            {item.djs.map((d, i) => (
              <ArtistLink key={`${d.id ?? 'x'}-${i}`} artist={d} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ─── Parallel-class detection (for the highlight pill) ───────────────────────

const buildParallelMap = (classItems: FestivalScheduleItem[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const it of classItems) {
    const key = formatTime(it.startTime);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
};

// ─── Main ────────────────────────────────────────────────────────────────────

export const FestivalProgramSection = ({ schedule }: FestivalProgramSectionProps) => {
  if (!schedule || schedule.length === 0) return null;

  const grouped = groupByDay(schedule);
  const firstDay = grouped[0]?.[0];
  const [selectedDay, setSelectedDay] = useState<string | null>(firstDay ?? null);

  const effectiveSelectedDay = selectedDay || firstDay;
  const currentDayItems = grouped.find(([day]) => day === effectiveSelectedDay)?.[1] || [];
  const classItems = currentDayItems.filter((item) =>
    ['class', 'workshop', 'bootcamp', 'masterclass', 'show', 'competition', 'social'].includes(item.type),
  );
  const partyItems = currentDayItems.filter((item) => item.type === 'party');
  const parallelCounts = buildParallelMap(classItems);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_35px_rgba(0,0,0,0.28)] backdrop-blur-sm">
      <p className="mb-4 text-[10px] uppercase tracking-[0.18em] text-white/45">Schedule</p>

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <h3 className="text-xs font-medium text-white/70 mb-3 flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 text-blue-400" />
            Classes & Workshops
          </h3>
          <div className="space-y-2">
            {classItems.length > 0 ? (
              classItems.map((item, idx) => {
                const key = formatTime(item.startTime);
                const isParallel = key ? (parallelCounts.get(key) ?? 0) > 1 : false;
                return (
                  <FestivalRankCard
                    key={`${effectiveSelectedDay}-class-${idx}`}
                    item={item}
                    highlightParallel={isParallel}
                  />
                );
              })
            ) : (
              <p className="text-xs text-white/40 italic">No classes scheduled</p>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-medium text-white/70 mb-3 flex items-center gap-2">
            <Music className="h-3.5 w-3.5 text-pink-400" />
            Parties
          </h3>
          <div className="space-y-2">
            {partyItems.length > 0 ? (
              partyItems.map((item, idx) => (
                <FestivalPartyCard key={`${effectiveSelectedDay}-party-${idx}`} item={item} />
              ))
            ) : (
              <p className="text-xs text-white/40 italic">No parties scheduled</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
