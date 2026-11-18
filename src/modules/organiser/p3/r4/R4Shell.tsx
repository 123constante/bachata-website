import type { ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useP3Home } from '../data/useP3Data';
import { usePageScope } from '../screens/PageScope';
import { GateHost } from '../onboarding/GateHost';
import { switchBadgeOf } from '../model/strip';
import { isPushed } from '../shell/P3Shell';
import { P3_BASE, P3_PATHS } from '../shell/paths';
import { EventChoiceProvider } from '../v2/V2Shell';
import { R4_TABS, R4_TAB_WORD, type R4Tab } from './r4Model';
import '../theme/p3.css';
import './r4.css';

export const R4_EXIT_TO = 'https://bachatacalendar.co.uk';
export const R4_EXIT_WORD = 'Back to bachatacalendar.co.uk';

export const R4_PATHS: Record<R4Tab, string> = { home: P3_PATHS.home, events: P3_PATHS.events, tickets: `${P3_BASE}/tickets`, team: P3_PATHS.youTeam };

/** Which tab a path belongs to: Team owns the team pushes, Events owns one event's screens. */
export function r4TabOf(pathname: string): R4Tab {
  if (pathname.startsWith(R4_PATHS.team)) return 'team';
  if (pathname.startsWith(R4_PATHS.tickets)) return 'tickets';
  if (pathname.startsWith(R4_PATHS.events) || pathname.startsWith(`${P3_BASE}/create`)) return 'events';
  return 'home';
}

const ICON: Record<R4Tab, ReactNode> = {
  home: (<><path d="M3 11 12 3l9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>),
  events: (<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18" /><path d="M8 3v4" /><path d="M16 3v4" /></>),
  tickets: (<><path d="M3 9V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a3 3 0 0 0 0 6v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a3 3 0 0 0 0-6Z" /><path d="M14 5v14" strokeDasharray="2 3" /></>),
  team: (<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" /><path d="M18 14.3a6.5 6.5 0 0 1 3.5 5.7" /></>),
};

export function R4Chevron({ dir = 'right' }: { dir?: 'right' | 'left' | 'down' }) {
  const d = dir === 'left' ? 'm15 6-6 6 6 6' : dir === 'down' ? 'm6 9 6 6 6-6' : 'm9 6 6 6-6 6';
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}

/** The 48px header: the open page (tap to switch) and the To do count from the other pages. */
function R4Header() {
  const scope = usePageScope();
  const home = useP3Home();
  const pageId = scope.pageId ?? null;
  const badge = switchBadgeOf(home.data, pageId);
  const to = pageId ? `${P3_PATHS.youSwitch}?o=${encodeURIComponent(pageId)}` : P3_PATHS.youSwitch;
  const name = scope.selected?.name ?? '';
  return (
    <header className="r4-header" data-testid="r4-header">
      <Link to={to} className="r4-page" data-testid="r4-switch" aria-label={name ? `Switch page, now showing ${name}` : 'Switch page'}>
        <span className="r4-page-name">{scope.loading ? '' : name || 'Your page'}</span>
        <span className="r4-mut"><R4Chevron dir="down" /></span>
      </Link>
      {badge > 0 && (
        <Link to={to} className="r4-todo" data-testid="r4-todo">
          To do<span className="r4-badge" aria-label={`${badge} waiting`}>{badge}</span>
        </Link>
      )}
    </header>
  );
}

/** Organiser Round 4 (flag organiserR4): white + orange frame, exit bar, header, Home / Events / Tickets / Team. */
export function R4Shell() {
  const { pathname } = useLocation();
  const tab = r4TabOf(pathname);
  // Compare is a pushed surface under P3 / V2; under R4 it is drawn in the frame (board R4Compare).
  const pushed = isPushed(pathname) && tab !== 'team' && pathname !== P3_PATHS.compare;
  return (
    <div className="p3-theme p3-frame r4-look" data-theme="light" data-testid="r4-shell">
      <EventChoiceProvider>
        <div className="r4-exit">
          <a href={R4_EXIT_TO} className="r4-exit-link" data-testid="r4-back"><R4Chevron dir="left" />{R4_EXIT_WORD}</a>
        </div>
        {pushed ? <Outlet /> : (
          <>
            <R4Header />
            <main className="r4-main p3-main"><Outlet /></main>
          </>
        )}
        <nav className="r4-tabs" aria-label="Main">
          {R4_TABS.map((t) => (
            <Link key={t} to={R4_PATHS[t]} className="r4-tab" data-tab={t} aria-current={t === tab ? 'page' : undefined}>
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{ICON[t]}</svg>
              {R4_TAB_WORD[t]}
            </Link>
          ))}
        </nav>
        <GateHost />
      </EventChoiceProvider>
    </div>
  );
}
