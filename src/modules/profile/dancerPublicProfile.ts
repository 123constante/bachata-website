import type { Database } from "@/integrations/supabase/types";
import { buildFullName } from "@/lib/name-utils";
import { getPhotoUrl, parsePartnerDetails } from "@/lib/utils";

type DancerRow = Database["public"]["Tables"]["dancers"]["Row"];

export type DancerPublicRecord = Pick<
  DancerRow,
  | "id"
  | "first_name"
  | "surname"
  | "city"
  | "nationality"
  | "years_dancing"
  | "favorite_styles"
  | "partner_role"
  | "looking_for_partner"
  | "instagram"
  | "facebook"
  | "photo_url"
  | "hide_surname"
  | "website"
  | "achievements"
  | "favorite_songs"
  | "partner_search_role"
  | "partner_search_level"
  | "partner_practice_goals"
  | "partner_details"
  | "is_public"
  | "verified"
  | "dancing_start_date"
  | "festival_plans"
> & { email?: string | null };

export type DancerPublicViewModel = {
  id: string;
  displayName: string;
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
  festivalPlanIds: string[];
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

  const displayName = record.hide_surname
    ? `${record.first_name}${record.surname ? ` ${record.surname.charAt(0)}.` : ""}`.trim()
    : buildFullName(record.first_name, record.surname) || "Dancer";

  return {
    id: record.id,
    displayName,
    avatarUrl: getPhotoUrl(record.photo_url),
    city: record.city,
    nationality: record.nationality,
    yearsDancing: record.years_dancing,
    dancingStartDate: record.dancing_start_date || null,
    favoriteStyles: normalizeStringArray(record.favorite_styles),
    partnerRole: record.partner_role,
    lookingForPartner: Boolean(record.looking_for_partner),
    achievements: normalizeStringArray(record.achievements),
    favoriteSongs: normalizeStringArray(record.favorite_songs),
    partnerSearchRole: record.partner_search_role,
    partnerSearchLevel: normalizeStringArray(record.partner_search_level),
    partnerPracticeGoals: normalizeStringArray(record.partner_practice_goals),
    partnerDetailsText,
    isVerified: Boolean(record.verified),
    goals: [],
    festivalPlanIds: normalizeStringArray(record.festival_plans),
    connectLinks: {
      instagram: normalizeUrl(record.instagram, "instagram"),
      facebook: normalizeUrl(record.facebook, "facebook"),
      website: normalizeUrl(record.website, "website"),
      email: (record as any).email || null,
    },
  };
};
