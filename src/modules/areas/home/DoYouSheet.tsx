import { useState } from 'react';
import { GhostButton, PrimaryButton, SheetView } from '@/modules/organiser/ui';
import { roleErrorMessage } from '../shared/errorCopy';
import { doYouDjStep } from '../dj/wizardSteps';
import { doYouTeachStep } from '../teacher/wizardSteps';
import { answerDoYou, type RoleWriters } from './rolesApi';

const DO_YOU = { teacher: doYouTeachStep, dj: doYouDjStep } as const;

/**
 * The ask sheet (D119 #3): the wizard step's own title and line, with Yes / Skip for now. Skip stores the same No.
 * ONE sheet for Your areas and for a teacher / DJ area page opened while the role is not added (F1).
 */
export function DoYouSheet({ role, writers, onDone, onClose }: { role: 'teacher' | 'dj'; writers: RoleWriters; onDone: (yes: boolean) => void; onClose: () => void }) {
  const step = DO_YOU[role];
  const [saving, setSaving] = useState<'yes' | 'skip' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const answer = async (yes: boolean) => {
    setSaving(yes ? 'yes' : 'skip');
    setError(null);
    try {
      await answerDoYou(role, yes, writers);
      onDone(yes);
    } catch (e) {
      setError(roleErrorMessage(e));
    } finally {
      setSaving(null);
    }
  };
  return (
    <SheetView
      open
      onOpenChange={(o) => { if (!o && !saving) onClose(); }}
      title={step.title}
      testId={`do-you-${role}`}
      footer={
        <div className="space-y-[8px]">
          <PrimaryButton testId={`do-you-${role}-yes`} loading={saving === 'yes'} disabled={saving !== null} onClick={() => void answer(true)}>Yes</PrimaryButton>
          <GhostButton testId={`do-you-${role}-skip`} loading={saving === 'skip'} disabled={saving !== null} onClick={() => void answer(false)}>Skip for now</GhostButton>
        </div>
      }
    >
      <div className="space-y-[8px]">
        {step.unlockLine && <p className="text-[15px] text-[var(--mut)]">{step.unlockLine}</p>}
        {error && <p role="alert" className="text-[14px] text-[var(--danger)]">{error}</p>}
      </div>
    </SheetView>
  );
}
