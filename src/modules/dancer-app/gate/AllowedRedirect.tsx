import { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ProfileGateContext, useAuth } from '@/hooks/useAuth';
import { ACCOUNT_HOME_PATH, isLegacyAccountLink } from '@/lib/accountRouting';
import {
  fetchMyAccessRequests,
  fetchOrganiserHome,
  myAccessRequestsQueryKey,
  organiserHomeQueryKey,
} from '@/modules/organiser/shared/selfServeApi';
import { allowedRedirectTarget, queryFact } from './redirectModel';

/**
 * The organiser half of RedirectIfAllowed, in its own lazy chunk: only an
 * ALLOWED signed-in person ever loads it, so the organiser reads' code stays off
 * every other visitor's first load. Same reads, keys and fetchers as
 * src/pages/Account.tsx, so /account opens from the cache either way.
 *
 * Renders nothing, or a replace-redirect into the dancer app.
 */
const AllowedRedirect = () => {
  const { user } = useAuth();
  const { pathname, search, hash } = useLocation();
  const gate = useContext(ProfileGateContext);
  const legacyParams = pathname.toLowerCase() === ACCOUNT_HOME_PATH && isLegacyAccountLink(search, hash);
  const enabled = Boolean(user?.id) && !legacyParams;
  const home = useQuery({ queryKey: organiserHomeQueryKey(user?.id), queryFn: fetchOrganiserHome, enabled });
  const requests = useQuery({ queryKey: myAccessRequestsQueryKey(user?.id), queryFn: fetchMyAccessRequests, enabled });

  const target = allowedRedirectTarget({
    legacyParams,
    organiserCount: queryFact(home, (d) => d.organisers.length),
    openRequestCount: queryFact(requests, (d) => d.filter((r) => r.status === 'open').length),
    profile: gate === null ? null : gate === 'loading' ? 'loading' : gate.status,
  });
  return target ? <Navigate to={target} replace /> : null;
};

export default AllowedRedirect;
