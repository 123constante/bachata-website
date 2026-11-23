import { useState } from 'react';
import { V2Sheet } from './V2Sheet';
import { V2 } from './copy';
import type { LifeState } from './EndCard';
import { venueReasonLabel, SoldWarning } from './CancelNight';
import { useCancelReasons } from '../screens/CancelEventSheet';

const E = V2.every;
export type TodayAnswer = 'ran' | 'not_running';

/** SH-STATUS: "Pause the event?" / "End the event?". Ending a weekly event takes a last night (empty = end today). */
export function StatusSheet({ to, from, lastNight, tonight, error, onDo, onClose }: {
  to: 'Paused' | 'Ended'; from: LifeState; lastNight: string; tonight: boolean; error?: string | null;
  onDo: (last: string, today: TodayAnswer | null) => void | Promise<unknown>; onClose: () => void;
}) {
  const [last, setLast] = useState(lastNight);
  const [ans, setAns] = useState<TodayAnswer | null>(null);
  const ending = to === 'Ended';
  const needAns = ending && !last && tonight && !ans;
  return (
    <V2Sheet open title={ending ? E.endTitle : E.pauseTitle} onClose={onClose}>
      <div className="grp">
        <p className="txt">{ending ? E.endText : E.pauseText}</p>
        {ending && (
          <label className="fld"><span className="lab">{E.endLast}</span>
            <input type="date" aria-label={E.endLast} value={last} onChange={(e) => setLast(e.target.value)} />
          </label>
        )}
        {ending && !last && tonight && (
          <div role="radiogroup" aria-label={E.tonightAsk}>
            <p className="txt">{E.tonightAsk}</p>
            <button type="button" className={`btn ${ans === 'ran' ? 'pri' : 'sec'}`} aria-pressed={ans === 'ran'} onClick={() => setAns('ran')}>{E.tonightRan}</button>
            <button type="button" className={`btn ${ans === 'not_running' ? 'pri' : 'sec'}`} aria-pressed={ans === 'not_running'} onClick={() => setAns('not_running')}>{E.tonightOff}</button>
          </div>
        )}
        {error && <p className="txt" role="alert" data-testid="status-error">{error}</p>}
        <button type="button" className={ending ? 'btn dan solid' : 'btn pri'} data-testid="status-do" disabled={needAns} onClick={() => void onDo(ending ? last : '', ending && !last && tonight ? ans : null)}>{ending ? E.endRow : E.pauseRow}</button>
        <button type="button" className="btn sec" data-testid="status-keep" onClick={onClose}>{E.keepIt(from)}</button>
      </div>
    </V2Sheet>
  );
}

/** SH-CANCELE: "Cancel the event" (weekly). Built, NOT mounted: no server command cancels a whole weekly event (see handover). */
export function CancelEventSheetV2({ soldCount, soldState = 'ready', onRetrySold, error, onCancel, onClose }: {
  soldCount: number; soldState?: 'loading' | 'error' | 'ready'; onRetrySold?: () => void;
  error?: string | null; onCancel: (reason: string) => void | Promise<unknown>; onClose: () => void;
}) {
  const reasons = useCancelReasons();
  const [pick, setPick] = useState<'venue' | 'none'>('venue');
  const venue = venueReasonLabel((reasons.data ?? []).map((r) => r.label));
  const reason = pick === 'none' ? '' : venue.label;
  return (
    <V2Sheet open title={E.cancelEventTitle} onClose={onClose}>
      <div className="grp">
        <p className="txt">{E.cancelEventText}</p>
        {soldState === 'ready' && <SoldWarning soldCount={soldCount} />}
        {soldState === 'error' && (
          <div role="alert" data-testid="cancele-sold-error">
            <p className="hint" style={{ color: '#B42318' }}>{V2.soldCheckError}</p>
            <button type="button" className="btn sec" data-testid="cancele-sold-retry" onClick={() => onRetrySold?.()}>{V2.soldCheckRetry}</button>
          </div>
        )}
        <div role="radiogroup" aria-label="Reason">
          <label className="radio"><input type="radio" name="ereason" checked={pick === 'venue'} onChange={() => setPick('venue')} /> {V2.reasonVenue}</label>
          <label className="radio"><input type="radio" name="ereason" checked={pick === 'none'} onChange={() => setPick('none')} /> {V2.reasonNone}</label>
        </div>
        <p className="hint">{V2.cancelNow}</p>
        {error && <p className="hint" role="alert" style={{ color: '#B42318' }}>{error}</p>}
        <button type="button" className="btn dan solid" data-testid="cancele-go" disabled={reason === null || soldState !== 'ready'} onClick={() => reason !== null && soldState === 'ready' && void onCancel(reason)}>{E.cancelEventTitle}</button>
        <button type="button" className="btn sec" data-testid="cancele-keep" onClick={onClose}>{E.keepEvent}</button>
      </div>
    </V2Sheet>
  );
}
