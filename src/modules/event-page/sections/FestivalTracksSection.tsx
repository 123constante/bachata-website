import type { FestivalTrack } from '@/modules/event-page/types';

type FestivalTracksSectionProps = {
  tracks: FestivalTrack[];
};

export const FestivalTracksSection = ({ tracks }: FestivalTracksSectionProps) => {
  if (tracks.length === 0) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_35px_rgba(0,0,0,0.28)] backdrop-blur-sm">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">Tracks</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {tracks.map((track) => (
          <span
            key={track.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: track.color }}
            />
            <span className="text-xs text-white/80">{track.name}</span>
          </span>
        ))}
      </div>
    </section>
  );
};
