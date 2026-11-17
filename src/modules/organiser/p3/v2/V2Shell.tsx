import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Link, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { rowsOf, type P3Row } from '../data/home';
import { useP3Home } from '../data/useP3Data';
import { usePageScope } from '../screens/PageScope';
import { GateHost } from '../onboarding/GateHost';
import type { HomeOrganiser } from '../../shared/selfServeApi';
import { isPushed } from '../shell/P3Shell';
import { EVENT_PARAM, readStoredEvent, resolveEventId, storeEvent } from './eventChoice';
import { vibrate } from './feedback';
import { V2_TABS, V2_TAB_WORD, v2TabOf, type V2Tab } from './paths';
import '../theme/p3.css';
import './v2.css';

export const BACK_WORD = 'Back to Bachata Calendar';
export const BACK_TO = '/';

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

/** The one event the tabs act on. Throws outside the V2 shell, so no screen reads a made-up choice. */
export function useEventChoice(): EventChoice {
  const v = useContext(Ctx);
  if (!v) throw new Error('useEventChoice is used outside the organiser shell V2');
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

/** The event switcher: pick once, every tab acts on it. */
export function EventSwitcher() {
  const c = useEventChoice();
  if (c.loading || c.error || !c.rows.length) return <span className="v2-switch-empty p3-grow" aria-hidden="true" />;
  return (
    <label className="v2-switch p3-grow">
      <span className="v2-sr">Event</span>
      <select value={c.eventId ?? ''} onChange={(e) => c.choose(e.target.value)} data-testid="v2-event-switch">
        {c.rows.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
    </label>
  );
}

const ICON: Record<V2Tab, ReactNode> = {
  events: (<><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" /></>),
  tickets: <path d="M3 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4v2h18v-2a2 2 0 0 1 0-4 2 2 0 0 0 0-4V6H3z" strokeLinejoin="round" />,
  guests: (<><path d="M8 7h12M8 12h12M8 17h12" strokeLinecap="round" /><path d="M3 7h1M3 12h1M3 17h1" strokeLinecap="round" /></>),
  raffle: (<><rect x="4" y="9" width="16" height="12" rx="2" /><path d="M2 9h20M12 9v12M12 9c-2-4-6-4-6-1s6 1 6 1 6 2 6-1-4-3-6 1" strokeLinejoin="round" /></>),
};

/** Organiser shell V2 (flag organiserShellV2): slim top bar, the page, and the four tabs. */
export function V2Shell() {
  const { pathname, search } = useLocation();
  const tab = v2TabOf(pathname);
  return (
    <div className="p3-theme v2-look p3-frame" data-testid="v2-shell">
      <EventChoiceProvider>
        <header className="v2-top" data-testid="v2-top">
          <a href={BACK_TO} className="v2-back" data-testid="v2-back">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {BACK_WORD}
          </a>
          <EventSwitcher />
        </header>
        {isPushed(pathname) ? <Outlet /> : (
          <main className="p3-main" aria-label={V2_TAB_WORD[tab]}>
            <Outlet />
          </main>
        )}
        <nav className="p3-tabs" aria-label="Main">
          {V2_TABS.map((t) => (
            <Link key={t.id} to={`${t.path}${search}`} className="p3-tab" data-tab={t.id} aria-current={t.id === tab ? 'page' : undefined} onClick={() => vibrate('tap')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">{ICON[t.id]}</svg>
              {V2_TAB_WORD[t.id]}
            </Link>
          ))}
        </nav>
        <GateHost />
      </EventChoiceProvider>
    </div>
  );
}
