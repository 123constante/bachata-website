import type { FestivalArtist, FestivalDetail } from '@/modules/event-page/types';
import { PersonChip } from '@/modules/event-page/bento/blocks/schedule/PersonChip';
import type { Person } from '@/modules/event-page/sections/EventScheduleGrid';

type FestivalLineupSectionProps = {
  lineup: FestivalDetail['lineup'];
  /** F.1.a Phase 4 rollout â€” forwarded to emitProfileView for click attribution. */
  eventId: string | null;
};

type RoleKey = keyof FestivalDetail['lineup'];

const roleMeta: Array<{ key: RoleKey; label: string; tint: string; profileType: string }> = [
  { key: 'teachers',      label: 'Teachers',      tint: 'bg-blue-500/5',    profileType: 'teacher' },
  { key: 'djs',           label: 'DJs',           tint: 'bg-purple-500/5',  profileType: 'dj' },
  { key: 'mcs',           label: 'MCs',           tint: 'bg-amber-500/5',   profileType: 'unknown' },
  { key: 'performers',    label: 'Performers',    tint: 'bg-pink-500/5',    profileType: 'dancer' },
  { key: 'videographers', label: 'Videographers', tint: 'bg-white/5',       profileType: 'videographer' },
  { key: 'vendors',       label: 'Vendors',       tint: 'bg-emerald-500/5', profileType: 'vendor' },
];

const adaptPerson = (artist: FestivalArtist, profileType: string): Person => ({
  id: artist.id,
  name: artist.displayName ?? '',
  href: artist.href ?? null,
  avatarUrl: artist.avatarUrl ?? null,
  role: '',
  profileType,
  level: null,
});

export const FestivalLineupSection = ({ lineup, eventId }: FestivalLineupSectionProps) => {
  const groups = roleMeta.filter(({ key }) => lineup[key].length > 0);
  if (groups.length === 0) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_35px_rgba(0,0,0,0.28)] backdrop-blur-sm">
      <p className="mb-3 text-[10px] uppercase tracking-[0.18em] text-white/45">Lineup</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {groups.map(({ key, label, tint, profileType }) => (
          <div key={key} className={`rounded-2xl border border-white/10 p-3 ${tint}`}>
            <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/45">{label}</p>
            <div className="flex flex-wrap gap-2">
              {lineup[key].map((artist) => (
                <PersonChip
                  key={artist.id}
                  person={adaptPerson(artist, profileType)}
                  size="lg"
                  layout="stacked"
                  context={`festival-lineup:${key}`}
                  eventId={eventId}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
