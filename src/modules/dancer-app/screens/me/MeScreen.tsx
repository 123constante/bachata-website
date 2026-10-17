import { Link } from 'react-router-dom';
import { APP_ACCOUNT_SETTINGS_PATH } from '@/lib/accountRouting';
import { mainAction, nextStepCopy, profileName, roleCityLine } from './model';
import { useMyDancerEdit } from '../../api/useMyDancerEdit';
import { ACCOUNT_SETTINGS_LABEL, HIDDEN_STATE_LINE, HIDDEN_STATE_WORD } from '../../copy/sharedCopy';
import { Avatar, QueryGate, StrengthBar, ghostButton, mainButton } from './ui';

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
    <section data-testid="dancer-screen-me" style={{ display: 'grid', gap: 12 }}>
      <h1 className="da-muted" style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Me</h1>

      {!p.is_active && (
        <div className="da-card" role="status" data-testid="me-paused" style={{ borderColor: 'var(--da-danger)' }}>
          <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Your profile is {HIDDEN_STATE_WORD}</p>
          <p className="da-muted" style={{ fontSize: 14, margin: '4px 0 8px' }}>
            {HIDDEN_STATE_LINE} You can show it again in {ACCOUNT_SETTINGS_LABEL}.
          </p>
          <Link to={APP_ACCOUNT_SETTINGS_PATH} className="da-tap" style={{ ...ghostButton, minHeight: 44 }}>
            Open account settings
          </Link>
        </div>
      )}

      <div className="da-card" data-testid="me-card" style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar profile={p} size={64} />
          <div style={{ minWidth: 0 }}>
            <p data-testid="me-name" style={{ fontSize: 20, fontWeight: 800, margin: 0, overflowWrap: 'anywhere' }}>
              {profileName(p)}
            </p>
            <p data-testid="me-role-city" className="da-muted" style={{ fontSize: 14, margin: '2px 0 0' }}>
              {roleCityLine(p)}
            </p>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
            <span>Profile strength</span>
            <span data-testid="me-strength-pct">{p.strength.pct}%</span>
          </div>
          <StrengthBar pct={p.strength.pct} />
          <p data-testid="me-next-step" className="da-muted" style={{ fontSize: 14, margin: '8px 0 0' }}>
            {nextStepCopy(p)}
          </p>
          {/* Audit M24: no "Going and Interested unlock at 70%" line. The RSVP RPC
              (set_my_occurrence_attendance_p5_v1) checks only sign-in and the night, never the profile. */}
        </div>

        <Link to={action.href} className="da-tap" style={mainButton} data-testid="me-main-action">
          {action.label}
        </Link>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {!action.isEdit && (
          <Link to="/app/me/edit" className="da-tap" style={ghostButton} data-testid="me-edit">
            Edit my profile
          </Link>
        )}
        <Link to="/app/page" className="da-tap" style={ghostButton} data-testid="me-my-page">
          My page: how it looks and who visited
        </Link>
        {p.is_active ? (
          <a href={`/dancers/${p.profile_id}`} className="da-tap" style={ghostButton} data-testid="me-public-page">
            See my public page
          </a>
        ) : (
          <div>
            <button type="button" disabled className="da-tap" style={{ ...ghostButton, opacity: 0.5, cursor: 'not-allowed' }} data-testid="me-public-page">
              See my public page
            </button>
            <p className="da-muted" data-testid="me-public-page-reason" style={{ fontSize: 13, margin: '4px 0 0' }}>
              Your profile is hidden, so there is no public page to see.
            </p>
          </div>
        )}
        {!hasName && (
          <p className="da-muted" style={{ fontSize: 13, margin: 0 }}>
            People will not find your page by name until you add one.
          </p>
        )}
      </div>
    </section>
  );
};

export default MeScreen;
