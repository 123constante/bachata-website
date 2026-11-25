import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/modules/organiser/ui';
import { COUNT_STEP, COUNT_TICK_MS, RING_CIRC, WIN_DELAY_MS } from '../onboarding/neonMotion';
import { boom } from '../onboarding/neon/neonConfetti';
import { NEXT_LABEL, type ProgressItem, type ProgressResult } from '../onboarding/profileProgress';
import { SHINE_ADD_PATH } from './ShineCard';
import './progressRing.css';

/** Dashoffset of the progress arc for a percentage (213.6 = empty, 0 = full). */
export const ringOffset = (pct: number): number => RING_CIRC * (1 - pct / 100);

export const wonKey = (userId: string): string => `dancer_app_ring_won:${userId}`;

const calm = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const OPTIONAL: readonly ProgressItem[] = ['bio', 'link'];
const CHIP_LABEL: Partial<Record<ProgressItem, string>> = { bio: 'Add a bio', link: 'Add a link' };

/** Home card (layout C, onboarding v8): progress ring while incomplete, the win badge at 100%. */
const ProgressRingCard = ({ progress, requiredPath }: { progress: ProgressResult; requiredPath: string }) => {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { pct, missing, next } = progress;
  const [shown, setShown] = useState(() => (calm() ? pct : 0));
  const [armed, setArmed] = useState(() => calm());

  useEffect(() => {
    if (calm()) { setShown(pct); setArmed(true); return undefined; }
    let a = 0;
    let b = 0;
    a = requestAnimationFrame(() => { b = requestAnimationFrame(() => setArmed(true)); });
    const t = setInterval(() => setShown((n) => (n >= pct ? (clearInterval(t), pct) : Math.min(n + COUNT_STEP, pct))), COUNT_TICK_MS);
    return () => { cancelAnimationFrame(a); cancelAnimationFrame(b); clearInterval(t); };
  }, [pct]);

  useEffect(() => {
    if (pct !== 100 || userId === '') return undefined;
    try { if (window.localStorage.getItem(wonKey(userId))) return undefined; } catch { /* storage blocked: may repeat */ }
    const t = setTimeout(() => {
      try { window.localStorage.setItem(wonKey(userId), '1'); } catch { /* ignore */ }
      boom(true);
    }, WIN_DELAY_MS);
    return () => clearTimeout(t);
  }, [pct, userId]);

  if (pct === 100) {
    return (
      <Card variant="padded" testId="home-ring-win">
        <div className="ring-win">
          <span className="ring-trophy" aria-hidden="true">&#127942;</span>
          <b>Profile complete</b>
          <span>You are fully visible to dancers and organisers.</span>
        </div>
      </Card>
    );
  }
  return (
    <Card variant="padded" testId="home-ring">
      <div className="ring-card">
        <div className="ring-row">
          <svg className="ring-svg" width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">
            <defs><linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff2d95" /><stop offset="1" stopColor="#ffa600" /></linearGradient></defs>
            <circle cx="42" cy="42" r="34" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="9" />
            <circle className="ring-bar" data-testid="home-ring-bar" cx="42" cy="42" r="34" fill="none" stroke="url(#ring-grad)" strokeWidth="9" strokeLinecap="round" strokeDasharray={RING_CIRC} strokeDashoffset={armed ? ringOffset(pct) : RING_CIRC} />
          </svg>
          <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
            <b className="ring-count" data-testid="home-ring-count">{shown}%</b>
            <span>Your profile</span>
            {next && <span className="ring-next" data-testid="home-ring-next">Next: {NEXT_LABEL[next]} (+1 step closer)</span>}
          </div>
        </div>
        <div className="ring-chips">
          {missing.map((k) => (
            <Link key={k} to={OPTIONAL.includes(k) ? SHINE_ADD_PATH : requiredPath} className="ring-chip" data-testid={`home-ring-chip-${k}`}>
              &#65291; {CHIP_LABEL[k] ?? NEXT_LABEL[k].replace(/^./, (c) => c.toUpperCase())}
            </Link>
          ))}
        </div>
      </div>
    </Card>
  );
};

export default ProgressRingCard;
