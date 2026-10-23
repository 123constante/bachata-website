// The "Do you also teach or DJ?" screen on the way to Go live (invite journey
// W2). Rules and copy: ./roleQuestion.ts. Yes / No per role; a Yes opens the
// minimum inline; Continue stays off, with its reason on screen, until every
// role is answered. Writing is the caller's (saveRoleAnswers).
import { useId, useState } from 'react';
import { Chip, FIELD_CLASS, PrimaryButton } from '../../../ui';
import {
  DO_YOU, ROLE_MINIMUM, ROLE_QUESTION_HELP, roleQuestionBlock, type RoleAnswer, type RoleAnswers,
} from './roleQuestion';
import type { Role } from '@/modules/areas/shared/fieldRegistry';

export interface RoleQuestionProps {
  asked: readonly Role[];
  saving: boolean;
  error: string | null;
  initial?: RoleAnswers;
  onContinue: (answers: RoleAnswers) => void;
}

const EMPTY: RoleAnswer = { yes: null, fields: {} };

export function RoleQuestion({ asked, saving, error, initial = {}, onContinue }: RoleQuestionProps) {
  const id = useId();
  const [answers, setAnswers] = useState<RoleAnswers>(initial);
  const set = (r: Role, next: Partial<RoleAnswer>) =>
    setAnswers((a) => ({ ...a, [r]: { ...(a[r] ?? EMPTY), ...next } }));
  const block = roleQuestionBlock(asked, answers);
  const reasonId = `${id}-reason`;

  return (
    <div className="space-y-[16px]" data-testid="golive-roles">
      <p className="text-[13px] text-[var(--mut)]" data-testid="golive-roles-help">{ROLE_QUESTION_HELP}</p>
      {asked.map((r) => {
        const a = answers[r] ?? EMPTY;
        return (
          <fieldset key={r} className="space-y-[8px] rounded-[12px] border border-[var(--line)] p-[12px]" data-testid={`golive-role-${r}`}>
            <legend className="px-[4px] text-[15px] font-bold text-[var(--fg)]">{DO_YOU[r]}</legend>
            <div className="flex gap-[8px]">
              <Chip selected={a.yes === true} disabled={saving} onToggle={() => set(r, { yes: true })} testId={`golive-role-${r}-yes`}>Yes</Chip>
              <Chip selected={a.yes === false} disabled={saving} onToggle={() => set(r, { yes: false })} testId={`golive-role-${r}-no`}>No</Chip>
            </div>
            {a.yes && ROLE_MINIMUM[r].map((f) => {
              const fid = `${id}-${r}-${f.key}`;
              return (
                <div key={f.key} className="space-y-[4px]">
                  <label htmlFor={fid} className="text-[13px] font-semibold text-[var(--fg)]">{f.label}</label>
                  <input
                    id={fid}
                    type="text"
                    value={a.fields[f.key] ?? ''}
                    disabled={saving}
                    maxLength={f.kind === 'list' ? 400 : 80}
                    placeholder={f.placeholder}
                    aria-describedby={f.kind === 'list' ? `${fid}-hint` : undefined}
                    data-testid={`golive-role-${r}-${f.key}`}
                    onChange={(e) => set(r, { fields: { ...a.fields, [f.key]: e.target.value } })}
                    className={`${FIELD_CLASS} h-[48px]`}
                  />
                  {f.kind === 'list' && <p id={`${fid}-hint`} className="text-[12px] text-[var(--mut)]">At least one. Put a comma between them.</p>}
                </div>
              );
            })}
          </fieldset>
        );
      })}
      {error && <p role="alert" data-testid="golive-roles-error" className="text-[13px] text-[var(--danger)]">{error}</p>}
      {block && <p id={reasonId} role="status" data-testid="golive-roles-reason" className="text-[13px] text-[var(--mut)]">{block}</p>}
      <PrimaryButton testId="golive-roles-continue" loading={saving} disabled={!!block} aria-describedby={block ? reasonId : undefined} onClick={() => onContinue(answers)}>
        Continue
      </PrimaryButton>
    </div>
  );
}
