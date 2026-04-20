import { Link } from 'react-router-dom';
import type { FestivalArtist, FestivalDetail } from '@/modules/event-page/types';

type FestivalLineupSectionProps = {
  lineup: FestivalDetail['lineup'];
};

type RoleKey = keyof FestivalDetail['lineup'];

const roleMeta: Array<{ key: RoleKey; label: string; tint: string }> = [
  { key: 'teachers', label: 'Teachers', tint: 'bg-blue-500/5' },
  { key: 'djs', label: 'DJs', tint: 'bg-purple-500/5' },
  { key: 'mcs', label: 'MCs', tint: 'bg-amber-500/5' },
  { key: 'performers', label: 'Performers', tint: 'bg-pink-500/5' },
  { key: 'videographers', label: 'Videographers', tint: 'bg-white/5' },
  { key: 'vendors', label: 'Vendors', tint: 'bg-emerald-500/5' },
];

const ArtistCard = ({ artist }: { artist: FestivalArtist }) => {
  const content = (
    <>
      <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-full bg-white/[0.06]">
        {artist.avatarUrl ? (
          <img src={artist.avatarUrl} alt={artist.displayName ?? undefined} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/70">
            {(artist.displayName || '').trim().charAt(0) || '•'}
          </div>
        )}
      </div>
      <p className="w-full line-clamp-2 text-center text-xs leading-normal text-white/85">{artist.displayName}</p>
    </>
  );
  if (artist.href) {
    return (
      <Link to={artist.href} className="flex w-16 flex-col items-center gap-1.5 rounded-xl p-1 hover:bg-white/[0.06] transition-colors focus-visible:outline-none">
        {content}
      </Link>
    );
  }
  return <div className="flex w-16 flex-col items-center gap-1.5 p-1">{content}</div>;
};

export const FestivalLineupSection = ({ lineup }: FestivalLineupSectionProps) => {
  const groups = roleMeta.filter(({ key }) => lineup[key].length > 0);
  if (groups.length === 0) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_35px_rgba(0,0,0,0.28)] backdrop-blur-sm">
      <p className="mb-3 text-[10px] uppercase tracking-[0.18em] text-white/45">Lineup</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {groups.map(({ key, label, tint }) => (
          <div key={key} className={`rounded-2xl border border-white/10 p-3 ${tint}`}>
            <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/45">{label}</p>
            <div className="flex flex-wrap gap-2">
              {lineup[key].map((artist) => (
                <ArtistCard key={artist.id} artist={artist} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
