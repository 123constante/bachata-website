import { LIFECYCLE_LABEL } from '@/modules/organiser/shared/selfServeApi';
import type { StatusTone } from '../ui';

/**
 * The organiser's lifecycle on the Profile page (F1), and whether it can be
 * sent for review. Same states and the same send rule as the old /account
 * header (organiserStatusView in organiser/shared/homeModel.ts):
 * submit_organiser_profile_v1 admits draft and rejected only.
 */
export interface ReviewStatus {
  label: string;
  tone: StatusTone;
  /** One plain sentence under the tag, or null. */
  sentence: string | null;
  canSend: boolean;
}

export function reviewStatus(lifecycle: string, reason: string | null | undefined): ReviewStatus {
  const label = LIFECYCLE_LABEL[lifecycle] ?? lifecycle;
  switch (lifecycle) {
    case 'draft':
      return { label, tone: 'draft', sentence: 'Only you can see this organiser until the team approves it.', canSend: true };
    case 'pending_review':
      return { label, tone: 'neutral', sentence: 'The team is looking at it.', canSend: false };
    case 'rejected': {
      const why = reason?.trim();
      return { label, tone: 'draft', sentence: why ? `The team asked for changes: ${why}` : 'The team asked for changes.', canSend: true };
    }
    case 'live':
      return { label, tone: 'live', sentence: 'Live on the site.', canSend: false };
    default:
      return { label, tone: 'neutral', sentence: null, canSend: false };
  }
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
