// The role-details spread in mapDancerPublicProfile overwrote `id` with the
// dancing_role_details row id, so profile-page views were logged under the wrong
// person id (prod 2026-11-26: 82083343... instead of 962f4ca1...).
import { describe, it, expect } from 'vitest';
import { mapDancerPublicProfile } from '@/modules/profile/dancerPublicProfile';

describe('mapDancerPublicProfile id', () => {
  it('keeps the dancer_profiles id when role details carry their own id', () => {
    const view = mapDancerPublicProfile({
      id: 'dancer-id',
      first_name: 'Ana',
      dancing_role_details: [{ id: 'role-details-id', person_id: 'dancer-id' }],
    } as never);
    expect(view.id).toBe('dancer-id');
  });

  it('also works when role details come back as a single object', () => {
    const view = mapDancerPublicProfile({
      id: 'dancer-id',
      first_name: 'Ana',
      dancing_role_details: { id: 'role-details-id', person_id: 'dancer-id' },
    } as never);
    expect(view.id).toBe('dancer-id');
  });
});
