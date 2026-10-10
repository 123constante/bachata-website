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
    const p = buildOrganiserProfilePatch(form, 'c') as Record<string, unknown>;
    expect(p.name).toBe('Casa Bachata');
    expect(p.website).toBe('https://example.com');
    expect(p.instagram).toBe('https://instagram.com/casa');
    expect(p.socials).toEqual({ instagram: 'https://instagram.com/casa', website: 'https://example.com', facebook: 'https://facebook.com/casa' });
    expect(p.founded_year).toBe(2015);
    expect(buildOrganiserProfilePatch({ ...form, founded_year: '', instagram: '@casa' }, 'c').founded_year).toBeNull();
    expect(buildOrganiserProfilePatch({ ...form, instagram: '@casa' }, 'c').instagram).toBe('@casa');
  });
});

describe('private contact fields in the patch', () => {
  it('sends the phone and show_contact_publicly when the form carries them', () => {
    const p = buildOrganiserProfilePatch({ ...form, contact_phone: ' 0113 000 ', show_contact_publicly: true }, 'c');
    expect(p.contact_phone).toBe('0113 000');
    expect(p.show_contact_publicly).toBe(true);
  });

  it('leaves both out when undefined, so a failed contact read can never blank a phone or flip the flag', () => {
    const { contact_phone: _phone, ...withoutPhone } = form;
    const p = buildOrganiserProfilePatch(withoutPhone, 'c');
    expect(p).not.toHaveProperty('contact_phone');
    expect(p).not.toHaveProperty('show_contact_publicly');
  });

  it('an empty phone clears it (null); a false flag is sent, not dropped', () => {
    const p = buildOrganiserProfilePatch({ ...form, contact_phone: '  ', show_contact_publicly: false }, 'c');
    expect(p.contact_phone).toBeNull();
    expect(p.show_contact_publicly).toBe(false);
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
