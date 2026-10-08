import { Navigate, useLocation, useParams } from 'react-router-dom';
import { ORG_PATHS } from './paths';

/**
 * The old /account URLs (bookmarks, sign-in return paths, emails) land on the
 * rebuilt area. The query string and hash ride along; the old team URL's
 * organiser id becomes the Team page's `?o=` choice.
 */
export type LegacyAccountTarget = 'home' | 'new' | 'series' | 'team';

export function legacyAccountPath(
  target: LegacyAccountTarget,
  params: { seriesId?: string; organiserId?: string },
  search: string,
  hash: string,
): string {
  const query = new URLSearchParams(search);
  let path: string;
  if (target === 'new') path = ORG_PATHS.newEvent;
  else if (target === 'series' && params.seriesId) path = ORG_PATHS.event(params.seriesId);
  else if (target === 'team') {
    path = ORG_PATHS.team;
    if (params.organiserId && !query.has('o')) query.set('o', params.organiserId);
  } else path = ORG_PATHS.home;
  const qs = query.toString();
  return `${path}${qs ? `?${qs}` : ''}${hash}`;
}

export function LegacyAccountRedirect({ target }: { target: LegacyAccountTarget }) {
  const { search, hash } = useLocation();
  const params = useParams();
  return <Navigate to={legacyAccountPath(target, params, search, hash)} replace />;
}
