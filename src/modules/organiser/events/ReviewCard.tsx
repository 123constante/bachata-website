import { useId, useState } from 'react';
import { submitForReviewCommand } from '@/modules/organiser/shared/seriesCommands';
import { commandErrorMessage } from '@/modules/organiser/shared/selfServeErrors';
import type { HomeOrganiser } from '@/modules/organiser/shared/selfServeApi';
import { Card, GhostButton, useShake } from '../ui';
import { usePublishReadiness, useRunCommands } from './eventsApi';
import { eventReviewView } from './reviewModel';

/**
 * Top of the event editor (G1): a draft or changes-needed event's 'Send for
 * review' (series.set_lifecycle {to:'pending_review'}), with what it still needs
 * shown first; 'In review' afterwards. The Save bar is this screen's one primary,
 * so every button here is a GhostButton.
 */
export function EventReviewCard({ seriesId, name, status, version, upcomingListed, organisers, dirty, onSent }: {
  seriesId: string;
  name: string;
  status: string;
  version: number;
  upcomingListed: number;
  /** The organisers this event belongs to; null while the home loads. */
  organisers: HomeOrganiser[] | null;
  dirty: boolean;
  onSent: () => void;
}) {
  const sendable = status === 'draft' || status === 'rejected';
  const readiness = usePublishReadiness(seriesId, version, sendable);
  const view = eventReviewView({
    status,
    missing: readiness.data ?? null,
    readinessError: readiness.isError,
    upcomingListed,
    organisers,
    dirty,
  });
  const run = useRunCommands(seriesId);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { shake, shakeProps } = useShake();
  const reasonId = useId();
  if (!view.show) return null;

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await run([submitForReviewCommand()], version);
      setConfirming(false);
      onSent();
    } catch (err) {
      setError(commandErrorMessage(err));
      shake();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card label="Status" variant="padded" testId="org-event-review">
      <div className={`space-y-[12px] ${shakeProps.className}`} onAnimationEnd={shakeProps.onAnimationEnd}>
        {/* The lifecycle word is the tag at the top of the editor; this says what it means. */}
        {view.sentence && <p className="break-words text-[14px] text-[var(--fg)]" data-testid="org-event-review-sentence">{view.sentence}</p>}
        {sendable && (confirming ? (
          <div className="space-y-[8px]" data-testid="org-event-review-confirm">
            <p className="break-words text-[15px] text-[var(--fg)]">
              Send {name.trim() || 'this event'} to the Bachata Calendar team for review{view.again ? ' again' : ''}? Until they approve it, you can still edit it.
            </p>
            <GhostButton onClick={() => setConfirming(false)} disabled={busy} testId="org-event-review-no">No, not yet</GhostButton>
            <GhostButton onClick={() => void send()} loading={busy} loadingLabel="Sending" disabled={!view.canSend} testId="org-event-review-yes">Yes, send it</GhostButton>
          </div>
        ) : (
          <div className="space-y-[8px]">
            <GhostButton onClick={() => { setError(null); setConfirming(true); }} disabled={!view.canSend}
              aria-describedby={view.canSend ? undefined : reasonId} testId="org-event-review-send">
              {view.again ? 'Send for review again' : 'Send for review'}
            </GhostButton>
            {!view.canSend && <p id={reasonId} className="text-[13px] text-[var(--mut)]" data-testid="org-event-review-blocked">{view.blockers.join(' ')}</p>}
          </div>
        ))}
        {error && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="org-event-review-error">{error}</p>}
      </div>
    </Card>
  );
}
