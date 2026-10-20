import { useState } from 'react';
import { Field, GhostButton, PrimaryButton } from '@/modules/organiser/ui';
import type { WizardStepDef, WizardStepProps } from '../wizardStep';
import { saveMyRole, setMyRoleDeclined } from './areaApi';
import { ROLE_ERROR_COPY } from './errorCopy';
import { ROLE_FIELDS, roleField, type Role } from './fieldRegistry';
import { FieldInput, YesNoInput } from './inputs';
import { toDraftValue, toServerValue, validateValue, type DraftValue } from './roleModel';

/** The yes/no "Do you teach / DJ?" step's field name; its answer goes to set_my_role_declined_v1. */
export const DECLINED_FIELD = 'declined';

function makeFieldStep(role: Role, key: string) {
  const field = roleField(role, key)!;
  function RoleFieldStep({ value, saving, error, onAnswer, onSkip }: WizardStepProps) {
    const [draft, setDraft] = useState<DraftValue>(() => toDraftValue(field, value));
    const [localError, setLocalError] = useState<string | null>(null);
    const id = `wizard-${role}-${key}`;
    const answer = () => {
      const sent = toServerValue(field, draft);
      const code = validateValue(field, sent);
      if (code) {
        setLocalError(ROLE_ERROR_COPY[code]);
        return;
      }
      onAnswer(sent);
    };
    return (
      <div className="space-y-[16px]">
        <Field label={`${field.label} (optional)`} htmlFor={field.kind === 'yesno' ? undefined : id} help={field.help} error={localError ?? error} testId={`step-${key}`}>
          <FieldInput field={field} id={id} value={draft} disabled={saving} autoFocus describedBy={field.help ? `${id}-help` : undefined} onChange={(v) => { setDraft(v); setLocalError(null); }} />
        </Field>
        <PrimaryButton testId="step-continue" loading={saving} onClick={answer}>Continue</PrimaryButton>
        {onSkip && <GhostButton testId="step-skip" disabled={saving} onClick={onSkip}>Skip</GhostButton>}
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
  }));
}

/** "Do you teach?" / "Do you DJ?": No = declined true. */
export function makeDoYouStep(role: Role, title: string, unlockLine: string): WizardStepDef {
  function DoYouStep({ value, saving, error, onAnswer, onSkip }: WizardStepProps) {
    const [answer, setAnswer] = useState<boolean | null>(typeof value === 'boolean' ? value : null);
    return (
      <div className="space-y-[16px]">
        <YesNoInput label={title} value={answer} onChange={setAnswer} disabled={saving} />
        {error && <p role="alert" className="text-[13px] text-[var(--danger)]">{error}</p>}
        <PrimaryButton testId="step-continue" loading={saving} disabled={answer === null} onClick={() => answer !== null && onAnswer(answer)}>
          Continue
        </PrimaryButton>
        {answer === null && <p className="text-center text-[13px] text-[var(--mut)]">Choose Yes or No to continue.</p>}
        {onSkip && <GhostButton testId="step-skip" disabled={saving} onClick={onSkip}>Skip</GhostButton>}
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
