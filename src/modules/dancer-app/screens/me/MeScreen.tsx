import { Link } from 'react-router-dom';
import { Card, SectionLabel } from '@/modules/organiser/ui';
import { APP_ACCOUNT_SETTINGS_PATH } from '@/lib/accountRouting';
import { mainAction, nextStepCopy, profileName, roleCityLine } from './model';
import { useMyDancerEdit } from '../../api/useMyDancerEdit';
import { ACCOUNT_SETTINGS_LABEL, HIDDEN_STATE_LINE, HIDDEN_STATE_WORD } from '../../copy/sharedCopy';
import { DisabledRow, LINK_GHOST_SM, LINK_PRIMARY, LinkRow } from '../blocks';
import { Avatar, QueryGate, StrengthBar } from './ui';

/**
 * /app/me (mockup "5 Me"). Everything here is read from the server's own shape:
 * strength, next step and role/city line come from ./model (the same mapping Edit uses).
 * Badges and year-in-review render nothing in release 1a.
 */
const MeScreen = () => {
  const q = useMyDancerEdit();
  const gate = QueryGate({ q, id: 'me' });
  if (gate) return <>{gate}</>;
  const p = q.data!;
  const action = mainAction(p);
  const hasName = Boolean(p.display_name?.trim() || p.first_name?.trim());

  return (
    <section data-testid="dancer-screen-me" className="grid gap-[12px]">
      <h1 className="m-0 text-[14px] font-bold text-[var(--mut)]">Me</h1>

      {!p.is_active && (
        <Card variant="padded" role="status" testId="me-paused" className="border-[var(--danger)]">
          <p className="m-0 text-[15px] font-bold">Your profile is {HIDDEN_STATE_WORD}</p>
          <p className="mb-[8px] mt-[4px] text-[14px] text-[var(--mut)]">
            {HIDDEN_STATE_LINE} You can show it again in {ACCOUNT_SETTINGS_LABEL}.
          </p>
          <Link to={APP_ACCOUNT_SETTINGS_PATH} className={LINK_GHOST_SM}>
            Open account settings
          </Link>
        </Card>
      )}

      <Card variant="padded" testId="me-card" className="grid gap-[10px]">
        <div className="flex items-center gap-[12px]">
          <span className="da-ring-avatar"><Avatar profile={p} size={64} /></span>
          <div className="min-w-0">
            <p data-testid="me-name" className="m-0 break-words text-[20px] font-extrabold">
              {profileName(p)}
            </p>
            <p data-testid="me-role-city" className="mb-0 mt-[2px] text-[14px] text-[var(--mut)]">
              {roleCityLine(p)}
            </p>
          </div>
        </div>

        <div>
          <div className="mb-[6px] flex justify-between text-[14px] font-semibold">
            <span>Profile strength</span>
            <span data-testid="me-strength-pct">{p.strength.pct}%</span>
          </div>
          <StrengthBar pct={p.strength.pct} />
          <p data-testid="me-next-step" className="mb-0 mt-[8px] text-[14px] text-[var(--mut)]">
            {nextStepCopy(p)}
          </p>
          {/* Audit M24: no "Going and Interested unlock at 70%" line. The RSVP RPC
              (set_my_occurrence_attendance_p5_v1) checks only sign-in and the night, never the profile. */}
        </div>

        <Link to={action.href} className={LINK_PRIMARY} data-testid="me-main-action">
          {action.label}
        </Link>
      </Card>

      <div>
        <SectionLabel as="p">My profile</SectionLabel>
        <Card>
          {!action.isEdit && <LinkRow to="/app/me/edit" label="Edit my profile" testId="me-edit" />}
          <LinkRow to="/app/page" label="My page: how it looks and who visited" testId="me-my-page" />
          {p.is_active ? (
            <LinkRow href={`/dancers/${p.profile_id}`} label="See my public page" testId="me-public-page" />
          ) : (
            <DisabledRow label="See my public page" reason="Your profile is hidden, so there is no public page to see." testId="me-public-page" reasonTestId="me-public-page-reason" />
          )}
        </Card>
        {!hasName && (
          <p className="mb-0 mt-[8px] text-[13px] text-[var(--mut)]">
            People will not find your page by name until you add one.
          </p>
        )}
      </div>
    </section>
  );
};

export default MeScreen;
