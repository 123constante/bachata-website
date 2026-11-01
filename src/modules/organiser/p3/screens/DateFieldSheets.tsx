import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { MAX_GALLERY, type EventWorkspace } from '../../events/eventModel';
import { uploadEventPicture } from '../../events/media';
import { newPriceRow, type PriceRow } from '../../events/seriesExtras';
import { FLYER_ACCEPT } from '../../shared/flyerModel';
import { commandErrorMessage } from '../../shared/selfServeErrors';
import type { OverridePatch } from '../../shared/seriesCommands';
import type { DateDetail } from '../../shared/seriesModel';
import { L } from '../model';
import { useLeave } from './EditTray';
import { sameValue } from '../model/saveModel';
import {
  DATE_NAME_MAX, dateGalleryOf, dateGalleryPatch, dateNameOf, dateNamePatch, dateNameProblem, datePriceRows, datePricesPatch, datePricesProblem,
} from '../data/dateFields';
import { PriceCard } from './PriceCard';
import { Sheet } from './Sheet';

/** The three W3b-2 steps of the date sheet: this date's own Name, Photos, Price. */
export type FieldStep = 'edit-name' | 'edit-photos' | 'edit-price';

interface FieldProps {
  ws: EventWorkspace;
  detail: DateDetail | null;
  busy: boolean;
  error: string | null;
  onSave: (patch: OverridePatch) => void;
  onBack: () => void;
  onClose: () => void;
}

/**
 * The shared save model for one field of one date: the draft beside the base it opened with,
 * a save that sends only a real change (the builder's patch, null = nothing to send), a leave
 * guard on Back and Close, and "Undo my changes" behind a confirm.
 */
function FieldSheet<T>({ title, base, draft, setDraft, patch, problem, busy, uploading = false, error, onSave, onBack, onClose, children }: {
  title: string; base: T; draft: T; setDraft: (v: T) => void; patch: OverridePatch | null; problem: string | null;
  /** Photos still uploading: leaving asks first (they would be lost), saving waits. */
  uploading?: boolean;
  children: ReactNode;
} & Omit<FieldProps, 'ws' | 'detail'>) {
  const [ask, setAsk] = useState<null | 'leave' | 'close' | 'undo'>(null);
  // Dirty only when the draft differs in what a save compares (trimmed, as sent): a trailing space is no change.
  const dirty = !sameValue(base, draft) && (patch !== null || problem !== null);
  // F-24: a tab-bar tap or phone Back (router navigation) asks first too, through the same ask below
  const [routeGo, setRouteGo] = useState<(() => void) | null>(null);
  const blocker = useLeave((dirty || uploading) && !busy, (a) => {
    if (a?.kind === 'leave') { setRouteGo(() => a.go); setAsk('leave'); }
  });
  const stay = () => { if (blocker.state === 'blocked') blocker.reset?.(); setRouteGo(null); setAsk(null); };
  const guard = (to: 'leave' | 'close', go: () => void) => () => ((dirty || uploading) && !busy ? setAsk(to) : go());
  const why = !dirty || patch ? null : problem;
  // Sheet re-runs its focus effect when onClose changes: keep ONE function, reading the latest guard,
  // so typing never moves the focus out of the field.
  const closeNow = useRef(onClose);
  useLayoutEffect(() => { closeNow.current = guard('close', onClose); });
  const close = useCallback(() => closeNow.current(), []);
  return (
    <Sheet title={title} onClose={close}>
      <button type="button" className="p3-link" onClick={guard('leave', onBack)} data-testid="p3-field-back">&larr; Back</button>
      {children}
      {ask && (
        <div className="p3-card p3-tight p3-stack-s" role="alertdialog" aria-label={ask === 'undo' ? L.dateUndoAsk : L.dateLeaveAsk} data-testid="p3-field-ask">
          <p className="p3-row-t p3-plain">{ask === 'undo' ? L.dateUndoAsk : L.dateLeaveAsk}</p>
          <button type="button" className="p3-btn p3-btn-danger" data-testid="p3-field-ask-go"
            onClick={() => { const a = ask; const r = routeGo; setAsk(null); setRouteGo(null); if (a === 'undo') setDraft(base); else if (r) r(); else (a === 'close' ? onClose : onBack)(); }}>
            {ask === 'undo' ? L.dateUndoGo : L.dateLeaveGo}
          </button>
          <button type="button" className="p3-btn p3-btn-line" autoFocus onClick={stay} data-testid="p3-field-ask-stay">{L.dateLeaveStay}</button>
        </div>
      )}
      {why && <p className="p3-warn" role="alert" data-testid="p3-field-why">{why}</p>}
      {error && <p className="p3-error" role="alert" data-testid="p3-sheet-error">{error}</p>}
      <div className="p3-stack-s">
        <button type="button" className="p3-btn" disabled={!patch || busy || uploading} data-testid="p3-own-save" onClick={() => patch && onSave(patch)}>
          {patch || (dirty && problem) ? L.saveOne : L.dateNothing}
        </button>
        {dirty && <button type="button" className="p3-link" disabled={busy || uploading} onClick={() => setAsk('undo')} data-testid="p3-field-undo">{L.dateUndo}</button>}
      </div>
    </Sheet>
  );
}

