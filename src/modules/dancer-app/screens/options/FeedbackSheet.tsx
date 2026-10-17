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
import { ROW, Sheet } from './optionsUi';

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
        <p role="status" data-testid="feedback-thanks" style={{ fontSize: 14, margin: '0 0 8px' }}>{FEEDBACK_THANKS}</p>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          <label htmlFor="feedback-text" style={{ fontSize: 14 }}>{FEEDBACK_PROMPT}</label>
          <div role="group" aria-label="What kind of message is it?" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {FEEDBACK_KIND_CHIPS.map((c) => (
              <button
                key={c.kind}
                type="button"
                className="da-tap"
                aria-pressed={kind === c.kind}
                data-testid={`feedback-kind-${c.kind}`}
                onClick={() => setKind(c.kind)}
                style={{ minHeight: 44, borderRadius: 22, padding: '0 14px', fontSize: 14, fontWeight: 600, border: '1px solid var(--da-border)', background: kind === c.kind ? 'var(--da-accent)' : 'transparent', color: kind === c.kind ? 'var(--da-on-accent)' : 'var(--da-text)' }}
              >
                {c.label}
              </button>
            ))}
          </div>
          <textarea
            id="feedback-text"
            data-testid="feedback-text"
            value={text}
            rows={5}
            onChange={(e) => setText(e.target.value)}
            style={{ width: '100%', borderRadius: 10, border: '1px solid var(--da-border)', background: 'var(--da-bg)', color: 'var(--da-text)', padding: 10, fontSize: 16 }}
          />
          <span className="da-muted" style={{ fontSize: 12 }} data-testid="feedback-count">{trimmedLength(text)} / {FEEDBACK_MAX_LENGTH}</span>
          {error && <p role="alert" data-testid="feedback-error" style={{ fontSize: 14, margin: 0, color: 'var(--da-danger)' }}>{error}</p>}
          <button
            type="button"
            className="da-tap"
            data-testid="feedback-send"
            disabled={sending || why !== null}
            // F14: point at the reason only when it is on screen (while sending the label is the reason).
            aria-describedby={why ? 'feedback-why' : undefined}
            style={{ ...ROW, justifyContent: 'center', background: 'var(--da-accent)', color: 'var(--da-on-accent)', opacity: sending || why ? 0.6 : 1 }}
            onClick={() => void send()}
          >
            {sending ? 'Sending\u2026' : 'Send'}
          </button>
          {why && <span id="feedback-why" className="da-muted" style={{ fontSize: 13 }} data-testid="feedback-why">{why}</span>}
        </div>
      )}
    </Sheet>
  );
};

export default FeedbackSheet;
