/**
 * parseVenueVideoUrl — classify a venue video URL into something the
 * hero renderer can use.
 *
 * Returns one of:
 *   - { kind: 'direct',  src }           → use <video src={src}>
 *   - { kind: 'youtube', embedUrl }      → use <iframe src={embedUrl}>
 *   - { kind: 'vimeo',   embedUrl }      → use <iframe src={embedUrl}>
 *   - null                               → unsupported, fall back to cover image
 *
 * Cost note (decided 2026-04-30 with Ricky): YouTube and Vimeo embeds
 * stream from THEIR servers, not ours — Supabase egress isn't touched
 * for those. So pasting a YouTube link is the cheapest option. Direct
 * uploads to our venue-videos bucket are guarded by the IntersectionObserver
 * pause + the 8 MB / 30s caps in the uploader.
 *
 * Accepted YouTube URL shapes:
 *   https://www.youtube.com/watch?v=<id>
 *   https://youtu.be/<id>
 *   https://www.youtube.com/embed/<id>
 *   https://www.youtube.com/shorts/<id>
 *
 * Accepted Vimeo URL shapes:
 *   https://vimeo.com/<id>
 *   https://player.vimeo.com/video/<id>
 */

export type VenueVideo =
  | { kind: 'direct'; src: string }
  | { kind: 'youtube'; embedUrl: string; videoId: string }
  | { kind: 'vimeo'; embedUrl: string; videoId: string };

const DIRECT_VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|$)/i;
const SUPABASE_STORAGE = /\/storage\/v\d+\/object\/(public|sign)\//;

const YT_PATTERNS: RegExp[] = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/i,
];

const VIMEO_PATTERN =
  /(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/i;

export const parseVenueVideoUrl = (url: string | null | undefined): VenueVideo | null => {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // 1. Direct media file or Supabase storage upload — return as-is.
  if (DIRECT_VIDEO_EXT.test(trimmed) || SUPABASE_STORAGE.test(trimmed)) {
    return { kind: 'direct', src: trimmed };
  }

  // 2. YouTube — extract the 11-char video ID.
  for (const re of YT_PATTERNS) {
    const m = re.exec(trimmed);
    if (m && m[1]) {
      const videoId = m[1];
      // autoplay+mute+loop+playsinline. Loop requires playlist=<id> on YouTube.
      const params = new URLSearchParams({
        autoplay: '1',
        mute: '1',
        loop: '1',
        playlist: videoId,
        playsinline: '1',
        modestbranding: '1',
        rel: '0',
        iv_load_policy: '3', // hide annotations
      });
      return {
        kind: 'youtube',
        videoId,
        embedUrl: `https://www.youtube.com/embed/${videoId}?${params.toString()}`,
      };
    }
  }

  // 3. Vimeo — extract numeric video ID.
  const vm = VIMEO_PATTERN.exec(trimmed);
  if (vm && vm[1]) {
    const videoId = vm[1];
    const params = new URLSearchParams({
      autoplay: '1',
      muted: '1',
      loop: '1',
      playsinline: '1',
      title: '0',
      byline: '0',
      portrait: '0',
    });
    return {
      kind: 'vimeo',
      videoId,
      embedUrl: `https://player.vimeo.com/video/${videoId}?${params.toString()}`,
    };
  }

  return null;
};

/** Backward-compat shim — `isDirectVideoUrl` previously used as a gate. */
export const isDirectVideoUrl = (url: string | null | undefined): boolean => {
  const parsed = parseVenueVideoUrl(url);
  return parsed?.kind === 'direct';
};
