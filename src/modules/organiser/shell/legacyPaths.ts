import { ORG_PATHS } from './paths';

const tail = (query: URLSearchParams, hash: string) => {
  const qs = query.toString();
  return `${qs ? `?${qs}` : ''}${hash}`;
};

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
  if (target === 'new') path = ORG_PATHS.newWhat;
  else if (target === 'series' && params.seriesId) path = ORG_PATHS.event(params.seriesId);
  else if (target === 'team') {
    path = ORG_PATHS.team;
    if (params.organiserId && !query.has('o')) query.set('o', params.organiserId);
  } else path = ORG_PATHS.home;
  return `${path}${tail(query, hash)}`;
}

/**
 * main's own organiser URLs (before R1) -> their R1 paths, query and hash kept:
 * /events/new -> /new/what; /events/:s/dates/:o -> /change/:s/:o; /profile -> /page.
 */
export type ModuleLegacyTarget = 'newEvent' | 'date' | 'profile';

export function moduleLegacyPath(
  target: ModuleLegacyTarget,
  params: { seriesId?: string; occurrenceId?: string },
  search: string,
  hash: string,
): string {
  let path: string;
  if (target === 'newEvent') path = ORG_PATHS.newWhat;
  else if (target === 'profile') path = ORG_PATHS.page;
  else if (params.seriesId && params.occurrenceId) path = ORG_PATHS.changeDate(params.seriesId, params.occurrenceId);
  else path = ORG_PATHS.change;
  return `${path}${tail(new URLSearchParams(search), hash)}`;
}
