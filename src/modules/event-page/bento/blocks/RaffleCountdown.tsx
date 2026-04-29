// =============================================================================
// RaffleCountdown — urgency-tiered countdown for the bento raffle tile.
//
// Single source of truth for the visible "time-to-close" UI. Takes a
// timezone-aware ISO timestamp (cutoff_at, returned by get_event_raffle) and
// computes the countdown against Date.now(). No wall-clock string parsing,
// no date assumptions — old useCountdown hook anchored to TODAY's date and
// counted down to the wrong moment for any future event.
//
// Urgency tiers
// -------------
//    > 24h         calm    "Closes Sat 9pm"      muted, no animation
//   1h–24h         steady  "Closes in 4h 12m"    brass, slightly larger
//   10m–1h         alert   "Closes in 47m"       brass + soft 4s pulse
//    1m–10m        urgent  "⚡ Closes in 8m 24s" amber + faster pulse
//    < 1m          final   "Closing in 47s"      red-orange + tick bounce
//   passed         closed  "Entries closed"      grey, padlock returns
//
// Tick rate
// ---------
//   30s by default. Drops to 1s when under 10 minutes remaining (so the
//   urgent + final tiers visibly tick).
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

export type RaffleCountdownTier = 'far' | 'steady' | 'alert' | 'urgent' | 'final' | 'closed';

interface Props {
  /** ISO timestamp (timezone-aware) when the raffle closes. Null hides the line. */
  cutoffAt: string | null | undefined;
  /** When true, render the closed state regardless of math (server says it's closed). */
  closed: boolean;
}

interface Snapshot {
  tier: RaffleCountdownTier;
  label: string;
  msUntil: number;
}

function formatRelative(msUntil: number): string {
  const totalSec = Math.max(0, Math.floor(msUntil / 1000));
  const totalMin = Math.floor(totalSec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const s = totalSec % 60;
  if (h >= 24) {
    // Won't happen in formatRelative (handled by formatAbsolute) but safe-guarded.
    const days = Math.floor(h / 24);
    return `${days}d ${h % 24}h`;
  }
  if (h > 0) return `${h}h ${m}m`;
  if (totalMin >= 10) return `${m}m`;
  if (totalMin >= 1) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

function formatAbsolute(cutoffAt: string): string {
  // "Closes Sat 9pm" — short weekday, hour-only when on the hour, else h:mm.
  // Renders in the viewer's local timezone, which is fine for the calm tier
  // (multiple days out, no precision needed).
  try {
    const dt = new Date(cutoffAt);
    const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(dt);
    const minutes = dt.getMinutes();
    const hours12 = dt.getHours() % 12 || 12;
    const ampm = dt.getHours() < 12 ? 'am' : 'pm';
    const time = minutes === 0 ? `${hours12}${ampm}` : `${hours12}:${String(minutes).padStart(2, '0')}${ampm}`;
    return `Closes ${weekday} ${time}`;
  } catch {
    return 'Closes soon';
  }
}

function compute(cutoffAt: string | null | undefined, closed: boolean, now: number): Snapshot | null {
  if (!cutoffAt) return null;
  const target = new Date(cutoffAt).getTime();
  if (!Number.isFinite(target)) return null;
  const msUntil = target - now;

  if (closed || msUntil <= 0) {
    return { tier: 'closed', label: 'Entries closed', msUntil: 0 };
  }
  if (msUntil > 24 * 60 * 60 * 1000) {
    return { tier: 'far', label: formatAbsolute(cutoffAt), msUntil };
  }
  if (msUntil > 60 * 60 * 1000) {
    return { tier: 'steady', label: `Closes in ${formatRelative(msUntil)}`, msUntil };
  }
  if (msUntil > 10 * 60 * 1000) {
    return { tier: 'alert', label: `Closes in ${formatRelative(msUntil)}`, msUntil };
  }
  if (msUntil > 60 * 1000) {
    return { tier: 'urgent', label: `Closes in ${formatRelative(msUntil)}`, msUntil };
  }
  return { tier: 'final', label: `Closing in ${formatRelative(msUntil)}`, msUntil };
}

const BRASS = 'hsl(var(--bento-accent))';

export const RaffleCountdown: React.FC<Props> = ({ cutoffAt, closed }) => {
  const [now, setNow] = useState(() => Date.now());

  // Adaptive tick: 1s when under 10 minutes remaining, 30s otherwise. Keeps the
  // urgent/final tiers visually alive without wasting renders far out.
  const initialMsUntil = useMemo(() => {
    if (!cutoffAt) return Infinity;
    const t = new Date(cutoffAt).getTime();
    return Number.isFinite(t) ? t - now : Infinity;
  }, [cutoffAt, now]);

  useEffect(() => {
    if (closed || !cutoffAt) return;
    const interval = initialMsUntil <= 10 * 60 * 1000 ? 1_000 : 30_000;
    const id = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(id);
  }, [cutoffAt, closed, initialMsUntil]);

  const snapshot = useMemo(() => compute(cutoffAt, closed, now), [cutoffAt, closed, now]);
  if (!snapshot) return null;

  const { tier, label, msUntil } = snapshot;

  // Per-tier visual tokens.
  let color = 'hsl(var(--bento-fg-muted))';
  let weight: 'normal' | 'semibold' | 'bold' = 'normal';
  let size = '11px';
  let pulseDur: number | null = null;
  let showIcon = false;

  switch (tier) {
    case 'far':
      // calm — leave defaults
      break;
    case 'steady':
      color = BRASS;
      size = '12px';
      break;
    case 'alert':
      color = BRASS;
      size = '12px';
      weight = 'semibold';
      pulseDur = 4;
      break;
    case 'urgent':
      color = '#f5b95a'; // warm amber
      size = '12.5px';
      weight = 'bold';
      pulseDur = 1.6;
      showIcon = true;
      break;
    case 'final':
      color = '#f06a4a'; // red-orange
      size = '13px';
      weight = 'bold';
      pulseDur = 1.0;
      showIcon = true;
      break;
    case 'closed':
      color = 'hsl(var(--bento-fg-muted))';
      size = '11px';
      break;
  }

  // Final tier: tiny scale bounce per tick (each second under 1 minute).
  const bounceKey = tier === 'final' ? Math.floor(msUntil / 1000) : 0;

  return (
    <motion.span
      key={bounceKey}
      className="inline-flex items-center gap-1 leading-snug"
      style={{ color, fontSize: size, fontWeight: weight === 'normal' ? 400 : weight === 'semibold' ? 600 : 700 }}
      animate={
        pulseDur
          ? { opacity: [0.78, 1, 0.78] }
          : tier === 'final'
            ? { scale: [1, 1.06, 1] }
            : undefined
      }
      transition={
        pulseDur
          ? { duration: pulseDur, repeat: Infinity, ease: 'easeInOut' }
          : tier === 'final'
            ? { duration: 0.5, ease: 'easeOut' }
            : undefined
      }
      aria-live={tier === 'final' || tier === 'urgent' ? 'polite' : 'off'}
    >
      {showIcon && <Zap className="w-3 h-3" aria-hidden style={{ color }} />}
      {label}
    </motion.span>
  );
};
