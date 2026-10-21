import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { OrganiserShell, ORG_PATHS } from '../shell';
import { PrimaryButton, SkeletonRows } from '../ui';
import { rememberChoice, useOrganiserChoice } from './useOrganiserChoice';
import { joinedWelcome } from './welcomeModel';

/**
 * /account/o/welcome?o=<id> (Arc 1 flow 7c): where an accepted invite lands.
 * With another page already on the login it says which one is new and that
 * Switch exists; the first page goes straight to Home, as before.
 */
export default function WelcomePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, home, organisers } = useOrganiserChoice();
  const joinedId = params.get('o');
  const goHome = () => {
    if (joinedId) rememberChoice(user?.id, joinedId);
    navigate(joinedId ? `${ORG_PATHS.home}?o=${encodeURIComponent(joinedId)}` : ORG_PATHS.home, { replace: true });
  };

  const loading = home.isPending && !home.isPaused;
  const joined = organisers.find((o) => o.id === joinedId);
  const copy = joined ? joinedWelcome(joined.name, organisers.filter((o) => o.id !== joined.id).map((o) => o.name)) : null;

  if (!loading && home.data) {
    // Not on the login (yet): plain Home. The first page: Home on it, no extra screen.
    if (!joined) return <Navigate to={ORG_PATHS.home} replace />;
    if (!copy) return <Navigate to={`${ORG_PATHS.home}?o=${encodeURIComponent(joined.id)}`} replace />;
  }

  return (
    <OrganiserShell title="Welcome" testId="org-page-welcome">
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
          <p className="text-[15px] text-[var(--fg)]" data-testid="org-welcome-sub">You joined the team. Your pages are on Home.</p>
        )}
        <PrimaryButton onClick={goHome} disabled={loading} testId="org-welcome-home">Go to Home</PrimaryButton>
      </div>
    </OrganiserShell>
  );
}
