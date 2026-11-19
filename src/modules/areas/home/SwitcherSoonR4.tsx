// Dashboard switch, Round-4 look (flag dashboardSwitchR4): the sheet's "Coming soon" card (Teacher / DJ,
// only when picked at onboarding, never a link) and the link card (Add a profile, Your areas, Account
// settings). Read only while the sheet is open; a form with unsaved edits still asks "Discard changes?".
import { useContext, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QueryClientContext, useQuery } from '@tanstack/react-query';
import { AREA_PATHS } from '@/lib/areaPaths';
import { COMING_SOON_LABEL, COMING_SOON_NAME, comingSoonRoles } from '@/components/account/profiles/switchR4Model';
import { isLeaveDirty, requestLeave } from '../shared/leaveGuard';
import { YOUR_AREAS_LABEL } from './areaStatus';
import { fetchMyRoleIntent, myRoleIntentQueryKey } from './rolesApi';

export interface SwitcherSoonR4Props {
  rowClass: string;
  headingClass: string;
  cardStyle: CSSProperties;
  lineColor: string;
  mutedColor: string;
  chevron: ReactNode;
  addRow: ReactNode;
  settingsRow: ReactNode;
  onPick: () => void;
}

function Entries(props: SwitcherSoonR4Props) {
  const { rowClass, headingClass, cardStyle, lineColor, mutedColor, chevron, onPick } = props;
  const navigate = useNavigate();
  const intent = useQuery({ queryKey: myRoleIntentQueryKey, queryFn: fetchMyRoleIntent });
  const soon = comingSoonRoles(intent.data);
  const pick = (to: string) => (e: MouseEvent) => {
    if (isLeaveDirty()) {
      e.preventDefault();
      onPick();
      requestLeave(() => navigate(to));
    } else onPick();
  };
  return (
    <>
      {soon.length > 0 && (
        <section aria-label={COMING_SOON_LABEL} data-testid="profile-switcher-soon">
          <h3 className={headingClass}>{COMING_SOON_LABEL}</h3>
          <ul style={cardStyle}>
            {soon.map((role, i) => (
              <li
                key={role}
                aria-disabled="true"
                data-testid={`profile-switcher-soon-${role}`}
                className={`${rowClass} cursor-not-allowed`}
                style={{ borderTop: i ? `1px solid ${lineColor}` : undefined, color: mutedColor }}
              >
                <span className="min-w-0 flex-1 truncate font-medium">{COMING_SOON_NAME[role]}</span>
                <span
                  className="shrink-0 rounded-full px-[7px] py-[3px] font-mono text-[11px] uppercase leading-none tracking-[0.07em]"
                  style={{ border: `1px solid ${lineColor}` }}
                >
                  {COMING_SOON_LABEL}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div style={cardStyle} data-testid="profile-switcher-links">
        {props.addRow}
        <Link
          to={AREA_PATHS.areas}
          onClick={pick(AREA_PATHS.areas)}
          className={rowClass}
          style={{ borderTop: `1px solid ${lineColor}` }}
          data-testid="profile-switcher-your-areas"
        >
          <span className="min-w-0 flex-1 font-medium">{YOUR_AREAS_LABEL}</span>
          {chevron}
        </Link>
        {props.settingsRow}
      </div>
    </>
  );
}

export function SwitcherSoonR4(props: SwitcherSoonR4Props) {
  // Screens tested without a query client: no Coming soon card, no Your areas, as the old sheet.
  const client = useContext(QueryClientContext);
  return client ? <Entries {...props} /> : (
    <div style={props.cardStyle} data-testid="profile-switcher-links">{props.addRow}{props.settingsRow}</div>
  );
}

export default SwitcherSoonR4;
