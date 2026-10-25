/**
 * Finding 7 / D36: organiser_invite_preview_v1 answers a MASKED hint; the parser never yields a full
 * email from a non-open link. The landing is exercised in join/__tests__/joinJourney.test.tsx (W1).
 */
import { describe, expect, it } from 'vitest';
import { parsePreview as parseInvitePreview } from '../inviteModel';

describe('parseInvitePreview', () => {
  it.each([
    [{ email_hint: 'r...@ymail.com', organiser_name: 'Ritmo' }, 'r...@ymail.com'],
    [{ status: 'open', email_hint: 'r***@ymail.com', organiser_name: 'Ritmo' }, 'r***@ymail.com'],
    [{ status: 'expired', email_hint: 'rosa@ymail.com', organiser_name: 'Ritmo' }, null],
    [{ email_hint: 5, organiser_name: 'Ritmo' }, null],
    [{ email_hint: 'r...@ymail.com' }, null],
    [{}, null],
    [null, null],
    ['r...@ymail.com', null],
  ])('%j -> %s', (v, hint) => {
    expect(parseInvitePreview(v)?.emailHint ?? null).toBe(hint);
  });
});
