// Pure, client-free: Arc 1 flow 7b, the page question before New event.

export const WHICH_PAGE_TITLE = 'Which page is this for?';

// The page rule itself lives with P3's create flow (review r1 F8); one copy, re-exported here.
import { PAGE_SET, PAGE_SET_PARAM, needsPagePick } from '../../p3/new/pageModel';

export { PAGE_SET_PARAM, needsPagePick };

/** The New event steps before the draft keep the page (`?o=`) and that it was answered. */
export function withPageChoice(path: string, params: URLSearchParams): string {
  const keep = new URLSearchParams();
  const organiserId = params.get('o');
  if (organiserId) keep.set('o', organiserId);
  if (params.get(PAGE_SET_PARAM) === PAGE_SET) keep.set(PAGE_SET_PARAM, PAGE_SET);
  const query = keep.toString();
  return query ? `${path}${path.includes('?') ? '&' : '?'}${query}` : path;
}

export const pageChosenHref = (path: string, organiserId: string) =>
  withPageChoice(path, new URLSearchParams({ o: organiserId, [PAGE_SET_PARAM]: PAGE_SET }));
