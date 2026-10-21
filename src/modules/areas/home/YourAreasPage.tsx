// /account/areas -- "Your areas": one row per role (my_roles_v1), each with its
// status words (areaStatus, the one mapping) and ONE action. A teacher or DJ
// role the person does not hold is added through the wizard's own "Do you
// teach? / Do you DJ?" step, answered here and stored by the B-DB1 writers.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, GraduationCap, Headphones, User, type LucideIcon } from 'lucide-react';
import { AREA_PATHS } from '@/lib/areaPaths';
import { useProfileProgress } from '@/modules/organiser/shared/profileProgress';
import { Card, ErrorState, GhostButton, PrimaryButton, SheetView, SkeletonRows, StatusTag, type StatusTone } from '@/modules/organiser/ui';
import { AreaFrame } from '../shared/AreaFrame';
import { BlockedState, blockedCode } from '../shared/BlockedState';
import { roleErrorMessage } from '../shared/errorCopy';
import { DANCER_PROFILE_PATH, SIGN_IN_PATH } from '../shared/paths';
import { doYouDjStep } from '../dj/wizardSteps';
import { doYouTeachStep } from '../teacher/wizardSteps';
import { AREA_NAME, YOUR_AREAS_LABEL, areaAction, areaStatus, type AreaAction, type AreaStatusKind } from './areaStatus';
import { AREA_ROLES, REAL_ROLE_WRITERS, type AreaRole, fetchMyRoles, myRoleIntentQueryKey, myRolesQueryKey, answerDoYou, type RoleWriters } from './rolesApi';

const DO_YOU = { teacher: doYouTeachStep, dj: doYouDjStep } as const;
export const ACCOUNT_PATH = '/account';

/** The status tag's tone: green for Complete, amber for unfinished, quiet for not added / said no. */
const TONE: Record<AreaStatusKind, StatusTone> = { complete: 'live', 'to-finish': 'draft', 'not-held': 'neutral', declined: 'neutral' };

const ROLE_ICON: Record<AreaRole, LucideIcon> = { dancer: User, organiser: CalendarDays, teacher: GraduationCap, dj: Headphones };

const ACTION = 'inline-flex h-[44px] min-w-[64px] shrink-0 items-center justify-center rounded-[12px] px-[12px] text-[15px] font-semibold';

function ActionControl({ action, onAsk }: { action: AreaAction; onAsk: (role: 'teacher' | 'dj') => void }) {
  const testId = `area-action-${action.kind}`;
  if (action.kind === 'ask') {
    return <button type="button" className={`${ACTION} bg-[var(--card2)] text-[var(--fg)]`} data-testid={testId} onClick={() => onAsk(action.role)}>{action.label}</button>;
  }
  const tone = action.kind === 'open' ? 'text-[var(--gold-fg)]' : 'bg-[var(--card2)] text-[var(--fg)]';
  return <Link to={action.to} className={`${ACTION} ${tone}`} data-testid={testId}>{action.label}</Link>;
}

/** The ask sheet (D119 #3): the wizard step's own title and line, with Yes / Skip for now. Skip stores the same No. */
function DoYouSheet({ role, writers, onDone, onClose }: { role: 'teacher' | 'dj'; writers: RoleWriters; onDone: (yes: boolean) => void; onClose: () => void }) {
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
                <span aria-hidden="true" className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[12px] bg-[var(--card2)] text-[var(--mut)]">
                  {(() => { const Icon = ROLE_ICON[role]; return <Icon className="h-[20px] w-[20px]" />; })()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-[var(--fg)]">{AREA_NAME[role]}</span>
                  <StatusTag tone={TONE[status.kind]} testId={`area-status-${role}`} className="mt-[2px]">{status.words}</StatusTag>
                </span>
                <ActionControl action={areaAction(role, status)} onAsk={setAsking} />
              </div>
            );
          })}
        </Card>
        {asking && <DoYouSheet key={asking} role={asking} writers={writers} onDone={(yes) => done(asking, yes)} onClose={() => setAsking(null)} />}
      </>
    );
  }

  return (
    <AreaFrame title={YOUR_AREAS_LABEL} back={{ to: ACCOUNT_PATH, label: 'Account' }} testId="your-areas">
      {body}
    </AreaFrame>
  );
}
