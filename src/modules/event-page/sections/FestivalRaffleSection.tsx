// =============================================================================
// FestivalRaffleSection -- festival-page-native raffle band ("Lucky Reels").
//
// The bento RaffleBlock is a square tile that looks alien inside the
// cinematic-festival layout, so festival event pages rendered no raffle UI at
// all ("latent"). This renders the SAME raffle -- same get_event_raffle config,
// same RaffleEntryDialog submit flow -- but skinned in the page's black / gold /
// Bebas-Neue language as a slot machine.
//
// All styling lives in CINEMATIC_CSS in FestivalDetail.tsx, scoped under
// `.cinematic-festival .raffle-band ...`. This component only emits the markup
// + wires the real data and the entry dialog.
//
// Time display: the close clock and draw date are shown AS-STORED (event
// timezone) via raffleCountdown helpers, never browser-tz-converted. The
// countdown duration is timezone-invariant.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEventRaffleConfig } from '@/hooks/useEventRaffleConfig';
import { getRaffleSessionId, raffleEnteredKey, tryVibrate } from '@/lib/raffleSession';
import {
  countdownParts,
  formatCloseClock,
  formatDrawDate,
  parseCutoffMs,
  useRaffleNow,
} from '@/modules/event-page/utils/raffleCountdown';
import { RaffleEntryDialog } from '@/modules/event-page/bento/modals/RaffleEntryDialog';

const pad = (n: number) => (n < 10 ? '0' : '') + n;

// Read the per-browser "already entered" flag. Guarded: sessionStorage.getItem
// can throw (sandboxed iframes / strict privacy modes) and this runs during
// render via the lazy initializer, so an unguarded throw would crash the band.
const readEntered = (eventId: string | null | undefined): boolean => {
  if (typeof window === 'undefined') return false;
  const key = raffleEnteredKey(eventId);
  if (!key) return false;
  try { return window.sessionStorage.getItem(key) === '1'; } catch { return false; }
};

// Live "Closes in 16d 06h" label. Ticks via useRaffleNow (adaptive: 1s under
// 10 minutes, 30s otherwise). The countdown duration is timezone-invariant.
function useCountdownLabel(cutoffAt: string | null, closed: boolean): string {
  const cutoffMs = useMemo(() => parseCutoffMs(cutoffAt), [cutoffAt]);
  const now = useRaffleNow(cutoffMs, closed);
  return useMemo(() => {
    if (cutoffMs === null) return '';
    if (closed || cutoffMs - now <= 0) return 'Closed';
    const { days, hours, mins } = countdownParts(cutoffMs - now);
    if (days > 0) return `${days}d ${pad(hours)}h left`;
    if (hours > 0) return `${hours}h ${pad(mins)}m left`;
    return `${mins}m left`;
  }, [cutoffMs, now, closed]);
}

// Each reel repeats its 3-symbol pattern 4x so the CSS translateY loop is
// seamless. Symbols are JS escapes (ASCII source): gift, star, ticket. The
// three reels are index rotations of one base set (no repeated literals).
const REEL_SYMS = ['\u{1F381}', '\u{2605}', '\u{1F39F}\u{FE0F}'];
const REELS: string[][] = [
  REEL_SYMS,
  [...REEL_SYMS.slice(1), ...REEL_SYMS.slice(0, 1)],
  [...REEL_SYMS.slice(2), ...REEL_SYMS.slice(0, 2)],
];

