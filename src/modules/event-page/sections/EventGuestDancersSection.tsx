import { Link } from 'react-router-dom';
import type { EventPageModel } from '@/modules/event-page/types';

type EventGuestDancersSectionProps = {
  guestDancers: EventPageModel['guestDancers'];
};

export const EventGuestDancersSection = ({ guestDancers }: EventGuestDancersSectionProps) => {
  if (!guestDancers.isVisible) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_35px_rgba(0,0,0,0.28)] backdrop-blur-sm">
      <p className="mb-3 text-[10px] uppercase tracking-[0.18em] text-white/45">Guest Dancers</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {guestDancers.items.map((person) => {
          const content = (
            <>
              <div className="h-14 w-14 overflow-hidden rounded-full bg-white/[0.06]">
                {person.avatarUrl ? (
                  <img src={person.avatarUrl} alt={person.displayName ?? undefined} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-white/70">
                    {(person.displayName || '').trim().charAt(0) || '•'}
                  </div>
                )}
              </div>
              <p className="line-clamp-2 text-center text-xs leading-tight text-white/85">{person.displayName}</p>
            </>
          );

          return person.href ? (
            <Link key={person.id} to={person.href} className="flex flex-col items-center gap-1 p-1">
              {content}
            </Link>
          ) : (
            <div key={person.id} className="flex flex-col items-center gap-1 p-1">
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
};