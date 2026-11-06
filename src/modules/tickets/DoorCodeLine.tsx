import { DOOR_CODE_LABEL } from './myTicketsModel';

/**
 * The short door code under a ticket's QR (My tickets and the thank-you page share this one
 * line). Plain text, not tappable. Checked in = greyed and says so. `code` is already grouped by
 * formatShortCode; the caller renders nothing at all when there is no code.
 */
export default function DoorCodeLine({ code, checkedIn, testId }: { code: string; checkedIn: boolean; testId: string }) {
  return (
    <p
      className="mt-2 flex flex-wrap items-baseline gap-x-2 text-[13px]"
      style={{ color: checkedIn ? 'hsl(var(--bento-fg-muted))' : 'hsl(var(--bento-fg))', opacity: checkedIn ? 0.7 : 1 }}
      data-testid={testId}
      data-checked-in={checkedIn ? 'true' : 'false'}
    >
      <span>{DOOR_CODE_LABEL}</span>
      <span
        className="font-mono text-[18px] font-semibold tracking-[0.08em]"
        translate="no"
        aria-label={code.replace(/ /g, '').split('').join(' ')}
        data-testid="door-code-value"
      >
        {code}
      </span>
      {checkedIn && <span className="text-[12px]">Checked in</span>}
    </p>
  );
}
