// =============================================================================
// RaffleBlock -- bento-tile raffle as a "Lucky Reels" slot machine.
//
// Replaces the earlier animated-chest tile. Same data + entry flow
// (get_event_raffle config, RaffleEntryDialog submit), re-skinned as the
// festival slot machine but scaled for the bento grid and themed to the bento
// dark-surface / gold-black-cabinet hybrid. All keyframes + pseudo-elements
// live in the co-located RaffleBlock.css under the `.rsb-` prefix.
//
// The lever IS the entry action and the SOLE entry control (the redundant
// "Pull To Enter" CTA was removed -- the lever's PULL hint + the "Free to
// enter" badge already cover it). Pulling -> reels spin -> land -> the entry
// dialog opens. The lever is therefore the accessible, labelled control.
//
// Time display: close clock + countdown are shown AS-STORED (event timezone)
// via the shared raffleCountdown helpers, never browser-tz-converted.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import './RaffleBlock.css';
import { BentoTile } from '@/modules/event-page/bento/BentoTile';
import { BLOCK_COLORS, BLOCK_TITLES } from '@/modules/event-page/bento/BentoGrid';
import { useEventRaffleConfig } from '@/hooks/useEventRaffleConfig';
import { getRaffleSessionId, raffleEnteredKey, tryVibrate } from '@/lib/raffleSession';
import {
  countdownParts,
  formatCloseClock,
  parseCutoffMs,
  useRaffleNow,
} from '@/modules/event-page/utils/raffleCountdown';
import { RaffleEntryDialog } from '@/modules/event-page/bento/modals/RaffleEntryDialog';
import { Trophy } from 'lucide-react';

const GOLD = 'hsl(var(--bento-accent))';
const pad = (n: number) => (n < 10 ? '0' : '') + n;

// Winner-state stamp: "12 Jun 19:30" as stored (UTC fields = wall clock).
function formatDrawnAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      hour12: false, timeZone: 'UTC',
    }).format(new Date(iso));
  } catch { return iso; }
}

// Read the per-browser "already entered" flag. Guarded: sessionStorage.getItem
// can throw (sandboxed iframes / strict privacy modes) and this runs during
// render via the lazy initializer, so an unguarded throw would crash the tile.
const readEntered = (eventId: string | null | undefined): boolean => {
  if (typeof window === 'undefined') return false;
  const key = raffleEnteredKey(eventId);
  if (!key) return false;
  try { return window.sessionStorage.getItem(key) === '1'; } catch { return false; }
};

type CountdownTone = 'normal' | 'warn' | 'urgent';

