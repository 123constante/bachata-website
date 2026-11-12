// Photo order and cover for the Gallery sheet. Pure.
// The cover (default_cover_image_url) and the gallery (default_gallery) are stored apart,
// but the organiser sees ONE row of photos: the cover first, then the gallery.

export interface PhotoSet { coverUrl: string; gallery: string[] }

/** The cover first, then the gallery (a gallery copy of the cover is not listed twice). */
export function photoList(s: PhotoSet): string[] {
  const cover = s.coverUrl.trim();
  return cover ? [cover, ...s.gallery.filter((g) => g !== cover)] : [...s.gallery];
}

/** A list back into the two stored fields. With no cover, the whole list stays the gallery. */
function fromList(list: string[], hadCover: boolean): PhotoSet {
  return hadCover ? { coverUrl: list[0] ?? '', gallery: list.slice(1) } : { coverUrl: '', gallery: list };
}

/** Swap a photo with its neighbour. Moving the first photo right makes photo 2 the cover. */
export function movePhoto(s: PhotoSet, url: string, dir: -1 | 1): PhotoSet {
  const list = photoList(s);
  const i = list.indexOf(url);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return { coverUrl: s.coverUrl, gallery: s.gallery };
  [list[i], list[j]] = [list[j], list[i]];
  return fromList(list, !!s.coverUrl.trim());
}

/** The photo becomes the cover; the old cover becomes photo 2 (first in the gallery). */
export function makeCover(s: PhotoSet, url: string): PhotoSet {
  const list = photoList(s);
  if (!list.includes(url)) return { coverUrl: s.coverUrl, gallery: s.gallery };
  return { coverUrl: url, gallery: list.filter((u) => u !== url) };
}

/** Why a move is not possible; null when it is. Used to disable the button and say why. */
export function moveBlock(s: PhotoSet, url: string, dir: -1 | 1): string | null {
  const list = photoList(s);
  const i = list.indexOf(url);
  if (i < 0) return 'Photo not found';
  if (dir === -1 && i === 0) return 'Already first';
  if (dir === 1 && i === list.length - 1) return 'Already last';
  return null;
}
