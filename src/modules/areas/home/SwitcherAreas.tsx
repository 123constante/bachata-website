// The Switch profile sheet's area entries: the teacher and DJ areas the person
// has added (isAreaShown), with the same status dot and words as Your areas (areaStatus), then
// one "Your areas" link. Read only while the sheet is open.
import { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { MouseEvent } from 'react';
import { isLeaveDirty, requestLeave } from '../shared/leaveGuard';
import { QueryClientContext, useQuery } from '@tanstack/react-query';
import { AREA_PATHS } from '@/lib/areaPaths';
import { fetchProfileProgress, profileProgressQueryKey } from '@/modules/organiser/shared/profileProgress';
import { AREA_HREF, AREA_NAME, YOUR_AREAS_LABEL, areaStatus, isAreaShown } from './areaStatus';
import { fetchMyRoles, myRolesQueryKey } from './rolesApi';
import { StatusDot } from './StatusDot';

/** The roles the sheet lists beside the sides it already shows (dancer and organiser come from the side list). */
export const SWITCHER_AREA_ROLES = ['teacher', 'dj'] as const;

function Entries({ rowClass, mutedClass, onPick }: SwitcherAreasProps) {
  const navigate = useNavigate();
  // A form with unsaved edits asks "Discard changes?" before the person leaves for another area (D119 #2).
  const pick = (to: string) => (e: MouseEvent) => {
    if (isLeaveDirty()) {
      e.preventDefault();
      onPick();
      requestLeave(() => navigate(to));
    } else onPick();
  };
  const roles = useQuery({ queryKey: myRolesQueryKey, queryFn: fetchMyRoles });
  const progress = useQuery({ queryKey: profileProgressQueryKey(null), queryFn: () => fetchProfileProgress(null) });
  // The same "added" rule as Your areas (isAreaShown): a teacher / DJ chosen at sign-up is listed too.
  const held = SWITCHER_AREA_ROLES.filter((r) => isAreaShown(r, roles.data?.find((row) => row.role === r), progress.data));
  return (
    <>
      {held.length > 0 && (
        <ul data-testid="profile-switcher-areas">
          {held.map((role) => {
            const status = areaStatus(role, roles.data?.find((r) => r.role === role), progress.data);
            return (
              <li key={role}>
                <Link to={AREA_HREF[role]} onClick={pick(AREA_HREF[role])} className={rowClass} data-testid={`profile-switcher-area-${role}`} data-status={status.kind}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{AREA_NAME[role]}</span>
                    <span className={`flex items-center gap-[6px] text-[13px] ${mutedClass}`}>
                      <StatusDot kind={status.kind} />
                      <span data-testid={`profile-switcher-area-status-${role}`}>{status.words}</span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Link to={AREA_PATHS.areas} onClick={pick(AREA_PATHS.areas)} className={`${rowClass} font-semibold`} data-testid="profile-switcher-your-areas">
        {YOUR_AREAS_LABEL}
      </Link>
    </>
  );
}

export interface SwitcherAreasProps { rowClass: string; mutedClass: string; onPick: () => void }

export function SwitcherAreas(props: SwitcherAreasProps) {
  // The sheet also renders in screens tested without a query client; there it
  // shows only its sides, as before.
  const client = useContext(QueryClientContext);
  return client ? <Entries {...props} /> : null;
}

export default SwitcherAreas;
