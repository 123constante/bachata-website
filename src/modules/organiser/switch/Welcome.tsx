import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useOrgSurface } from '../shell/surface';
import { GhostButton, PrimaryButton, SkeletonRows } from '../ui';
import { rememberChoice, useOrganiserChoice } from './useOrganiserChoice';
import { joinedWelcome } from './welcomeModel';

/**
 * /account/o/welcome?o=<id>: where an accepted invite lands, once (only a NEW
 * seat is sent here). The first page says "You manage X" and offers its first
 * event (Arc 1 flow 1d); with another page already on the login it says which
 * one is new and that Switch exists (7c).
 */
export default function WelcomePage() {
  const navigate = useNavigate();
  const { kind, Shell, paths, hub } = useOrgSurface();
  const [params] = useSearchParams();
  const { user, home, organisers } = useOrganiserChoice();
  const joinedId = params.get('o');
  const go = (to: string) => {
    if (joinedId) rememberChoice(user?.id, joinedId);
    navigate(to, { replace: true });
  };
  const goHome = () => go(joinedId ? `${paths.home}?o=${encodeURIComponent(joinedId)}` : paths.home);

  const loading = home.isPending && !home.isPaused;
  const joined = organisers.find((o) => o.id === joinedId);
  const copy = joined ? joinedWelcome(joined.name, organisers.filter((o) => o.id !== joined.id).map((o) => o.name), hub.label) : null;

  // Not on the login (yet): plain Home, never a welcome naming nothing.
  if (!loading && home.data && !joined) return <Navigate to={paths.home} replace />;

  return (
    <Shell title="Welcome" testId="org-page-welcome">
      <div className="flex flex-col gap-[12px] p-[12px]">
        {loading ? (
          <SkeletonRows count={2} label="Loading your pages" testId="org-welcome-loading" />
        ) : copy ? (
          <>
            <h2 className="text-[20px] font-bold text-[var(--fg)]" data-testid="org-welcome-title">{copy.title}</h2>
            <p className="text-[15px] text-[var(--fg)]" data-testid="org-welcome-sub">{copy.sub}</p>
          </>
        ) : (
          // Home did not load: the button below still leads on.
          <p className="text-[15px] text-[var(--fg)]" data-testid="org-welcome-sub">{kind === 'p3' ? `You joined the team. Switch pages any time from ${hub.label}.` : `You joined the team. Your pages are on ${hub.label}.`}</p>
        )}
        {copy?.screen === '1d' ? (
          <>
            <PrimaryButton onClick={() => go(paths.newWhatFor(joinedId))} testId="org-welcome-add-event">Add an event</PrimaryButton>
            <GhostButton onClick={goHome} testId="org-welcome-home">Look around first</GhostButton>
          </>
        ) : (
          <PrimaryButton onClick={goHome} disabled={loading} testId="org-welcome-home">Go to Home</PrimaryButton>
        )}
      </div>
    </Shell>
  );
}
