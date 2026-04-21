import type { EventPageModel, EventPagePerson } from '@/modules/event-page/types';

type EventAttendanceSectionProps = {
  attendance: EventPageModel['attendance'];
};

const AVATAR_PALETTE: Array<{ bg: string; text: string }> = [
  { bg: '#534AB7', text: '#EEEDFE' }, // purple
  { bg: '#D85A30', text: '#FAECE7' }, // coral
  { bg: '#1D9E75', text: '#E1F5EE' }, // teal
  { bg: '#185FA5', text: '#E6F1FB' }, // blue
  { bg: '#993556', text: '#FBEAF0' }, // pink
];

const AvatarCell = ({
  person,
  index,
  isFirst,
}: {
  person: EventPagePerson;
  index: number;
  isFirst: boolean;
}) => {
  const palette = AVATAR_PALETTE[index % AVATAR_PALETTE.length];
  const initial = (person.displayName ?? '').trim().charAt(0).toUpperCase() || '•';
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{
        backgroundColor: palette.bg,
        border: '2px solid hsl(var(--background))',
        marginLeft: isFirst ? 0 : -10,
        zIndex: index + 1,
      }}
    >
      {person.avatarUrl ? (
        <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span
          className="text-[12px] font-semibold"
          style={{ color: palette.text }}
          aria-hidden
        >
          {initial}
        </span>
      )}
    </div>
  );
};

export const EventAttendanceSection = ({ attendance }: EventAttendanceSectionProps) => {
  const { goingCount, interestedCount, preview } = attendance;

  if (goingCount === 0 && interestedCount === 0) return null;

  const visibleAvatars = preview.slice(0, 5);
  const visibleCount = visibleAvatars.length;
  const overflow = goingCount > 5 ? goingCount - visibleCount : 0;
  const showGoing = goingCount > 0;
  const showInterested = interestedCount > 0;

  return (
    <section className="rounded-lg border-[0.5px] border-white/15 bg-white/[0.04] p-[14px]">
      <p className="text-[14px] text-white/85">
        {showGoing && (
          <>
            <span className="font-medium text-white">{goingCount}</span>
            {' going'}
          </>
        )}
        {showGoing && showInterested && (
          <span className="mx-[6px] text-white/45" aria-hidden>·</span>
        )}
        {showInterested && (
          <>
            <span className="font-medium text-white">{interestedCount}</span>
            {' interested'}
          </>
        )}
      </p>

      {visibleCount > 0 && (
        <div className="mt-[10px] flex items-center">
          {visibleAvatars.map((person, i) => (
            <AvatarCell key={person.id} person={person} index={i} isFirst={i === 0} />
          ))}
          {overflow > 0 && (
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[12px] font-medium text-white/80"
              style={{
                border: '2px solid hsl(var(--background))',
                marginLeft: visibleCount === 0 ? 0 : -10,
                zIndex: visibleCount + 1,
              }}
            >
              +{overflow}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
