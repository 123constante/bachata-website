import type { PostgrestError } from "@supabase/supabase-js";
import type { VendorProduct, VendorPromoDiscountType } from "@/modules/vendor/types";

export const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
};

export const normalizeProducts = (value: unknown): VendorProduct[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const name = typeof record.name === "string" ? record.name.trim() : "";
      const description = typeof record.description === "string" ? record.description.trim() : "";
      const imageUrl = typeof record.image_url === "string"
        ? record.image_url.trim()
        : typeof record.image === "string"
            ? record.image.trim()
          : "";

      const variants = Array.isArray(record.variants)
        ? record.variants
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean)
        : [];

      const rawPrice = record.price;
      const price = typeof rawPrice === "number"
        ? rawPrice
        : typeof rawPrice === "string" && rawPrice.trim().length > 0
          ? Number(rawPrice)
          : null;

      if (!name) return null;

      return {
        id: typeof record.id === "string" ? record.id : undefined,
        name,
        price: Number.isFinite(price) ? price : null,
        variants,
        description: description || undefined,
        image_url: imageUrl || undefined,
      } satisfies VendorProduct;
    })
    .filter((item): item is VendorProduct => Boolean(item));
};

export const normalizePromoDiscountType = (value: unknown): VendorPromoDiscountType => {
  return value === "fixed" ? "fixed" : "percent";
};

export const normalizePromoDiscountValue = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const parseStringListInput = (raw: string): string[] => {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

export const toNullableNumber = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

export const isRlsError = (error: PostgrestError | null): boolean => {
  if (!error) return false;
  const code = error.code || "";
  const message = `${error.message || ""} ${error.details || ""}`.toLowerCase();
  return (
    code === "42501" ||
    message.includes("not authorized") ||
    message.includes("permission denied") ||
    message.includes("row-level security")
  );
};

export const normalizeLink = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
};

export const normalizeSocialUrl = (kind: "instagram" | "facebook" | "website", value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (kind === "instagram") {
    const withoutAt = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
    if (
      !withoutAt.includes("/") &&
      !withoutAt.includes(".") &&
      !withoutAt.startsWith("http://") &&
      !withoutAt.startsWith("https://")
    ) {
      return `https://instagram.com/${withoutAt}`;
    }
    if (!withoutAt.startsWith("http://") && !withoutAt.startsWith("https://")) {
      return `https://${withoutAt}`;
    }
    return withoutAt;
  }

  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return `https://${trimmed}`;
  }
  return trimmed;
};
