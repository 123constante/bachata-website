import type { Database, Json } from "@/integrations/supabase/types";

export type VendorPromoDiscountType = "percent" | "fixed";

type VendorContractFields = {
  promo_discount_type: VendorPromoDiscountType | null;
  promo_discount_value: number | null;
};

// Phase 5.5 dropped vendors.team (jsonb) and vendors.upcoming_events (text[]).
// Both are excluded from VendorRow now so TS catches stale readers; the
// canonical sources are vendor_team_members and event_vendor_booths,
// surfaced through get_public_vendor_detail_v1 (team jsonb) and the
// admin RPCs.
export type VendorRow = Omit<
  Database["public"]["Tables"]["vendors"]["Row"],
  "team" | "upcoming_events"
> & VendorContractFields;

export type VendorRowWithCity = VendorRow & {
  cities?: { name: string } | null;
};

// ─── Public RPC return shapes (Vendors Phase 1) ─────────────────────────────
// These mirror the SQL TABLE returns of get_public_vendor_directory_v1 and
// get_public_vendor_detail_v1. The scalar photo_url + scalar city flattening
// is intentional: directory cards show one hero image and one city label.

export type VendorPublicCard = {
  id: string;
  business_name: string | null;
  photo_url: string | null;
  city_id: string | null;
  city: string | null;
  country: string | null;
  product_categories: string[];
  ships_international: boolean;
  has_promo_code: boolean;
  verified: boolean;
  upcoming_event_count: number;
  total_count: number;
};

// VendorPublicDetail mirrors get_public_vendor_detail_v1's RETURN signature.
// The signature was preserved across Phase 5 — `team` is still jsonb (now
// resolved from vendor_team_members + member_profiles + dancer_profiles)
// and `upcoming_events` is still text[] of event ids (now sourced from
// event_vendor_booths).
export type VendorPublicDetail = {
  id: string;
  business_name: string | null;
  photo_url: string | null;
  gallery_urls: string[];
  city_id: string | null;
  city: string | null;
  country: string | null;
  description: string | null;
  short_description: string | null;
  faq: string | null;
  products: Json;
  product_categories: string[];
  ships_international: boolean;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  whatsapp: string | null;
  public_email: string | null;
  promo_code: string | null;
  promo_discount_type: VendorPromoDiscountType | null;
  promo_discount_value: number | null;
  team: Json;
  upcoming_events: string[];
  verified: boolean;
};

export type VendorProduct = {
  id?: string;
  name: string;
  price: number | null;
  variants: string[];
  description?: string;
  image_url?: string;
};

// Phase 5.5: "events" and "team" sections retired from the self-service portal.
// Event linking now goes through admin_attach_vendor_to_event_v1 (Phase 3) and
// team membership through admin_set_vendor_team_v1 (Phase 5). Keep entries here
// so legacy progress maps don't blow up, but the portal no longer renders them.
export const VENDOR_DASHBOARD_SECTIONS = [
  "profile",
  "media",
  "products",
  "categories",
  "promo",
  "contact",
  "social",
  "faq",
  "save",
  "advanced",
] as const;

export type VendorDashboardSection = (typeof VENDOR_DASHBOARD_SECTIONS)[number];

export type VendorSectionProgress = {
  complete: boolean;
};

export type VendorDashboardProgressMap = Partial<
  Record<VendorDashboardSection, VendorSectionProgress>
>;

export type VendorDashboardSavePayload = {
  section: VendorDashboardSection;
  savedAt: string;
  vendor?: VendorRow;
  progress?: VendorDashboardProgressMap;
};

export type VendorDashboardFormState = {
  id: string | null;
  business_name: string;
  city: string;
  country?: string;
  phone?: string;
  photo_url: string[];
  products: VendorProduct[];
  product_categories: string[];
  ships_international: boolean;
  promo_code: string;
  promo_discount_type: VendorPromoDiscountType;
  promo_discount_value: string;
  public_email: string;
  whatsapp: string;
  website: string;
  instagram: string;
  facebook: string;
  faq: string;
  meta_data: Json | null;
};
