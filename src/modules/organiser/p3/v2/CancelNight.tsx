import { useState } from 'react';
import { useCancelReasons } from '../screens/CancelEventSheet';
import { V2 } from './copy';
import { V2Sheet } from './V2Sheet';

export interface CancelResult { ok: boolean; error: string | null }

/** The label sent for "Venue not available": the reasons-list label matching it (any case), else the first label. */
export function venueReasonLabel(labels: readonly string[]): { label: string | null; exact: boolean } {
  const hit = labels.find((l) => l.trim().toLowerCase() === V2.reasonVenue.toLowerCase());
  return hit ? { label: hit, exact: true } : { label: labels[0] ?? null, exact: false };
}

/** SH-CANCELN-03: only when tickets are sold on this night. */
export function SoldWarning({ soldCount }: { soldCount: number }) {
  if (!soldCount || soldCount < 1) return null;
  return <p className="warn" data-testid="cancel-sold">{V2.soldWarn(soldCount)}</p>;
}

export function CancelNightSheet({ open, dateLong, soldCount, busy, onKeep, onCancel }: {
  open: boolean; dateLong: string; soldCount: number; busy?: boolean; onKeep: () => void;
  onCancel: (reason: string) => Promise<CancelResult>;
}) {
  const reasons = useCancelReasons();
  const [pick, setPick] = useState<'venue' | 'none'>('venue');
  const [error, setError] = useState<string | null>(null);
  const venue = venueReasonLabel((reasons.data ?? []).map((r) => r.label));
  const reason = pick === 'none' ? '' : venue.label;
  const go = async () => {
    if (reason === null) return;
    setError(null);
    const r = await onCancel(reason);
    if (!r.ok) setError(r.error);
  };
  return (
    <V2Sheet open={open} title={V2.cancelTitle(dateLong)} onClose={() => { if (!busy) onKeep(); }}>
      <p className="txt">{V2.cancelSheetText}</p>
      <SoldWarning soldCount={soldCount} />
      <div role="radiogroup" aria-label="Reason">
        <label className="radio"><input type="radio" name="reason" value="venue" checked={pick === 'venue'} disabled={busy} onChange={() => setPick('venue')} /> {V2.reasonVenue}</label>
        <label className="radio"><input type="radio" name="reason" value="" checked={pick === 'none'} disabled={busy} onChange={() => setPick('none')} /> {V2.reasonNone}</label>
      </div>
      <p className="hint">{V2.cancelNow}</p>
      {error && <p className="hint" role="alert" data-testid="cancel-error" style={{ color: '#B42318' }}>{error}</p>}
      <button type="button" className="btn dan solid" data-testid="cancel-go" disabled={busy || reason === null} onClick={() => void go()}>{V2.cancelNight}</button>
      <button type="button" className="btn sec" data-testid="cancel-keep" disabled={busy} onClick={onKeep}>{V2.keepNight}</button>
    </V2Sheet>
  );
}

export function BringBackSheet({ open, dateLong, busy, onKeep, onBack }: {
  open: boolean; dateLong: string; busy?: boolean; onKeep: () => void; onBack: () => Promise<CancelResult>;
}) {
  const [error, setError] = useState<string | null>(null);
  const go = async () => { setError(null); const r = await onBack(); if (!r.ok) setError(r.error); };
  return (
    <V2Sheet open={open} title={V2.bringTitle(dateLong)} onClose={() => { if (!busy) onKeep(); }}>
      <p className="txt">{V2.bringText}</p>
      {error && <p className="hint" role="alert" data-testid="bring-error" style={{ color: '#B42318' }}>{error}</p>}
      <button type="button" className="btn pri" data-testid="bring-go" disabled={busy} onClick={() => void go()}>{V2.bringGo}</button>
      <button type="button" className="btn sec" data-testid="bring-keep" disabled={busy} onClick={onKeep}>{V2.bringKeep}</button>
    </V2Sheet>
  );
}

/** The button and line at the bottom of the facts (N-27..N-30). The whole event cancelled: a line only, never a button. */
export function NightCancelArea({ eventCancelled, eventReason, nightCancelled, nightReason, dateLong, soldCount = 0, busy, onCancelNight, onBringBack }: {
  eventCancelled: boolean; eventReason?: string | null; nightCancelled: boolean; nightReason?: string | null;
  dateLong: string; soldCount?: number; busy?: boolean;
  onCancelNight: (reason: string) => Promise<CancelResult>; onBringBack: () => Promise<CancelResult>;
}) {
  const [sheet, setSheet] = useState<'cancel' | 'bring' | null>(null);
  if (eventCancelled) return <div className="why" data-testid="cancel-area-event">{V2.eventCancelledLine(eventReason)}</div>;
  const close = () => setSheet(null);
  return (
    <div data-testid="cancel-area">
      {nightCancelled ? (
        <>
          <button type="button" className="btn sec" data-testid="bring-open" onClick={() => setSheet('bring')}>{V2.bringBackNight}</button>
          <div className="why">{V2.nightCancelledLine(nightReason)}</div>
        </>
      ) : (
        <>
          <button type="button" className="btn dan fcan" data-testid="cancel-open" onClick={() => setSheet('cancel')}>{V2.cancelNight}</button>
          <div className="why">{V2.dancersSeeCancelled}</div>
        </>
      )}
      {sheet === 'cancel' && <CancelNightSheet open dateLong={dateLong} soldCount={soldCount} busy={busy} onKeep={close}
        onCancel={async (r) => { const x = await onCancelNight(r); if (x.ok) close(); return x; }} />}
      <BringBackSheet open={sheet === 'bring'} dateLong={dateLong} busy={busy} onKeep={close}
        onBack={async () => { const x = await onBringBack(); if (x.ok) close(); return x; }} />
    </div>
  );
}