// Live "16d 06h left" / "8m 30s left" label + urgency tone. Ticks via
// useRaffleNow (adaptive: 1s under 10 minutes, 30s otherwise). The countdown
// duration is timezone-invariant. Returns empty label when >24h is implied by
// days (the clock alone is enough) -- mirrors the festival band's behaviour but
// keeps the colour cue from the old TimeLeft tile.
function useCountdown(cutoffAt: string | null, closed: boolean): { label: string; tone: CountdownTone } {
  const cutoffMs = useMemo(() => parseCutoffMs(cutoffAt), [cutoffAt]);
  const now = useRaffleNow(cutoffMs, closed);
  return useMemo(() => {
    if (cutoffMs === null) return { label: '', tone: 'normal' as CountdownTone };
    if (closed || cutoffMs - now <= 0) return { label: 'Closed', tone: 'normal' as CountdownTone };
    const { days, hours, mins, secs, totalMin } = countdownParts(cutoffMs - now);
    if (days > 0) return { label: `${days}d ${pad(hours)}h left`, tone: 'normal' };
    if (hours >= 1) return { label: `${hours}h ${pad(mins)}m left`, tone: 'normal' };
    if (totalMin >= 10) return { label: `${mins}m left`, tone: 'normal' };
    if (totalMin >= 1) return { label: `${mins}m ${pad(secs)}s left`, tone: 'warn' };
    return { label: `${secs}s left`, tone: 'urgent' };
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

type SpinPhase = 'idle' | 'spinning' | 'landed';

// The cabinet: marquee, chasing bulbs, reels (+ landing flash) and the winline.
// Shared by the live tile and the dimmed admin-excluded state. winnerName, when
// set, replaces the prize on the winline ("[name] WON").
function Cabinet({ spinPhase, prizeFull, winnerName }: {
  spinPhase: SpinPhase;
  prizeFull: string;
  winnerName?: string | null;
}) {
  const reelsCls =
    spinPhase === 'spinning' ? ' is-spinning' : spinPhase === 'landed' ? ' is-landed' : '';
  return (
    <div className="rsb-cabinet">
      <p className="rsb-marquee">Lucky Reels</p>
      <div className="rsb-bulbs"><i /><i /><i /><i /><i /></div>

      <div className="rsb-bezel">
        <div className={`rsb-reels${reelsCls}`} aria-hidden="true">
          {REELS.map((syms, ri) => (
            <div className={`rsb-reel rsb-reel${ri + 1}`} key={ri}>
              <div className="rsb-strip">
                {[0, 1, 2, 3].map((rep) =>
                  syms.map((s, si) => (
                    <span className="rsb-sym" key={`${rep}-${si}`}>{s}</span>
                  )),
                )}
              </div>
            </div>
          ))}
        </div>
        <div className={`rsb-reel-flash${spinPhase === 'landed' ? ' show' : ''}`} aria-hidden="true">
          <span>You&rsquo;re in the draw!</span>
        </div>
      </div>

      <div className="rsb-winline">
        <span className="rsb-lamp" />
        <span className="rsb-winlabel">
          {winnerName
            ? <>{'\u{1F389}'} <b>{winnerName}</b> WON</>
            : <>WIN &#8212; <b>{prizeFull}</b></>}
        </span>
        <span className="rsb-lamp" />
      </div>
    </div>
  );
}

const TrophyCircle = () => (
  <div
    className="h-[72px] w-[72px] shrink-0 rounded-full flex items-center justify-center"
    style={{
      background: 'radial-gradient(circle at 35% 35%, rgba(245,213,99,0.35), rgba(179,138,78,0.15) 60%, transparent 80%)',
      border: '1.5px solid ' + GOLD,
    }}
  >
    <Trophy className="w-8 h-8" style={{ color: GOLD }} />
  </div>
);

// eventId is the RESOLVED event uuid (passed from BentoPage). Reading it from
// useParams() here used to break: the URL param is a slug after canonicalisation,
// and the raffle-config RPC expects a uuid.
export const RaffleBlock = ({ eventId }: { eventId: string | null }) => {
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

  const [spinPhase, setSpinPhase] = useState<SpinPhase>('idle');
  const [leverDown, setLeverDown] = useState(false);
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
      setLeverDown(false);
      setDialogOpen(true);
      return;
    }
    tryVibrate([20, 40, 30]);
    setAnnounce('Opening entry form.');
    const reduced = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setDialogOpen(true); return; }
    setLeverDown(true);
    setSpinPhase('spinning');
    // Knob slams down, holds ~1s, then springs back up while the reels keep
    // spinning; reels land ~0.8s after the spring-back, then the form opens.
    spinTimers.current.push(window.setTimeout(() => setLeverDown(false), 1000));
    spinTimers.current.push(window.setTimeout(() => setSpinPhase('landed'), 1800));
    spinTimers.current.push(window.setTimeout(() => {
      setDialogOpen(true);
      setSpinPhase('idle');
    }, 2500));
  }, [spinPhase, clearSpinTimers]);

  const closed = !!config?.cutoff_passed;
  const cutoff = useCountdown(config?.cutoff_at ?? null, closed);

  // Gate: render nothing until we know the raffle is enabled (BentoPage already
  // hides the tile when disabled; this avoids a flash before config lands).
  if (loading && !config) return null;
  if (!config || !config.enabled) return null;

  const prizeFull = config.prize_text?.trim() || 'a free pass';
  const closeClock = formatCloseClock(config.cutoff_time, config.cutoff_at);
  const entryCount = config.entry_count ?? 0;
  const winner = config.winner_display ?? null;
  const entered = hasEntered || !!config.my_status?.entered;

  // --- Special states (early returns) ---------------------------------------

  // Admin-excluded: the entrant doesn't meet a special rule. Show the machine
  // dimmed (no lever) so it reads as unavailable, with a pointer to an alt event.
  if (config.my_status?.status === 'admin_excluded') {
    const alt = config.my_status.alternate_event;
    return (
      <BentoTile title={BLOCK_TITLES.raffle} color={BLOCK_COLORS.raffle}>
        <div className="rsb-root rsb-is-dimmed">
          <div className="rsb-machine-row">
            <Cabinet spinPhase="idle" prizeFull={prizeFull} />
          </div>
          <div
            className="mt-3 text-center text-[11px] leading-snug"
            style={{ color: 'hsl(var(--bento-fg-muted))' }}
          >
            This raffle has a special rule you don&rsquo;t meet this time.
            {alt && (
              <>
                {' '}Try{' '}
                <a
                  href={`/event/${alt.event_id}`}
                  className="underline decoration-dotted underline-offset-2"
                  style={{ color: GOLD }}
                >
                  {alt.name ?? 'another event'}
                </a>{' '}
                instead.
              </>
            )}
          </div>
        </div>
      </BentoTile>
    );
  }

  // Already won (this entrant): trophy + organiser-will-be-in-touch.
  if (config.my_status?.status === 'already_won') {
    const alt = config.my_status.alternate_event;
    return (
      <BentoTile title={BLOCK_TITLES.raffle} color={BLOCK_COLORS.raffle}>
        <div className="flex items-start gap-3">
          <TrophyCircle />
          <div className="flex-1 min-w-0">
            <div
              className="text-[14px] font-extrabold leading-[1.15] tracking-[-0.015em]"
              style={{ fontFamily: '"Fraunces", Georgia, serif', color: GOLD }}
            >
              You won this one! {'\u{1F389}'}
            </div>
            <div className="mt-1 text-[11px] leading-snug" style={{ color: 'hsl(var(--bento-fg-muted))' }}>
              Organiser will be in touch.
              {alt && (
                <>
                  {' '}Try{' '}
                  <a
                    href={`/event/${alt.event_id}`}
                    className="underline decoration-dotted underline-offset-2"
                    style={{ color: GOLD }}
                  >
                    {alt.name ?? 'another raffle'}
                  </a>{' '}
                  next.
                </>
              )}
            </div>
          </div>
        </div>
      </BentoTile>
    );
  }

  // Winner drawn: trophy + name.
  if (winner) {
    return (
      <BentoTile title={BLOCK_TITLES.raffle} color={BLOCK_COLORS.raffle}>
        <div className="flex items-center gap-3">
          <TrophyCircle />
          <div className="flex-1 min-w-0">
            <div
              className="text-[15px] font-extrabold leading-[1.15] tracking-[-0.015em] truncate"
              style={{ fontFamily: '"Fraunces", Georgia, serif', color: GOLD }}
            >
              {'\u{1F389}'} {winner.first_name} won!
            </div>
            <div className="mt-1 text-[11px]" style={{ color: 'hsl(var(--bento-fg-muted))' }}>
              Drawn {formatDrawnAt(winner.drawn_at)}
            </div>
          </div>
        </div>
      </BentoTile>
    );
  }

  // --- Live state ------------------------------------------------------------

  const canEnter = !closed && !entered;
  const machineDimmed = closed; // winner already handled above
  const busy = spinPhase !== 'idle';
  const subToneCls =
    cutoff.tone === 'warn' ? ' warn' : cutoff.tone === 'urgent' ? ' urgent' : '';

  return (
    <>
      <BentoTile title={BLOCK_TITLES.raffle} color={BLOCK_COLORS.raffle} mode="multi-target">
        <div className={`rsb-root${machineDimmed ? ' rsb-is-dimmed' : ''}`}>
          {canEnter && (
            <div className="rsb-free-badge"><span>Free to enter</span></div>
          )}

          <div className="rsb-machine-row">
            <Cabinet spinPhase={spinPhase} prizeFull={prizeFull} />
            {canEnter && (
              <div className="rsb-lever-col">
                {/* The lever is the sole entry control, so it carries the
                    accessible label (no separate CTA button any more). */}
                <button
                  className={`rsb-lever${busy ? ' is-active' : ''}${leverDown ? ' is-pulled' : ''}`}
                  type="button"
                  onClick={handlePull}
                  aria-busy={busy}
                  aria-label="Pull the lever to enter the raffle"
                >
                  <span className="rsb-lever-track" />
                  <span className="rsb-lever-arm" />
                  <span className="rsb-lever-knob" />
                  <span className="rsb-lever-hint">Pull</span>
                </button>
              </div>
            )}
          </div>

          <div className="rsb-info">
            <div className="rsb-meta">
              <div className="rsb-meta-cell">
                <div className="rsb-meta-k">{closed ? 'Closed' : 'Closes'}</div>
                <div className="rsb-meta-v">{closeClock}</div>
                {!closed && cutoff.label && (
                  <div className={`rsb-meta-sub${subToneCls}`}>{cutoff.label}</div>
                )}
              </div>
              <div className="rsb-meta-cell">
                <div className="rsb-meta-k">Entered</div>
                <motion.div
                  key={entryCount}
                  initial={{ opacity: 0.3, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="rsb-meta-v"
                >
                  {entryCount}
                </motion.div>
                <div className="rsb-meta-sub">
                  {entryCount === 0 ? 'be the first' : entered ? "you're in" : entryCount === 1 ? 'dancer' : 'dancers'}
                </div>
              </div>
            </div>

            {/* Post-entry / closed footer only -- the live entry action is the
                lever itself; the redundant "Pull To Enter" CTA was removed. */}
            {!canEnter && (
              <div className="rsb-cta">
                {entered ? (
                  <div className="rsb-chip" role="status">
                    <span className="rsb-chip-ico" aria-hidden="true" />
                    You&rsquo;re entered &#8212; good luck
                  </div>
                ) : (
                  <p className="rsb-status"><b>Entries closed</b> &#8212; winner drawn soon</p>
                )}
              </div>
            )}
          </div>

          <p className="sr-only" aria-live="polite">{announce}</p>
        </div>
      </BentoTile>

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
};
