import type { Database } from "@/integrations/supabase/types";

type OrganiserRow = Database["public"]["Tables"]["organiser_profiles"]["Row"];

/** Fields OrganiserProfile.tsx (and the SSR loader dehydrating the same
 *  ['entity', id] cache entry) actually read off an organiser_profiles row --
 *  verified by grep, not guessed. Everything else on the table is irrelevant
 *  to rendering and was only ever fetched because both queries used
 *  `select('*')`. */
export type OrganiserPublicRecord = Pick<
  OrganiserRow,
  | "id"
  | "name"
  | "avatar_url"
  | "bio"
  | "claimed_by"
  | "socials"
  | "city_id"
  | "instagram"
  | "website"
  | "contact_email"
  | "contact_phone"
  | "organisation_category"
  | "founded_year"
>;

/**
 * The ONE PostgREST column list for the public organiser entity query.
 *
 * `select('*')` on organiser_profiles dehydrated `claimed_by` AND `created_by`
 * -- both auth.users UUIDs -- into the SSR document's hydration payload for
 * every organiser page: `created_by` unconditionally (nothing on the page
 * ever reads it) and `claimed_by` even for anonymous/bot visitors who cannot
 * use it (only a signed-in claimant's browser has a `user.id` to compare it
 * against). It also meant any future column added to the table -- with no
 * review of whether it was safe to expose -- would ship into crawlable HTML
 * automatically.
 *
 * `claimed_by` is kept: OrganiserProfile.tsx's claim-button gating
 * (`entity.claimed_by === user?.id`) needs it once hydrated client-side, and
 * the loader and the page share the SAME ['entity', id] cache entry, so both
 * queries must select the identical shape or cache parity breaks.
 *
 * ONE LINE, and `as const`, both load-bearing -- same reasoning as
 * DANCER_PUBLIC_COLS (src/modules/profile/dancerPublicProfile.ts): a
 * concatenated select string widens to `string` and collapses PostgREST's
 * inference, forcing a cast at every call site that then hides real column
 * mistakes.
 */
export const ORGANISER_PUBLIC_COLS =
  "id, name, avatar_url, bio, claimed_by, socials, city_id, instagram, website, contact_email, contact_phone, organisation_category, founded_year" as const;
