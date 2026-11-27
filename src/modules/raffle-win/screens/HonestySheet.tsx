// Winner journey W4a: "One last thing" honesty sheet. Controlled: the parent owns tick, busy and the lock call.
import type { OpenNight } from '../model';

const WDS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'YYYY-MM-DDTHH:MM' London local as stored: read the parts, never convert zones. */
export function nightParts(startLocal: string): { d: string; mon: string; long: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(startLocal);
  if (!m) return { d: '', mon: '', long: '' };
  const wd = WDS[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()];
  const d = String(+m[3]);
  const mon = MONS[+m[2] - 1];
  return { d, mon, long: `${wd} ${d} ${mon}` };
}

type Props = {
  night: Pick<OpenNight, 'title' | 'startLocal' | 'venueName' | 'organiserName' | 'needsTick' | 'tickOrganiser'>;
  ticked: boolean;
  busy: boolean;
  /** true after a confirm tap without the tick: the hint line is highlighted */
  nudge: boolean;
  onTick: () => void;
  onConfirm: () => void;
  onBack: () => void;
};

export default function HonestySheet({ night, ticked, busy, nudge, onTick, onConfirm, onBack }: Props) {
  const p = nightParts(night.startLocal);
  const needsTick = night.needsTick !== false;
  const orgTick = night.tickOrganiser === true && !!night.organiserName;
  const confirmBlocked = (needsTick && !ticked) || busy;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/65" onClick={busy ? undefined : onBack} aria-hidden="true" />
      <section role="dialog" aria-modal="true" aria-label="One last thing" className="absolute inset-x-0 bottom-0 flex flex-col gap-3 rounded-t-[28px] border-t border-white/15 bg-[#23122d] px-5 pb-6 pt-4 text-[#f7ecd9]">
        <h2 className="text-[26px] leading-[1.05] font-extrabold">One last thing</h2>
        <div className="flex items-stretch gap-3 rounded-[18px] bg-white/[0.07] p-2.5" data-testid="honesty-night">
          <span className="flex w-[62px] min-h-[62px] flex-none flex-col items-center justify-center rounded-[14px] bg-[#f7ecd9] text-[#24121f]">
            <b className="text-[26px] leading-none font-extrabold">{p.d}</b>
            <i className="mt-[3px] text-[11.5px] font-semibold not-italic uppercase tracking-[0.14em] text-[#ec3458]">{p.mon}</i>
          </span>
          <span className="flex min-w-0 flex-col justify-center gap-0.5">
            <strong className="text-[17px] font-extrabold leading-tight">{night.title}</strong>
            <span className="text-[14.5px] font-bold">{p.long}</span>
            {night.venueName ? <small className="text-[13px] text-[#f7ecd9]/70">{night.venueName}</small> : null}
          </span>
        </div>
        {needsTick ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={ticked}
          disabled={busy}
          onClick={onTick}
          className={`flex min-h-[68px] w-full items-center gap-3.5 rounded-[18px] border-2 px-3.5 py-3 text-left text-[17px] font-bold ${ticked ? 'border-[#3ddbb4] bg-[#3ddbb4]/10' : 'border-[#f7ecd9]/35'}`}
        >
          <span aria-hidden="true" className={`flex h-8 w-8 flex-none items-center justify-center rounded-[10px] border-[2.5px] text-[20px] ${ticked ? 'border-[#3ddbb4] bg-[#3ddbb4] text-[#150a1c]' : 'border-[#f7ecd9]/60 text-transparent'}`} data-testid="honesty-tick">&#10003;</span>
          <span className="min-w-0 break-words">{orgTick ? <>I&rsquo;ve never been to any event by {night.organiserName}</> : 'I have never been to this event.'}</span>
        </button>
        ) : null}
        <p id="honesty-hint" role={nudge ? 'alert' : undefined} className={`text-center text-[13.5px] ${nudge ? 'font-bold text-[#ff5470]' : 'text-[#f7ecd9]/70'}`}>
          Once you lock it, only the organiser can change it.
        </p>
        <button
          type="button"
          aria-disabled={confirmBlocked}
          aria-describedby="honesty-hint"
          onClick={() => { if (!busy) onConfirm(); }}
          className={`flex h-[56px] w-full items-center justify-center gap-2.5 rounded-[18px] text-[17px] font-bold ${confirmBlocked ? 'bg-[#321c3f] text-[#f7ecd9]/40' : 'bg-[#ec3458] text-white'}`}
        >
          {busy ? (<><span aria-hidden="true" className="h-[18px] w-[18px] animate-spin rounded-full border-[2.5px] border-white/35 border-t-white" />Locking your night&hellip;</>) : 'Confirm and get my QR'}
        </button>
        <button type="button" disabled={busy} aria-disabled={busy} onClick={onBack} className="h-[56px] w-full rounded-[18px] border-[1.5px] border-white/15 text-[17px] font-bold disabled:opacity-50">Back</button>
      </section>
    </div>
  );
}
