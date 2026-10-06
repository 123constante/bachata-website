import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Check, Heart, Users } from 'lucide-react';
import { toast } from 'sonner';
import { AuthPromptModal } from '@/components/AuthPromptModal';
import { wallClockToInstant } from '@/lib/time/wallClock';
import type { EventPageSnapshotOccurrence } from '@/modules/event-page/types';
import {
  rsvpErrorMessage,
  useOccurrenceRsvp,
  type RsvpStatus,
} from '@/modules/event-page/hooks/useOccurrenceRsvp';

type RsvpBlockProps = {
  /** Route param the snapshot query is keyed by (for cache updates). */
  pageEventId: string | null;
  /** snapshot.eventId -- event_series_p5.public_event_id. */
  publicEventId: string | null;
  /** snapshot.occurrenceId -- the P5 night this page is showing. */
  occurrenceId: string | null;
  occurrence: EventPageSnapshotOccurrence | null;
  /** snapshot.event.lifecycleStatus -- only 'live' takes RSVPs. */
  seriesLifecycle: string | null;
  /** pageModel.attendance.goingCountLabel, e.g. "4 going". */
  goingCountLabel: string;
};

/**
 * Same end rule the RPC applies: COALESCE(end, start) as a naive LONDON wall
 * clock against London now -- so London, not occurrence.timezone, and no grace.
 * That is why this is not isPast(), which converts through the occurrence tz and
 * flips 6h later.
 */
const nightHasEnded = (occurrence: EventPageSnapshotOccurrence | null, now: number): boolean => {
  const anchor = occurrence?.endsAt ?? occurrence?.startsAt;
  if (!anchor) return false;
  const t = wallClockToInstant(anchor, 'Europe/London');
  return t ? t.getTime() <= now : false;
};

const closedReason = (
  seriesLifecycle: string | null,
  occurrence: EventPageSnapshotOccurrence | null,
  hasEnded: boolean,
): string | null => {
  if (seriesLifecycle !== 'live') return 'RSVPs are closed for this event';
  if (occurrence?.isCancelled) return 'This night is cancelled';
  if (hasEnded) return 'This night has ended';
  return null;
};

const GOING_STYLE: React.CSSProperties = {
  background: 'linear-gradient(180deg, #FFD64B, #FFB200)',
  color: '#3A2603',
};
const GHOST_STYLE: React.CSSProperties = {
  background: 'hsl(var(--bento-surface-raised))',
  color: 'hsl(var(--bento-fg))',
  border: '1px solid hsl(var(--bento-fg-muted) / 0.25)',
};
const BTN =
  'flex h-10 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-50';

/**
 * "I'm Going" / "Interested" for the night on screen. Tap sets, tap again
 * clears. Signed-out and anonymous visitors see the same buttons, but a tap
 * opens the site's sign-in prompt and never reaches the RPC.
 */
export const RsvpBlock = ({
  pageEventId,
  publicEventId,
  occurrenceId,
  occurrence,
  seriesLifecycle,
  goingCountLabel,
}: RsvpBlockProps) => {
  const location = useLocation();
  const [authOpen, setAuthOpen] = useState(false);
  // First render reads the snapshot's server-computed isPast so SSR (possibly an
  // hour-old edge copy) and hydration agree; the clock is consulted after mount
  // (same split as BentoPage's `past`) and again on every tap, so a page left
  // open past the end of the night greys out instead of toasting forever.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), [occurrence]);
  const hasEnded = Boolean(occurrence?.isPast) || (now !== null && nightHasEnded(occurrence, now));
  const reason = closedReason(seriesLifecycle, occurrence, hasEnded);
  // The read still runs on a closed night, so an RSVP made before the night was
  // cancelled or ended keeps showing; only the write is blocked.
  const { status, statusUnknown, statusError, refetchStatus, canRsvp, authLoading, setStatus, isPending } =
    useOccurrenceRsvp({
      publicEventId,
      occurrenceId,
      pageEventId,
      enabled: now !== null,
    });

  if (!publicEventId || !occurrenceId) return null;

  const isGoing = status === 'going';
  const isInterested = status === 'interested';

  const onTap = async (target: RsvpStatus) => {
    if (reason || now === null || isPending || authLoading) return;
    if (nightHasEnded(occurrence, Date.now())) {
      setNow(Date.now());
      return;
    }
    if (!canRsvp) {
      setAuthOpen(true);
      return;
    }
    if (statusUnknown) {
      if (statusError) {
        toast.error("Couldn't load your RSVP. Please try again.");
        void refetchStatus();
      }
      return;
    }
    try {
      await setStatus(status === target ? null : target);
    } catch (e) {
      toast.error(rsvpErrorMessage(e));
    }
  };

  return (
    <section
      className="mt-3 rounded-[18px] border p-3"
      style={{ background: 'hsl(var(--bento-surface-raised))', borderColor: 'var(--bento-hairline)' }}
      aria-label="RSVP for this night"
      aria-busy={(statusUnknown && !statusError) || isPending}
      data-testid="rsvp-block"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void onTap('going')}
          disabled={reason !== null}
          aria-pressed={isGoing}
          className={`${BTN} flex-1`}
          style={reason ? GHOST_STYLE : GOING_STYLE}
          data-testid="rsvp-going"
        >
          {isGoing ? <Check className="h-4 w-4" strokeWidth={2.4} /> : <Users className="h-4 w-4" />}
          {isGoing ? "You're Going" : "I'm Going"}
        </button>
        <button
          type="button"
          onClick={() => void onTap('interested')}
          disabled={reason !== null}
          aria-pressed={isInterested}
          className={BTN}
          style={GHOST_STYLE}
          data-testid="rsvp-interested"
        >
          <Heart className="h-4 w-4" fill={isInterested ? 'currentColor' : 'none'} />
          Interested
        </button>
      </div>
      <p className="mt-2 text-[12px]" style={{ color: 'hsl(var(--bento-fg-muted))' }} data-testid="rsvp-meta">
        {reason ?? goingCountLabel}
      </p>
      <AuthPromptModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        title="Sign in to RSVP"
        description="Sign in to let the organiser know you're going."
        returnTo={`${location.pathname}${location.search}`}
      />
    </section>
  );
};
