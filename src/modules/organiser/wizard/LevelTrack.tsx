// C16: the percentage ring and the three-level track. Both read the RPC's
// numbers through levelOf(): the ring, the track and Home can never disagree.
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePrefersReducedMotion } from '../motion';
import { LEVELS, levelName, levelOf, type LevelId } from './wizardModel';

export function ProgressRing({ percent, size = 44, testId }: { percent: number; size?: number; testId?: string }) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} data-testid={testId} data-percent={p}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--card2)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--gold)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} />
      </svg>
      <span className="absolute text-[12px] font-bold text-[var(--fg)]">{p}%</span>
    </span>
  );
}

/** The bar on top of every wizard screen: the server's percent. */
export function ProgressBar({ percent }: { percent: number }) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div role="progressbar" aria-label="Profile complete" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p} data-testid="wizard-progress" className="h-[6px] w-full overflow-hidden rounded-full bg-[var(--card2)]">
      <div className="h-full rounded-full bg-[var(--gold)] transition-[width] duration-300 ease-in-out motion-reduce:transition-none" style={{ width: `${p}%` }} />
    </div>
  );
}

/** Starter -> Ready to publish -> Full profile, the current one marked in words, not colour alone. */
export function LevelTrack({ percent, publishReady }: { percent: number; publishReady: boolean }) {
  const current = levelOf({ percent, publishReady });
  const at = LEVELS.findIndex((l) => l.id === current);
  return (
    <ol className="grid grid-cols-3 gap-[8px]" data-testid="level-track" aria-label={`Level: ${levelName(current)}`}>
      {LEVELS.map((l, i) => (
        <li key={l.id} data-testid="level-step" data-reached={i <= at} aria-current={i === at ? 'step' : undefined} className="flex flex-col items-center gap-[4px] text-center">
          <span className={cn('flex h-[28px] w-[28px] items-center justify-center rounded-full border text-[13px] font-bold',
            i <= at ? 'border-[var(--gold)] bg-[var(--gold)] text-[var(--btnfg)]' : 'border-[var(--line-strong)] text-[var(--mut)]')}>
            {i <= at ? <Check aria-hidden="true" className="h-[16px] w-[16px]" /> : i + 1}
          </span>
          <span className={cn('text-[12px] leading-[16px]', i === at ? 'font-semibold text-[var(--fg)]' : 'text-[var(--mut)]')}>{l.name}</span>
        </li>
      ))}
    </ol>
  );
}

/** A short celebration: a pop of the mark; still under reduced motion. */
export function Celebration({ level }: { level: LevelId }) {
  const reduced = usePrefersReducedMotion();
  return (
    <span
      aria-hidden="true"
      data-testid="celebration"
      data-motion={reduced ? 'off' : 'on'}
      className={cn('mx-auto flex h-[64px] w-[64px] items-center justify-center rounded-full bg-[var(--gold)] text-[var(--btnfg)]', !reduced && 'animate-in zoom-in-50 fade-in duration-300')}
    >
      <Check className="h-[32px] w-[32px]" data-level={level} />
    </span>
  );
}
