import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ORGANISER_HOME_KEY,
  submitOrganiserProfile,
  type OrganiserHome,
  type SubmittedOrganiser,
} from '../selfServeApi';

/**
 * "Send for review" (admin D6, submit_organiser_profile_v1), then the home's
 * view of it, the way useOwnerCommand does for a series command: the organiser
 * reads with the lifecycle the server returned at once (the selector row and
 * the home header), then every organiser-home query reloads. A refusal reloads
 * too: each one (invalid_state, not_authorised, organiser_not_found) means the
 * home no longer matches the server, so the stale badge and button go.
 */
export function useSendForReview(onSent: (sent: SubmittedOrganiser) => void) {
  const queryClient = useQueryClient();
  const reload = () => void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });

  return useMutation<SubmittedOrganiser, Error, string>({
    mutationFn: (organiserId) => submitOrganiserProfile(organiserId),
    onSuccess: (sent) => {
      queryClient.setQueriesData<OrganiserHome>({ queryKey: ORGANISER_HOME_KEY }, (current) =>
        current
          ? {
              ...current,
              organisers: current.organisers.map((o) =>
                o.id === sent.organiserId ? { ...o, lifecycle_status: sent.lifecycleStatus } : o,
              ),
            }
          : current,
      );
      reload();
      onSent(sent);
    },
    onError: reload,
  });
}
