import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { trackDancerEvent } from '../../analytics/events';
import { submitFeedback } from '../../api/rpc';
import { FEEDBACK_MAX_LENGTH, type FeedbackKind } from '../../api/types';
import {
  FEEDBACK_KIND_CHIPS,
  FEEDBACK_OFFLINE,
  FEEDBACK_PROMPT,
  FEEDBACK_THANKS,
  FEEDBACK_TITLE,
  feedbackErrorCopy,
  sendDisabledReason,
  trimmedLength,
} from './feedbackModel';
import { Chip, FIELD_CLASS, Field, PrimaryButton } from '@/modules/organiser/ui';
import { Sheet } from './optionsUi';

const isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false;

/** In-app feedback (submit_feedback_v1). The text stays after a failure; it clears only after a send. */
const FeedbackSheet = ({ onClose }: { onClose: () => void }) => {
  const { pathname } = useLocation();
  const [text, setText] = useState('');
  const [kind, setKind] = useState<FeedbackKind>('general');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const why = sendDisabledReason(text, sending);

  const send = async () => {
    if (sending || why) return;
    if (!isOnline()) {
      setError(FEEDBACK_OFFLINE);
      return;
    }
    setSending(true);
    setError(null);
    try {
      await submitFeedback(text.trim(), kind, pathname);
      trackDancerEvent('feedback_sent', { channel: 'in_app' });
      setSent(true);
      setText('');
    } catch (e) {
      setError(feedbackErrorCopy(e, isOnline()));
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet title={FEEDBACK_TITLE} testId="opt-feedback-sheet" onClose={onClose} closeDisabled={sending}>
      {sent ? (
        <p role="status" data-testid="feedback-thanks" className="mb-[8px] mt-0 text-[14px]">{FEEDBACK_THANKS}</p>
      ) : (
        <div className="grid gap-[8px]">
          <div role="group" aria-label="What kind of message is it?" className="flex flex-wrap gap-[6px]">
            {FEEDBACK_KIND_CHIPS.map((c) => (
              <Chip key={c.kind} selected={kind === c.kind} testId={`feedback-kind-${c.kind}`} onToggle={() => setKind(c.kind)}>
                {c.label}
              </Chip>
            ))}
          </div>
          <Field label={FEEDBACK_PROMPT} htmlFor="feedback-text">
            <textarea
              id="feedback-text"
              data-testid="feedback-text"
              value={text}
              rows={5}
              onChange={(e) => setText(e.target.value)}
              className={`${FIELD_CLASS} py-[10px]`}
            />
          </Field>
          <span className="text-[12px] text-[var(--mut)]" data-testid="feedback-count">{trimmedLength(text)} / {FEEDBACK_MAX_LENGTH}</span>
          {error && <p role="alert" data-testid="feedback-error" className="m-0 text-[14px] text-[var(--danger)]">{error}</p>}
          <PrimaryButton
            testId="feedback-send"
            disabled={sending || why !== null}
            // F14: point at the reason only when it is on screen (while sending the label is the reason).
            aria-describedby={why ? 'feedback-why' : undefined}
            onClick={() => void send()}
          >
            {sending ? 'Sending\u2026' : 'Send'}
          </PrimaryButton>
          {why && <span id="feedback-why" className="text-[13px] text-[var(--mut)]" data-testid="feedback-why">{why}</span>}
        </div>
      )}
    </Sheet>
  );
};

export default FeedbackSheet;
