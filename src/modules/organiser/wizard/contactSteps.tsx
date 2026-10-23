// The wizard's phone and Instagram steps (invite journey W2). Same contract and
// footer as the text step in stepKinds.tsx, but the field is the ONE shared
// input (PhoneInput / InstagramInput), so the wizard saves exactly what the
// edit screens save: E.164, or the bare lowercase Instagram name. A stored
// legacy value is shown as it is; Continue on it untouched sends nothing new.
import { useId, useState, type ReactNode } from 'react';
import type { WizardStepProps } from '@/modules/areas/wizardStep';
import { PhoneInput } from '@/components/forms/PhoneInput';
import { InstagramInput } from '@/components/forms/InstagramInput';
import { checkInstagramField } from '@/lib/instagramHandle';
import { Frame, Hint, StepError, StepFooter, textOf } from './stepKinds';

/** Why Continue is refused while the number is not complete (on screen, as the step error). */
export const PHONE_INCOMPLETE = 'Finish the number first: pick the country, then type the rest.';

export interface ContactStepConfig {
  label: string;
  help?: ReactNode;
}

export function makePhoneStep(key: string, c: ContactStepConfig) {
  function PhoneStep({ value, required, saving, error, onAnswer, onSkip }: WizardStepProps) {
    const id = useId();
    const stored = textOf(value);
    const [draft, setDraft] = useState(stored);
    const [valid, setValid] = useState(false);
    const [local, setLocal] = useState<string | null>(null);
    const blank = draft.trim() === '';
    const send = () => {
      if (draft === stored) { onAnswer(stored || null); return; }
      if (!valid) { setLocal(PHONE_INCOMPLETE); return; }
      onAnswer(draft);
    };
    return (
      <Frame testId={`step-${key}`}>
        <div className="space-y-[4px]">
          <label htmlFor={id} className="sr-only">{c.label}</label>
          <PhoneInput
            inputId={id}
            value={draft}
            disabled={saving}
            autoFocus
            error={local ?? error}
            renderError={false}
            onChange={(e164, ok) => { setDraft(e164); setValid(ok); setLocal(null); }}
          />
          <Hint id={`${id}-hint`} required={required} help={c.help} />
        </div>
        <div id={`${id}-error`}><StepError error={local ?? error} /></div>
        <StepFooter blank={blank} required={required} saving={saving} hintId={`${id}-hint`} onContinue={send} onSkip={onSkip} />
      </Frame>
    );
  }
  PhoneStep.displayName = `phone:${key}`;
  return PhoneStep;
}

export function makeInstagramStep(key: string, c: ContactStepConfig) {
  function InstagramStep({ value, required, saving, error, onAnswer, onSkip }: WizardStepProps) {
    const id = useId();
    const stored = textOf(value);
    const [draft, setDraft] = useState(stored);
    const blank = draft.trim() === '';
    const untouched = draft === stored;
    const check = untouched ? null : checkInstagramField(draft);
    const local = check && !check.ok ? check.error : null;
    const send = () => {
      if (untouched) { onAnswer(stored || null); return; }
      if (check?.ok) onAnswer(check.handle);
      // A refused box sends nothing; the reason is already on screen.
    };
    return (
      <Frame testId={`step-${key}`}>
        <div className="space-y-[4px]">
          <label htmlFor={id} className="sr-only">{c.label}</label>
          <InstagramInput
            id={id}
            value={draft}
            stored={stored}
            disabled={saving}
            autoFocus
            error={local ?? error}
            renderError={false}
            describedBy={`${id}-hint`}
            onChange={setDraft}
            onEnter={() => { if (!blank && !saving) send(); }}
          />
          <Hint id={`${id}-hint`} required={required} help={c.help} />
        </div>
        <div id={`${id}-error`}><StepError error={local ?? error} /></div>
        <StepFooter blank={blank} required={required} saving={saving} hintId={`${id}-hint`} onContinue={send} onSkip={onSkip} />
      </Frame>
    );
  }
  InstagramStep.displayName = `instagram:${key}`;
  return InstagramStep;
}
