/**
 * Columns the public /videographers page may read from `videographers`.
 *
 * The admin repo revokes SELECT on the private columns (email, phone,
 * whatsapp, created_by, claimed_by, meta_data) from anon and authenticated, so
 * a `select('*')` -- which expands to them -- would fail the whole read with
 * 42501. Name only what the page renders. ONE line, `as const`, so supabase-js
 * infers the row type from the literal. `nationality` (anon-granted, stored as
 * ISO alpha-2 by an admin trigger) feeds the nationality flag on the photo.
 */
export const VIDEOGRAPHER_PUBLIC_COLS =
  "id, first_name, surname, business_name, photo_url, bio, instagram, website, verified, videography_styles, nationality" as const;