export function FestivalRaffleSection({ eventId }: { eventId: string | null }) {
  const sessionId = typeof window !== 'undefined' ? getRaffleSessionId() : null;
  const { config, loading, refresh } = useEventRaffleConfig(eventId ?? null, sessionId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hasEntered, setHasEntered] = useState<boolean>(() => readEntered(eventId));
  const [announce, setAnnounce] = useState('');

  useEffect(() => { setHasEntered(readEntered(eventId)); }, [eventId]);

  const markEntered = useCallback(() => {
    if (typeof window === 'undefined' || !eventId) return;
    const key = raffleEnteredKey(eventId);
    try { if (key) window.sessionStorage.setItem(key, '1'); } catch { /* no-op */ }
    setHasEntered(true);
    setAnnounce('You are entered in the draw.');
    void refresh();
  }, [eventId, refresh]);

  const [spinPhase, setSpinPhase] = useState<'idle' | 'spinning' | 'landed'>('idle');
  const spinTimers = useRef<number[]>([]);
  const clearSpinTimers = useCallback(() => {
    spinTimers.current.forEach((t) => window.clearTimeout(t));
    spinTimers.current = [];
  }, []);
  useEffect(() => clearSpinTimers, [clearSpinTimers]);

  // Pull the lever -> reels spin, land on the prize, a brief "you're in the
  // draw" beat, then the entry form opens. Flavour only -- the winner is a
  // random draw, this sequence decides nothing. Respects prefers-reduced-motion
  // (opens at once); a second tap once landed skips straight to the form.
  const handlePull = useCallback(() => {
    if (spinPhase === 'spinning') return;
    if (spinPhase === 'landed') {
      clearSpinTimers();
      setSpinPhase('idle');
      setDialogOpen(true);
      return;
    }
    tryVibrate([20, 40, 30]);
    setAnnounce('Opening entry form.');
    const reduced = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setDialogOpen(true); return; }
    setSpinPhase('spinning');
    spinTimers.current.push(window.setTimeout(() => setSpinPhase('landed'), 700));
    spinTimers.current.push(window.setTimeout(() => {
      setDialogOpen(true);
      setSpinPhase('idle');
    }, 1300));
  }, [spinPhase, clearSpinTimers]);

  const closed = !!config?.cutoff_passed;
  const winner = config?.winner_display ?? null;
  const entered = hasEntered || !!config?.my_status?.entered;
  const cutoffLabel = useCountdownLabel(config?.cutoff_at ?? null, closed);

  // Gate: render nothing until we know the raffle is enabled (avoids a flash of
  // empty band on non-raffle festivals).
  if (loading && !config) return null;
  if (!config || !config.enabled) return null;

  const prizeText = config.prize_text?.trim() || '';
  const prizeFull = prizeText || 'a free pass';
  const closeClock = formatCloseClock(config.cutoff_time, config.cutoff_at);
  const drawDate = formatDrawDate(config.draw_date ?? config.cutoff_at);
  const entryCount = config.entry_count ?? 0;

  const isWinnerState = !!winner;
  const isClosed = closed && !isWinnerState;
  const canEnter = !closed && !entered;
  const machineDimmed = isWinnerState || isClosed;
  const busy = spinPhase !== 'idle';

  return (
    <>
      <section className={`raffle-band${machineDimmed ? ' is-dimmed' : ''}`} aria-label="Festival raffle">
        <div className="rb-inner">
          <div className="rb-tab">
            <span className="rb-tab-ico" aria-hidden="true">{'\u{1F381}'}</span>
            <span>Free Prize Draw</span>
          </div>
          <div className="rb-head">
            <h2 className="rb-heading">
              {isWinnerState
                ? <>WE HAVE A <span className="gold">WINNER</span></>
                : prizeText
                  ? <>WIN <span className="gold">{prizeText}</span></>
                  : <>WIN A <span className="gold">FREE PRIZE</span></>}
            </h2>
          </div>

          <div className="rb-body">
            {/* left -- the machine */}
            <div className="rb-machine-col">
              <div className="machine-wrap">
                <div className="cabinet">
                  <p className="marquee">Lucky Reels</p>
                  <div className="bulbs"><i /><i /><i /><i /><i /><i /><i /></div>

                  <div className="bezel">
                    <div className={`reels${spinPhase === 'spinning' ? ' is-spinning' : spinPhase === 'landed' ? ' is-landed' : ''}`} aria-hidden="true">
                      {REELS.map((syms, ri) => (
                        <div className={`reel reel${ri + 1}`} key={ri}>
                          <div className="strip">
                            {[0, 1, 2, 3].map((rep) =>
                              syms.map((s, si) => (
                                <span className="sym" key={`${rep}-${si}`}>{s}</span>
                              )),
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className={`reel-flash${spinPhase === 'landed' ? ' show' : ''}`} aria-hidden="true">
                      <span>You&rsquo;re in the draw!</span>
                    </div>
                  </div>

                  <div className="winline">
                    <span className="lamp" />
                    <span className="label">
                      {isWinnerState
                        ? <>{'\u{1F389}'} <b>{winner!.first_name}</b> WON</>
                        : <>WIN &#8212; <b>{prizeFull}</b></>}
                    </span>
                    <span className="lamp" />
                  </div>
                </div>

                {canEnter && (
                  <div className="lever-col">
                    <button className={`lever${busy ? ' is-pulled' : ''}`} type="button" onClick={handlePull} aria-hidden="true" tabIndex={-1}>
                      <span className="lever-track" />
                      <span className="lever-arm" />
                      <span className="lever-knob" />
                      <span className="lever-hint">Pull</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* right -- info + CTA */}
            <div className="rb-info-col">
              {!isWinnerState && (
                <div className="rb-meta">
                  <div className="meta-cell">
                    <p className="k">Entered</p>
                    <div className="v gold">{entryCount}</div>
                    <p className="sub">{entryCount === 0 ? 'Be the first' : entered ? "You're in" : 'in the draw'}</p>
                  </div>
                  <div className="meta-cell">
                    <p className="k">Closes</p>
                    <div className="v">{closeClock}</div>
                    <p className="sub">{cutoffLabel}</p>
                  </div>
                  <div className="meta-cell">
                    <p className="k">Entry</p>
                    <div className="v">FREE</div>
                    <p className="sub">no purchase</p>
                  </div>
                </div>
              )}

              <div className="cta-row">
                {canEnter ? (
                  <>
                    <button className={`pull-btn${busy ? ' is-busy' : ''}`} type="button" onClick={handlePull} aria-busy={busy}>
                      <span className="lab-small">Enter Raffle</span>
                      Pull To Enter
                    </button>
                    <p className="rb-trust">Free to enter &#183; one entry per person &#183; just your phone</p>
                  </>
                ) : isWinnerState ? (
                  <p className="cta-foot">Winner drawn{drawDate ? ` ${drawDate}` : ''} &#8212; <b>thanks for playing.</b></p>
                ) : entered ? (
                  <div className="rb-chip" role="status">
                    <span className="rb-chip-ico" aria-hidden="true" />
                    You&rsquo;re entered &#8212; good luck
                  </div>
                ) : (
                  <p className="cta-foot rb-status"><b>Entries closed</b></p>
                )}
              </div>
            </div>
          </div>
        </div>
        <p className="sr-only" aria-live="polite">{announce}</p>
      </section>

      {eventId && (
        <RaffleEntryDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          eventId={eventId}
          consentVersion={config.consent_version ?? null}
          onSubmitted={markEntered}
        />
      )}
    </>
  );
}
