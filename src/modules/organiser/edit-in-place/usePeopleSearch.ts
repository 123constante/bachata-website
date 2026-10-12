// Edit in place: the team picker's search-as-you-type. Debounced (about 250ms
// after the last key) and STALE-PROOF: every keystroke takes a new ticket, and
// an answer is shown only if its ticket is still the latest, so a slow answer
// for "ma" can never overwrite the one for "mar". Fewer than two letters asks
// nothing (the RPC would answer nothing anyway).
import { useEffect, useRef, useState } from 'react';
import { SEARCH_DEBOUNCE_MS, parsePeople, searchTerm, type PersonResult, type SearchState } from './teamPickerModel';

export function usePeopleSearch(query: string, search: (term: string) => Promise<unknown>): { state: SearchState; people: PersonResult[] } {
  const [state, setState] = useState<SearchState>({ kind: 'idle' });
  // The last answered rows stay listed while the next search runs (no flicker).
  const [shown, setShown] = useState<PersonResult[]>([]);
  const ticket = useRef(0);
  useEffect(() => {
    const mine = ++ticket.current;
    const term = searchTerm(query);
    if (!term) return undefined; // idle is derived below, not stored
    const t = setTimeout(() => {
      if (ticket.current !== mine) return;
      setState({ kind: 'searching', term });
      search(term).then(
        (raw) => {
          if (ticket.current !== mine) return;
          const people = parsePeople(raw);
          setShown(people);
          setState({ kind: 'done', term, people });
        },
        () => {
          if (ticket.current !== mine) return;
          setShown([]);
          setState({ kind: 'error', term });
        },
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, search]);
  if (!searchTerm(query)) return { state: { kind: 'idle' }, people: [] };
  return { state, people: state.kind === 'done' ? state.people : shown };
}
