import { Heart, Share2, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { EventPageModel } from '@/modules/event-page/types';
import type { RsvpStatus } from '@/modules/event-page/useEventPageRsvpMutation';

const GOLD = '#FFA500';
const GOLD_INK = '#4A1B0C';

type Props = {
  attendance: EventPageModel['attendance'];
  identity: EventPageModel['identity'];
  schedule: EventPageModel['schedule'];
  location: EventPageModel['location'];
  isPending: boolean;
  isCancelled: boolean;
  setRsvp: (status: RsvpStatus) => Promise<RsvpStatus>;
};

export const EventActionBar = ({
  attendance,
  identity,
  schedule,
  location,
  isPending,
  isCancelled,
  setRsvp,
}: Props) => {
  const current = isCancelled ? null : attendance.currentUserStatus;
  const isGoing = current === 'going';
  const isInterested = current === 'interested';
  const rsvpDisabled = !attendance.canToggle || isPending || isCancelled;

  const handleGoing = () => {
    void setRsvp(isGoing ? null : 'going').catch(() => {
      toast({ title: 'Could not update attendance', variant: 'destructive' });
    });
  };

  const handleInterested = () => {
    void setRsvp(isInterested ? null : 'interested').catch(() => {
      toast({ title: 'Could not update attendance', variant: 'destructive' });
    });
  };

  const handleShare = async () => {
    const url = window.location.href;
    const subtitle =
      schedule.dateLabel && location.venueName
        ? `${schedule.dateLabel} at ${location.venueName}`
        : schedule.dateLabel ?? location.venueName ?? null;
    const text = [identity.title, subtitle, url].filter(Boolean).join('\n');

    if (navigator.share) {
      try {
        await navigator.share({
          title: identity.title,
          text: subtitle ?? undefined,
          url,
        });
        return;
      } catch {
        // User cancelled or share failed — fall through
      }
    }
    if (navigator?.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        toast({ title: 'Link copied to clipboard' });
        return;
      } catch {
        // fall through to WhatsApp
      }
    }
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const baseBtn =
    'flex h-10 items-center justify-center gap-1.5 rounded-full text-[13px] font-medium disabled:cursor-not-allowed';
  const outlinedBtn = 'border-[0.5px] border-white/25 bg-white text-black/85';
  const pendingDim = isPending ? 'opacity-70' : '';

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <div className="grid grid-cols-3 gap-2">
        {/* Going */}
        <button
          type="button"
          onClick={handleGoing}
          disabled={rsvpDisabled}
          className={`${baseBtn} ${pendingDim}`}
          style={{ backgroundColor: GOLD, color: GOLD_INK }}
        >
          {isGoing && <Check className="h-3.5 w-3.5" />}
          Going
        </button>

        {/* Interested */}
        <button
          type="button"
          onClick={handleInterested}
          disabled={rsvpDisabled}
          className={`${baseBtn} ${outlinedBtn} ${pendingDim}`}
        >
          <Heart
            className="h-3.5 w-3.5"
            fill={isInterested ? GOLD : 'none'}
            style={isInterested ? { color: GOLD } : undefined}
          />
          Interested
        </button>

        {/* Share */}
        <button
          type="button"
          onClick={handleShare}
          className={`${baseBtn} ${outlinedBtn}`}
        >
          <Share2 className="h-3.5 w-3.5" />
          Share
        </button>
      </div>
    </section>
  );
};
