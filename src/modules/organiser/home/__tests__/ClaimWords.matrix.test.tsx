// Every claim state's words, one table: none names a person, and only the
// 'yours' state may say "owner" (the hint cannot tell owned from managers-only).
import { describe, expect, it } from 'vitest';
import { WARN_END } from '../../shared/copy';
import { CLAIM_HINTS, NO_EMAIL_COPY, askedToJoinDone, claimScreen, hintRowText } from '../onboarding/claimStates';

const NAME = 'Salsa Nights';
const PERSON = /ricky|constante/i;
const STATES = [...CLAIM_HINTS, null] as const;

describe('claim words never name a person', () => {
  it.each(STATES)('hint %s: title, sub, row and primary label', (hint) => {
    const s = claimScreen(hint, NAME);
    const words = [s.title, s.sub, hintRowText(hint), s.primaryLabel];
    for (const w of words) {
      expect(w).not.toMatch(PERSON);
      if (hint !== 'yours') expect(w).not.toMatch(/owner/i);
    }
  });

  it('yours may still say owner', () => {
    expect(claimScreen('yours', NAME).sub).toBe('You are already its owner.');
  });

  it('managed says team, not owner', () => {
    expect(claimScreen('managed', NAME).title).toBe(`${NAME} already has a team`);
  });

  it('done, no-email and end-warning lines', () => {
    const d = askedToJoinDone(NAME);
    expect(`${d.title} ${d.message}`).not.toMatch(PERSON);
    expect(NO_EMAIL_COPY).toBe('This page has no email on file yet. Ask to join and the Bachata Calendar team will check and get back to you.');
    expect(NO_EMAIL_COPY).not.toMatch(PERSON);
    expect(WARN_END).toBe('Only the Bachata Calendar team can reopen an ended event.');
  });
});
