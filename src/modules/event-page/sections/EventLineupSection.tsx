import { Link } from 'react-router-dom';
import type { EventPageModel, EventPagePerson } from '@/modules/event-page/types';

type EventLineupSectionProps = {
  lineup: EventPageModel['lineup'];
};

type RoleKey = EventPageModel['lineup']['groups'][number]['key'];

const ROLE_COLORS: Record<RoleKey, { bg: string; text: string }> = {
  teachers: { bg: '#534AB7', text: '#EEEDFE' },
  djs: { bg: '#D85A30', text: '#FAECE7' },
  vendors: { bg: '#FFA500', text: '#4A1B0C' },
  videographers: { bg: '#185FA5', text: '#E6F1FB' },
};

const LineupPerson = ({ person, groupKey }: { person: EventPagePerson; groupKey: RoleKey }) => {
  const colors = ROLE_COLORS[groupKey];
  const initial = (person.displayName ?? '').trim().charAt(0).toUpperCase() || '•';

  const avatarNode = (
    <div
      className="h-[52px] w-[52px] overflow-hidden rounded-full"
      style={{ backgroundColor: colors.bg }}
    >
      {person.avatarUrl ? (
        <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center text-[18px] font-semibold"
          style={{ color: colors.text }}
          aria-hidden
        >
          {initial}
        </span>
      )}
    </div>
  );

  const nameNode = (
    <span className="mt-1 block w-full truncate text-center text-[12px] font-medium text-white">
      {person.displayName}
    </span>
  );

  if (person.href) {
    return (
      <Link to={person.href} className="flex min-w-0 flex-col items-center">
        {avatarNode}
        {nameNode}
      </Link>
    );
  }
  return (
    <div className="flex min-w-0 flex-col items-center">
      {avatarNode}
      {nameNode}
    </div>
  );
};

export const EventLineupSection = ({ lineup }: EventLineupSectionProps) => {
  if (!lineup.hasAny) return null;

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className="space-y-5">
        {lineup.groups.map((group) => (
          <div key={group.key}>
            <p className="mb-3 text-[13px] font-medium text-white/55">{group.label}</p>
            <div className="grid grid-cols-3 gap-x-2 gap-y-3.5">
              {group.items.map((p) => (
                <LineupPerson key={`${group.key}-${p.id}`} person={p} groupKey={group.key} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
