import type { EventPageModel, EventPagePerson } from '@/modules/event-page/types';
import { PersonChip } from '@/modules/event-page/bento/blocks/schedule/PersonChip';
import type { Person } from '@/modules/event-page/sections/EventScheduleGrid';

type EventLineupSectionProps = {
  lineup: EventPageModel['lineup'];
  /** F.1.a Phase 4 rollout — forwarded to emitProfileView for click attribution. */
  eventId: string | null;
};

type RoleKey = EventPageModel['lineup']['groups'][number]['key'];

// Map the lineup group key onto the profile_type the click-telemetry RPC
// expects. Anything else collapses to 'unknown' inside emitProfileView.
const PROFILE_TYPE_FOR_GROUP: Record<RoleKey, string> = {
  teachers: 'teacher',
  djs: 'dj',
  vendors: 'vendor',
  videographers: 'videographer',
};

const adaptPerson = (p: EventPagePerson, groupKey: RoleKey): Person => ({
  id: p.id,
  name: p.displayName ?? '',
  href: p.href ?? null,
  avatarUrl: p.avatarUrl ?? null,
  role: '',
  profileType: PROFILE_TYPE_FOR_GROUP[groupKey] ?? null,
  level: null,
});

export const EventLineupSection = ({ lineup, eventId }: EventLineupSectionProps) => {
  if (!lineup.hasAny) return null;

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className="space-y-5">
        {lineup.groups.map((group) => (
          <div key={group.key}>
            <p className="mb-3 text-[13px] font-medium text-white/55">{group.label}</p>
            <div className="flex flex-wrap gap-x-2 gap-y-3.5">
              {group.items.map((p) => (
                <PersonChip
                  key={`${group.key}-${p.id}`}
                  person={adaptPerson(p, group.key)}
                  size="lg"
                  layout="stacked"
                  context={`lineup:${group.key}`}
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
