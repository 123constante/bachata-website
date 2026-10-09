import { describe, expect, it, vi } from 'vitest';
import {
  buildOrganiserProfilePatch,
  organiserProfileSaveErrorToast,
  saveOrganiserProfile,
  type OrganiserProfileEditForm,
} from '@/lib/organiserProfileUpdate';

const form: OrganiserProfileEditForm = {
  name: '  Casa Bachata ',
  avatar_url: '',
  bio: 'Hello',
  instagram: 'instagram.com/casa',
  facebook: 'facebook.com/casa',
  website: 'example.com',
  contact_phone: '',
  organisation_category: 'Studio',
  founded_year: '2015',
};

describe('saveOrganiserProfile', () => {
  it('calls the RPC and never writes organiser_profiles directly', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
    const from = vi.fn();
    await saveOrganiserProfile({ rpc, from } as never, 'org-1', form, 'city-1');
    expect(from).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
    const [name, args] = rpc.mock.calls[0];
    expect(name).toBe('organiser_profile_update_p5_v1');
    expect(args.p_organiser_id).toBe('org-1');
    expect(Object.keys(args.p_patch).sort()).toEqual(
      ['avatar_url', 'bio', 'city_id', 'founded_year', 'instagram', 'name', 'organisation_category', 'contact_phone', 'socials', 'website'].sort(),
    );
    expect(args.p_patch).not.toHaveProperty('contact_email');
  });

  it('normalises URLs and builds socials from the three allowed keys', () => {
    const p = buildOrganiserProfilePatch(form, 'c') as Record<string, any>;
    expect(p.name).toBe('Casa Bachata');
    expect(p.website).toBe('https://example.com');
    expect(p.instagram).toBe('https://instagram.com/casa');
    expect(p.socials).toEqual({ instagram: 'https://instagram.com/casa', website: 'https://example.com', facebook: 'https://facebook.com/casa' });
    expect(p.founded_year).toBe(2015);
    expect(buildOrganiserProfilePatch({ ...form, founded_year: '', instagram: '@casa' }, 'c').founded_year).toBeNull();
    expect((buildOrganiserProfilePatch({ ...form, instagram: '@casa' }, 'c') as any).instagram).toBe('@casa');
  });
});

describe('organiserProfileSaveErrorToast', () => {
  it.each([
    'organiser_name_taken', 'name_too_long', 'invalid_website', 'invalid_instagram', 'invalid_socials', 'contact_email_admin_only',
  ])('maps %s to a specific toast', (code) => {
    const t = organiserProfileSaveErrorToast({ message: `${code}: detail` });
    expect(t.title).not.toMatch(/Unable to save/);
  });
  it('maps permission_denied', () => {
    expect(organiserProfileSaveErrorToast({ message: 'permission_denied: editing an organiser profile needs its owner' }).title).toBe('Not allowed');
  });
  it('falls back to the generic toast', () => {
    expect(organiserProfileSaveErrorToast(new Error('boom')).title).toMatch(/Unable to save/);
    expect(organiserProfileSaveErrorToast(null).title).toMatch(/Unable to save/);
  });
});
