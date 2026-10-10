import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The rating card already shows the dancer-rated level, so the duplicate
// DerivedLevelBadge may only render where the card is absent: a cancelled
// occurrence, or the card's fallback (no summary yet). Source-level guard:
// BentoPage is too heavy to mount here.
const src = readFileSync(new URL('../BentoPage.tsx', import.meta.url), 'utf8');

describe('BentoPage DerivedLevelBadge gating', () => {
  it('shows the badge bare only for a cancelled occurrence', () => {
    expect(src).toMatch(/occurrence\?\.isCancelled \? badge :/);
  });
  it('hands the badge to the rating card as its no-summary fallback', () => {
    expect(src).toMatch(/<LevelRatingPrompt seriesId=\{eventId\} fallback=\{badge\}/);
  });
});
