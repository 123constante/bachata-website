import { Link, Navigate } from 'react-router-dom';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { APP_HOME_PATH, APP_WELCOME_PATH, ORGANISER_HOME_PATH, signInLanding, type ProfileSide } from '@/lib/accountRouting';
import { SideAvatar, sideKind, sideTitle } from './SideAvatar';
import { useProfileSides } from './useProfileSides';

/** L18: the switch promise, only where it is true. */
export const SWITCH_HINT = 'You can switch later by tapping your picture, top right.';

/**
 * Lands in a shell that carries the Switch-profile picture: the dancer app or the organiser area.
 * Not the dancer setup: focus mode (audit H5) hides the picture there until the profile is done.
 */
const hasSwitcher = (to: string): boolean => {
  const p = to.split(/[?#]/, 1)[0].toLowerCase();
  if (p === APP_WELCOME_PATH) return false;
  const app = APP_HOME_PATH.slice(0, APP_HOME_PATH.lastIndexOf('/'));
  return p === app || p.startsWith(`${app}/`) || p === ORGANISER_HOME_PATH || p.startsWith(`${ORGANISER_HOME_PATH}/`);
};

/** The hint when EVERY button lands where the picture is; none otherwise (no text points at a missing control). */
export const switchHint = (sides: readonly Pick<ProfileSide, 'to'>[]): string | null =>
  sides.length > 0 && sides.every((s) => hasSwitcher(s.to)) ? SWITCH_HINT : null;

/**
 * /account/continue -- where a sign-in with no returnTo lands (lib/auth-otp-routing).
 * lib/accountRouting's signInLanding() decides: one side -> straight there
 * (replace, so Back does not return here); two or more -> "Continue as...", one
 * large button per side, organisers first and visually primary. Shown on every
 * sign-in; never to a single-side person.
 */
export const ContinueAsScreen = () => {
  const { facts } = useProfileSides();
  const landing = signInLanding(facts, null);
  if (landing.kind === 'go') return <Navigate to={landing.to} replace />;
  if (landing.kind === 'wait') {
    return (
      <div className="mx-auto w-full max-w-md px-4 pt-6" aria-busy="true" data-testid="continue-as-loading">
        <p className="text-sm text-muted-foreground">Signing you in&hellip;</p>
      </div>
    );
  }
  const hint = switchHint(landing.sides);
  return (
    <div className="mx-auto w-full max-w-md px-4 pb-24 pt-4" data-testid="continue-as">
      <h1 className="text-lg font-bold text-foreground">Continue as&hellip;</h1>
      {hint && (
        <p className="mt-1 text-sm text-muted-foreground" data-testid="continue-as-hint">
          {hint}
        </p>
      )}
      <ul className="mt-3 space-y-3">
        {landing.sides.map((side) => {
          const primary = side.kind === 'organiser';
          return (
            <li key={side.key}>
              <Link
                to={side.to}
                replace
                data-testid={`continue-as-${side.key}`}
                className={`flex min-h-[72px] w-full items-center gap-3 rounded-xl border p-3 ${
                  primary ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground'
                }`}
              >
                <SideAvatar side={side} size={48} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-bold">{sideTitle(side)}</span>
                  <span className={`block text-sm ${primary ? 'opacity-90' : 'text-muted-foreground'}`}>{sideKind(side)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const ContinueAsPage = () => {
  useNoindexMeta(true);
  return (
    <AuthGuard>
      <ContinueAsScreen />
    </AuthGuard>
  );
};

export default ContinueAsPage;
