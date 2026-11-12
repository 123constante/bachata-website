import { useState, type ChangeEvent, type RefObject } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FLYER_ACCEPT } from '@/modules/organiser/shared/flyerModel';
import { GhostButton } from '../ui';
import { MAX_GALLERY, type EventDraft } from './eventModel';
import { makeCover, moveBlock, movePhoto, photoList } from './photoOrder';

interface Props {
  draft: EventDraft;
  patch: (p: Partial<EventDraft>) => void;
  fileRef: RefObject<HTMLInputElement>;
  onPick: (e: ChangeEvent<HTMLInputElement>) => void;
  uploading: boolean;
  uploadError: string | null;
}

const ACTION = 'flex min-h-[44px] flex-1 items-center justify-center gap-[6px] rounded-[12px] border border-[var(--line)] bg-[var(--card2)] px-[12px] text-[14px] font-semibold text-[var(--fg)] disabled:opacity-50';

/** The Gallery sheet with order and cover: tap a photo, then one action bar (Move left, Move right, Make cover, Remove). */
export function PhotoOrderBody({ draft, patch, fileRef, onPick, uploading, uploadError }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const set = { coverUrl: draft.coverUrl, gallery: draft.gallery };
  const list = photoList(set);
  const cover = draft.coverUrl.trim();
  const at = selected ? list.indexOf(selected) : -1;
  const pickedUrl = at >= 0 ? list[at] : null;
  const isCover = !!pickedUrl && pickedUrl === cover;
  const apply = (next: { coverUrl: string; gallery: string[] }) => patch({ coverUrl: next.coverUrl, gallery: next.gallery });
  const left = pickedUrl ? moveBlock(set, pickedUrl, -1) : null;
  const right = pickedUrl ? moveBlock(set, pickedUrl, 1) : null;

  return (
    <div className="space-y-[12px]" data-testid="org-sheet-gallery">
      {list.length === 0 && <p className="text-[14px] text-[var(--mut)]">No photos yet. Add a few from past nights.</p>}
      <div role="list" className="grid grid-cols-3 gap-[8px]">
        {list.map((url, i) => (
          <button key={url} type="button" role="listitem" data-testid="org-gallery-tile" aria-pressed={url === selected}
            aria-label={url === cover ? 'Cover photo' : `Photo ${i + 1}`}
            onClick={() => setSelected(url === selected ? null : url)}
            className={cn('relative aspect-square overflow-hidden rounded-[12px] bg-[var(--card2)]', url === selected && 'outline outline-[3px] -outline-offset-[3px] outline-[var(--fg)]')}>
            <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
            {url === cover && (
              <span className="absolute left-[6px] top-[6px] rounded-full bg-[var(--danger)] px-[7px] py-[2px] text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--danger-fg)]" data-testid="org-gallery-cover-badge">Cover</span>
            )}
          </button>
        ))}
      </div>
      {list.length > 1 && !pickedUrl && <p className="text-[13px] text-[var(--mut)]">Tap a photo to move it, make it the cover or remove it.</p>}
      {pickedUrl && (
        <div className="space-y-[8px]" data-testid="org-gallery-bar">
          <p className="text-[13px] text-[var(--mut)]">{isCover ? 'Cover photo selected' : `Photo ${at + 1} selected`}</p>
          <div className="flex gap-[8px]">
            <button type="button" className={ACTION} disabled={!!left} title={left ?? undefined} data-testid="org-gallery-left"
              onClick={() => apply(movePhoto(set, pickedUrl, -1))}><ArrowLeft aria-hidden="true" className="h-[16px] w-[16px]" /> Move left</button>
            <button type="button" className={ACTION} disabled={!!right} title={right ?? undefined} data-testid="org-gallery-right"
              onClick={() => apply(movePhoto(set, pickedUrl, 1))}>Move right <ArrowRight aria-hidden="true" className="h-[16px] w-[16px]" /></button>
          </div>
          <div className="flex gap-[8px]">
            <button type="button" className={cn(ACTION, !isCover && 'bg-[var(--fg)] text-[var(--bg)]')} disabled={isCover} data-testid="org-gallery-cover"
              onClick={() => apply(makeCover(set, pickedUrl))}>{isCover ? 'This is the cover' : 'Make cover'}</button>
            {!isCover && (
              <button type="button" className={cn(ACTION, 'text-[var(--danger)]')} data-testid="org-gallery-remove"
                onClick={() => { patch({ gallery: draft.gallery.filter((g) => g !== pickedUrl) }); setSelected(null); }}>Remove</button>
            )}
          </div>
        </div>
      )}
      <input ref={fileRef} type="file" accept={FLYER_ACCEPT} multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onPick} data-testid="org-gallery-file" />
      {draft.gallery.length < MAX_GALLERY && (
        <GhostButton loading={uploading} loadingLabel="Uploading" onClick={() => fileRef.current?.click()} testId="org-gallery-add">
          <ImagePlus aria-hidden="true" className="h-[20px] w-[20px]" /> Add photos
        </GhostButton>
      )}
      {uploadError && <p role="alert" className="text-[14px] text-[var(--danger)]">{uploadError}</p>}
    </div>
  );
}
