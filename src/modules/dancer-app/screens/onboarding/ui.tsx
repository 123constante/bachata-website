import type { ReactNode } from 'react';
import { GhostButton as BlockGhost, PrimaryButton as BlockPrimary, Field as BlockField, FIELD_CLASS } from '@/modules/organiser/ui';
import { nextStepLine, type NextStepProfile } from '../../api/nextStep';

/** Small presentational pieces for the onboarding cards, on the rebuild's blocks. Sizes in px (the phone html font-size trap). */

export const WRAP = '[overflow-wrap:anywhere] [word-break:break-word]';

/** The strength meter, with the SAME next-step sentence Home and Me show (api/nextStep.ts, review S2). */
export const Meter = ({ profile }: { profile: NextStepProfile }) => {
  const { strength } = profile;
  return (
  <div data-testid="onboarding-meter" className="mb-[12px]">
    <div className="flex justify-between text-[13px] font-bold">
      <span>Profile strength</span>
      <span data-testid="onboarding-pct">{strength.pct}%</span>
    </div>
    <div
      role="progressbar"
      aria-label="Profile strength"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={strength.pct}
      className="mt-[6px] h-[6px] overflow-hidden rounded-full bg-[var(--card2)]"
    >
      <div className="da-bar-fill h-full transition-[width] duration-200" style={{ width: `${strength.pct}%` }} />
    </div>
    {strength.next_step ? (
      <p data-testid="onboarding-next-step" className={`${WRAP} mb-0 mt-[6px] text-[14px]`}>
        {nextStepLine(profile)}
      </p>
    ) : null}
  </div>
  );
};

export const Tag = ({ children, onGradient }: { children: ReactNode; onGradient?: boolean }) => (
  <span
    className={`da-type-label mb-[8px] inline-block${onGradient ? ' !bg-black/30 !text-[var(--da-on-gradient)]' : ''}`}
    data-testid="onboarding-tag"
  >
    {children}
  </span>
);

export const Question = ({ children }: { children: ReactNode }) => (
  <h1 className={`${WRAP} mx-0 mb-[12px] mt-0 text-[30px] font-bold leading-[1.1]`}>{children}</h1>
);

export const PrimaryButton = ({ children, onClick, disabled, busy, testId }: { children: ReactNode; onClick: () => void; disabled?: boolean; busy?: boolean; testId?: string }) => (
  <BlockPrimary className="h-[48px]" onClick={onClick} disabled={disabled || busy} testId={testId ?? 'onboarding-continue'}>
    {busy ? 'Saving\u2026' : children}
  </BlockPrimary>
);

export const GhostButton = ({ children, onClick, testId }: { children: ReactNode; onClick: () => void; testId?: string }) => (
  <BlockGhost className="h-[48px]" onClick={onClick} testId={testId}>
    {children}
  </BlockGhost>
);

/** A reason a button is disabled, in visible text. */
export const Reason = ({ children }: { children: ReactNode }) => (
  <p data-testid="onboarding-reason" className={`${WRAP} mb-0 mt-[8px] text-[14px] text-[var(--mut)]`}>
    {children}
  </p>
);

export const ErrorLine = ({ message }: { message: string | null }) =>
  message ? (
    <p role="alert" data-testid="onboarding-error" className={`${WRAP} mb-0 mt-[8px] text-[14px] text-[var(--danger)]`}>
      {message}
    </p>
  ) : null;

/**
 * One answer in a question card: a full-width 56px option (radio for one answer, checkbox for several). The rebuild's
 * Chip is a pill toggle (aria-pressed); a list of long answers reads as stacked options, so this keeps the radio and
 * checkbox roles and takes the colour layer's selected look.
 */
export const Chip = ({ label, selected, onClick, multi }: { label: string; selected: boolean; onClick: () => void; multi?: boolean }) => (
  <button
    type="button"
    role={multi ? 'checkbox' : 'radio'}
    aria-checked={selected}
    onClick={onClick}
    className={`${WRAP} min-h-[56px] cursor-pointer rounded-[var(--r-ctl,12px)] border px-[14px] text-left text-[16px] font-semibold ${
      selected ? 'da-vote-on' : 'border-[var(--line-strong)] bg-[var(--card2)] text-[var(--fg)]'
    }`}
  >
    {label}
  </button>
);

export const Field = ({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) => (
  <div className="mb-[12px]">
    <BlockField label={label} htmlFor={id} help={hint}>
      {children}
    </BlockField>
  </div>
);

export const textInput = `${FIELD_CLASS} min-h-[48px]`;
