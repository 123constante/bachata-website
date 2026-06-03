// =============================================================================
// FestivalRaffleSection — festival-page-native raffle band ("Lucky Reels").
//
// The bento RaffleBlock is a square tile that looks alien inside the
// cinematic-festival layout, so festival event pages rendered no raffle UI at
// all ("latent"). This renders the SAME raffle — same get_event_raffle config,
// same RaffleEntryDialog submit flow — but skinned in the page's black / gold /
// Bebas-Neue language as a slot machine.
//
// All styling lives in CINEMATIC_CSS in FestivalDetail.tsx, scoped under
// `.cinematic-festival .raffle-band …`. This component only emits the markup +
// wires the real data and the entry dialog.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEventRaffleConfig } from '@/hooks/useEventRaffleConfig';
import { getRaffleSessionId } from '@/lib/raffleSession';
import { RaffleEntryDialog } from '@/modules/event-page/bento/modals/RaffleEntryDialog';

const enteredStorageKey = (eventId: string | null | undefined) =>
  eventId ? `bcal_raffle_entered_${eventId}` : null;

const tryVibrate = (pattern: number | number[]) => {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
  } catch { /* no-op */ }
};

const pad = (n: number) => (n < 10 ? '0' : '') + n;

function formatClock(iso: string | null): string {
  if (!iso) return '—';
  try { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
  catch { return '—'; }
}
function formatDate(iso: string | null): string {
  if (!iso) return '';
  try { return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso)); }
  catch { return iso ?? ''; }
}

// Live "Closes in 16d 06h" label, ticking every 30s. Mirrors the bento
// countdown's tiers but condensed to a single pill-sized string.
function useCountdownLabel(cutoffAt: string | null, closed: boolean): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (closed || !cutoffAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [cutoffAt, closed]);
  return useMemo(() => {
    if (!cutoffAt) return '';
    const target = new Date(cutoffAt).getTime();
    if (!Number.isFinite(target)) return '';
    const diff = target - now;
    if (closed || diff <= 0) return 'Closed';
    const d = Math.floor(diff / 86_400_000);
    const h = Math.floor((diff % 86_400_000) / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    if (d > 0) return `${d}d ${pad(h)}h left`;
    if (h > 0) return `${h}h ${pad(m)}m left`;
    return `${m}m left`;
  }, [cutoffAt, now, closed]);
}

// Each reel repeats its 3-symbol pattern 4× so the CSS translateY loop is seamless.
const REELS: string[][] = [
  ['\u{1F381}', '★', '\u{1F39F}️'],
  ['★', '\u{1F39F}️', '\u{1F381}'],
  ['\u{1F39F}️', '\u{1F381}', '★'],
];

export function FestivalRaffleSection({ eventId }: { eventId: string | null }) {
  const sessionId = typeof window !== 'undefined' ? getRaffleSessionId() : null;
  const { config, loading, refresh } = useEventRaffleConfig(eventId ?? null, sessionId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hasEntered, setHasEntered] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const key = enteredStorageKey(eventId);
    return key ? window.sessionStorage.getItem(key) === '1' : false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = enteredStorageKey(eventId);
    setHasEntered(key ? window.sessionStorage.getItem(key) === '1' : false);
  }, [eventId]);

  const markEntered = useCallback(() => {
    if (typeof window === 'undefined' || !eventId) return;
    try { window.sessionStorage.setItem(enteredStorageKey(eventId)!, '1'); } catch { /* no-op */ }
    setHasEntered(true);
    void refresh();
  }, [eventId, refresh]);

  const [spinPhase, setSpinPhase] = useState<'idle' | 'spinning' | 'landed'>('idle');
  const spinTimers = useRef<number[]>([]);
  useEffect(() => () => {
    spinTimers.current.forEach((t) => window.clearTimeout(t));
    spinTimers.current = [];
  }, []);

  // Pull the lever → reels spin, land on the prize, a brief "you're in the draw"
  // beat, then the entry form opens. Flavour only — the winner is a random draw,
  // this sequence decides nothing. Respects prefers-reduced-motion (opens at once).
  const handlePull = useCallback(() => {
    if (spinPhase !== 'idle') return;
    tryVibrate([20, 40, 30]);
    const reduced = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setDialogOpen(true); return; }
    setSpinPhase('spinning');
    spinTimers.current.push(window.setTimeout(() => setSpinPhase('landed'), 1000));
    spinTimers.current.push(window.setTimeout(() => {
      setDialogOpen(true);
      setSpinPhase('idle');
    }, 1950));
  }, [spinPhase]);

  const closed = !!config?.cutoff_passed;
  const winner = config?.winner_display ?? null;
  const entered = hasEntered || !!config?.my_status?.entered;
  const cutoffLabel = useCountdownLabel(config?.cutoff_at ?? null, closed);

  // Gate: render nothing until we know the raffle is enabled (avoids a flash of
  // empty band on non-raffle festivals).
  if (loading && !config) return null;
  if (!config || !config.enabled) return null;

  const prizeText = config.prize_text?.trim() || 'a free pass';
  const closeClock = formatClock(config.cutoff_at);
  const drawDate = formatDate(config.draw_date ?? config.cutoff_at);
  const entryCount = config.entry_count ?? 0;

  const isWinnerState = !!winner;
  const isClosed = closed && !isWinnerState;
  const canEnter = !closed && !entered;
  const machineDimmed = isWinnerState || isClosed;

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
                : <>WIN A <span className="gold">FREE PRIZE</span></>}
            </h2>
          </div>

          <div className="rb-body">
            {/* left — the machine */}
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
                        : <>WIN — <b>{prizeText}</b></>}
                    </span>
                    <span className="lamp" />
                  </div>
                </div>

                {canEnter && (
                  <div className="lever-col">
                    <button className={`lever${spinPhase !== 'idle' ? ' is-pulled' : ''}`} type="button" onClick={handlePull} aria-label="Pull lever to enter raffle">
                      <span className="lever-track" />
                      <span className="lever-arm" />
                      <span className="lever-knob" />
                      <span className="lever-hint">Pull</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* right — info + CTA */}
            <div className="rb-info-col">
              {!isWinnerState && (
                <div className="rb-meta">
                  <div className="meta-cell">
                    <p className="k">Entered</p>
                    <div className="v gold">{entryCount}</div>
                    <p className="sub">{entryCount === 0 ? 'Be the first' : entered ? "You're in" : 'so far'}</p>
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
                  <button className="pull-btn" type="button" onClick={handlePull}>
                    <span className="lab-small">Enter Raffle</span>
                    Pull To Enter
                  </button>
                ) : isWinnerState ? (
                  <p className="cta-foot">Winner drawn{drawDate ? ` ${drawDate}` : ''} — <b>thanks for playing.</b></p>
                ) : entered ? (
                  <p className="cta-foot rb-status"><b>You&rsquo;re entered {'\u{1F389}'}</b></p>
                ) : (
                  <p className="cta-foot rb-status"><b>Entries closed</b></p>
                )}
              </div>
            </div>
          </div>
        </div>
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
