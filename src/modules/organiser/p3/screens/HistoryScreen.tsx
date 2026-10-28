import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { EventWorkspace } from '../../events/eventModel';
import { fetchHistory, historyDays, historyKey, isHistoryRefusal, type HistoryPage } from '../data/history';
import { L } from '../model';
import { P3_PATHS } from '../shell/paths';
import { NotYoursCard, WorkspaceGate } from './EventPage';
import { RetryButton, StateCard } from './parts';

/** organiser_series_history_v1, newest first, one page at a time (a button, never infinite scroll). */
export function useP3History(seriesId: string) {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: historyKey(user?.id, seriesId),
    queryFn: ({ pageParam }) => fetchHistory(seriesId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last: HistoryPage) => (last.hasMore ? last.nextBefore : undefined),
    enabled: !!user?.id,
    staleTime: 30_000,
  });
}

function History({ ws }: { ws: EventWorkspace }) {
  const id = ws.series.id;
  const name = ws.series.name.trim() || L.noName;
  const q = useP3History(id);
  const head = (
    <>
      <Link className="p3-link" to={P3_PATHS.event(id)}>&larr; {name}</Link>
      <h2 className="p3-name">{L.history}</h2>
      <p className="p3-note">{L.historyIntro}</p>
    </>
  );
  if (q.isPending) {
    return <div className="p3-stack" data-testid="p3-history">{head}<StateCard title={L.historyLoading} testId="p3-history-loading">{null}</StateCard></div>;
  }
  // a failed older page keeps the rows already shown (its own note below), only a failed first read is the error card
  if (q.isError && !q.isFetchNextPageError) {
    if (isHistoryRefusal(q.error)) return <NotYoursCard />;
    return (
      <div className="p3-stack" data-testid="p3-history">
        {head}
        <StateCard title={L.historyError} testId="p3-history-error">
          <p>{L.historyErrorBody}</p>
          <RetryButton onClick={() => void q.refetch()} />
        </StateCard>
      </div>
    );
  }
  const days = historyDays((q.data?.pages ?? []).flatMap((p) => p.items));
  if (!days.length) {
    return (
      <div className="p3-stack" data-testid="p3-history">
        {head}
        <StateCard title={L.historyEmptyTitle} testId="p3-history-empty">
          <p>{L.historyEmptyBody}</p>
          <Link className="p3-link" to={P3_PATHS.event(id)}>{L.historyBack}</Link>
        </StateCard>
      </div>
    );
  }
  return (
    <div className="p3-stack" data-testid="p3-history">
      {head}
      {days.map((d) => (
        <section key={d.day} className="p3-card p3-tight" aria-label={d.title} data-testid="p3-history-day">
          <strong className="p3-day">{d.title}</strong>
          <ul className="p3-list p3-flush">
            {d.rows.map((r, i) => (
              <li key={`${r.at}-${i}`} className="p3-row" data-testid="p3-history-row">
                <div className="p3-grow">
                  <div className="p3-row-t">{r.label}</div>
                  <div className="p3-row-s" data-testid="p3-history-sub">{r.sub}</div>
                  {r.changed && <div className="p3-row-s" data-testid="p3-history-fields">{r.changed}</div>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {q.isFetchNextPageError && <p className="p3-note" role="alert" data-testid="p3-history-more-error">{L.historyMoreError}</p>}
      {q.hasNextPage && (
        <button type="button" className="p3-btn p3-btn-line" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()} data-testid="p3-history-more">
          {q.isFetchingNextPage ? L.historyMoreLoading : L.historyMore}
        </button>
      )}
    </div>
  );
}

/** One event's History (W3b-1): read only, no Undo (that waits for admin A3 R2). */
export function HistoryScreen() {
  return <WorkspaceGate>{(ws) => <History ws={ws} />}</WorkspaceGate>;
}
