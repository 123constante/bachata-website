// The ONE answer to "which picture is this event's cover". An event with no
// cover but at least one gallery picture shows its first gallery picture as the
// cover: the event page cover tile, the video poster, JSON-LD, og:image and the
// share card all read it through here, so they cannot disagree.
//
// Returns the raw source (trimmed), not a resolved URL: callers keep their own
// URL normalisation (resolveEventImage on the page, the OG card's own fetch).
// Blank and non-string entries are skipped, so a gallery whose first entry is
// '' still yields its first real picture.
// 'null' / 'undefined' are stringified nulls resolveEventImage already drops;
// skipping them here lets the gallery fallback still apply.
const nonBlank = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && trimmed !== 'null' && trimmed !== 'undefined' ? trimmed : null;
};

export function pickEventCoverSource(
  coverUrl: unknown,
  galleryUrls: readonly unknown[] | null | undefined,
): string | null {
  const cover = nonBlank(coverUrl);
  if (cover) return cover;
  for (const url of galleryUrls ?? []) {
    const candidate = nonBlank(url);
    if (candidate) return candidate;
  }
  return null;
}
