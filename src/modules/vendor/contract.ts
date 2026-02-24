export const VENDOR_REQUIRED_FIELDS = ["business_name"] as const;

export const VENDOR_FIELD_GROUPS = {
  identity: ["business_name", "city", "country", "team"] as const,
  media: ["photo_url"] as const,
  products: ["products", "product_categories", "ships_international"] as const,
  promo: ["promo_code", "promo_discount_type", "promo_discount_value"] as const,
  contact: ["public_email", "whatsapp", "website", "instagram", "facebook"] as const,
  content: ["faq", "upcoming_events", "team"] as const,
} as const;

export const VENDOR_DASHBOARD_SECTIONS = [
  "profile",
  "products",
  "promo",
  "media",
  "contact",
  "faq",
  "events",
  "shipping",
] as const;

export const VENDOR_BENTO_MIN_COLUMNS = 4;
