import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import { BentoTile } from '@/modules/event-page/bento/BentoTile';
import { BLOCK_COLORS, BLOCK_TITLES } from '@/modules/event-page/bento/BentoGrid';
import { useEventRaffleConfig } from '@/hooks/useEventRaffleConfig';
import { getRaffleSessionId } from '@/lib/raffleSession';
import { RaffleEntryDialog } from '@/modules/event-page/bento/modals/RaffleEntryDialog';
import { Check, Sparkles, Trophy } from 'lucide-react';

const GOLD = 'hsl(var(--bento-accent))';

const tryVibrate = (pattern: number | number[]) => {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
  } catch { /* no-op */ }
};

const enteredStorageKey = (eventId: string | null | undefined) =>
  eventId ? `bcal_raffle_entered_${eventId}` : null;

function formatDrawnAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
      .format(new Date(iso));
  } catch { return iso; }
}

function formatCloseClock(cutoffAt: string): string {
  try {
    const dt = new Date(cutoffAt);
    const minutes = dt.getMinutes();
    const hours12 = dt.getHours() % 12 || 12;
    const ampm = dt.getHours() < 12 ? 'AM' : 'PM';
    return `${hours12}:${String(minutes).padStart(2, '0')} ${ampm}`;
  } catch {
    return '–';
  }
}

interface TimeLeftProps {
  cutoffAt: string;
}

const TimeLeft: React.FC<TimeLeftProps> = ({ cutoffAt }) => {
  const [now, setNow] = useState(() => Date.now());
  const target = useMemo(() => {
    const t = new Date(cutoffAt).getTime();
    return Number.isFinite(t) ? t : null;
  }, [cutoffAt]);

  useEffect(() => {
    if (target === null) return;
    const remaining = target - now;
    const interval = remaining <= 10 * 60 * 1000 ? 1_000 : 60_000;
    const id = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(id);
  }, [target, now]);

  if (target === null) return null;
  const ms = target - now;
  if (ms <= 0) return null;

  const totalSec = Math.floor(ms / 1000);
  const totalMin = Math.floor(totalSec / 60);
  const hr = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  const sec = totalSec % 60;

  // > 24h: hide – clock time alone is enough.
  if (hr >= 24) return null;

  let label: string;
  let color = 'hsl(var(--bento-fg-muted))';

  if (hr >= 1) {
    label = `${hr} hr${hr > 1 ? 's' : ''}${min > 0 ? ` ${min} min` : ''} left`;
  } else if (totalMin >= 10) {
    label = `${totalMin} min left`;
    color = 'hsl(var(--bento-accent))';
  } else if (totalMin >= 1) {
    label = `${totalMin} min ${String(sec).padStart(2, '0')}s left`;
    color = '#f5b95a';
  } else {
    label = `${sec}s left`;
    color = '#f06a4a';
  }

  return (
    <div className="text-[10px] mt-0.5 font-medium" style={{ color }}>
      {label}
    </div>
  );
};


interface AnimatedChestProps {
  intensity: number;
  opening: boolean;
  celebrate: boolean;
  dimmed?: boolean;
}

