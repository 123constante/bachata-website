// Pure, client-free: Arc 1 flow 7b, the page question before New event.

export const WHICH_PAGE_TITLE = 'Which page is this for?';

/** Set by Continue on the page question, so Back from the format step does not ask it again on the way in. */
export const PAGE_SET_PARAM = 'page';
const PAGE_SET = 'set';

/** Asked only when the login runs 2 or more pages, once per New event; one page skips it. */
export function needsPagePick(pageCount: number, params: URLSearchParams): boolean {
  return pageCount >= 2 && params.get(PAGE_SET_PARAM) !== PAGE_SET;
}

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
