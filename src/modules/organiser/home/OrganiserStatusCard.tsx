import { useId } from 'react';
import { organiserStatus } from '@/modules/organiser/shared/organiserStatus';
import { selfServeErrorCopy } from '@/modules/organiser/shared/selfServeErrors';
import { useSendForReview } from '@/modules/organiser/shared/useSendForReview';
import type { HomeOrganiser } from '@/modules/organiser/shared/selfServeApi';
import { sendBlockers } from '../profile/reviewModel';
import { Card, GhostButton, PrimaryButton, StatusTag, useShake } from '../ui';

/**
 * Home's status card for an organiser that is not live yet (the 2026-10-09
 * draft dead end): where it stands, what to do, and for a draft or
 * changes-needed organiser the primary "Send for review"
 * (submit_organiser_profile_v1 through useSendForReview, which patches the
 * home to pending_review at once, so the card turns to "Waiting for review").
 * Home lists owner and manager organisers only, the roles the RPC admits.
 */
export function OrganiserStatusCard({ organiser, primary, onSent }: {
  organiser: HomeOrganiser;
  /** The screen's one primary: true while no organiser can take events (New event is disabled). */
  primary: boolean;
  onSent: (message: string) => void;
}) {
  const SendButton = primary ? PrimaryButton : GhostButton;
  const status = organiserStatus(organiser.name, organiser.lifecycle_status, organiser.latest_decision?.reason);
  const { shake, shakeProps } = useShake();
  const send = useSendForReview(() => onSent(`${organiser.name} is sent for review.`));
  const reasonId = useId();
  // Kept outside canSendForReview: a refusal reloads the home and may hide the button.
  const refusal = send.error ? selfServeErrorCopy(send.error).message : null;
  const blockers = sendBlockers({ name: organiser.name, cityId: organiser.city_id, dirty: false });
  const blocked = blockers.length > 0;

  return (
    <Card label={organiser.name} variant="padded" testId="home-org-status">
      <div className={`space-y-[12px] ${shakeProps.className}`} onAnimationEnd={shakeProps.onAnimationEnd}>
        <div className="flex items-start gap-[12px]">
          <StatusTag tone={status.tone} testId="home-org-status-tag">{status.label}</StatusTag>
          <p className="min-w-0 flex-1 break-words text-[15px] font-semibold text-[var(--fg)]" data-testid="home-org-status-line">{status.line}</p>
        </div>
        {status.canSendForReview ? (
          <div className="space-y-[8px]">
            <p className="text-[14px] text-[var(--mut)]">{status.next}</p>
            <SendButton
              onClick={() => send.mutate(organiser.id, { onError: () => shake() })}
              loading={send.isPending}
              loadingLabel="Sending"
              disabled={blocked}
              aria-describedby={blocked ? reasonId : undefined}
              testId="home-send-review"
            >
              {status.sendLabel}
            </SendButton>
            {blocked && <p id={reasonId} className="text-[13px] text-[var(--mut)]" data-testid="home-send-blocked">{blockers.join(' ')} Add it on your Profile page.</p>}
          </div>
        ) : (
          status.next && <p className="text-[14px] text-[var(--mut)]" data-testid="home-org-status-next">{status.next}</p>
        )}
        {refusal && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="home-send-error">{refusal}</p>}
      </div>
    </Card>
  );
}
