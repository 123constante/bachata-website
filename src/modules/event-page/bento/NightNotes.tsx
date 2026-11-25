import { publicCancelReason } from '@/lib/cancelLabel';
import type { NextNight } from '@/modules/event-page/bento/nextPublicNight';

const PILL_STYLE = {
  background: '#f5a623',
  color: '#1a1208',
  fontWeight: 800,
} as const;

const NextNightButton = ({ next }: { next: NextNight }) => (
  <a
    href={next.href}
    data-testid="night-notes-next"
    className="block w-full rounded-full px-4 py-3 text-center text-sm no-underline"
    style={PILL_STYLE}
  >
    Go to the next night, {next.dateLabel}
  </a>
);

type FinishedProps = { dateLabel: string | null; next: NextNight | null };

/** Card for a finished night. Replaces the grey "This event has ended." strip. */
export const FinishedNightCard = ({ dateLabel, next }: FinishedProps) => (
  <div
    data-testid="night-notes-finished"
    className="mb-3 rounded-xl px-3 py-3 text-center"
    style={{ background: '#24352c', border: '1.5px solid #5d7a6a', color: '#fff' }}
  >
    <div className="text-[15px] font-bold">This night has finished</div>
    {dateLabel && <div className="mb-2 mt-0.5 text-[12px] opacity-90">{dateLabel}</div>}
    {next && <NextNightButton next={next} />}
  </div>
);

type CancelledProps = { reasonLabel?: string | null; next: NextNight | null };

/** Content of the sticky red bar for a cancelled night (future or past). */
export const CancelledNightBar = ({ reasonLabel, next }: CancelledProps) => {
  const reason = publicCancelReason(reasonLabel);
  return (
    <div
      data-testid="night-notes-cancelled"
      role="status"
      aria-live="polite"
      className="w-full border-b-2 border-red-900 px-4 py-2.5 text-white shadow-lg"
      style={{ background: 'linear-gradient(180deg, #dc2626 0%, #991b1b 100%)' }}
    >
      <div className="mx-auto max-w-[430px] text-center">
        <div className="text-[13px] font-bold leading-tight">This night is cancelled</div>
        {next && (
          <div className="mt-2">
            <NextNightButton next={next} />
          </div>
        )}
        {reason && <div className="mt-2 text-[11px] leading-tight opacity-90">{reason}</div>}
      </div>
    </div>
  );
};
