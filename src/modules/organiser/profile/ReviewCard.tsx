import { useId, useState } from 'react';
import { selfServeErrorCopy } from '@/modules/organiser/shared/selfServeErrors';
import { useSendForReview } from '@/modules/organiser/shared/useSendForReview';
import type { HomeOrganiser } from '@/modules/organiser/shared/selfServeApi';
import { Card, GhostButton, StatusTag, useShake } from '../ui';
import { reviewStatus } from './reviewModel';

/**
 * Top of the Profile page (F1): the organiser's lifecycle and, for a draft or
 * changes-needed organiser, "Send for review" (submit_organiser_profile_v1
 * through the old useSendForReview hook, so the home cache is patched and
 * reloaded exactly as on the old /account). The Save bar is this screen's one
 * primary, so every button here is a GhostButton.
 */
export function ReviewCard({ organiser, blockers, onSent }: {
  organiser: HomeOrganiser;
  /** Plain reasons the send is not possible yet (sendBlockers); empty = ready. */
  blockers: string[];
  onSent: () => void;
}) {
  const status = reviewStatus(organiser.lifecycle_status, organiser.latest_decision?.reason);
  const [confirming, setConfirming] = useState(false);
  const { shake, shakeProps } = useShake();
  const send = useSendForReview(() => {
    setConfirming(false);
    onSent();
  });
  const reasonId = useId();
  // Outside the canSend branch: a refusal reloads the home, and when the reloaded
  // organiser is no longer sendable the button goes but its explanation stays.
  const refusal = send.error ? selfServeErrorCopy(send.error).message : null;
  const blocked = blockers.length > 0;
  const again = organiser.lifecycle_status === 'rejected';

  const go = () => send.mutate(organiser.id, { onError: () => shake() });

  return (
    <Card label="Status" variant="padded" testId="profile-status">
      <div className={`space-y-[12px] ${shakeProps.className}`} onAnimationEnd={shakeProps.onAnimationEnd} data-testid="profile-status-body">
        <div className="flex items-start gap-[12px]">
          <StatusTag tone={status.tone} testId="profile-status-tag">{status.label}</StatusTag>
          {status.sentence && <p className="min-w-0 flex-1 break-words text-[14px] text-[var(--fg)]" data-testid="profile-status-sentence">{status.sentence}</p>}
        </div>
        {status.canSend && (confirming ? (
          <div className="space-y-[8px]" data-testid="profile-send-confirm">
            <p className="break-words text-[15px] text-[var(--fg)]">
              Send {organiser.name} to the Bachata Calendar team for review{again ? ' again' : ''}? They check new organisers within a day.
            </p>
            <GhostButton onClick={() => setConfirming(false)} disabled={send.isPending} testId="profile-send-no">No, not yet</GhostButton>
            <GhostButton onClick={go} loading={send.isPending} loadingLabel="Sending" testId="profile-send-yes">Yes, send it</GhostButton>
          </div>
        ) : (
          <div className="space-y-[8px]">
            <GhostButton
              onClick={() => { send.reset(); setConfirming(true); }}
              disabled={blocked}
              aria-describedby={blocked ? reasonId : undefined}
              testId="profile-send-review"
            >
              {again ? 'Send for review again' : 'Send for review'}
            </GhostButton>
            {blocked && <p id={reasonId} className="text-[13px] text-[var(--mut)]" data-testid="profile-send-blocked">{blockers.join(' ')}</p>}
          </div>
        ))}
        {refusal && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="profile-send-error">{refusal}</p>}
      </div>
    </Card>
  );
}
