import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Check, ImagePlus, MapPin, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FLYER_ACCEPT } from '@/modules/organiser/shared/flyerModel';
import type { VenueOption } from '@/modules/organiser/shared/publicVenues';
import { canConfirm, confirmCopy } from '@/modules/organiser/shared/editorGuards';
import { linkOnClose, linkProblem } from '@/modules/organiser/shared/linkRules';
import { Card, Collapse, ErrorState, FIELD_CLASS, GhostButton, PrimaryButton, SearchField, SheetView, SkeletonRows, SummaryRow } from '../ui';
import { CAP_NOTE, allowedEndChoices, type CapInput } from './dateCap';
import { MAX_GALLERY, MAX_VIDEOS, SHAPE_LABEL, shortDate, weekdayName, type EventDraft, type Shape } from './eventModel';

export type SheetName = 'gallery' | 'video' | 'starts' | 'repeats' | 'one-date' | 'until' | 'venue' | 'venue-search' | 'description' | 'ticket';

/** The description's limit (the server's and draftProblem's). */
export const MAX_DESCRIPTION = 4000;

const TITLES: Record<SheetName, string> = {
  gallery: 'Gallery', video: 'Videos', starts: 'Starts on', repeats: 'Repeats', 'one-date': 'One date', until: 'Listed until',
  venue: 'Venue', 'venue-search': 'Find a venue', description: 'Description', ticket: 'Ticket link',
};

interface Props {
  sheet: SheetName | null;
  onSheet: (sheet: SheetName | null) => void;
  draft: EventDraft;
  patch: (p: Partial<EventDraft>) => void;
  today: string;
  cap: CapInput;
  venues: VenueOption[] | undefined;
  /** The venue list failed to load: the search view shows a retry. */
  venuesError?: boolean;
  onRetryVenues?: () => void;
  venuesRetrying?: boolean;
  onUploadGallery: (files: File[]) => void;
  uploading: boolean;
  uploadError: string | null;
  /** Why 'One date' cannot be chosen (a live or paused repeating event); null when it can. */
  stopReason?: string | null;
  /** The 'Listed until' sheet's sentence (listingView.sheetNote, the row's own mapping). */
  capNote?: string;
  /** Weekly -> One date: how many listed dates would go (oneDateLoss); above 0 asks first. */
  oneDateLoss?: number;
}

function Choice({ selected, label, sub, onPress, disabled, testId }: { selected: boolean; label: string; sub?: string; onPress: () => void; disabled?: boolean; testId: string }) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onPress} disabled={disabled} data-testid={testId}
      className={cn('flex min-h-[52px] w-full items-center gap-[12px] px-[16px] py-[12px] text-left', disabled && 'cursor-not-allowed opacity-60')}>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] text-[var(--fg)]">{label}</span>
        {sub && <span className="block text-[13px] text-[var(--mut)]">{sub}</span>}
      </span>
      {selected && <Check aria-hidden="true" className="h-[20px] w-[20px] text-[var(--gold)]" />}
    </button>
  );
}

/** A photo or video on its way out: already gone from the draft, still drawn while it collapses. */
type Leaving = { url: string; at: number };

/** The draft list with the leaving items put back where they were drawn. */
function withLeaving(list: string[], leaving: Leaving[]) {
  const out = list.filter((url) => !leaving.some((l) => l.url === url)).map((url) => ({ url, leaving: false }));
  for (const l of [...leaving].sort((a, b) => a.at - b.at)) out.splice(Math.min(l.at, out.length), 0, { url: l.url, leaving: true });
  return out;
}

