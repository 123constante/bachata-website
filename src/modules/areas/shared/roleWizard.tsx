import { useState } from 'react';
import { Chip, PrimaryButton } from '@/modules/organiser/ui';
import type { WizardStepDef, WizardStepProps } from '../wizardStep';
import { saveMyRole, setMyRoleDeclined } from './areaApi';
import { ROLE_ERROR_COPY } from './errorCopy';
import { REQUIRED_HINT, ROLE_FIELDS, roleField, type Role } from './fieldRegistry';
import { FieldInput } from './inputs';
import { sameValue, toDraftValue, toServerValue, validateValue, withPending, type DraftValue } from './roleModel';

/** The yes/no "Do you teach / DJ?" step's field name; its answer goes to set_my_role_declined_v1. */
export const DECLINED_FIELD = 'declined';
export const SKIP_LABEL = 'Skip for now';

// D26: the shell's heading is the question, so each step keeps its field label
// for screen readers only and puts "Optional" on the hint line. An empty step
// shows ONE quiet "Skip for now"; Continue appears once something is entered.
// A go-live key the wizard asks as REQUIRED (W2 walk fix 1) says the required
// words instead, offers no Skip, and its empty Continue is off with that reason.

/** The one quiet text button an empty optional step shows. */
function SkipButton({ onSkip, disabled }: { onSkip: () => void; disabled: boolean }) {
  return (
    <button type="button" data-testid="step-skip" disabled={disabled} onClick={onSkip} className="h-[44px] w-full text-[15px] font-semibold text-[var(--mut)] underline underline-offset-4">
      {SKIP_LABEL}
    </button>
  );
}

function StepError({ error }: { error: string | null }) {
  return error ? <p role="alert" className="text-[13px] text-[var(--danger)]">{error}</p> : null;
}

/** Yes and No answer on the tap (advanceOnAnswer): no separate Continue. */
function YesNoAnswer({ label, held, saving, onPick }: { label: string; held: boolean | null; saving: boolean; onPick(v: boolean): void }) {
  return (
    <div role="group" aria-label={label} className="flex gap-[8px]">
      <Chip selected={held === true} disabled={saving} onToggle={() => onPick(true)}>Yes</Chip>
      <Chip selected={held === false} disabled={saving} onToggle={() => onPick(false)}>No</Chip>
    </div>
  );
}

function isEmpty(v: unknown): boolean {
  return v === null || (Array.isArray(v) && v.length === 0);
}

function makeFieldStep(role: Role, key: string) {
  const field = roleField(role, key)!;
  function RoleFieldStep({ value, required, saving, error, onAnswer, onSkip }: WizardStepProps) {
    const [draft, setDraft] = useState<DraftValue>(() => toDraftValue(field, value));
    const [pending, setPending] = useState('');
    const [localError, setLocalError] = useState<string | null>(null);
    const id = `wizard-${role}-${key}`;
    const held = toServerValue(field, toDraftValue(field, value));
    const effective = field.kind === 'list' ? withPending(Array.isArray(draft) ? draft : [], pending) : draft;
    const sent = toServerValue(field, effective);
    const changed = !sameValue(sent, held);
    const words = required ? [field.help, REQUIRED_HINT] : ['Optional.', field.help];
    const hint = <p id={`${id}-help`} className="text-[13px] text-[var(--mut)]" data-testid="step-hint">{words.filter(Boolean).join(' ')}</p>;
    // An untouched answer sends nothing (finding 5): it moves on as a Skip.
    const send = (v: unknown) => {
      if (sameValue(v, held)) {
        onSkip?.();
        return;
      }
      const code = validateValue(field, v);
      if (code) {
        setLocalError(ROLE_ERROR_COPY[code]);
        return;
      }
      onAnswer(v);
    };
    if (field.kind === 'yesno') {
      return (
        <div className="space-y-[16px]" data-testid={`step-${key}`}>
          <div className="space-y-[4px]">
            <YesNoAnswer label={field.label} held={typeof held === 'boolean' ? held : null} saving={saving} onPick={send} />
            {hint}
          </div>
          <StepError error={error} />
          {held === null && onSkip && <SkipButton onSkip={onSkip} disabled={saving} />}
        </div>
      );
    }
    return (
      <div className="space-y-[16px]" data-testid={`step-${key}`}>
        <div className="space-y-[4px]">
          <label htmlFor={id} className="sr-only">{field.label}</label>
          <FieldInput
            field={field}
            id={id}
            value={draft}
            disabled={saving}
            autoFocus
            describedBy={`${id}-help`}
            onPendingChange={(t) => { setPending(t); setLocalError(null); }}
            onChange={(v) => { setDraft(v); setLocalError(null); }}
          />
          {hint}
        </div>
        <StepError error={localError ?? error} />
        {!isEmpty(sent) || changed ? (
          <PrimaryButton testId="step-continue" loading={saving} onClick={() => send(sent)}>Continue</PrimaryButton>
        ) : required ? (
          <PrimaryButton testId="step-continue" disabled aria-describedby={`${id}-help`}>Continue</PrimaryButton>
        ) : (
          onSkip && <SkipButton onSkip={onSkip} disabled={saving} />
        )}
      </div>
    );
  }
  RoleFieldStep.displayName = `${role}:${key}`;
  return RoleFieldStep;
}

/** One step per writable key, one question per screen, all optional (Skip allowed). */
export function makeRoleWizardSteps(role: Role): WizardStepDef[] {
  return ROLE_FIELDS[role].map((f) => ({
    area: role,
    field: f.key,
    title: f.question,
    Component: makeFieldStep(role, f.key),
    toPatch: (value: unknown) => ({ [f.key]: value }),
    labelIsQuestion: true,
    ...(f.kind === 'yesno' ? { advanceOnAnswer: true } : {}),
  }));
}

/** "Do you teach?" / "Do you DJ?": No = declined true. Answers on the tap of Yes or No. */
export function makeDoYouStep(role: Role, title: string, unlockLine: string): WizardStepDef {
  function DoYouStep({ value, saving, error, onAnswer, onSkip }: WizardStepProps) {
    const held = typeof value === 'boolean' ? value : null;
    return (
      <div className="space-y-[16px]">
        <YesNoAnswer label={title} held={held} saving={saving} onPick={onAnswer} />
        <StepError error={error} />
        {held === null && onSkip && <SkipButton onSkip={onSkip} disabled={saving} />}
      </div>
    );
  }
  DoYouStep.displayName = `${role}:do-you`;
  return {
    area: role,
    field: DECLINED_FIELD,
    title,
    unlockLine,
    Component: DoYouStep,
    toPatch: (value: unknown) => ({ [DECLINED_FIELD]: value === false }),
    labelIsQuestion: true,
    advanceOnAnswer: true,
  };
}

/**
 * How the wizard shell sends a step's answer: the yes/no step goes to
 * set_my_role_declined_v1, every field step to save_my_role_v1 with exactly
 * its one key. Shared so the shell (slice A-WEB1b) never re-decides it.
 */
export async function submitRoleWizardStep(step: WizardStepDef, value: unknown): Promise<void> {
  if (step.area !== 'teacher' && step.area !== 'dj') throw new Error('invalid_role');
  const patch = step.toPatch(value);
  if (step.field === DECLINED_FIELD) {
    await setMyRoleDeclined(step.area, patch[DECLINED_FIELD] === true);
    return;
  }
  await saveMyRole(step.area, patch);
}
