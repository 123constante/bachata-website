import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { rowsOf, type P3Row } from '../data/home';
import { useP3Home } from '../data/useP3Data';
import { usePageScope } from '../screens/PageScope';
import type { HomeOrganiser } from '../../shared/selfServeApi';
import { EVENT_PARAM, readStoredEvent, resolveEventId, storeEvent } from './eventChoiceModel';
import { vibrate } from './feedback';

export interface EventChoice {
  loading: boolean;
  error: boolean;
  noPage: boolean;
  retry: () => void;
  page: HomeOrganiser | null;
  rows: readonly P3Row[];
  today: string;
  eventId: string | null;
  event: P3Row | null;
  choose: (id: string) => void;
}

const Ctx = createContext<EventChoice | null>(null);

/** The one event the tabs act on. Throws outside the R4 shell, so no screen reads a made-up choice. */
export function useEventChoice(): EventChoice {
  const v = useContext(Ctx);
  if (!v) throw new Error('useEventChoice is used outside the organiser shell');
  return v;
}

export function EventChoiceProvider({ children }: { children: ReactNode }) {
  const home = useP3Home();
  const scope = usePageScope();
  const [params, setParams] = useSearchParams();
  const rows = useMemo(() => (home.data && scope.pageId ? rowsOf(home.data, scope.pageId) : []), [home.data, scope.pageId]);
  const today = home.data?.today ?? '';
  const urlId = params.get(EVENT_PARAM);
  const eventId = resolveEventId({ urlId, storedId: readStoredEvent(), rows, today });
  // Only an explicit pick (choose) is kept for the visit; the computed default is never stored,
  // so "next event" keeps moving on as dates pass.
  const loading = !!home.isPending || scope.loading;
  const error = !!home.isError;
  const refetch = home.refetch;
  const value = useMemo<EventChoice>(() => ({
    loading,
    error,
    noPage: scope.noPage,
    retry: () => void refetch(),
    page: scope.selected,
    rows,
    today,
    eventId,
    event: rows.find((r) => r.id === eventId) ?? null,
    choose: (id: string) => {
      storeEvent(id);
      vibrate('tap');
      const next = new URLSearchParams(params);
      next.set(EVENT_PARAM, id);
      setParams(next, { replace: true });
    },
  }), [loading, error, scope.noPage, refetch, scope.selected, rows, today, eventId, params, setParams]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
