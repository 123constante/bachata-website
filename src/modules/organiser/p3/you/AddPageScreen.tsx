import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { ORGANISER_HOME_KEY, fetchMyAccessRequests, myAccessRequestsQueryKey } from '@/modules/organiser/shared/selfServeApi';
import { isMailboxProvenToken } from '@/modules/organiser/shared/sessionProof';
import { OnboardingView } from '../../home/onboarding/OnboardingView';
import { useP3Home } from '../data/useP3Data';
import { RetryButton, StateCard } from '../screens/parts';
import { P3_PATHS } from '../shell/paths';
import { P3PushedShell } from './surface';

/**
 * P3 W4b: Welcome (no page yet; P3 Home sends a login here) and Add a page (from You). The same
 * onboarding as R1 Home's -- search, claim, ask to join, create, every read and write unchanged --
 * in P3's frame and tokens, with the unfinished-profile check at the tap (owner pick no-city B).
 */
export default function AddPageScreen() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const home = useP3Home();
  const mine = useQuery({ queryKey: myAccessRequestsQueryKey(user?.id), queryFn: fetchMyAccessRequests, enabled: !!user });
  const organisers = home.data?.organisers ?? [];
  const firstRun = !!home.data && organisers.length === 0;
  const back = firstRun ? undefined : { to: P3_PATHS.you, label: 'You' };

  if (!user) return null;

  // The same reads R1 Home refreshes after a claim, request or create.
  const onChanged = () => {
    void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
    void queryClient.invalidateQueries({ queryKey: myAccessRequestsQueryKey(user.id) });
  };

  return (
    <P3PushedShell title={firstRun ? 'Welcome' : 'Add a page'} back={back} testId="p3-add-page">
      {home.isPending ? (
        <StateCard title="Loading&hellip;" testId="p3-add-page-loading">This takes a second.</StateCard>
      ) : home.isError ? (
        <StateCard title="We couldn&rsquo;t load your pages" testId="p3-add-page-error">
          <p>Check your connection, then try again.</p>
          <RetryButton onClick={() => void home.refetch()} />
        </StateCard>
      ) : (
        <OnboardingView
          user={{ id: user.id, email: user.email ?? null }}
          mailboxProven={isMailboxProvenToken(session?.access_token)}
          myOrganiserIds={new Set(organisers.map((o) => o.id))}
          requests={mine.data ?? []}
          firstRun={firstRun}
          onChanged={onChanged}
          look="p3"
        />
      )}
    </P3PushedShell>
  );
}