function NameSheet(p: FieldProps) {
  const base = dateNameOf(p.ws, p.detail);
  const [text, setText] = useState(base);
  return (
    <FieldSheet title={L.dateName} base={base} draft={text} setDraft={setText} patch={dateNamePatch(p.ws, p.detail, text)}
      problem={dateNameProblem(text)} {...p}>
      <label className="p3-field" htmlFor="p3-own-name">{L.dateName}</label>
      <input id="p3-own-name" className="p3-in" value={text} maxLength={DATE_NAME_MAX + 20} onChange={(e) => setText(e.target.value)} data-testid="p3-own-name-text" />
      <p className="p3-note">{L.dateNameHint}</p>
    </FieldSheet>
  );
}

function PhotosSheet(p: FieldProps) {
  const base = dateGalleryOf(p.ws, p.detail);
  const [photos, setPhotos] = useState(base);
  const latest = useRef(photos);
  useLayoutEffect(() => { latest.current = photos; }, [photos]);
  const [uploading, setUploading] = useState(false);
  const [upError, setUpError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  // The series editor's upload path (events/media): checked, re-encoded, uploaded; a failure keeps every photo already here.
  const add = async (files: File[]) => {
    setUploading(true);
    setUpError(null);
    try {
      for (const f of files.slice(0, MAX_GALLERY - latest.current.length)) {
        const url = await uploadEventPicture(p.ws.series.id, f);
        setPhotos((now) => [...now, url]);
      }
    } catch (e) {
      setUpError(e instanceof Error ? e.message : commandErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };
  return (
    <FieldSheet title={L.datePhotos} base={base} draft={photos} setDraft={setPhotos} patch={dateGalleryPatch(p.ws, p.detail, photos)}
      problem={null} {...p} uploading={uploading}>
      <p className="p3-note">{L.datePhotosHint}</p>
      {photos.length === 0 && <p className="p3-note" data-testid="p3-photos-empty">{L.datePhotosEmpty}</p>}
      <div role="list" className="p3-photos" data-testid="p3-photos">
        {photos.map((url, i) => (
          <div role="listitem" key={`${url}-${i}`} className="p3-photo" data-testid="p3-photo">
            <img src={url} alt="" loading="lazy" />
            <button type="button" className="p3-photo-x" aria-label={`${L.datePhotosRemove} ${i + 1}`} disabled={p.busy || uploading}
              onClick={() => setPhotos(photos.filter((_, j) => j !== i))} data-testid="p3-photo-remove">
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
        ))}
      </div>
      <input ref={file} type="file" accept={FLYER_ACCEPT} multiple className="p3-sr" tabIndex={-1} aria-hidden="true"
        onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ''; if (f.length) void add(f); }} data-testid="p3-photos-file" />
      {photos.length < MAX_GALLERY && (
        <button type="button" className="p3-btn p3-btn-line" disabled={p.busy || uploading} onClick={() => file.current?.click()} data-testid="p3-photos-add">
          {uploading ? L.detailsUploading : L.datePhotosAdd}
        </button>
      )}
      {photos.length >= MAX_GALLERY && <p className="p3-note" data-testid="p3-photos-max">{L.datePhotosMax(MAX_GALLERY)}</p>}
      {upError && <p className="p3-error" role="alert" data-testid="p3-photos-error">{upError}</p>}
    </FieldSheet>
  );
}

function PriceSheet(p: FieldProps) {
  const base = datePriceRows(p.ws, p.detail);
  const [rows, setRows] = useState<PriceRow[]>(base);
  return (
    <FieldSheet title={L.datePrice} base={base} draft={rows} setDraft={setRows} patch={datePricesPatch(p.ws, p.detail, rows)}
      problem={datePricesProblem(rows)} {...p}>
      <p className="p3-note">{L.datePricesHint}</p>
      {rows.length === 0 && <p className="p3-note" data-testid="p3-prices-empty">{L.datePricesEmpty}</p>}
      {rows.map((r, i) => (
        <PriceCard key={r.id} row={r} i={i} off={p.busy} onChange={(x) => setRows(rows.map((y, j) => (j === i ? x : y)))}
          onRemove={() => setRows(rows.filter((_, j) => j !== i))} />
      ))}
      <button type="button" className="p3-btn p3-btn-line" disabled={p.busy} onClick={() => setRows([...rows, newPriceRow()])} data-testid="p3-price-add">{L.pricesAdd}</button>
    </FieldSheet>
  );
}

export function DateFieldSheet({ step, ...p }: FieldProps & { step: FieldStep }) {
  if (step === 'edit-name') return <NameSheet {...p} />;
  if (step === 'edit-photos') return <PhotosSheet {...p} />;
  return <PriceSheet {...p} />;
}
