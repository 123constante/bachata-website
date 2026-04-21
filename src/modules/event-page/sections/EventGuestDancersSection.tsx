import { Link } from 'react-router-dom';
import type { EventPageModel, EventPagePerson } from '@/modules/event-page/types';

type EventGuestDancersSectionProps = {
  guestDancers: EventPageModel['guestDancers'];
};

const PINK = { bg: '#993556', text: '#FBEAF0' };

const DancerCell = ({ person }: { person: EventPagePerson }) => {
  const initial = (person.displayName ?? '').trim().charAt(0).toUpperCase() || '•';

  const avatar = (
    <div
      className="h-[52px] w-[52px] overflow-hidden rounded-full"
      style={{ backgroundColor: PINK.bg }}
    >
      {person.avatarUrl ? (
        <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center text-[18px] font-semibold"
          style={{ color: PINK.text }}
          aria-hidden
        >
          {initial}
        </span>
      )}
    </div>
  );

  const name = (
    <span className="mt-1 block w-full truncate text-center text-[12px] font-medium text-white">
      {person.displayName}
    </span>
  );

  if (person.href) {
    return (
      <Link to={person.href} className="flex min-w-0 flex-col items-center">
        {avatar}
        {name}
      </Link>
    );
  }
  return (
    <div className="flex min-w-0 flex-col items-center">
      {avatar}
      {name}
    </div>
  );
};

export const EventGuestDancersSection = ({ guestDancers }: EventGuestDancersSectionProps) => {
  if (!guestDancers.items.length) return null;

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <p className="mb-3 text-[13px] font-medium text-white/55">Guest dancers</p>
      <div className="grid grid-cols-3 gap-x-2 gap-y-3.5">
        {guestDancers.items.map((p) => (
          <DancerCell key={p.id} person={p} />
        ))}
      </div>
    </section>
  );
};
