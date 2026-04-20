import { Link } from 'react-router-dom';
import type { EventPageModel } from '@/modules/event-page/types';

type EventOrganiserSectionProps = {
  organiser: EventPageModel['organiser'];
};

export const EventOrganiserSection = ({ organiser }: EventOrganiserSectionProps) => {
  if (!organiser.isVisible || !organiser.person) return null;

  const content = (
    <>
      <div className="h-16 w-16 overflow-hidden rounded-full bg-white/[0.06]">
        {organiser.person.avatarUrl ? (
          <img src={organiser.person.avatarUrl} alt={organiser.person.displayName ?? undefined} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/70">
            {(organiser.person.displayName || '').trim().charAt(0) || '•'}
          </div>
        )}
      </div>

      <p className="line-clamp-2 text-center text-sm leading-normal text-white/85">{organiser.person.displayName}</p>
    </>
  );

  return (
    <section className="rounded-2xl border border-orange-300/20 bg-orange-500/10 p-4 shadow-[0_10px_35px_rgba(0,0,0,0.28)] backdrop-blur-sm">
      <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/45">Organiser</p>
      {organiser.person.href ? (
        <Link to={organiser.person.href} className="flex flex-col items-center gap-2 p-1">
          {content}
        </Link>
      ) : (
        <div className="flex flex-col items-center gap-2 p-1">{content}</div>
      )}
    </section>
  );
};
