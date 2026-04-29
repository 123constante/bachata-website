import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import { BentoTile } from '@/modules/event-page/bento/BentoTile';
import { BLOCK_COLORS, BLOCK_TITLES } from '@/modules/event-page/bento/BentoGrid';
import { useEventRaffleConfig } from '@/hooks/useEventRaffleConfig';
import { getRaffleSessionId } from '@/lib/raffleSession';
import { RaffleEntryDialog } from '@/modules/event-page/bento/modals/RaffleEntryDialog';
import { RaffleCountdown } from '@/modules/event-page/bento/blocks/RaffleCountdown';
import { Check, Sparkles, Trophy } from 'lucide-react';

const GOLD = 'hsl(var(--bento-accent))';

const tryVibrate = (pattern: number | number[]) => {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
  } catch { /* no-op */ }
};

const enteredStorageKey = (eventId: string | undefined) =>
  eventId ? `bcal_raffle_entered_${eventId}` : null;

function formatDrawDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const [y, m, d] = iso.split('-').map((s) => parseInt(s, 10));
    if (!y || !m || !d) return iso;
    return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })
      .format(new Date(Date.UTC(y, m - 1, d)));
  } catch { return iso; }
}

function formatDrawnAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
      .format(new Date(iso));
  } catch { return iso; }
}

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

export const RaffleBlock = () => {
  const { id: eventId } = useParams<{ id: string }>();
  const sessionId = typeof window !== 'undefined' ? getRaffleSessionId() : null;
  const { config, loading, refresh } = useEventRaffleConfig(eventId ?? null, sessionId);
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
              This raffle has a special rule you don’t meet this time.
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
              You won this one! 🎉
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
              🎉 {config.winner_display.first_name} won!
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
  const tileClickable = canEnter;

  const renderSubLine = () => {
    if (closed) {
      return (
        <span style={{ color: 'hsl(var(--bento-fg-muted))' }}>
          Entries closed — winner drawn soon
        </span>
      );
    }
    if (hasEntered) {
      return (
        <span style={{ color: 'hsl(var(--bento-fg-muted))' }}>
          You're entered — we'll call the winner
        </span>
      );
    }
    if (config?.cutoff_at) {
      return <RaffleCountdown cutoffAt={config.cutoff_at} closed={false} />;
    }
    if (config?.draw_date) {
      return (
        <span style={{ color: 'hsl(var(--bento-fg-muted))' }}>
          Draws {formatDrawDate(config.draw_date) ?? config.draw_date}
        </span>
      );
    }
    return (
      <span style={{ color: 'hsl(var(--bento-fg-muted))' }}>
        Prize drawn after the event
      </span>
    );
  };

  return (
    <>
      <BentoTile
        title={BLOCK_TITLES.raffle}
        color={BLOCK_COLORS.raffle}
        onClick={tileClickable ? openEntryForm : undefined}
      >
        <div
          key={shakeKey}
          className="flex items-center gap-3"
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
          <div className="flex-1 min-w-0">
            {canEnter && (
              <div
                className="inline-flex items-center mb-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                style={{
                  background: '#f5d563',
                  color: '#1a2e2a',
                  letterSpacing: '0.06em',
                }}
                aria-label="Free to enter"
              >
                Free to enter
              </div>
            )}
            <div
              className="text-[15px] font-extrabold leading-[1.15] tracking-[-0.015em] truncate"
              style={{ fontFamily: '"Fraunces", Georgia, serif', color: 'hsl(var(--bento-fg))' }}
            >
              {config?.prize_text ?? 'Prize pool unlocking soon'}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px]">
              {renderSubLine()}
              {typeof config?.entry_count === 'number' && (
                <>
                  <span aria-hidden style={{ color: 'hsl(var(--bento-fg-muted))' }}>·</span>
                  <motion.span
                    key={config.entry_count}
                    initial={{ opacity: 0.3, y: -2 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ color: 'hsl(var(--bento-fg-muted))' }}
                  >
                    {config.entry_count} entered
                  </motion.span>
                </>
              )}
            </div>

            {canEnter && (
              <motion.button
                type="button"
                onClick={(e) => { e.stopPropagation(); openEntryForm(); }}
                className="mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold shadow-md"
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
                <span aria-hidden className="ml-0.5">→</span>
              </motion.button>
            )}
          </div>
        </div>
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
