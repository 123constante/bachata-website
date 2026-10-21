// /account/areas -- "Your areas": one row per role (my_roles_v1), each with its
// status words (areaStatus, the one mapping) and ONE action. A teacher or DJ
// role the person does not hold is added through the wizard's own "Do you
// teach? / Do you DJ?" step, answered here and stored by the B-DB1 writers.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AREA_PATHS } from '@/lib/areaPaths';
import { useProfileProgress } from '@/modules/organiser/shared/profileProgress';
import { Card, ErrorState, SkeletonRows } from '@/modules/organiser/ui';
import { AreaFrame } from '../shared/AreaFrame';
import { BlockedState, blockedCode } from '../shared/BlockedState';
import { roleErrorMessage } from '../shared/errorCopy';
import { DANCER_PROFILE_PATH, SIGN_IN_PATH } from '../shared/paths';
import { doYouDjStep } from '../dj/wizardSteps';
import { doYouTeachStep } from '../teacher/wizardSteps';
import { AREA_NAME, YOUR_AREAS_LABEL, areaAction, areaStatus, type AreaAction } from './areaStatus';
import { AREA_ROLES, REAL_ROLE_WRITERS, fetchMyRoles, myRoleIntentQueryKey, myRolesQueryKey, answerDoYou, type RoleWriters } from './rolesApi';
import { StatusDot } from './StatusDot';

const DO_YOU = { teacher: doYouTeachStep, dj: doYouDjStep } as const;
export const ACCOUNT_PATH = '/account';

const ACTION = 'inline-flex h-[44px] min-w-[64px] shrink-0 items-center justify-center rounded-[12px] px-[12px] text-[15px] font-semibold';

function ActionControl({ action, onAsk }: { action: AreaAction; onAsk: (role: 'teacher' | 'dj') => void }) {
  const testId = `area-action-${action.kind}`;
  if (action.kind === 'ask') {
    return <button type="button" className={`${ACTION} bg-[var(--card2)] text-[var(--fg)]`} data-testid={testId} onClick={() => onAsk(action.role)}>{action.label}</button>;
  }
  const tone = action.kind === 'open' ? 'text-[var(--gold)]' : 'bg-[var(--card2)] text-[var(--fg)]';
  return <Link to={action.to} className={`${ACTION} ${tone}`} data-testid={testId}>{action.label}</Link>;
}

/** The wizard's own "Do you...?" step, shown in place for one role. */
function DoYouPanel({ role, writers, onDone }: { role: 'teacher' | 'dj'; writers: RoleWriters; onDone: (yes: boolean) => void }) {
  const step = DO_YOU[role];
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const answer = async (value: unknown) => {
    setSaving(true);
    setError(null);
    try {
      await answerDoYou(role, value === true, writers);
      onDone(value === true);
    } catch (e) {
      setError(roleErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card variant="padded" testId={`do-you-${role}`}>
      <div className="space-y-[12px]">
        <h2 className="text-[17px] font-bold text-[var(--fg)]">{step.title}</h2>
        {step.unlockLine && <p className="text-[14px] text-[var(--mut)]">{step.unlockLine}</p>}
        <step.Component field={step.field} value={null} required={false} saving={saving} error={error} onAnswer={(v) => void answer(v)} />
      </div>
    </Card>
  );
}

export interface YourAreasPageProps { writers?: RoleWriters }

export default function YourAreasPage({ writers = REAL_ROLE_WRITERS }: YourAreasPageProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const roles = useQuery({ queryKey: myRolesQueryKey, queryFn: fetchMyRoles });
  // The same progress query the wizard and Home read: the step counts and the No answers.
  const progress = useProfileProgress(null);
  const [asking, setAsking] = useState<'teacher' | 'dj' | null>(null);
  const blocked = blockedCode(roles.error);

  const done = (role: 'teacher' | 'dj', yes: boolean) => {
    setAsking(null);
    void qc.invalidateQueries({ queryKey: myRolesQueryKey });
    void qc.invalidateQueries({ queryKey: myRoleIntentQueryKey });
    void qc.invalidateQueries({ queryKey: ['my-profile-progress'] });
    if (yes) navigate(AREA_PATHS[role]);
  };

  let body;
  if (blocked) {
    body = <BlockedState code={blocked} paths={{ dancerProfile: DANCER_PROFILE_PATH, signIn: SIGN_IN_PATH }} />;
  } else if (roles.status === 'pending') {
    body = <Card variant="padded"><SkeletonRows count={4} label="Loading your areas" /></Card>;
  } else if (roles.status === 'error') {
    body = <ErrorState title="Your areas did not load" onRetry={() => void roles.refetch()} retrying={roles.isFetching} testId="areas-error" />;
  } else {
    const rows = roles.data;
    body = (
      <>
        <Card testId="areas-list">
          {AREA_ROLES.map((role) => {
            const status = areaStatus(role, rows.find((r) => r.role === role), progress.data);
            return (
              <div key={role} className="flex min-h-[56px] items-center gap-[12px] px-[16px] py-[8px]" data-testid={`area-row-${role}`} data-status={status.kind}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-[var(--fg)]">{AREA_NAME[role]}</span>
                  <span className="flex items-center gap-[6px] text-[13px] text-[var(--mut)]">
                    <StatusDot kind={status.kind} />
                    <span data-testid={`area-status-${role}`}>{status.words}</span>
                  </span>
                </span>
                <ActionControl action={areaAction(role, status)} onAsk={setAsking} />
              </div>
            );
          })}
        </Card>
        {asking && <DoYouPanel key={asking} role={asking} writers={writers} onDone={(yes) => done(asking, yes)} />}
      </>
    );
  }

  return (
    <AreaFrame title={YOUR_AREAS_LABEL} back={{ to: ACCOUNT_PATH, label: 'Account' }} testId="your-areas">
      {body}
    </AreaFrame>
  );
}