const AnimatedChest: React.FC<AnimatedChestProps> = ({ intensity, opening, celebrate, dimmed }) => {
  const lidControls = useAnimationControls();
  const padlockControls = useAnimationControls();
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (opening || celebrate) {
      lidControls.start({
        rotate: celebrate ? -45 : -28,
        y: celebrate ? -8 : -5,
        transition: { duration: 0.35, ease: 'easeOut' },
      });
      padlockControls.start({
        y: 16,
        rotate: -110,
        opacity: 0,
        transition: { duration: 0.4, delay: 0.05, ease: 'easeIn' },
      });
    } else {
      lidControls.start({
        rotate: -2,
        y: 0,
        transition: { duration: 0.3, ease: 'easeInOut' },
      });
      padlockControls.start({
        y: 0,
        rotate: -22,
        opacity: 1,
        transition: { duration: 0.35, ease: 'easeOut', delay: 0.1 },
      });
    }
  }, [opening, celebrate, lidControls, padlockControls]);

  const glowBase = 0.35 + intensity * 0.45;
  const glowPeak = Math.min(0.95, glowBase + 0.2 + (hovered ? 0.1 : 0));

  return (
    <svg
      viewBox="0 0 64 64"
      className="h-[72px] w-[72px] shrink-0"
      aria-hidden="true"
      style={{ opacity: dimmed ? 0.55 : 1, transition: 'opacity 250ms ease' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <defs>
        <filter id="raffleChest-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.8" />
        </filter>
        <filter id="raffleChest-glow-strong" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      <motion.ellipse
        cx="32"
        cy="26"
        rx={22 + intensity * 3}
        ry={2.5 + intensity * 0.8}
        fill={GOLD}
        filter="url(#raffleChest-glow)"
        animate={{ opacity: [glowBase, glowPeak, glowBase] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      <AnimatePresence>
        {celebrate && (
          <motion.ellipse
            cx="32"
            cy="22"
            rx="30"
            ry="10"
            fill={GOLD}
            filter="url(#raffleChest-glow-strong)"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.5, 0.2] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

      <rect x="6" y="28" width="52" height="28" rx="2" fill="#2a1f17" stroke={GOLD} strokeWidth="1.5" />
      <line x1="6" y1="40" x2="58" y2="40" stroke={GOLD} strokeWidth="0.5" opacity="0.4" />

      <AnimatePresence>
        {celebrate &&
          Array.from({ length: 8 }).map((_, i) => {
            const angle = (i / 8) * Math.PI - Math.PI / 2;
            const dx = Math.cos(angle) * 14;
            const dy = -20 - Math.sin(-angle) * 6;
            return (
              <motion.circle
                key={i}
                cx={32}
                cy={26}
                r={1.1}
                fill={GOLD}
                initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
                animate={{ opacity: [0, 1, 0], x: dx, y: dy, scale: [0.4, 1.1, 0.6] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.0 + i * 0.04, ease: 'easeOut', delay: i * 0.03 }}
              />
            );
          })}
      </AnimatePresence>

      <motion.g
        animate={lidControls}
        initial={{ rotate: -2, y: 0 }}
        style={{ originX: '32px', originY: '26px' }}
      >
        <path
          d="M 6 26 L 6 18 Q 6 8 32 8 Q 58 8 58 18 L 58 26 Z"
          fill="#1f1510"
          stroke={GOLD}
          strokeWidth="1.5"
        />
        <circle cx="12" cy="22" r="0.9" fill={GOLD} opacity="0.65" />
        <circle cx="52" cy="22" r="0.9" fill={GOLD} opacity="0.65" />
      </motion.g>

      <g transform="translate(32 42)">
        <motion.g
          animate={padlockControls}
          initial={{ y: 0, rotate: -22, opacity: 1 }}
          style={{ originX: '0px', originY: '4px' }}
        >
          <rect x="-4.5" y="0" width="9" height="9" rx="1" fill={GOLD} />
          <path
            d="M -2.8 0 L -2.8 -2.8 Q -2.8 -6 0 -6 Q 2.4 -6 2.8 -3.5"
            fill="none"
            stroke={GOLD}
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <circle cx="0" cy="3.8" r="1.1" fill="#141414" />
          <rect x="-0.55" y="4.2" width="1.1" height="2.6" fill="#141414" />
        </motion.g>
      </g>
    </svg>
  );
};

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
  const { config, loading, error, refresh } = useEventRaffleConfig(eventId ?? null, sessionId);
  const [shakeKey, setShakeKey] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const celebrateTimerRef = useRef<number | null>(null);
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

  useEffect(() => () => {
    if (celebrateTimerRef.current !== null) window.clearTimeout(celebrateTimerRef.current);
  }, []);

  const markEntered = useCallback(() => {
    if (typeof window === 'undefined' || !eventId) return;
    try { window.sessionStorage.setItem(enteredStorageKey(eventId)!, '1'); } catch { /* no-op */ }
    setHasEntered(true);
    setCelebrate(true);
    if (celebrateTimerRef.current !== null) window.clearTimeout(celebrateTimerRef.current);
    celebrateTimerRef.current = window.setTimeout(() => setCelebrate(false), 1600);
    void refresh();
  }, [eventId, refresh]);

  const openEntryForm = useCallback(() => {
    setShakeKey((k) => k + 1);
    tryVibrate(30);
    setDialogOpen(true);
  }, []);

  const intensity = Math.min(1, (config?.entry_count ?? 0) / 50);

  if (config?.enabled && config.my_status?.status === 'admin_excluded') {
    const alt = config.my_status.alternate_event;
    return (
      <BentoTile title={BLOCK_TITLES.raffle} color={BLOCK_COLORS.raffle}>
        <div className="flex items-start gap-3">
          <AnimatedChest intensity={0.2} opening={false} celebrate={false} dimmed />
          <div className="flex-1 min-w-0">
            <div
              className="text-[14px] font-semibold leading-[1.2] tracking-[-0.01em]"
              style={{ fontFamily: '"Fraunces", Georgia, serif', color: 'hsl(var(--bento-fg))' }}
            >
              Thanks for entering!
            </div>
            <div className="mt-1 text-[11px] leading-snug" style={{ color: 'hsl(var(--bento-fg-muted))' }}>
              This raffle has a special rule you don't meet this time.
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
        </div>
      </BentoTile>
    );
  }

  if (config?.enabled && config.my_status?.status === 'already_won') {
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

  if (config?.enabled && config.winner_display) {
    return (
      <BentoTile title={BLOCK_TITLES.raffle} color={BLOCK_COLORS.raffle}>
        <div className="flex items-center gap-3">
          <TrophyCircle />
          <div className="flex-1 min-w-0">
            <div
              className="text-[15px] font-extrabold leading-[1.15] tracking-[-0.015em] truncate"
              style={{ fontFamily: '"Fraunces", Georgia, serif', color: GOLD }}
            >
              {'\u{1F389}'} {config.winner_display.first_name} won!
            </div>
            <div className="mt-1 text-[11px]" style={{ color: 'hsl(var(--bento-fg-muted))' }}>
              Drawn {formatDrawnAt(config.winner_display.drawn_at)}
            </div>
          </div>
        </div>
      </BentoTile>
    );
  }

  if (!loading && (!config || !config.enabled)) {
    return null;
  }

  const closed = !!config?.cutoff_passed;
  const canEnter = !closed && !hasEntered;

  return (
    <>
      <BentoTile
        title={BLOCK_TITLES.raffle}
        color={BLOCK_COLORS.raffle}
        mode="multi-target"
      >
        {canEnter && (
          <div className="flex justify-center mb-2">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase"
              style={{ background: '#f5d563', color: '#1a2e2a', letterSpacing: '0.06em' }}
            >
              Free to enter
            </span>
          </div>
        )}

        <div
          key={shakeKey}
          className="flex flex-1 flex-col items-center justify-center text-center min-h-[170px]"
          style={{ animation: shakeKey > 0 ? 'raffle-shake 250ms ease' : undefined }}
        >
          <div className="relative">
            <AnimatedChest
              intensity={intensity}
              opening={dialogOpen}
              celebrate={celebrate}
              dimmed={closed && !hasEntered}
            />
            {hasEntered && !celebrate && (
              <motion.div
                className="absolute -right-1 -bottom-1 h-6 w-6 rounded-full flex items-center justify-center"
                style={{ background: GOLD, color: '#1A2E2A' }}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                aria-hidden
              >
                <Check className="w-3.5 h-3.5" strokeWidth={3} />
              </motion.div>
            )}
          </div>

          <div className="mt-1 text-[9px] uppercase" style={{ letterSpacing: '0.08em', color: 'hsl(var(--bento-fg-muted))' }}>
            You could win
          </div>
          <div
            className="text-[16px] font-extrabold leading-[1.2] tracking-[-0.015em] px-1 mt-0.5"
            style={{ fontFamily: '"Fraunces", Georgia, serif', color: 'hsl(var(--bento-fg))' }}
          >
            {config?.prize_text ?? 'Prize pool unlocking soon'}
          </div>
        </div>

        <div
          className="grid grid-cols-2 mt-3 py-2"
          style={{
            borderTop: '1px solid rgba(179,138,78,0.18)',
            borderBottom: '1px solid rgba(179,138,78,0.18)',
          }}
        >
          <div className="text-center" style={{ borderRight: '1px solid rgba(179,138,78,0.18)' }}>
            <div
              className="text-[9px] uppercase"
              style={{ letterSpacing: '0.08em', color: 'hsl(var(--bento-fg-muted))' }}
            >
              {closed ? 'Closed' : 'Closes'}
            </div>
            <div
              className="text-[14px] font-bold mt-0.5"
              style={{ color: 'hsl(var(--bento-fg))' }}
            >
              {config?.cutoff_at ? formatCloseClock(config.cutoff_at) : '–'}
            </div>
            {!closed && config?.cutoff_at && <TimeLeft cutoffAt={config.cutoff_at} />}
          </div>
          <div className="text-center">
            <div
              className="text-[9px] uppercase"
              style={{ letterSpacing: '0.08em', color: 'hsl(var(--bento-fg-muted))' }}
            >
              Entered
            </div>
            <motion.div
              key={config?.entry_count ?? 0}
              initial={{ opacity: 0.3, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="text-[14px] font-bold mt-0.5"
              style={{ color: 'hsl(var(--bento-fg))' }}
            >
              {config?.entry_count ?? 0} {(config?.entry_count ?? 0) === 1 ? 'dancer' : 'dancers'}
            </motion.div>
          </div>
        </div>

        {(closed || hasEntered) && (
          <div
            className="text-center text-[11px] mt-2"
            style={{ color: 'hsl(var(--bento-fg-muted))' }}
          >
            {closed ? 'Entries closed – winner drawn soon' : "You're entered – we'll call the winner"}
          </div>
        )}

        {canEnter && (
          <div className="mt-3 flex justify-center">
            <motion.button
              type="button"
              onClick={(e) => { e.stopPropagation(); openEntryForm(); }}
              className="inline-flex items-center gap-1 rounded-full px-4 py-2 text-[12px] font-semibold shadow-md"
              style={{
                background: GOLD,
                color: '#1A2E2A',
                boxShadow: '0 2px 8px rgba(179,138,78,0.35)',
              }}
              whileHover={{ scale: 1.04, boxShadow: '0 4px 14px rgba(245,213,99,0.45)' }}
              whileTap={{ scale: 0.96 }}
              animate={{
                boxShadow: [
                  '0 2px 8px rgba(179,138,78,0.35)',
                  '0 2px 14px rgba(245,213,99,0.55)',
                  '0 2px 8px rgba(179,138,78,0.35)',
                ],
              }}
              transition={{ boxShadow: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } }}
              aria-label="Enter the raffle"
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden />
              Enter raffle
              <span aria-hidden className="ml-0.5">↑</span>
            </motion.button>
          </div>
        )}
      </BentoTile>

      {eventId && (
        <RaffleEntryDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          eventId={eventId}
          consentVersion={config?.consent_version ?? null}
          onSubmitted={markEntered}
        />
      )}
    </>
  );
};

