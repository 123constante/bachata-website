import { Suspense, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { GOING_CHECKIN_ENABLED } from '@/lib/goingCheckin';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import type { EventPageSnapshotOccurrence } from '@/modules/event-page/types';
// Inside this lazy chunk, never the event route chunk (see RsvpBlockPlaceholder).
import {
  BENTO_GOING_THEME,
  GOING_COPY,
  GoingButton,
  GoingPeople,
  goingNightStatus,
  nightLine,
  useNightGoing,
} from '@/modules/going';

// The title, box and night line are mirrored in RsvpBlockPlaceholder (the
// Suspense fallback): copied, not shared, because a shared module would split the
// event route chunk. rsvpBlock.test.tsx fails if the two drift apart.
export const TILE_TITLE_CLASS = 'mb-1.5 text-center text-[13px] font-bold uppercase tracking-[0.04em]';
export const TILE_BODY_CLASS = 'rounded-[18px] border p-3';
export const TILE_NIGHT_CLASS = 'text-[12px] font-bold uppercase tracking-[0.05em]';

// Lazy: the dialog stack only matters after a signed-out tap, and a static
// import added two first-load chunks to /event/:id (perf-budgets chunk ratchet).
const AuthPromptModal = lazyWithRetry(() =>
  import('@/components/AuthPromptModal').then((m) => ({ default: m.AuthPromptModal })),
);

type RsvpBlockProps = {
  /** snapshot.eventId -- event_series_p5.public_event_id (telemetry only). */
  publicEventId: string | null;
  /** snapshot.occurrenceId -- the P5 night this page is showing. Going is for this ONE night. */
  occurrenceId: string | null;
  occurrence: EventPageSnapshotOccurrence | null;
  /** snapshot.event.lifecycleStatus -- only 'live' takes names. */
  seriesLifecycle: string | null;
};

// The snapshot's starts/ends are naive London wall clocks: the going module reads
// the digits as stored (never `new Date()`), so the raw stamp is handed over.
const raw = (wc: unknown): string | null => (typeof wc === 'string' ? wc : null);

/**
 * Design A "Who's going" tile (Going P2): the night, the count and up to 8
 * people, and the one "I'm going" button. Every word, rule and state comes from
 * src/modules/going; this file only places them on the bento.
 */
const RsvpBlockInner = ({ publicEventId, occurrenceId, occurrence, seriesLifecycle }: RsvpBlockProps) => {
  const location = useLocation();
  const [authOpen, setAuthOpen] = useState(false);
  // Stays mounted after the first open so the dialog can animate closed.
  const [authMounted, setAuthMounted] = useState(false);
  // The clock is read after mount (server render and hydration agree on "not
  // ended"), and again on every tap, so a page left open past the end of the
  // night turns into "Who went" instead of offering a dead button.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), [occurrence]);

  const startsAt = raw(occurrence?.startsAt);
  const nightFacts = {
    startsAtLocal: startsAt,
    endsAtLocal: raw(occurrence?.endsAt),
    isCancelled: Boolean(occurrence?.isCancelled),
    eventLive: seriesLifecycle === 'live',
  };
  const night = goingNightStatus(nightFacts, now);
  const going = useNightGoing({ occurrenceId, night, enabled: now !== null });

  if (!occurrenceId) return null;

  const past = night === 'ended';
  // A night with no timed session (the TIME_TBC_LABEL case) shows the date alone.
  const line = nightLine(occurrence?.hasTimedSession === false ? startsAt?.slice(0, 10) : startsAt);

  const onTap = () => {
    if (goingNightStatus(nightFacts, new Date()) !== night) {
      setNow(new Date());
      return;
    }
    going.tap();
  };

  return (
    <section className="mt-3" aria-label={GOING_COPY.tileLabel} data-testid="rsvp-block" data-state={going.view.state}>
      <h2 className={TILE_TITLE_CLASS} style={{ color: BENTO_GOING_THEME.accent }}>
        {past ? GOING_COPY.tileTitlePast : GOING_COPY.tileTitle}
      </h2>
      <div
        className={TILE_BODY_CLASS}
        style={{ background: BENTO_GOING_THEME.surface, borderColor: BENTO_GOING_THEME.hairline }}
        aria-busy={going.peopleLoading || going.view.control.busy}
      >
        {line && (
          <p className={TILE_NIGHT_CLASS} style={{ color: BENTO_GOING_THEME.muted }} data-testid="rsvp-night">
            {line}
          </p>
        )}
        <div className="mt-2 min-h-[20px]">
          {going.peopleError ? (
            <p className="flex items-center gap-2 text-[12px]" style={{ color: BENTO_GOING_THEME.muted }} data-testid="rsvp-people-error">
              {GOING_COPY.peopleLoadFailed}
              <button
                type="button"
                onClick={going.refetchPeople}
                className="min-h-[44px] px-2 font-semibold underline"
                style={{ color: BENTO_GOING_THEME.fg }}
              >
                {GOING_COPY.retry}
              </button>
            </p>
          ) : going.peopleLoading ? (
            <p className="text-[14px]" style={{ color: BENTO_GOING_THEME.muted }} aria-hidden>
              &nbsp;
            </p>
          ) : (
            <GoingPeople
              count={going.count}
              peopleCount={going.peopleCount}
              people={going.people}
              past={past}
              context="event-page:going"
              eventId={publicEventId}
            />
          )}
        </div>
        <div className="mt-3">
          <GoingButton
            view={going.view}
            onTap={onTap}
            onSignIn={() => {
              setAuthMounted(true);
              setAuthOpen(true);
            }}
            testId="rsvp-going"
          />
        </div>
      </div>
      {authMounted && (
        <Suspense fallback={null}>
          <AuthPromptModal
            open={authOpen}
            onOpenChange={setAuthOpen}
            title={GOING_COPY.signInTitle}
            description={GOING_COPY.signInBody}
            returnTo={`${location.pathname}${location.search}`}
          />
        </Suspense>
      )}
    </section>
  );
};

/** Renders nothing (and runs no RPC) while GOING_CHECKIN_ENABLED is off. */
export const RsvpBlock = (props: RsvpBlockProps) =>
  GOING_CHECKIN_ENABLED ? <RsvpBlockInner {...props} /> : null;
