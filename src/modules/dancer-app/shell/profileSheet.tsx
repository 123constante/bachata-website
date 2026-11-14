import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { ORGANISER_HOME_PATH, appWelcomeHref } from '@/lib/accountRouting';
import { AREA_PATHS } from '@/lib/areaPaths';
import { ROLE_CHIPS, ROLE_SOON, roleTarget, type RoleId } from '../screens/tickets/model';
import { DANCER_TICKETS } from './routes';

/**
 * Option A's ONE "What are you?" sheet. The shell owns it so the amber bar's Start, every
 * locked tab and the blurred preview open the same sheet. Each chip is a link into an
 * EXISTING flow (dancer onboarding, the organiser claim, the teacher / DJ areas); a role with
 * no flow today says "coming soon". Nothing is sent from here.
 */
export type ProfileSheetApi = { incomplete: boolean; viewOnly: boolean; open: () => void };

const ProfileSheetContext = createContext<ProfileSheetApi>({ incomplete: false, viewOnly: false, open: () => {} });

export const useProfileSheet = (): ProfileSheetApi => useContext(ProfileSheetContext);

export function ProfileSheetProvider({ incomplete, viewOnly, children }: { incomplete: boolean; viewOnly: boolean; children: ReactNode }) {
  const [shown, setShown] = useState(false);
  return (
    <ProfileSheetContext.Provider value={{ incomplete, viewOnly, open: () => setShown(true) }}>
      {children}
      {shown && <ProfileSheet viewOnly={viewOnly} onClose={() => setShown(false)} />}
    </ProfileSheetContext.Provider>
  );
}

const TARGETS = {
  welcomeHref: appWelcomeHref(DANCER_TICKETS),
  organiserHref: ORGANISER_HOME_PATH,
  teacherHref: AREA_PATHS.teacher,
  djHref: AREA_PATHS.dj,
};

function ProfileSheet({ viewOnly, onClose }: { viewOnly: boolean; onClose: () => void }) {
  const [soon, setSoon] = useState<RoleId | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const soonLabel = soon ? ROLE_CHIPS.find((c) => c.id === soon)?.label : null;
  return (
    <div className="dt-sheet-scrim" onClick={onClose} data-testid="profile-sheet-scrim">
      <div
        className="dt-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dt-sheet-title"
        onClick={(e) => e.stopPropagation()}
        data-testid="profile-sheet"
      >
        <div className="dt-sheet-head">
          <h2 id="dt-sheet-title" className="dt-sheet-title">What are you?</h2>
          <button type="button" className="dt-icon-btn" onClick={onClose} aria-label="Close" data-testid="profile-sheet-close">
            <X aria-hidden="true" style={{ width: 18, height: 18 }} />
          </button>
        </div>
        <p className="dt-sheet-sub">Pick one to finish your profile. You can add more later.</p>
        <div className="dt-chips">
          {ROLE_CHIPS.map((c) => {
            const to = roleTarget(c.id, { viewOnly, ...TARGETS });
            return to ? (
              <Link key={c.id} to={to} className="dt-chip" onClick={onClose} data-testid={`profile-chip-${c.id}`}>
                {c.label}
              </Link>
            ) : (
              <button
                key={c.id}
                type="button"
                className="dt-chip"
                aria-pressed={soon === c.id}
                onClick={() => setSoon(c.id)}
                data-testid={`profile-chip-${c.id}`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        {soonLabel && (
          <p className="dt-sheet-soon" role="status" data-testid="profile-sheet-soon">
            {soonLabel} {ROLE_SOON}
          </p>
        )}
      </div>
    </div>
  );
}
