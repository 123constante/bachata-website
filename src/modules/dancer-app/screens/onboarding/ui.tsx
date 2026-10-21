import type { CSSProperties, ReactNode } from 'react';
import { nextStepLine, type NextStepProfile } from '../../api/nextStep';

/** Small presentational pieces for the onboarding cards. Sizes in px (the phone html font-size trap). */

export const wrap: CSSProperties = { overflowWrap: 'anywhere', wordBreak: 'break-word' };

/** The strength meter, with the SAME next-step sentence Home and Me show (api/nextStep.ts, review S2). */
export const Meter = ({ profile }: { profile: NextStepProfile }) => {
  const { strength } = profile;
  return (
  <div data-testid="onboarding-meter" style={{ marginBottom: 12 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700 }}>
      <span>Profile strength</span>
      <span data-testid="onboarding-pct">{strength.pct}%</span>
    </div>
    <div
      role="progressbar"
      aria-label="Profile strength"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={strength.pct}
      style={{ height: 6, borderRadius: 999, background: 'var(--da-surface-2)', marginTop: 6, overflow: 'hidden' }}
    >
      <div style={{ width: `${strength.pct}%`, height: '100%', background: 'var(--da-sun)', transition: 'width .2s' }} />
    </div>
    {strength.next_step ? (
      <p data-testid="onboarding-next-step" style={{ ...wrap, fontSize: 14, margin: '6px 0 0' }}>
        {nextStepLine(profile)}
      </p>
    ) : null}
  </div>
  );
};

export const Tag = ({ children, onGradient }: { children: ReactNode; onGradient?: boolean }) => (
  <span
    className="da-type-label"
    data-testid="onboarding-tag"
    style={{ display: 'inline-block', marginBottom: 8, ...(onGradient ? { background: 'rgba(0,0,0,0.28)', color: 'var(--da-on-gradient)' } : null) }}
  >
    {children}
  </span>
);

export const Question = ({ children }: { children: ReactNode }) => (
  <h1 style={{ ...wrap, fontSize: 30, lineHeight: 1.1, fontWeight: 700, margin: '0 0 12px' }}>{children}</h1>
);

const btn: CSSProperties = {
  minHeight: 48,
  borderRadius: 12,
  fontSize: 16,
  fontWeight: 700,
  padding: '0 16px',
  width: '100%',
  cursor: 'pointer',
};

export const PrimaryButton = ({ children, onClick, disabled, busy, testId }: { children: ReactNode; onClick: () => void; disabled?: boolean; busy?: boolean; testId?: string }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled || busy}
    data-testid={testId ?? 'onboarding-continue'}
    style={{ ...btn, border: 'none', background: 'var(--da-accent)', color: 'var(--da-on-accent)', opacity: disabled || busy ? 0.55 : 1 }}
  >
    {busy ? 'Saving\u2026' : children}
  </button>
);

export const GhostButton = ({ children, onClick, testId }: { children: ReactNode; onClick: () => void; testId?: string }) => (
  <button type="button" onClick={onClick} data-testid={testId} style={{ ...btn, background: 'transparent', color: 'inherit', border: '1px solid var(--da-border)' }}>
    {children}
  </button>
);

/** A reason a button is disabled, in visible text. */
export const Reason = ({ children }: { children: ReactNode }) => (
  <p data-testid="onboarding-reason" className="da-muted" style={{ ...wrap, fontSize: 14, margin: '8px 0 0' }}>
    {children}
  </p>
);

export const ErrorLine = ({ message }: { message: string | null }) =>
  message ? (
    <p role="alert" data-testid="onboarding-error" style={{ ...wrap, color: 'var(--da-danger)', fontSize: 14, margin: '8px 0 0' }}>
      {message}
    </p>
  ) : null;

export const Chip = ({ label, selected, onClick, multi }: { label: string; selected: boolean; onClick: () => void; multi?: boolean }) => (
  <button
    type="button"
    role={multi ? 'checkbox' : 'radio'}
    aria-checked={selected}
    onClick={onClick}
    style={{
      ...wrap,
      minHeight: 56,
      borderRadius: 12,
      fontSize: 16,
      fontWeight: 600,
      padding: '0 14px',
      cursor: 'pointer',
      textAlign: 'left',
      color: selected ? '#fff' : 'var(--da-text)',
      background: selected ? 'var(--da-sun-scrim), var(--da-sun)' : 'var(--da-surface-2)',
      border: `1px solid ${selected ? 'transparent' : 'var(--da-border)'}`,
    }}
  >
    {label}
  </button>
);

export const Field = ({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) => (
  <div style={{ marginBottom: 12 }}>
    <label htmlFor={id} style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
      {label}
    </label>
    {children}
    {hint ? (
      <p className="da-muted" style={{ ...wrap, fontSize: 13, margin: '4px 0 0' }}>
        {hint}
      </p>
    ) : null}
  </div>
);

/** A link that looks like a PrimaryButton (primary) or a GhostButton: same 48px height, centred text. */
export const linkButton = (primary: boolean): CSSProperties => ({
  ...btn,
  ...wrap,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  textDecoration: 'none',
  boxSizing: 'border-box',
  background: primary ? 'var(--da-accent)' : 'transparent',
  color: primary ? 'var(--da-on-accent)' : 'inherit',
  border: primary ? 'none' : '1px solid var(--da-border)',
});

export const textInput: CSSProperties = {
  width: '100%',
  minHeight: 48,
  borderRadius: 12,
  border: '1px solid var(--da-border)',
  background: 'var(--da-surface-2)',
  color: 'var(--da-text)',
  fontSize: 16,
  padding: '0 12px',
};
