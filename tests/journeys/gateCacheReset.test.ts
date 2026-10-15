import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { myDancerEditKey, writeMyDancerEdit } from '@/modules/dancer-app/api/useMyDancerEdit';
import type { MyDancerEdit } from '@/modules/dancer-app/api/types';

/**
 * The walk's 2026-10-15 find: onboarding finished the profile, but the dancer gate's
 * cached "incomplete" (['profile-completion', uid], 60 s stale time) bounced /account/o
 * back to /finish-profile. A save that changes completeness must drop that answer.
 */
const shape = (complete: boolean, pct: number) =>
  ({ profile_id: 'p1', complete, strength: { pct, next_step: null, missing: [] } }) as unknown as MyDancerEdit;

const setup = (complete: boolean) => {
  const qc = new QueryClient();
  qc.setQueryData(myDancerEditKey('u1'), shape(complete, complete ? 70 : 40));
  qc.setQueryData(['profile-completion', 'u1'], { status: complete ? 'complete' : 'incomplete' });
  return qc;
};

describe('writeMyDancerEdit keeps the dancer gate honest', () => {
  it('a save that finishes the profile drops the cached gate answer', () => {
    const qc = setup(false);
    writeMyDancerEdit(qc, 'u1', shape(true, 70));
    expect(qc.getQueryData(['profile-completion', 'u1'])).toBeUndefined();
  });

  it('a save that does not change completeness leaves it alone', () => {
    const qc = setup(true);
    writeMyDancerEdit(qc, 'u1', shape(true, 85));
    expect(qc.getQueryData(['profile-completion', 'u1'])).toEqual({ status: 'complete' });
  });
});
