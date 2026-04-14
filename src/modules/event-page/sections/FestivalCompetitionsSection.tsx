import { Trophy, Clock, DollarSign } from 'lucide-react';
import type { FestivalCompetition, FestivalArtist } from '@/modules/event-page/types';

type FestivalCompetitionsSectionProps = {
  competitions: FestivalCompetition[];
};

const JudgeAvatar = ({ judge }: { judge: FestivalArtist }) => (
  <div className="group/judge relative flex flex-col items-center">
    <div className="h-8 w-8 overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/10">
      {judge.avatarUrl ? (
        <img src={judge.avatarUrl} alt={judge.displayName ?? undefined} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] text-white/60">
          {(judge.displayName || '').trim().charAt(0) || '•'}
        </div>
      )}
    </div>
    <span className="mt-0.5 max-w-[4rem] truncate text-center text-[10px] leading-tight text-white/55">
      {judge.displayName}
    </span>
  </div>
);

export const FestivalCompetitionsSection = ({ competitions }: FestivalCompetitionsSectionProps) => {
  if (!competitions.length) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_35px_rgba(0,0,0,0.28)] backdrop-blur-sm">
      <p className="mb-3 text-[10px] uppercase tracking-[0.18em] text-white/45">Competitions</p>
      <div className="flex flex-col gap-3">
        {competitions.map((comp) => (
          <div
            key={comp.id}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-400" />
                <p className="text-sm font-medium text-white/90">{comp.name}</p>
              </div>
              {comp.isQualifier && (
                <span className="flex-none rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-400">
                  Qualifier
                </span>
              )}
            </div>

            {comp.day && (
              <p className="mt-1 text-xs text-white/55">{comp.day}</p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/60">
              {comp.qualifiersTime && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Qualifiers: {comp.qualifiersTime}
                </span>
              )}
              {comp.finalsTime && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Finals: {comp.finalsTime}
                </span>
              )}
              {comp.entryFee && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> {comp.entryFee}
                </span>
              )}
            </div>

            {comp.prizeDescription && (
              <p className="mt-1.5 text-xs text-amber-400/70">{comp.prizeDescription}</p>
            )}

            {comp.judges.length > 0 && (
              <div className="mt-3">
                <p className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-white/40">Judges</p>
                <div className="flex flex-wrap gap-2">
                  {comp.judges.map((judge) => (
                    <JudgeAvatar key={judge.id} judge={judge} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
