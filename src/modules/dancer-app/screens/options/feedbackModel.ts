import { toDancerError } from '../../api/errors';
import { FEEDBACK_MAX_LENGTH, type FeedbackKind } from '../../api/types';

/** Everything the feedback form decides, as plain data (the sheet only renders it). */
export const FEEDBACK_KIND_CHIPS: ReadonlyArray<{ kind: FeedbackKind; label: string }> = [
  { kind: 'general', label: 'Something else' },
  { kind: 'bug', label: 'Something is broken' },
  { kind: 'idea', label: 'An idea' },
  { kind: 'praise', label: 'I like it' },
];

export const FEEDBACK_TITLE = 'Send feedback';
export const FEEDBACK_PROMPT = 'What is missing, broken or good? Write it in your own words.';
export const FEEDBACK_THANKS = 'Thank you. We read every message.';
export const FEEDBACK_RATE_LIMITED = 'You\u2019ve sent a few today, try again tomorrow.';
/** F13: the "Help and message us" row is on Options, BEHIND this sheet, so say to close it first. */
export const FEEDBACK_CLOSED = 'Feedback is not open for your account yet. Close this and use \u201CHelp and message us\u201D instead.';
export const FEEDBACK_OFFLINE = 'You look offline. Your message is still here: connect and send it again.';
export const FEEDBACK_EMPTY_REASON = 'Write a message to send it.';
export const FEEDBACK_TOO_LONG_REASON = `Your message is over ${FEEDBACK_MAX_LENGTH} characters. Shorten it to send it.`;

export const trimmedLength = (text: string): number => text.trim().length;

/**
 * Why Send is off, or null when there is nothing more to say. A disabled control always
 * has a reason: while sending, the button's own label ("Sending...") is that reason, so
 * no second line repeats it (F14). The sheet disables Send while sending on its own.
 */
export const sendDisabledReason = (text: string, sending: boolean): string | null => {
  if (sending) return null;
  const n = trimmedLength(text);
  if (n === 0) return FEEDBACK_EMPTY_REASON;
  if (n > FEEDBACK_MAX_LENGTH) return FEEDBACK_TOO_LONG_REASON;
  return null;
};

/** A failed send -> the words under the box. rate_limited / area_closed / offline are the ones the owner pinned. */
export const feedbackErrorCopy = (err: unknown, online: boolean): string => {
  const e = toDancerError(err);
  if (e.code === 'rate_limited') return FEEDBACK_RATE_LIMITED;
  if (e.code === 'area_closed') return FEEDBACK_CLOSED;
  if (!online && e.code === 'unknown') return FEEDBACK_OFFLINE;
  return e.message;
};
