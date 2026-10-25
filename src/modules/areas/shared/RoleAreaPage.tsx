import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useProfileProgress } from '@/modules/organiser/shared/profileProgress';
import { Card, ErrorState, PrimaryButton, SkeletonRows, StatusTag } from '@/modules/organiser/ui';
import { AREA_TONE, areaAction, areaStatus, isAreaShown } from '../home/areaStatus';
import { DoYouSheet } from '../home/DoYouSheet';
import { REAL_ROLE_WRITERS, fetchMyRoles, myRoleIntentQueryKey, myRolesQueryKey, type RoleWriters } from '../home/rolesApi';
import { fetchMyLineup, fetchMyRoleDetails, lineupQueryKey, roleDetailsQueryKey } from './areaApi';
import { AreaFrame } from './AreaFrame';
import { BlockedState, blockedCode, type BlockedPaths } from './BlockedState';
import { roleErrorCode, roleErrorMessage } from './errorCopy';
import { ROLE_NAME, ROLE_NOUN, ROLE_REQUIRED_LEAD, type Role } from './fieldRegistry';
import { LineupList } from './LineupList';
import { completeness, completenessLine } from './roleModel';

export interface RoleAreaPaths {
  /** This role's details edit page. */
  profile: string;
  /** Where the back link goes (the account home). */
  back: string;
  backLabel?: string;
  /** Where the no-profile and signed-out states send the person. */
  blocked: BlockedPaths;
}

/**
 * The prototype's meter line (S2): "N of M" as a big number over the rest, the other sentences at 24px. The text is
 * exactly the D118 sentence, so every surface that reads completenessLine still matches it.
 */
function MeterLine({ line }: { line: string }) {
  const m = /^(\d+)( of .*)$/.exec(line);
  if (!m) return <p className="text-[24px] font-extrabold leading-[30px]" data-testid="completeness-line">{line}</p>;
  return (
    <p className="text-[34px] font-extrabold leading-none tracking-[-1px] tabular-nums" data-testid="completeness-line">
      {m[1]}
      <span className="text-[17px] font-semibold tracking-normal text-[var(--mut)]">{m[2]}</span>
    </p>
  );
}

/** Shown the same way on the teacher and the DJ dashboard. */
export function CompletenessMeter({ role, filled, total, percent, complete }: { role: Role; filled: number; total: number; percent: number; complete?: boolean }) {
  return (
    <div className="space-y-[8px]">
      <MeterLine line={completenessLine({ filled, total, percent }, { complete })} />
      <div
        role="progressbar"
        aria-label={`${ROLE_NAME[role]} details added`}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={filled}
        aria-valuetext={completenessLine({ filled, total, percent }, { complete })}
        className="h-[8px] overflow-hidden rounded-full bg-[var(--card2)]"
      >
        <div className="h-full rounded-full bg-[var(--gold)]" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-[13px] text-[var(--mut)]" data-testid="role-required-lead">{ROLE_REQUIRED_LEAD[role]}</p>
    </div>
  );
}

/**
 * The area page of a role the person has not added (or said no to): the SAME status words and the SAME action Your
 * areas offers (areaStatus / areaAction), never a details count or Edit (F1). A direct link lands somewhere that works.
 */
function NotAddedCard({ role, status, writers }: { role: 'teacher' | 'dj'; status: ReturnType<typeof areaStatus>; writers: RoleWriters }) {
  const qc = useQueryClient();
  const [asking, setAsking] = useState(false);
  const action = areaAction(role, status);
  const done = () => {
    setAsking(false);
    void qc.invalidateQueries({ queryKey: myRolesQueryKey });
    void qc.invalidateQueries({ queryKey: myRoleIntentQueryKey });
    void qc.invalidateQueries({ queryKey: ['my-profile-progress'] });
  };
  return (
    <Card label={`Your ${ROLE_NOUN[role]} details`} variant="padded" testId="not-added-card">
      <div className="flex items-center justify-between gap-[12px]">
        <StatusTag tone={AREA_TONE[status.kind]} testId={`area-status-${role}`}>{status.words}</StatusTag>
        {action.kind === 'ask' && <PrimaryButton testId="area-action-ask" onClick={() => setAsking(true)}>{action.label}</PrimaryButton>}
      </div>
      {asking && <DoYouSheet role={role} writers={writers} onDone={done} onClose={() => setAsking(false)} />}
    </Card>
  );
}

/** The teacher / DJ dashboard: completeness + Edit details, then line-up appearances. */
export function RoleAreaPage({ role, paths, writers = REAL_ROLE_WRITERS }: { role: Role; paths: RoleAreaPaths; writers?: RoleWriters }) {
  const navigate = useNavigate();
  const details = useQuery({ queryKey: roleDetailsQueryKey(role), queryFn: () => fetchMyRoleDetails(role) });
  const lineup = useQuery({ queryKey: lineupQueryKey(role), queryFn: () => fetchMyLineup(role) });
  // The server's own "Complete" word, so the meter never contradicts the status (D118).
  const roles = useQuery({ queryKey: myRolesQueryKey, queryFn: fetchMyRoles });
  // The same progress query Your areas reads: whether the role counts as added is areaStatus's call, not a copy of it.
  const progress = useProfileProgress(null);
  const row = roles.data?.find((r) => r.role === role);
  const held = row?.active ? row : undefined;
  const settled = roles.status !== 'pending' && progress.status !== 'pending';
  const shown = isAreaShown(role, row, progress.data);
  const name = ROLE_NAME[role];
  const blocked = blockedCode(details.error, lineup.error);
  return (
    <AreaFrame title={name} back={{ to: paths.back, label: paths.backLabel ?? 'Account' }} testId={`${role}-area`}>
      {blocked ? (
        <BlockedState code={blocked} paths={paths.blocked} />
      ) : !settled ? (
        <Card variant="padded"><SkeletonRows count={2} label={`Loading your ${name} details`} /></Card>
      ) : roles.status === 'error' ? (
        <ErrorState title="Your areas did not load" onRetry={() => void roles.refetch()} retrying={roles.isFetching} testId="areas-error" />
      ) : !shown ? (
        <NotAddedCard role={role} status={areaStatus(role, row, progress.data)} writers={writers} />
      ) : (
        <>
          <Card label={`Your ${ROLE_NOUN[role]} details`} variant="padded" testId="details-card">
            {/* The meter waits for my_roles_v1 too: its "Complete" word decides the zero line (S7, D118). */}
            {details.status === 'pending' ? (
              <SkeletonRows count={2} label={`Loading your ${name} details`} />
            ) : details.status === 'error' ? (
              <ErrorState
                testId="details-error"
                body={roleErrorCode(details.error) ? roleErrorMessage(details.error) : undefined}
                onRetry={() => void details.refetch()}
                retrying={details.isFetching}
              />
            ) : (
              <div className="space-y-[16px]">
                <CompletenessMeter role={role} {...completeness(role, details.data.details)} complete={held?.complete === true} />
                <PrimaryButton testId="edit-details" onClick={() => navigate(paths.profile)}>Edit details</PrimaryButton>
              </div>
            )}
          </Card>
          <LineupList status={lineup.status} rows={lineup.data} onRetry={() => void lineup.refetch()} retrying={lineup.isFetching} />
        </>
      )}
    </AreaFrame>
  );
}
