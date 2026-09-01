import type { Database } from "@/integrations/supabase/types";
import { resolvePublicName } from "@/lib/publicName";
import { getPhotoUrl, parsePartnerDetails } from "@/lib/utils";

type DancerRow = Database["public"]["Tables"]["dancer_profiles"]["Row"];

export type DancerPublicRecord = Pick<
  DancerRow,
  | "id"
  | "display_name"
  | "first_name"
  | "surname"
  | "nationality"
  | "dance_started_year"
  | "favorite_styles"
  | "dance_role"
  | "looking_for_partner"
  | "instagram"
  | "facebook"
  | "avatar_url"
  | "website"
  | "achievements"
  | "favorite_songs"
  | "partner_search_role"
  | "partner_search_level"
  | "partner_practice_goals"
  | "partner_details"
> & { cities?: { name: string } | null; email?: string | null };

/**
 * The ONE PostgREST column list for a public dancer profile.
 *
 * It used to be written out twice — once in app/routes/dancers.tsx (with a
 * comment promising it mirrored the page's query "byte-for-byte") and once in
 * src/pages/DancerProfile.tsx. They drifted, both omitting `display_name`, and
 * the dehydrated SSR cache entry therefore matched a page query that was also
 * wrong, so nothing disagreed and nothing failed. Two hand-synchronised copies
 * cannot be kept in sync by a comment; there is now one definition, imported by
 * both, and `DancerPublicRecord` above is what it must satisfy.
 */
//
// ONE LINE, and `as const`, both load-bearing. supabase-js infers the row type
// from the select string's LITERAL type; a concatenation (`"a, b" + "c, d"`)
// widens it to `string`, PostgREST's inference collapses to GenericStringError,
// and every consumer needs a cast that then hides real column mistakes. Wrapping
// it here rather than at each call site is the whole point -- the cast this
// replaced is what let the two copies drift in the first place.
export const DANCER_PUBLIC_COLS =
  "id, display_name, first_name, surname, nationality, dance_started_year, favorite_styles, dance_role, looking_for_partner, instagram, facebook, avatar_url, website, achievements, favorite_songs, partner_search_role, partner_search_level, partner_practice_goals, partner_details, gallery_urls, cities!based_city_id(name)" as const;

export type DancerPublicViewModel = {
  id: string;
  /** `null` when no real name resolves — see @/lib/publicName. Callers render
   *  their own fallback; SEO callers must pass it through as `undefined` so
   *  buildSeoForRoute noindexes the page instead of indexing a placeholder. */
  displayName: string | null;
  avatarUrl: string | null;
  city: string | null;
  nationality: string | null;
  yearsDancing: string | null;
  dancingStartDate: string | null;
  favoriteStyles: string[];
  partnerRole: string | null;
  lookingForPartner: boolean;
  achievements: string[];
  favoriteSongs: string[];
  partnerSearchRole: string | null;
  partnerSearchLevel: string[];
  partnerPracticeGoals: string[];
  partnerDetailsText: string;
  isVerified: boolean;
  goals: string[];
  connectLinks: {
    instagram: string | null;
    facebook: string | null;
    website: string | null;
    email: string | null;
  };
};

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeUrl = (value: string | null, kind: "instagram" | "facebook" | "website") => {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (kind === "instagram") {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
    const username = trimmed.replace(/^@/, "");
    if (!username) return null;
    return `https://instagram.com/${username}`;
  }

  if (kind === "facebook") {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;

    if (trimmed.toLowerCase().includes("facebook.com")) {
      return `https://${trimmed}`;
    }

    const username = trimmed.replace(/^@/, "");
    if (!username) return null;
    return `https://facebook.com/${username}`;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
};

export const mapDancerPublicProfile = (record: DancerPublicRecord): DancerPublicViewModel => {
  const rawPartnerDetails = record.partner_details;
  const partnerDetailsText =
    typeof rawPartnerDetails === "string"
      ? parsePartnerDetails(rawPartnerDetails)
      : rawPartnerDetails !== null &&
          typeof rawPartnerDetails === "object" &&
          !Array.isArray(rawPartnerDetails)
        ? parsePartnerDetails(rawPartnerDetails as Record<string, unknown>)
        : "";

  // Was `buildFullName(first_name, surname) || "Dancer"`, which shipped the
  // literal string "Dancer" as the <h1> and <title> of 44 live profiles whose
  // names are in `display_name`. The placeholder ALSO defeated the noindex in
  // buildSeoForRoute (it only fires on a falsy entityName), so each one was
  // indexed as a duplicate-titled soft 404.
  const displayName = resolvePublicName(record);

  const currentYear = new Date().getFullYear();
  const yearsDancing =
    typeof record.dance_started_year === "number"
      ? String(currentYear - record.dance_started_year)
      : null;

  return {
    id: record.id,
    displayName,
    avatarUrl: getPhotoUrl(record.avatar_url),
    city: record.cities?.name || null,
    nationality: record.nationality,
    yearsDancing,
    dancingStartDate: null,
    favoriteStyles: normalizeStringArray(record.favorite_styles),
    partnerRole: record.dance_role,
    lookingForPartner: Boolean(record.looking_for_partner),
    achievements: normalizeStringArray(record.achievements),
    favoriteSongs: normalizeStringArray(record.favorite_songs),
    partnerSearchRole: record.partner_search_role,
    partnerSearchLevel: normalizeStringArray(record.partner_search_level),
    partnerPracticeGoals: normalizeStringArray(record.partner_practice_goals),
    partnerDetailsText,
    isVerified: false,
    goals: [],
    connectLinks: {
      instagram: normalizeUrl(record.instagram, "instagram"),
      facebook: normalizeUrl(record.facebook, "facebook"),
      website: normalizeUrl(record.website, "website"),
      email: (record as any).email || null,
    },
  };
};
