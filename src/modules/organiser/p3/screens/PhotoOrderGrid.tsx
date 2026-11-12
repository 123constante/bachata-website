import { useState } from 'react';
import { PHOTO_COPY, applyPhoto, photoBlock, photosOf, selectedAfter, type PhotoAction, type Photos } from '../model/photoOrder';

const ACTIONS: { action: PhotoAction; label: string }[] = [
  { action: 'earlier', label: PHOTO_COPY.earlier },
  { action: 'later', label: PHOTO_COPY.later },
  { action: 'cover', label: PHOTO_COPY.makeCover },
  { action: 'remove', label: PHOTO_COPY.remove },
];

/**
 * The P3 Pictures sheet's grid with order and cover (flags.organiserPhotoOrder): the cover first,
 * then the gallery. Tap a picture, then Move earlier / Move later / Make cover / Remove. A control
 * that cannot run is disabled and its reason shows under it. Edits the draft only; Save sends.
 */
export function PhotoOrderGrid({ photos, off, onPhotos }: { photos: Photos; off: boolean; onPhotos: (next: Photos) => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const list = photosOf(photos);
  const cover = !!photos.cover.trim();
  const at = picked !== null && picked < list.length ? picked : null;
  const run = (i: number, action: PhotoAction) => {
    onPhotos(applyPhoto(photos, i, action));
    setPicked(selectedAfter(i, action));
  };
  const blocks = at === null ? [] : ACTIONS.map((a) => ({ ...a, why: photoBlock(photos, at, a.action) }));
  return (
    <>
      {list.length > 0 && <p className="p3-note" data-testid="p3-pictures-order-hint">{list.length === 1 ? PHOTO_COPY.hintOne : PHOTO_COPY.hint}</p>}
      <div role="list" className="p3-photos" data-testid="p3-pictures">
        {list.map((url, i) => (
          <div role="listitem" key={`${url}-${i}`} className="p3-photo" data-testid="p3-picture">
            <button type="button" className="p3-photo-pick" aria-pressed={i === at} disabled={off}
              aria-label={PHOTO_COPY.tile(i + 1, cover && i === 0, i === at)}
              onClick={() => setPicked(i === at ? null : i)} data-testid="p3-picture-pick">
              <img src={url} alt="" loading="lazy" />
            </button>
            {cover && i === 0 && <span className="p3-photo-badge" data-testid="p3-picture-cover-badge">{PHOTO_COPY.coverBadge}</span>}
          </div>
        ))}
      </div>
      {at !== null && (
        <div className="p3-card p3-tight p3-stack-s" data-testid="p3-picture-bar">
          <p className="p3-row-t" role="status">{PHOTO_COPY.selected(at + 1, cover && at === 0)}</p>
          <div className="p3-photo-acts">
            {blocks.map((b) => (
              <button key={b.action} type="button" className="p3-btn p3-btn-line" style={{ minHeight: 44 }} disabled={off || !!b.why}
                aria-describedby={b.why ? `p3-why-${b.action}` : undefined} onClick={() => run(at, b.action)} data-testid={`p3-picture-${b.action}`}>
                {b.label}
              </button>
            ))}
          </div>
          {blocks.filter((b) => b.why).map((b) => (
            <p key={b.action} id={`p3-why-${b.action}`} className="p3-note" data-testid={`p3-picture-why-${b.action}`}>{b.why}</p>
          ))}
        </div>
      )}
    </>
  );
}
