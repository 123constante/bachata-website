/**
 * P-SERIES browser walk (390x844, docs/organiser-rebuild/walk-P-SERIES): the copy
 * defects it found, pinned. Copy points only at controls on that screen; a control
 * that cannot work says why; the way out of a step is never only Back.
 */
import { describe, expect, it } from 'vitest';
import { coverStepReason, offerLeave } from '@/modules/organiser/flows/new/model';
import { SEE_LIVE_DRAFT_REASON } from '@/modules/organiser/events/lifecycleModel';

describe('new event, last step (walk 14)', () => {
  it('with A1 off the reason does not promise going live', () => {
    expect(coverStepReason(false, false)).toBe('Choose a photo first.');
    expect(coverStepReason(false, true)).toBe('Choose a photo to go live.');
    expect(coverStepReason(true, false)).toBeNull();
  });
  it('without a photo the draft can still be left (the main button is off)', () => {
    expect(offerLeave(false, false)).toBe(true);
    expect(offerLeave(true, false)).toBe(false);
    expect(offerLeave(true, true)).toBe(true);
  });
});

describe('copy (walk 03, 07)', () => {
  it('See it live reason is a sentence', () => expect(SEE_LIVE_DRAFT_REASON).toMatch(/\.$/));
});