/** The editor's ONE sheet. Each row opens a view of it; nothing nests. */
export function EditorSheet({ sheet, onSheet, draft, patch, today, cap, venues, venuesError, onRetryVenues, venuesRetrying, onUploadGallery, uploading, uploadError, stopReason = null, capNote = `${CAP_NOTE}. Extend later to list more.`, oneDateLoss = 0 }: Props) {
  const [query, setQuery] = useState('');
  const [videoInput, setVideoInput] = useState('');
  const [ack, setAck] = useState(false);
  // The ticket link as the sheet opened: the X puts it back over an invalid entry.
  const [opened, setOpened] = useState({ sheet, ticketUrl: draft.ticketUrl });
  if (opened.sheet !== sheet) setOpened({ sheet, ticketUrl: draft.ticketUrl });
  // The ticket and video sheets check the link as it is typed with the rule Save uses.
  const ticketProblem = linkProblem('ticket', draft.ticketUrl);
  const videoProblem = linkProblem('video', videoInput);
  const oneDate = confirmCopy('one_date', { subject: draft.startDate ? shortDate(draft.startDate, today) : 'one date', count: oneDateLoss });
  // Removal leaves the draft at once (so Done mid-fade still saves it); the
  // row or tile is drawn on until Collapse has faded it and closed the gap.
  const [leavingVideos, setLeavingVideos] = useState<Leaving[]>([]);
  const [leavingPhotos, setLeavingPhotos] = useState<Leaving[]>([]);
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

  const photos = withLeaving(draft.gallery, leavingPhotos);
  const videos = withLeaving(draft.videos, leavingVideos);

  let body = null;
  switch (sheet) {
    case 'gallery':
      body = (
        <div className="space-y-[12px]" data-testid="org-sheet-gallery">
          {photos.length === 0 && <p className="text-[14px] text-[var(--mut)]">No photos yet. Add a few from past nights.</p>}
          <div role="list" className="grid grid-cols-3 gap-[8px]">
            {photos.map(({ url, leaving }, i) => (
              <Collapse key={url} show={!leaving} testId="org-gallery-tile" onExited={() => setLeavingPhotos((l) => l.filter((x) => x.url !== url))}>
                <div role="listitem" className="relative aspect-square overflow-hidden rounded-[12px] bg-[var(--card2)]">
                  <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  <button type="button" aria-label="Remove this photo" data-testid="org-gallery-remove" disabled={leaving}
                    onClick={() => {
                      setLeavingPhotos((l) => [...l, { url, at: i }]);
                      patch({ gallery: draft.gallery.filter((g) => g !== url) });
                    }}
                    className="absolute right-0 top-0 flex h-[44px] w-[44px] items-center justify-center rounded-full text-[var(--fg)]">
                    <span aria-hidden="true" className="flex h-[32px] w-[32px] items-center justify-center rounded-full bg-[var(--bg)]">
                      <X className="h-[16px] w-[16px]" />
                    </span>
                  </button>
                </div>
              </Collapse>
            ))}
          </div>
          <input ref={fileRef} type="file" accept={FLYER_ACCEPT} multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={pick} data-testid="org-gallery-file" />
          {draft.gallery.length < MAX_GALLERY && (
            <GhostButton loading={uploading} loadingLabel="Uploading" onClick={() => fileRef.current?.click()} testId="org-gallery-add">
              <ImagePlus aria-hidden="true" className="h-[20px] w-[20px]" /> Add photos
            </GhostButton>
          )}
          {uploadError && <p role="alert" className="text-[14px] text-[var(--danger)]">{uploadError}</p>}
        </div>
      );
      break;
    case 'video': {
      const add = () => {
        const url = videoInput.trim();
        if (!url || videoProblem || draft.videos.includes(url)) return;
        setLeavingVideos((l) => l.filter((x) => x.url !== url));
        patch({ videos: [...draft.videos, url] });
        setVideoInput('');
      };
      body = (
        <div className="space-y-[12px]" data-testid="org-sheet-video">
          {videos.length > 0 && (
            <Card>
              {videos.map(({ url, leaving }, i) => (
                <Collapse key={url} show={!leaving} testId="org-video-row" onExited={() => setLeavingVideos((l) => l.filter((x) => x.url !== url))}>
                <div className="flex min-h-[52px] items-center gap-[8px] px-[16px] py-[8px]">
                  <span className="min-w-0 flex-1 truncate text-[14px] text-[var(--fg)]">{url}</span>
                  <button type="button" aria-label="Remove this video" data-testid="org-video-remove" disabled={leaving}
                    onClick={() => {
                      setLeavingVideos((l) => [...l, { url, at: i }]);
                      patch({ videos: draft.videos.filter((v) => v !== url) });
                    }}
                    className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full text-[var(--mut)]">
                    <X aria-hidden="true" className="h-[16px] w-[16px]" />
                  </button>
                </div>
                </Collapse>
              ))}
            </Card>
          )}
          {draft.videos.length < MAX_VIDEOS && (
            <div className="flex gap-[8px]">
              <input type="url" inputMode="url" placeholder="https://youtube.com/..." aria-label="Video link" value={videoInput}
                onChange={(e) => setVideoInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
                data-sheet-autofocus data-testid="org-video-input" className={cn(FIELD_CLASS, 'h-[48px] min-w-0 flex-1')} />
              <GhostButton block={false} size="sm" className="h-[48px]" onClick={add} disabled={!videoInput.trim() || !!videoProblem}
                aria-describedby={videoProblem ? 'org-video-problem' : undefined} testId="org-video-add">Add</GhostButton>
            </div>
          )}
          {videoProblem && <p id="org-video-problem" role="alert" className="text-[14px] text-[var(--danger)]" data-testid="org-video-problem">{videoProblem}</p>}
        </div>
      );
      break;
    }
    case 'starts':
      body = (
        <div className="space-y-[8px]" data-testid="org-sheet-starts">
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
                sub={shape === 'single' ? (stopReason && draft.shape !== 'single' ? stopReason : 'One night only') : 'Same day every week'}
                disabled={shape === 'single' && !!stopReason && draft.shape !== 'single'}
                onPress={() => {
                  if (shape === 'weekly') patch({ shape, until: draft.until ?? choices.find((c) => c.count >= 8)?.until ?? choices[choices.length - 1]?.until ?? null });
                  // Dates would go: say how many and ask before choosing it.
                  else if (draft.shape === 'weekly' && oneDateLoss > 0) { setAck(false); onSheet('one-date'); }
                  else patch({ shape });
                }} />
            ))}
          </Card>
        </div>
      );
      break;
    case 'one-date':
      body = (
        <div className="space-y-[12px]" data-testid="org-sheet-one-date">
          <p className="text-[15px] font-semibold text-[var(--fg)]">{oneDate.title}</p>
          <p className="text-[15px] text-[var(--fg)]" data-testid="org-one-date-consequence">{oneDate.consequence} {oneDate.undo}</p>
          {oneDate.requireAck && (
            <label className="flex min-h-[44px] items-start gap-[12px] text-[15px] text-[var(--fg)]">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-[4px] h-[20px] w-[20px] accent-[var(--gold)]" data-testid="org-one-date-ack" />
              {oneDate.ackLabel}
            </label>
          )}
          <GhostButton onClick={() => onSheet('repeats')} testId="org-one-date-keep">{oneDate.keepLabel}</GhostButton>
        </div>
      );
      break;
    case 'until':
      body = (
        <div className="space-y-[8px]" data-testid="org-sheet-until">
          <p className="text-[14px] text-[var(--mut)]" data-testid="org-cap-note">{capNote}</p>
          <div role="radiogroup" aria-label="Listed until">
            <Card>
              {choices.map((c) => (
                <Choice key={c.until} selected={draft.until === c.until} testId="org-until-choice"
                  label={`${c.count} dates`} sub={`Listed until ${shortDate(c.until, today)}`} onPress={() => patch({ until: c.until })} />
              ))}
            </Card>
          </div>
          {choices.length === 0 && <p className="text-[14px] text-[var(--fg)]">No end fits: 30 or more upcoming dates are already listed.</p>}
        </div>
      );
      break;
    case 'venue':
      body = (
        <div className="space-y-[12px]" data-testid="org-sheet-venue">
          <Card>
            <SummaryRow icon={<MapPin />} label={current?.name ?? 'No venue yet'} sublabel={current ? [current.neighbourhood, current.city_name].filter(Boolean).join(', ') : 'Dancers see the venue on your event'} />
            <SummaryRow icon={<Search />} label={current ? 'Change venue' : 'Choose a venue'} onPress={() => onSheet('venue-search')} testId="org-venue-search-open" />
          </Card>
          <p className="text-[13px] text-[var(--mut)]">The city comes from the venue.</p>
        </div>
      );
      break;
    case 'venue-search':
      body = (
        <div className="space-y-[12px]" data-testid="org-sheet-venue-search">
          <SearchField value={query} onChange={setQuery} aria-label="Search venues" placeholder="Search venues" autoFocusInSheet testId="org-venue-query" />
          {!venues && venuesError ? (
            <ErrorState quiet title="Venues did not load" onRetry={() => onRetryVenues?.()} retrying={venuesRetrying} testId="org-venue-error" />
          ) : !venues ? (
            <SkeletonRows count={3} label="Loading venues" />
          ) : results.length > 0 && (
          <Card>
            {results.map((v) => (
              <SummaryRow key={v.id} label={v.name} sublabel={[v.neighbourhood, v.city_name].filter(Boolean).join(', ')} affordance="none"
                testId="org-venue-result" onPress={() => { patch({ venueId: v.id }); setQuery(''); onSheet('venue'); }} />
            ))}
          </Card>
          )}
          {venues && results.length === 0 && <p className="text-[14px] text-[var(--mut)]">No venue matches. Ask the team to add it.</p>}
        </div>
      );
      break;
    case 'description':
      body = (
        <div className="space-y-[8px]">
          <textarea value={draft.description} onChange={(e) => patch({ description: e.target.value })} rows={4} maxLength={MAX_DESCRIPTION}
            aria-label="Description" aria-describedby="org-description-count" placeholder="What dancers can expect" data-sheet-autofocus data-testid="org-description-input"
            className={cn(FIELD_CLASS, 'py-[12px]')} />
          <p id="org-description-count" className="text-right text-[13px] text-[var(--mut)]" data-testid="org-description-count">
            {draft.description.length >= MAX_DESCRIPTION
              ? `That is the limit: ${MAX_DESCRIPTION.toLocaleString('en-GB')} characters.`
              : `${draft.description.length.toLocaleString('en-GB')} of ${MAX_DESCRIPTION.toLocaleString('en-GB')} characters`}
          </p>
        </div>
      );
      break;
    case 'ticket':
      body = (
        <div className="space-y-[8px]">
          <input type="url" inputMode="url" placeholder="https://" aria-label="Ticket link" value={draft.ticketUrl} data-sheet-autofocus data-testid="org-ticket-input"
            aria-invalid={!!ticketProblem} aria-describedby={ticketProblem ? 'org-ticket-problem' : undefined}
            onChange={(e) => patch({ ticketUrl: e.target.value })} className={cn(FIELD_CLASS, 'h-[48px]')} />
          {ticketProblem
            ? <p id="org-ticket-problem" role="alert" className="text-[14px] text-[var(--danger)]" data-testid="org-ticket-problem">{ticketProblem}</p>
            : <p className="text-[13px] text-[var(--mut)]">Where dancers book or buy tickets.</p>}
        </div>
      );
      break;
    default:
      body = null;
  }

  return (
    <SheetView
      open={sheet !== null}
      onOpenChange={(open) => {
        if (open) return;
        // Closed without Done (X, outside, Escape): an invalid link is discarded (linkOnClose).
        if (sheet === 'ticket') {
          const kept = linkOnClose('ticket', draft.ticketUrl, opened.ticketUrl);
          if (kept !== draft.ticketUrl) patch({ ticketUrl: kept });
        }
        if (sheet === 'video') setVideoInput(linkOnClose('video', videoInput, ''));
        onSheet(null);
      }}
      title={sheet ? TITLES[sheet] : ''}
      viewKey={sheet ?? undefined}
      onBack={sheet === 'venue-search' ? () => onSheet('venue') : sheet === 'one-date' ? () => onSheet('repeats') : undefined}
      fullHeight={sheet === 'venue-search' || sheet === 'gallery'}
      footer={sheet === 'one-date' ? (
        <PrimaryButton onClick={() => { patch({ shape: 'single' }); onSheet(null); }} disabled={!canConfirm(oneDate, ack, false)} testId="org-one-date-confirm">
          {oneDate.confirmLabel}
        </PrimaryButton>
      ) : (
        <PrimaryButton
          onClick={() => {
            // A valid link typed but not added yet is added, not lost.
            if (sheet === 'video' && videoInput.trim() && !draft.videos.includes(videoInput.trim())) patch({ videos: [...draft.videos, videoInput.trim()] });
            setVideoInput('');
            onSheet(null);
          }}
          disabled={(sheet === 'ticket' && !!ticketProblem) || (sheet === 'video' && !!videoProblem)}
          aria-describedby={sheet === 'ticket' && ticketProblem ? 'org-ticket-problem' : sheet === 'video' && videoProblem ? 'org-video-problem' : undefined}
          testId="org-sheet-done"
        >
          Done
        </PrimaryButton>
      )}
      testId="org-editor-sheet"
    >
      {body ?? <span />}
    </SheetView>
  );
}
