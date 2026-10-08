import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Check, ImagePlus, MapPin, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FLYER_ACCEPT } from '@/modules/organiser-self-serve/flyerModel';
import type { VenueOption } from '@/modules/organiser-self-serve/components/publicVenues';
import { Card, GhostButton, SearchField, SheetView, SummaryRow } from '../ui';
import { CAP_NOTE, allowedEndChoices, type CapInput } from './dateCap';
import { MAX_GALLERY, MAX_VIDEOS, SHAPE_LABEL, shortDate, weekdayName, type EventDraft, type Shape } from './eventModel';

export type SheetName = 'gallery' | 'video' | 'starts' | 'repeats' | 'until' | 'venue' | 'venue-search' | 'description' | 'ticket';

export const FIELD_CLASS =
  'w-full rounded-[12px] border border-[var(--line-strong)] bg-[var(--card2)] px-3 text-[16px] text-[var(--fg)] placeholder:text-[var(--ph)]';

const TITLES: Record<SheetName, string> = {
  gallery: 'Gallery', video: 'Videos', starts: 'Starts on', repeats: 'Repeats', until: 'Listed until',
  venue: 'Place', 'venue-search': 'Find a place', description: 'Description', ticket: 'Ticket link',
};

interface Props {
  sheet: SheetName | null;
  onSheet: (sheet: SheetName | null) => void;
  draft: EventDraft;
  patch: (p: Partial<EventDraft>) => void;
  today: string;
  cap: CapInput;
  venues: VenueOption[] | undefined;
  onUploadGallery: (files: File[]) => void;
  uploading: boolean;
  uploadError: string | null;
}

function Choice({ selected, label, sub, onPress, testId }: { selected: boolean; label: string; sub?: string; onPress: () => void; testId: string }) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onPress} data-testid={testId}
      className="flex min-h-[52px] w-full items-center gap-3 px-4 py-3 text-left">
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] text-[var(--fg)]">{label}</span>
        {sub && <span className="block text-[13px] text-[var(--mut)]">{sub}</span>}
      </span>
      {selected && <Check aria-hidden="true" className="h-5 w-5 text-[var(--gold)]" />}
    </button>
  );
}

