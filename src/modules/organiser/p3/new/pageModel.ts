// Pure, client-free: the page question before New event (review r1 F8: lives with P3's create flow;
// the old wizard's flows/new/whichPageModel re-exports it until that wizard is retired).

/** Set by Continue on the page question, so Back from the kind step does not ask it again on the way in. */
export const PAGE_SET_PARAM = 'page';
export const PAGE_SET = 'set';

/** Asked only when the login runs 2 or more pages, once per New event; one page skips it. */
export function needsPagePick(pageCount: number, params: URLSearchParams): boolean {
  return pageCount >= 2 && params.get(PAGE_SET_PARAM) !== PAGE_SET;
}
