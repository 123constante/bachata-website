import { Link } from 'react-router-dom';
import type { EventPageModel, EventPagePerson } from '@/modules/event-page/types';

type EventLineupSectionProps = {
  lineup: EventPageModel['lineup'];
};

const tintClassMap: Record<EventPageModel['lineup']['groups'][number]['key'], string> = {
  teachers: 'bg-blue-500/5',
  djs: 'bg-purple-500/5',
  videographers: 'bg-white/5',
  vendors: 'bg-emerald-500/5',
};

const LineupPerson = ({ person }: { person: EventPagePerson }) => {
  const content = (
    <>
      <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-full bg-white/[0.06]">
        {person.avatarUrl ? (
          <img src={person.avatarUrl} alt={person.displayName ?? undefined} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/70">
            {(person.displayName || '').trim().charAt(0) || '•'}
          </div>
        )}
      </div>
      <p className="w-full line-clamp-2 text-center text-xs leading-normal text-white/85">{person.displayName}</p>
    </>
  );

  if (person.href) {
    return (
      <Link to={person.href} className="flex w-16 flex-col items-center gap-1.5 rounded-xl p-1 hover:bg-white/[0.06] transition-colors focus-visible:outline-none">
        {content}
      </Link>
    );
  }

  return <div className="flex w-16 flex-col items-center gap-1.5 p-1">{content}</div>;
};

export const EventLineupSection = ({ lineup }: EventLineupSectionProps) => {
  if (!lineup.hasAny) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_35px_rgba(0,0,0,0.28)] backdrop-blur-sm">
      <p className="mb-3 text-[10px] uppercase tracking-[0.18em] text-white/45">Lineup</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {lineup.groups.map((group) => (
          <div key={group.key} className={`rounded-2xl border border-white/10 p-3 ${tintClassMap[group.key]}`}>
            <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/45">{group.label}</p>
            <div className="flex flex-wrap gap-2">
              {group.items.map((person) => (
                <LineupPerson key={`${group.key}-${person.id}`} person={person} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
