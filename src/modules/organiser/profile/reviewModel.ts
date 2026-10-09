import { organiserStatus } from '@/modules/organiser/shared/organiserStatus';
import type { StatusTone } from '../ui';

/**
 * The organiser's lifecycle on the Profile page (F1), and whether it can be
 * sent for review: a view of THE shared mapping (shared/organiserStatus.ts),
 * the same words Home's status card and the New event refusal use.
 */
export interface ReviewStatus {
  label: string;
  tone: StatusTone;
  /** One plain sentence under the tag, or null. */
  sentence: string | null;
  canSend: boolean;
}

export function reviewStatus(lifecycle: string, reason: string | null | undefined): ReviewStatus {
  const s = organiserStatus('', lifecycle, reason);
  return { label: s.label, tone: s.tone, sentence: s.line, canSend: s.canSendForReview };
}

/**
 * What stops a send, in plain words. The old header applied no check of its
 * own (the server checks only the state), so these are the profile's required
 * fields: the ones organiser_profile_update_p5_v1 refuses without (name, city),
 * read from the STORED profile because the team reviews what is saved, plus
 * unsaved edits (the team would not see them).
 */
export function sendBlockers(input: { name: string; cityId: string | null; dirty: boolean }): string[] {
  const missing: string[] = [];
  if (!input.name.trim()) missing.push('Organiser name');
  if (!input.cityId) missing.push('City');
  const out = missing.length ? [`Missing: ${missing.join(', ')}.`] : [];
  if (input.dirty) out.push('Save your changes first.');
  return out;
}
