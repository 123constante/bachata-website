import type { SupabaseClient } from '@supabase/supabase-js';

// Organiser profile edit boundary. The ONLY way the Website writes
// organiser_profiles is organiser_profile_update_p5_v1 (admin repo); direct
// .from('organiser_profiles') writes are banned repo-wide by
// src/__tests__/noDirectOrganiserProfileWrites.test.ts and
// scripts/lint-runtime-architecture.mjs.

// Normalizes a protocol-optional URL fragment for validating, rendering, AND
// the extract*Handle/extractDomain helpers below, so no two of them can
// independently drift on what counts as "already has a scheme/domain".
// Lowercases only the scheme (never the path/query) and prepends https://
// when neither a scheme nor the given domain is present -- this is what
// makes a bare "instagram.com/foo" resolve to a real link instead of being
// glued onto another https://instagram.com/ prefix.
export const lowercaseScheme = (v: string): string => v.replace(/^https?:\/\//i, (m) => m.toLowerCase());

// Hostname-anchored domain check -- NEVER a substring/`.includes()` test.
// A substring match treats "https://bit.ly/promo?ref=instagram.com" or a
// typosquat host "instagram.com.evil.tk" as "is an instagram.com URL" (the
// substring appears in the query string / as a subdomain prefix of a
// different real domain), which would validate and render an arbitrary or
// look-alike URL under the "Instagram" label. Parsing the hostname and
// requiring an exact match or a real subdomain (`.instagram.com` suffix)
// closes both.
export const hostMatchesDomain = (trimmed: string, domain: string): boolean => {
  try {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const hostname = new URL(withScheme).hostname.toLowerCase();
    return hostname === domain || hostname.endsWith(`.${domain}`);
  } catch {
    return false;
  }
};

export const withNormalizedProtocol = (trimmed: string, domain?: string): string => {
  if (/^https?:\/\//i.test(trimmed)) {
    return lowercaseScheme(trimmed);
  }
  if (domain && hostMatchesDomain(trimmed, domain)) {
    return `https://${trimmed}`;
  }
  return domain ? trimmed : `https://${trimmed}`;
};

export interface OrganiserProfileEditForm {
  name: string;
  avatar_url: string;
  bio: string;
  instagram: string;
  facebook: string;
  website: string;
  /** Omitted (undefined) when the private contact read failed: a save must never blank a stored phone. */
  contact_phone?: string;
  /** organiser_profile_update_p5_v1's show_contact_publicly; omitted when undefined. */
  show_contact_publicly?: boolean;
  organisation_category: string;
  founded_year: string;
}

// contact_email is deliberately absent: the RPC refuses a non-admin change.
export const buildOrganiserProfilePatch = (
  form: OrganiserProfileEditForm,
  cityId: string,
): Record<string, unknown> => {
  const ig = form.instagram.trim() ? withNormalizedProtocol(form.instagram.trim(), 'instagram.com') : null;
  const fb = form.facebook.trim() ? withNormalizedProtocol(form.facebook.trim(), 'facebook.com') : null;
  const web = form.website.trim() ? withNormalizedProtocol(form.website.trim()) : null;
  const year = form.founded_year.trim();
  const contact: Record<string, unknown> = {};
  if (form.contact_phone !== undefined) contact.contact_phone = form.contact_phone.trim() || null;
  if (form.show_contact_publicly !== undefined) contact.show_contact_publicly = form.show_contact_publicly;
  return {
    name: form.name.trim(),
    avatar_url: form.avatar_url.trim() || null,
    bio: form.bio.trim() || null,
    city_id: cityId,
    instagram: ig,
    website: web,
    ...contact,
    organisation_category: form.organisation_category.trim() || null,
    founded_year: year && Number.isFinite(Number(year)) ? Number(year) : null,
    socials: { instagram: ig, website: web, facebook: fb },
  };
};

export const saveOrganiserProfile = (
  client: Pick<SupabaseClient, 'rpc'>,
  organiserId: string,
  form: OrganiserProfileEditForm,
  cityId: string,
) =>
  client.rpc('organiser_profile_update_p5_v1', {
    p_organiser_id: organiserId,
    p_patch: buildOrganiserProfilePatch(form, cityId),
  });

const SAVE_ERROR_TOASTS: Record<string, { title: string; description: string }> = {
  organiser_name_taken: { title: 'Name already taken', description: 'Another organiser already uses this name. Please choose a different one.' },
  name_too_long: { title: 'Name too long', description: 'The name can be at most 80 characters.' },
  name_required: { title: 'Name required', description: 'Please enter a name.' },
  name_invalid: { title: 'Invalid name', description: 'The name must be a single line without special characters.' },
  invalid_website: { title: 'Invalid website', description: 'Please enter a valid website URL.' },
  invalid_avatar_url: { title: 'Invalid image link', description: 'Please enter a valid image URL.' },
  invalid_instagram: { title: 'Invalid Instagram', description: 'Please enter a valid Instagram handle or URL.' },
  invalid_socials: { title: 'Invalid link', description: 'Please check your Instagram, Facebook and website links.' },
  contact_email_admin_only: { title: 'Email is locked', description: 'The contact email can only be changed by an admin.' },
  permission_denied: { title: 'Not allowed', description: 'Only an owner or manager of this profile can edit it.' },
  bio_too_long: { title: 'Bio too long', description: 'The bio can be at most 4000 characters.' },
  contact_phone_too_long: { title: 'Phone too long', description: 'Please enter a shorter phone number.' },
  contact_phone_invalid: { title: 'Invalid phone', description: 'Please enter a valid phone number.' },
  founded_year_out_of_range: { title: 'Invalid founded year', description: 'Please enter a year from 1900 to this year.' },
  city_required: { title: 'City is required', description: 'Please add city before saving.' },
  city_not_found: { title: 'Select a valid city', description: 'Please choose city from the city picker list.' },
};

export const organiserProfileSaveErrorToast = (err: unknown): { title: string; description?: string } => {
  const message = typeof (err as { message?: unknown } | null)?.message === 'string' ? (err as { message: string }).message : '';
  const code = message.split(':')[0].trim();
  return SAVE_ERROR_TOASTS[code] ?? { title: 'Unable to save changes. Please try again.' };
};
