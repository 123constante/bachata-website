// Make cover / move / Remove for the P3 Pictures sheet (behind flags.organiserPhotoOrder). Pure.
// The same model as the legacy Gallery sheet (../../events/photoOrder.ts, PR #1599): the cover
// (default_cover_image_url) and the gallery (default_gallery) are stored apart, but the organiser
// sees ONE row: the cover first, then the gallery. Actions work by POSITION, so two copies of one
// URL in the gallery are told apart. The draft's ONE save sends both fields (series.upsert).
import { photoList } from '../../events/photoOrder';

export interface Photos { cover: string; gallery: string[] }
export type PhotoAction = 'earlier' | 'later' | 'cover' | 'remove';

export const PHOTO_COPY = {
  hint: 'Tap a picture to make it the cover, move it or remove it. The cover shows first.',
  hintOne: 'Tap the picture to make it the cover or remove it.',
  coverBadge: 'Cover',
  earlier: 'Move earlier',
  later: 'Move later',
  makeCover: 'Make cover',
  remove: 'Remove',
  selected: (n: number, isCover: boolean) => (isCover ? 'The cover is selected' : `Picture ${n} is selected`),
  tile: (n: number, isCover: boolean, picked: boolean) => `${isCover ? 'Cover picture' : `Picture ${n}`}${picked ? ', selected' : ''}`,
  gone: 'That picture is no longer here. Tap another one.',
  firstCover: 'The cover is always first, so it cannot move earlier.',
  first: 'This picture is already first.',
  only: 'This is the only picture, so there is nowhere to move it.',
  last: 'This picture is already last.',
  isCover: 'This picture is already the cover.',
  coverLone: 'The cover cannot be removed here. To change it, use Choose a new cover photo above.',
  coverMany: 'The cover cannot be removed here. Make another picture the cover first, then remove this one.',
} as const;

/** Every picture in the order dancers see it: the cover first, then the gallery. */
export const photosOf = (s: Photos): string[] => photoList({ coverUrl: s.cover, gallery: s.gallery });

const hasCover = (s: Photos) => !!s.cover.trim();

/** A list back into the two stored fields. With no cover, the whole list stays the gallery. */
const back = (list: string[], hadCover: boolean): Photos =>
  (hadCover ? { cover: list[0] ?? '', gallery: list.slice(1) } : { cover: '', gallery: list });

/** Why an action cannot run on picture `i`; null when it can. Shown under the bar, never a silent no-op. */
export function photoBlock(s: Photos, i: number, action: PhotoAction): string | null {
  const list = photosOf(s);
  if (i < 0 || i >= list.length) return PHOTO_COPY.gone;
  const coverAt = hasCover(s) && i === 0;
  if (action === 'earlier' && i === 0) return list.length === 1 ? PHOTO_COPY.only : coverAt ? PHOTO_COPY.firstCover : PHOTO_COPY.first;
  if (action === 'later' && i === list.length - 1) return list.length === 1 ? PHOTO_COPY.only : PHOTO_COPY.last;
  if (action === 'cover' && coverAt) return PHOTO_COPY.isCover;
  if (action === 'remove' && coverAt) return list.length === 1 ? PHOTO_COPY.coverLone : PHOTO_COPY.coverMany;
  return null;
}

/** The pictures after an action on picture `i` (unchanged, same arrays, when it is blocked). */
export function applyPhoto(s: Photos, i: number, action: PhotoAction): Photos {
  if (photoBlock(s, i, action)) return s;
  const list = photosOf(s);
  if (action === 'cover') return { cover: list[i], gallery: list.filter((_, k) => k !== i) };
  if (action === 'remove') return back(list.filter((_, k) => k !== i), hasCover(s));
  const j = action === 'earlier' ? i - 1 : i + 1;
  [list[i], list[j]] = [list[j], list[i]];
  return back(list, hasCover(s));
}

/** Where the selection goes after an action: it follows a moved picture; a removed one clears it. */
export const selectedAfter = (i: number, action: PhotoAction): number | null =>
  (action === 'earlier' ? i - 1 : action === 'later' ? i + 1 : action === 'cover' ? 0 : null);
