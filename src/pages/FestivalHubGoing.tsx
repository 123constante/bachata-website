import {
  GOING_COPY,
  GoingButton,
  GoingPeople,
  goingNightStatus,
  useNightGoing,
  type GoingTheme,
} from '@/modules/going';
import type { FestivalNight } from '@/pages/festivalHubNights';

// The going colours on the hub: its own existing shadcn tokens (src/index.css), no new colours.
const HUB_GOING_THEME: GoingTheme = {
  fg: 'hsl(var(--foreground))',
  muted: 'hsl(var(--muted-foreground))',
  surface: 'hsl(var(--card))',
  hairline: 'hsl(var(--border))',
  accent: 'hsl(var(--primary))',
  primary: { background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', border: '1px solid transparent' },
  on: {
    background: 'hsl(var(--primary) / 0.12)',
    color: 'hsl(var(--foreground))',
    border: '1px solid hsl(var(--primary) / 0.6)',
  },
  ghost: {
    background: 'hsl(var(--muted))',
    color: 'hsl(var(--muted-foreground))',
    border: '1px solid hsl(var(--border))',
  },
  face: {
    background: 'hsl(var(--muted))',
    color: 'hsl(var(--foreground))',
    border: '2px solid hsl(var(--card))',
  },
};

export type FestivalGoingProps = {
  festivalId: string;
  night: FestivalNight | null | undefined;
  nightFailed: boolean;
  onRetryNight: () => void;
  /** Every P5 night id on the hub: ONE get_nights_going_v1 request for all cards. */
  batchIds: readonly string[];
  /** Hold the going read until every card knows its night (so the batch is asked once). */
  ready: boolean;
  /** null until mounted (server render and hydration agree: nothing is "ended"). */
  now: Date | null;
  onSignIn: () => void;
};

/**
 * One festival card's going: the count, up to 8 people and the "I'm going"
 * button for its ONE night. Words, rules and states are the going module's.
 */
export const FestivalGoing = ({ festivalId, night, nightFailed, onRetryNight, batchIds, ready, now, onSignIn }: FestivalGoingProps) => {
  const status = goingNightStatus(
    {
      startsAtLocal: night?.startsAtLocal ?? null,
      endsAtLocal: night?.endsAtLocal ?? null,
      isCancelled: Boolean(night?.isCancelled),
      eventLive: Boolean(night?.eventLive),
    },
    now,
  );
  const going = useNightGoing({
    occurrenceId: night?.occurrenceId ?? null,
    night: status,
    batchIds,
    enabled: ready && now !== null && Boolean(night),
  });
  const retry = (onRetry: () => void) => (
    <p className="mb-3 flex items-center gap-2 text-[12px] text-muted-foreground" data-testid="festival-going-error">
      {GOING_COPY.peopleLoadFailed}
      <button type="button" onClick={onRetry} className="min-h-[44px] px-2 font-semibold text-foreground underline">
        {GOING_COPY.retry}
      </button>
    </p>
  );
  // A festival with no visible night says nothing (never a made-up "0 going").
  if (nightFailed) return <div onClick={(e) => e.stopPropagation()}>{retry(onRetryNight)}</div>;
  if (!night) return null;
  return (
    // A tap anywhere in here must not open the festival card.
    <div className="mb-3" onClick={(e) => e.stopPropagation()} data-testid="festival-going" data-festival={festivalId} data-state={going.view.state}>
      <div className="mb-2 min-h-[20px]">
        {going.peopleError ? (
          retry(going.refetchPeople)
        ) : going.peopleLoading || !ready ? (
          <p className="text-[14px]" aria-hidden>&nbsp;</p>
        ) : (
          <GoingPeople
            count={going.count}
            peopleCount={going.peopleCount}
            people={going.people}
            past={status === 'ended'}
            theme={HUB_GOING_THEME}
            context="festival-hub:going"
            eventId={festivalId}
          />
        )}
      </div>
      <GoingButton view={going.view} onTap={going.tap} onSignIn={onSignIn} theme={HUB_GOING_THEME} testId="festival-going-button" />
    </div>
  );
};
