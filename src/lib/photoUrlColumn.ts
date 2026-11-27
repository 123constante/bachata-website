/**
 * vendors.photo_url and videographers.photo_url are TEXT columns in prod
 * (one URL), not text[]. Forms keep the photo as a list, so every save
 * path must collapse it to the first non-blank URL, or null.
 */
export function toPhotoUrlColumn(urls: readonly (string | null | undefined)[]): string | null {
  for (const url of urls) {
    const trimmed = typeof url === "string" ? url.trim() : "";
    if (trimmed) return trimmed;
  }
  return null;
}
