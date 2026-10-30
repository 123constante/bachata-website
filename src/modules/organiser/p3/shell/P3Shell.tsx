import type { ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { L } from '../model/labels';
import { P3_PATHS, P3_TABS, type P3Tab } from './paths';
import '../theme/p3.css';

// The four tab icons, as C3 draws them (24px box, stroke).
const ICON: Record<P3Tab, ReactNode> = {
  home: <path d="M3 11 12 4l9 7v9h-6v-6H9v6H3z" strokeLinejoin="round" />,
  events: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
    </>
  ),
  stats: <path d="M5 20V12M12 20V5M19 20v-9" strokeLinecap="round" />,
  you: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
    </>
  ),
};

const NEW_PREFIX = P3_PATHS.newWhat.replace(/what$/, '');
const ORGANISERS = new RegExp(`^${P3_PATHS.events}/[^/]+/organisers/?$`);

export function tabOf(pathname: string): P3Tab {
  // New event belongs to Events (its way out is Events).
  if (pathname.startsWith(NEW_PREFIX)) return 'events';
  const hit = P3_TABS.find((t) => t !== 'home' && (pathname === P3_PATHS[t] || pathname.startsWith(`${P3_PATHS[t]}/`)));
  return hit ?? 'home';
}

/** An R1 screen in P3's frame (the You hub's pushes, New event, an event's Organisers): it draws its own top bar, with the way back. */
export function isPushed(pathname: string): boolean {
  if (pathname.startsWith(NEW_PREFIX) || ORGANISERS.test(pathname)) return true;
  return pathname.startsWith(`${P3_PATHS.you}/`) && pathname !== `${P3_PATHS.you}/`;
}

/** The P3 frame: top bar (the tab's name), the page, and the Home / Events / Stats / You tab bar. */
export function P3Shell() {
  const { pathname } = useLocation();
  const tab = tabOf(pathname);
  return (
    <div className="p3-theme p3-frame" data-testid="p3-shell">
      {isPushed(pathname) ? (
        <Outlet />
      ) : (
        <>
          <header className="p3-top">
            <h1>{L.tabs[tab]}</h1>
          </header>
          <main className="p3-main">
            <Outlet />
          </main>
        </>
      )}
      <nav className="p3-tabs" aria-label="Main">
        {P3_TABS.map((t) => (
          <NavLink key={t} to={P3_PATHS[t]} end={t === 'home'} className="p3-tab" data-tab={t}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              {ICON[t]}
            </svg>
            {L.tabs[t]}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
