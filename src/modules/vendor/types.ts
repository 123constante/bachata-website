import type { Database, Json } from "@/integrations/supabase/types";

export type VendorPromoDiscountType = "percent" | "fixed";

type VendorContractFields = {
  promo_discount_type: VendorPromoDiscountType | null;
  promo_discount_value: number | null;
  team: Json | null;
};

export type VendorRow = Database["public"]["Tables"]["vendors"]["Row"] & VendorContractFields;

export type VendorPublicCard = Pick<
  VendorRow,
  "id" | "business_name" | "city" | "photo_url" | "product_categories" | "upcoming_events" | "ships_international"
>;

export type VendorPublicDetail = Pick<
  VendorRow,
  | "id"
  | "business_name"
  | "city"
  | "photo_url"
  | "product_categories"
  | "products"
  | "faq"
  | "email"
  | "whatsapp"
  | "promo_code"
  | "upcoming_events"
  | "ships_international"
  | "team"
  | "website"
  | "instagram"
  | "facebook"
>;

export type VendorProduct = {
  id?: string;
  name: string;
  price: number | null;
  variants: string[];
  description?: string;
  image_url?: string;
};

export const VENDOR_DASHBOARD_SECTIONS = [
  "profile",
  "media",
  "products",
  "categories",
  "promo",
  "events",
  "contact",
  "social",
  "faq",
  "team",
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
  photo_url: string[];
  products: VendorProduct[];
  product_categories: string[];
  ships_international: boolean;
  promo_code: string;
  promo_discount_type: VendorPromoDiscountType;
  promo_discount_value: string;
  email: string;
  whatsapp: string;
  website: string;
  instagram: string;
  facebook: string;
  faq: string;
  upcoming_events: string[];
  meta_data: Json | null;
  team: Json | null;
};