/** The editor's ONE sheet. Each row opens a view of it; nothing nests. */
export function EditorSheet({ sheet, onSheet, draft, patch, today, cap, venues, onUploadGallery, uploading, uploadError }: Props) {
  const [query, setQuery] = useState('');
  const [videoInput, setVideoInput] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const choices = useMemo(() => allowedEndChoices(cap), [cap]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = venues ?? [];
    return (q ? list.filter((v) => [v.name, v.neighbourhood, v.city_name].some((t) => t?.toLowerCase().includes(q))) : list).slice(0, 30);
  }, [venues, query]);
  const current = venues?.find((v) => v.id === draft.venueId) ?? null;

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_GALLERY - draft.gallery.length);
    e.target.value = '';
    if (files.length) onUploadGallery(files);
  };

  let body = null;
  switch (sheet) {
    case 'gallery':
      body = (
        <div className="space-y-3" data-testid="org-sheet-gallery">
          {draft.gallery.length === 0 && <p className="text-[14px] text-[var(--mut)]">No photos yet. Add a few from past nights.</p>}
          <ul className="grid grid-cols-3 gap-2">
            {draft.gallery.map((url) => (
              <li key={url} className="relative aspect-square overflow-hidden rounded-[12px] bg-[var(--card2)]">
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button type="button" aria-label="Remove this photo" data-testid="org-gallery-remove"
                  onClick={() => patch({ gallery: draft.gallery.filter((g) => g !== url) })}
                  className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg)] text-[var(--fg)] after:absolute after:-inset-[6px]">
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <input ref={fileRef} type="file" accept={FLYER_ACCEPT} multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={pick} data-testid="org-gallery-file" />
          {draft.gallery.length < MAX_GALLERY && (
            <GhostButton loading={uploading} loadingLabel="Uploading" onClick={() => fileRef.current?.click()} testId="org-gallery-add">
              <ImagePlus aria-hidden="true" className="h-5 w-5" /> Add photos
            </GhostButton>
          )}
          {uploadError && <p role="alert" className="text-[14px] text-[var(--danger)]">{uploadError}</p>}
        </div>
      );
      break;
    case 'video': {
      const add = () => {
        const url = videoInput.trim();
        if (!url || draft.videos.includes(url)) return;
        patch({ videos: [...draft.videos, url] });
        setVideoInput('');
      };
      body = (
        <div className="space-y-3" data-testid="org-sheet-video">
          {draft.videos.length > 0 && (
            <Card>
              {draft.videos.map((url) => (
                <div key={url} className="flex min-h-[52px] items-center gap-2 px-4 py-2">
                  <span className="min-w-0 flex-1 truncate text-[14px] text-[var(--fg)]">{url}</span>
                  <button type="button" aria-label="Remove this video" data-testid="org-video-remove"
                    onClick={() => patch({ videos: draft.videos.filter((v) => v !== url) })}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--mut)]">
                    <X aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </Card>
          )}
          {draft.videos.length < MAX_VIDEOS && (
            <div className="flex gap-2">
              <input type="url" inputMode="url" placeholder="https://youtube.com/..." aria-label="Video link" value={videoInput}
                onChange={(e) => setVideoInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
                data-sheet-autofocus data-testid="org-video-input" className={cn(FIELD_CLASS, 'h-[48px] min-w-0 flex-1')} />
              <GhostButton block={false} size="sm" className="h-[48px]" onClick={add} testId="org-video-add">Add</GhostButton>
            </div>
          )}
        </div>
      );
      break;
    }
    case 'starts':
      body = (
        <div className="space-y-2" data-testid="org-sheet-starts">
          <input type="date" min={today} value={draft.startDate} aria-label="Starts on" data-sheet-autofocus data-testid="org-starts-input"
            onChange={(e) => { if (e.target.value) patch({ startDate: e.target.value, until: null }); }}
            className={cn(FIELD_CLASS, 'h-[48px]')} />
          {draft.shape === 'weekly' && <p className="text-[13px] text-[var(--mut)]">A weekly event repeats on the weekday it starts on. Choose how long it is listed again after this.</p>}
        </div>
      );
      break;
    case 'repeats':
      body = (
        <div role="radiogroup" aria-label="Repeats" data-testid="org-sheet-repeats">
          <Card>
            {(['single', 'weekly'] as Shape[]).map((shape) => (
              <Choice key={shape} selected={draft.shape === shape} testId={`org-shape-${shape}`}
                label={shape === 'weekly' && draft.startDate ? `Every ${weekdayName(draft.startDate)}` : SHAPE_LABEL[shape]}
                sub={shape === 'single' ? 'One night only' : 'Same day every week'}
                onPress={() => patch(shape === 'weekly' ? { shape, until: draft.until ?? choices.find((c) => c.count >= 8)?.until ?? choices[choices.length - 1]?.until ?? null } : { shape })} />
            ))}
          </Card>
        </div>
      );
      break;
    case 'until':
      body = (
        <div className="space-y-2" data-testid="org-sheet-until">
          <p className="text-[14px] text-[var(--mut)]" data-testid="org-cap-note">{CAP_NOTE}. Extend later to list more.</p>
          <div role="radiogroup" aria-label="Listed until">
            <Card>
              {choices.map((c) => (
                <Choice key={c.until} selected={draft.until === c.until} testId="org-until-choice"
                  label={`${c.count} dates`} sub={`Listed until ${shortDate(c.until, today)}`} onPress={() => patch({ until: c.until })} />
              ))}
            </Card>
          </div>
          {choices.length === 0 && <p className="text-[14px] text-[var(--fg)]">There are already 30 upcoming dates.</p>}
        </div>
      );
      break;
    case 'venue':
      body = (
        <div className="space-y-3" data-testid="org-sheet-venue">
          <Card>
            <SummaryRow icon={<MapPin />} label={current?.name ?? 'No place yet'} sublabel={current ? [current.neighbourhood, current.city_name].filter(Boolean).join(', ') : 'Dancers see the place on your event'} />
            <SummaryRow icon={<Search />} label={current ? 'Change place' : 'Choose a place'} onPress={() => onSheet('venue-search')} testId="org-venue-search-open" />
          </Card>
          <p className="text-[13px] text-[var(--mut)]">The city comes from the place.</p>
        </div>
      );
      break;
    case 'venue-search':
      body = (
        <div className="space-y-3" data-testid="org-sheet-venue-search">
          <SearchField value={query} onChange={setQuery} aria-label="Search places" placeholder="Search places" autoFocusInSheet testId="org-venue-query" />
          <Card>
            {results.map((v) => (
              <SummaryRow key={v.id} label={v.name} sublabel={[v.neighbourhood, v.city_name].filter(Boolean).join(', ')} affordance="none"
                testId="org-venue-result" onPress={() => { patch({ venueId: v.id }); setQuery(''); onSheet('venue'); }} />
            ))}
          </Card>
          {results.length === 0 && <p className="text-[14px] text-[var(--mut)]">{venues ? 'No place matches. Ask the team to add it.' : 'Loading places'}</p>}
        </div>
      );
      break;
    case 'description':
      body = (
        <textarea value={draft.description} onChange={(e) => patch({ description: e.target.value })} rows={8} maxLength={4000}
          aria-label="Description" placeholder="What dancers can expect" data-sheet-autofocus data-testid="org-description-input"
          className={cn(FIELD_CLASS, 'py-3')} />
      );
      break;
    case 'ticket':
      body = (
        <div className="space-y-2">
          <input type="url" inputMode="url" placeholder="https://" aria-label="Ticket link" value={draft.ticketUrl} data-sheet-autofocus data-testid="org-ticket-input"
            onChange={(e) => patch({ ticketUrl: e.target.value })} className={cn(FIELD_CLASS, 'h-[48px]')} />
          <p className="text-[13px] text-[var(--mut)]">Where dancers book or buy tickets.</p>
        </div>
      );
      break;
    default:
      body = null;
  }

  return (
    <SheetView
      open={sheet !== null}
      onOpenChange={(open) => { if (!open) onSheet(null); }}
      title={sheet ? TITLES[sheet] : ''}
      viewKey={sheet ?? undefined}
      onBack={sheet === 'venue-search' ? () => onSheet('venue') : undefined}
      fullHeight={sheet === 'venue-search' || sheet === 'gallery'}
      footer={<GhostButton onClick={() => onSheet(null)} testId="org-sheet-done">Done</GhostButton>}
      testId="org-editor-sheet"
    >
      {body ?? <span />}
    </SheetView>
  );
}
