/**
 * isDirectVideoUrl — returns true only for URLs that the HTML5 <video>
 * element can actually play. Used by the venue page hero + admin
 * uploader to filter out YouTube/Vimeo links that return HTML pages
 * (which would render as a blank, broken player).
 *
 * Accepts:
 *   - Direct media files: .mp4, .webm, .mov, .m4v (case-insensitive)
 *   - Our own Supabase Storage uploads (any bucket, any extension —
 *     Storage always serves direct bytes with the correct Content-Type)
 *
 * Decided 2026-04-30 (Ricky): YouTube URLs in the "Video URLs
 * (advanced)" field shouldn't break the hero video. Anything that's
 * not a direct media URL falls back to the cover image.
 */
const DIRECT_VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|$)/i;
const SUPABASE_STORAGE = /\/storage\/v\d+\/object\/(public|sign)\//;

export const isDirectVideoUrl = (url: string | null | undefined): boolean => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  return DIRECT_VIDEO_EXT.test(trimmed) || SUPABASE_STORAGE.test(trimmed);
};
