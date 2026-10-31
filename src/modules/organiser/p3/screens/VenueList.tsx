import type { UseQueryResult } from '@tanstack/react-query';
import type { VenueOption } from '../../shared/publicVenues';

/** Copy for the place list, shared by the event Details sheet and the per-date "Where" sheet (F-17). */
export const VENUE_LIST_COPY = {
  loading: 'Loading the places…',
  fail: 'We couldn’t load the places. Check your connection, then try again.',
  retry: 'Try again',
  empty: 'There are no places to pick from yet. Try again in a moment, or close this and ask the team to add your place.',
} as const;

/**
 * The ONE place list for both place sheets: loading, a failure with Try again, and an empty list
 * that says what to do. `children` renders the rows once there are places.
 */
export function VenueList({ venues, testId, children }: {
  testId: string;
  venues: Pick<UseQueryResult<VenueOption[]>, 'isPending' | 'isError' | 'data' | 'refetch'>;
  children: (list: VenueOption[]) => React.ReactNode;
}) {
  if (venues.isPending) return <p className="p3-note">{VENUE_LIST_COPY.loading}</p>;
  if (venues.isError && !venues.data) {
    return (
      <div className="p3-stack-s">
        <p className="p3-error" role="alert">{VENUE_LIST_COPY.fail}</p>
        <button type="button" className="p3-btn p3-btn-line" data-testid="p3-venues-retry" onClick={() => void venues.refetch()}>{VENUE_LIST_COPY.retry}</button>
      </div>
    );
  }
  const list = venues.data ?? [];
  if (list.length === 0) {
    return (
      <div className="p3-stack-s">
        <p className="p3-note" data-testid="p3-venues-empty">{VENUE_LIST_COPY.empty}</p>
        <button type="button" className="p3-btn p3-btn-line" data-testid="p3-venues-retry" onClick={() => void venues.refetch()}>{VENUE_LIST_COPY.retry}</button>
      </div>
    );
  }
  return <div className="p3-stack-s" data-testid={testId}>{children(list)}</div>;
}
