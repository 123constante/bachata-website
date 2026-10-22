import { describe, expect, it } from 'vitest';
import { buildOrganiserProfilePatch, type OrganiserProfileEditForm } from '../organiserProfileUpdate';

const FORM: OrganiserProfileEditForm = {
  name: 'Ritmo', avatar_url: '', bio: '', instagram: '', website: '', facebook: '', organisation_category: '', founded_year: '',
};

describe('organiser patch city_id', () => {
  it('an unknown city is left out, never sent as ""', () => {
    const patch = buildOrganiserProfilePatch(FORM, '');
    expect('city_id' in patch).toBe(false);
  });
  it('a known city is sent', () => {
    expect(buildOrganiserProfilePatch(FORM, 'c1').city_id).toBe('c1');
  });
});
