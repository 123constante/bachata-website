import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { ORGANISER_HOME_PATH, appWelcomeHref } from '@/lib/accountRouting';
import { AREA_PATHS } from '@/lib/areaPaths';
import { ROLE_CHIPS, ROLE_SOON, roleTarget, type RoleId } from '../screens/tickets/roleChips';
import { BUYER_ONBOARDING_ENABLED } from '@/lib/buyerOnboardingFlag';
import type { BuyerRole, MyDancerEdit } from '../api/types';
import { RoleStep } from './roleStep';
import { DANCER_TICKETS } from './routes';

/**
 * Option A's ONE "What are you?" sheet. The shell owns it so the amber bar's Start, every
 * locked tab and the blurred preview open the same sheet. Each chip is a link into an
 * EXISTING flow (dancer onboarding, the organiser claim, the teacher / DJ areas); a role with
 * no flow today says "coming soon". Nothing is sent from here.
 */
/** `person`: buyer onboarding B only (flag ON, not view-only), else always null. */
export type ProfileSheetApi = { incomplete: boolean; viewOnly: boolean; person: MyDancerEdit | null; open: () => void };

const ProfileSheetContext = createContext<ProfileSheetApi>({ incomplete: false, viewOnly: false, person: null, open: () => {} });

export const useProfileSheet = (): ProfileSheetApi => useContext(ProfileSheetContext);

/**
 * `person` = the shell's own my_dancer_edit_v1 read (null while none). Buyer onboarding B (flag
 * ON): with a person to save to, the sheet opens on the "What are you?" multi-pick (RoleStep);
 * Save or Skip then shows the links below, narrowed to what was picked. Flag OFF = as before.
 */
export function ProfileSheetProvider({ incomplete, viewOnly, person = null, children }: { incomplete: boolean; viewOnly: boolean; person?: MyDancerEdit | null; children: ReactNode }) {
  const [shown, setShown] = useState(false);
  const own = BUYER_ONBOARDING_ENABLED && !viewOnly ? person : null;
  return (
    <ProfileSheetContext.Provider value={{ incomplete, viewOnly, person: own, open: () => setShown(true) }}>
      {children}
      {shown && <ProfileSheet viewOnly={viewOnly} person={own} onClose={() => setShown(false)} />}
    </ProfileSheetContext.Provider>
  );
}

const TARGETS = {
  welcomeHref: appWelcomeHref(DANCER_TICKETS),
  organiserHref: ORGANISER_HOME_PATH,
  teacherHref: AREA_PATHS.teacher,
  djHref: AREA_PATHS.dj,
};

function ProfileSheet({ viewOnly, person, onClose }: { viewOnly: boolean; person: MyDancerEdit | null; onClose: () => void }) {
  const [soon, setSoon] = useState<RoleId | null>(null);
  // null = the role step is showing (only with a person); an array = done, narrow the links to it.
  const [picked, setPicked] = useState<BuyerRole[] | null>(person ? null : []);
  const chips = picked && picked.length > 0 ? ROLE_CHIPS.filter((c) => (picked as RoleId[]).includes(c.id)) : ROLE_CHIPS;
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
        {person && picked === null ? (
          <RoleStep person={person} onDone={setPicked} />
        ) : (
          <>
          <p className="dt-sheet-sub">{person ? 'Next, finish your profile:' : 'Pick one to finish your profile. You can add more later.'}</p>
          <div className="dt-chips">
            {chips.map((c) => {
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
          </>
        )}
      </div>
    </div>
  );
}
