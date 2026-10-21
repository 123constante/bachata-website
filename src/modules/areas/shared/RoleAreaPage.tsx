import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, ErrorState, PrimaryButton, SkeletonRows } from '@/modules/organiser/ui';
import { fetchMyRoles, myRolesQueryKey } from '../home/rolesApi';
import { fetchMyLineup, fetchMyRoleDetails, lineupQueryKey, roleDetailsQueryKey } from './areaApi';
import { AreaFrame } from './AreaFrame';
import { BlockedState, blockedCode, type BlockedPaths } from './BlockedState';
import { roleErrorCode, roleErrorMessage } from './errorCopy';
import { ROLE_NAME, ROLE_NOUN, type Role } from './fieldRegistry';
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

/** Shown the same way on the teacher and the DJ dashboard. */
export function CompletenessMeter({ role, filled, total, percent, complete }: { role: Role; filled: number; total: number; percent: number; complete?: boolean }) {
  return (
    <div className="space-y-[8px]">
      <p className="text-[15px] font-semibold" data-testid="completeness-line">{completenessLine({ filled, total, percent }, { complete })}</p>
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
      <p className="text-[13px] text-[var(--mut)]">Every detail is optional. Add as many or as few as you like.</p>
    </div>
  );
}

/** The teacher / DJ dashboard: completeness + Edit details, then line-up appearances. */
export function RoleAreaPage({ role, paths }: { role: Role; paths: RoleAreaPaths }) {
  const navigate = useNavigate();
  const details = useQuery({ queryKey: roleDetailsQueryKey(role), queryFn: () => fetchMyRoleDetails(role) });
  const lineup = useQuery({ queryKey: lineupQueryKey(role), queryFn: () => fetchMyLineup(role) });
  // The server's own "Complete" word, so the meter never contradicts the status (D118).
  const roles = useQuery({ queryKey: myRolesQueryKey, queryFn: fetchMyRoles });
  const held = roles.data?.find((r) => r.role === role && r.active);
  const name = ROLE_NAME[role];
  const blocked = blockedCode(details.error, lineup.error);
  return (
    <AreaFrame title={name} back={{ to: paths.back, label: paths.backLabel ?? 'Account' }} testId={`${role}-area`}>
      {blocked ? (
        <BlockedState code={blocked} paths={paths.blocked} />
      ) : (
        <>
          <Card label={`Your ${ROLE_NOUN[role]} details`} variant="padded" testId="details-card">
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
