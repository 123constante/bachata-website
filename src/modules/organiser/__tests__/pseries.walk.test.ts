/**
 * P-SERIES browser walk (390x844, docs/organiser-rebuild/walk-P-SERIES): the copy
 * defects it found, pinned. Copy points only at controls on that screen; a control
 * that cannot work says why; the way out of a step is never only Back.
 */
import { describe, expect, it } from 'vitest';
import { SEE_LIVE_DRAFT_REASON } from '@/modules/organiser/events/lifecycleModel';

describe('copy (walk 03, 07)', () => {
  it('See it live reason is a sentence', () => expect(SEE_LIVE_DRAFT_REASON).toMatch(/\.$/));
});
