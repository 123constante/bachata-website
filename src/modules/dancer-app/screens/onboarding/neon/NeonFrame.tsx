import type { ReactNode } from 'react';
import { NeonPhoto } from './NeonPhoto';
import './neon.css';

export interface NeonFrameProps {
  /** Zero-based index of the current step (segments 0..pos are lit). */
  pos: number;
  /** Number of segments in the bar. */
  total: number;
  onBack?: () => void;
  /** Body top offset in px: 300 default, 215 for years. */
  top?: number;
  children: ReactNode;
}

export function NeonFrame({ pos, total, onBack, top = 300, children }: NeonFrameProps) {
  return (
    <div className="neon" data-testid="neon-frame">
      <NeonPhoto />
      <div className="neon-seg" data-testid="onboarding-progress">
        {Array.from({ length: total }, (_, k) => (
          <i key={k} data-testid="onboarding-seg" className={k <= pos ? 'on' : undefined} />
        ))}
      </div>
      {pos > 0 && onBack ? (
        <button type="button" className="neon-back" data-testid="onboarding-back" onClick={onBack}>
          &lsaquo; Back
        </button>
      ) : null}
      <div className="neon-body" style={{ top }}>
        {children}
      </div>
    </div>
  );
}
