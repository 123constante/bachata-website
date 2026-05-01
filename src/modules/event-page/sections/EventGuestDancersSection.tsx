import type { EventPageModel, EventPagePerson } from '@/modules/event-page/types';
import { PersonChip } from '@/modules/event-page/bento/blocks/schedule/PersonChip';
import type { Person } from '@/modules/event-page/sections/EventScheduleGrid';

type EventGuestDancersSectionProps = {
  guestDancers: EventPageModel['guestDancers'];
  /** F.1.a Phase 4 rollout â€” forwarded to emitProfileView for click attribution. */
  eventId: string | null;
};

const adaptPerson = (p: EventPagePerson): Person => ({
  id: p.id,
  name: p.displayName ?? '',
  href: p.href ?? null,
  avatarUrl: p.avatarUrl ?? null,
  role: '',
  profileType: 'dancer',
  level: null,
});

export const EventGuestDancersSection = ({ guestDancers, eventId }: EventGuestDancersSectionProps) => {
  if (!guestDancers.items.length) return null;

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <p className="mb-3 text-[13px] font-medium text-white/55">Guest dancers</p>
      <div className="flex flex-wrap gap-x-2 gap-y-3.5">
        {guestDancers.items.map((p) => (
          <PersonChip
            key={p.id}
            person={adaptPerson(p)}
            size="lg"
            layout="stacked"
            context="event:guest-dancers"
            eventId={eventId}
          />
        ))}
      </div>
    </section>
  );
};
