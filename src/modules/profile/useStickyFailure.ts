import { useState } from 'react';

/**
 * A read that failed stays "failed" while its retry runs. React Query (v5)
 * puts a query that never had data back to `pending` when it refetches, so
 * without this the error line -- and its Try again -- would vanish the moment
 * it is tapped and the section would read as loading. Cleared once a fetch
 * settles without an error. (State adjusted during render, React's pattern for
 * state derived from changing props: no effect, no extra commit.)
 */
export function useStickyFailure(isError: boolean, isFetching: boolean): { failed: boolean; retrying: boolean } {
  const [stuck, setStuck] = useState(false);
  if (isError && !stuck) setStuck(true);
  else if (!isError && !isFetching && stuck) setStuck(false);
  const failed = isError || (stuck && isFetching);
  return { failed, retrying: failed && isFetching };
}
