import { useEffect, useId, useRef, useState } from 'react';
import { Check, ImagePlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EventRow from '@/components/events/EventRow';
import { publicEventPath } from '@/modules/organiser/shared/editorGuards';
import { commandErrorMessage } from '@/modules/organiser/shared/selfServeErrors';
import {
  FLYER_ACCEPT,
  FLYER_PROBLEM_COPY,
  FlyerError,
  checkFlyerBytes,
  checkFlyerFile,
  flyerCoverCommand,
  isOwnFlyerUrl,
  reencodeFlyer,
  type EncodedFlyer,
  type ReencodeDeps,
} from '@/modules/organiser/shared/flyerModel';
import { uploadFlyer } from '@/modules/organiser/shared/flyerUploadApi';
import type { WorkspaceSeries } from '@/modules/organiser/shared/seriesModel';
import { useOwnerCommand } from '@/modules/organiser/shared/useOwnerCommand';

/**
 * The series flyer: pick a picture from the phone or computer, see it as
 * dancers will (the event page cover and the list card), then save. The
 * picture is checked and re-encoded in the browser first (flyerModel), so
 * only a fresh JPEG/WebP of about 1 MB with no metadata ever leaves the
 * device. Replace only: once a series has a picture there is no remove.
 * A pasted link saved earlier is shown read-only and left alone until a
 * new picture is saved.
 */

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

interface Picked extends EncodedFlyer {
  url: string;
}

export interface FlyerUploadProps {
  series: WorkspaceSeries;
  /** The next date (YYYY-MM-DD) for the card preview's date badge. */
  nextDate: string | null;
  /** One line for the card preview, as the public list shows it. */
  meta: string;
  onSaved: (text: string) => void;
  onDirtyChange: (dirty: boolean) => void;
  /** Test seam: the decode/canvas pair (defaults to the browser's). */
  reencodeDeps?: ReencodeDeps;
}

/** The event page cover tile, drawn the way CoverBlock draws one picture: contain-fit on the raised surface. */
function HeroPreview({ url, title }: { url: string | null; title: string }) {
  return (
    <figure className="space-y-1">
      <div
        className="relative aspect-[2/3] w-32 overflow-hidden rounded-[22px] border"
        style={{ background: '#17131a', borderColor: 'rgba(246,241,234,.12)', boxShadow: 'inset 0 0 32px rgba(0,0,0,0.55)' }}
        data-testid="flyer-hero-preview"
      >
        {url ? (
          <img src={url} loading="lazy" alt={`${title} event page picture`} className="h-full w-full" style={{ objectFit: 'contain' }} data-testid="flyer-hero-image" />
        ) : (
          <div className="flex h-full items-center justify-center p-2 text-center text-[11px]" style={{ color: 'rgba(246,241,234,.62)' }}>
            No picture yet
          </div>
        )}
      </div>
      <figcaption className="text-[11px] text-muted-foreground">Event page</figcaption>
    </figure>
  );
}

/** The public list card: the real EventRow, not clickable here. */
function CardPreview({ url, series, nextDate, meta }: { url: string | null; series: WorkspaceSeries; nextDate: string | null; meta: string }) {
  const day = nextDate ? String(Number(nextDate.slice(8, 10))) : '';
  const mon = nextDate ? MONTHS[Number(nextDate.slice(5, 7)) - 1] ?? '' : '';
  return (
    // At least 220px wide, as on a phone list: below that it drops under the cover tile instead of cutting the title short.
    <figure className="min-w-[220px] flex-1 space-y-1">
      <div className="pointer-events-none rounded-2xl p-1" style={{ background: '#0E0F13' }} aria-hidden="true" data-testid="flyer-card-preview">
        <EventRow href={publicEventPath(series)} name={series.name} posterUrl={url} dateDay={day} dateMon={mon} meta={meta} />
      </div>
      <figcaption className="text-[11px] text-muted-foreground">Lists and search</figcaption>
    </figure>
  );
}

export function FlyerUpload({ series, nextDate, meta, onSaved, onDirtyChange, reencodeDeps }: FlyerUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [checking, setChecking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Picking and saving disable the controls, so the focus would fall off them: put it back here once they are free.
  const focusTo = useRef<'input' | 'note' | 'save' | null>(null);
  const setFocusTo = (target: 'input' | 'note' | 'save') => { focusTo.current = target; };
  const noteRef = useRef<HTMLParagraphElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  // The URL just saved, shown until the series reloads (while the cover is still the one it replaced).
  const [justSaved, setJustSaved] = useState<{ url: string; over: string | null } | null>(null);
  const command = useOwnerCommand(series.id);

  const current = series.default_cover_image_url;
  const currentIsLink = Boolean(current) && !isOwnFlyerUrl(current, series.id);
  const pendingUrl = justSaved && justSaved.over === current ? justSaved.url : null;
  const shown = picked?.url ?? pendingUrl ?? current ?? null;
  const busy = checking || uploading || command.isPending;

  useEffect(() => { onDirtyChange(picked !== null); }, [picked, onDirtyChange]);
  // The local preview URL is released when it is replaced or the screen closes.
  useEffect(() => () => { if (picked) URL.revokeObjectURL(picked.url); }, [picked]);
  useEffect(() => {
    const target = focusTo.current;
    if (!target || busy) return;
    focusTo.current = null;
    (target === 'note' ? noteRef.current : target === 'save' ? saveRef.current : inputRef.current)?.focus();
  });

  const clearInput = () => { if (inputRef.current) inputRef.current.value = ''; };

  const choose = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    const quick = checkFlyerFile(file);
    if (quick) {
      setError(FLYER_PROBLEM_COPY[quick]);
      clearInput();
      return;
    }
    setChecking(true);
    try {
      const sniffed = await checkFlyerBytes(file);
      if (sniffed) throw new FlyerError(sniffed);
      const encoded = await reencodeFlyer(file, reencodeDeps);
      setPicked({ ...encoded, url: URL.createObjectURL(encoded.blob) });
      setFocusTo('note');
    } catch (err) {
      setError(FLYER_PROBLEM_COPY[err instanceof FlyerError ? err.problem : 'not_image']);
      setFocusTo('input');
    } finally {
      setChecking(false);
      clearInput();
    }
  };

  const save = async () => {
    if (!picked) return;
    setError(null);
    let publicUrl: string;
    setUploading(true);
    try {
      publicUrl = await uploadFlyer(series.id, picked);
    } catch (err) {
      setError(FLYER_PROBLEM_COPY[err instanceof FlyerError ? err.problem : 'upload']);
      setFocusTo('save');
      return;
    } finally {
      setUploading(false);
    }
    try {
      await command.mutateAsync({ targetId: series.id, version: series.version, command: flyerCoverCommand(series.name, publicUrl) });
      setJustSaved({ url: publicUrl, over: current });
      setPicked(null);
      setFocusTo('input');
      onSaved('Picture saved. Dancers see it on your event page and in lists.');
    } catch (err) {
      setError(commandErrorMessage(err));
      setFocusTo('save');
    }
  };

  const status = checking ? 'Getting your picture ready\u2026' : uploading ? 'Uploading your picture\u2026' : command.isPending ? 'Saving\u2026' : '';
  const chooseLabel = picked ? 'Choose a different picture' : shown ? 'Choose a new picture' : 'Choose a picture';

  return (
    // contain inline-size: the card preview's one-line title must not widen the editor's grid past a phone screen.
    <section className="[contain:inline-size] rounded-md border border-border p-3 space-y-3" data-testid="flyer-upload" aria-labelledby="flyer-heading">
      <div>
        <h2 id="flyer-heading" className="text-base font-semibold">Picture</h2>
        <p className="text-xs text-muted-foreground">
          Your flyer or a photo. JPEG, PNG or WebP, up to 10 MB. We make it smaller before it uploads.
        </p>
      </div>

      {currentIsLink && !picked && !pendingUrl && (
        <div className="space-y-1" data-testid="flyer-current-link">
          <p className="text-xs font-medium">Current picture link</p>
          <p className="text-xs text-muted-foreground break-all select-all" data-testid="flyer-current-link-value">{current}</p>
          <p className="text-[11px] text-muted-foreground">This stays until you save a new picture.</p>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-3">
        <HeroPreview url={shown} title={series.name} />
        <CardPreview url={shown} series={series} nextDate={nextDate} meta={meta} />
      </div>
      {picked && (
        <p ref={noteRef} tabIndex={-1} className="text-xs text-primary outline-none" data-testid="flyer-preview-note">
          This is how it will look. It is not saved yet.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {/* With a picture waiting, its save and its way back come first, side by side. */}
        {picked && (
          <>
            <Button type="button" size="sm" variant="ghost" className="min-h-[44px]" disabled={busy} onClick={() => { setPicked(null); setError(null); setFocusTo('input'); }} data-testid="flyer-cancel">
              {current || pendingUrl ? 'Keep the current picture' : 'Do not use this picture'}
            </Button>
            <Button ref={saveRef} type="button" size="sm" className="min-h-[44px]" disabled={busy} onClick={() => void save()} data-testid="flyer-save">
              {(uploading || command.isPending) && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Save picture
            </Button>
          </>
        )}
        {/* The input sits inside its label so the label shows the keyboard focus. No capture attribute: phones offer camera and gallery. */}
        <label
          htmlFor={inputId}
          className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background ${busy ? 'pointer-events-none opacity-50' : ''}`}
          data-testid="flyer-choose"
        >
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={FLYER_ACCEPT}
            className="sr-only"
            disabled={busy}
            onChange={(e) => void choose(e.target.files?.[0])}
            data-testid="flyer-input"
          />
          {checking ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="w-4 h-4" aria-hidden="true" />}
          {chooseLabel}
        </label>
        {/* Always in the page, so screen readers hear each step as its text changes. */}
        <p className="text-xs text-muted-foreground" role="status" data-testid="flyer-status">{status}</p>
      </div>
      {justSaved && !picked && !busy && (
        <p className="flex items-start gap-2 text-sm text-primary" data-testid="flyer-saved">
          <Check className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" /> Saved. This is the picture dancers see now.
        </p>
      )}
      {error && <p className="text-sm text-destructive" role="alert" data-testid="flyer-error">{error}</p>}
      <p className="text-[11px] text-muted-foreground">
        A date you gave its own picture keeps it. Every other date shows this one.
      </p>
    </section>
  );
}
