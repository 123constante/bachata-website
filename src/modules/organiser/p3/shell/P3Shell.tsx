import { Suspense, useCallback, useContext, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { QueryClientContext, useQueryClient } from '@tanstack/react-query';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { OB_THEME_KEY, readObTheme } from '../onboarding/obEnv';
import { L } from '../model/labels';
import { stripOf, switchBadgeOf } from '../model/strip';
import { usePageScope } from '../screens/PageScope';
import { GateHost } from '../onboarding/GateHost';
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
const CREATE = P3_PATHS.create;
const isCreate = (pathname: string) => pathname === CREATE || pathname.startsWith(`${CREATE}/`) || pathname.startsWith(NEW_PREFIX);
const ORGANISERS = new RegExp(`^${P3_PATHS.events}/[^/]+/organisers/?$`);

export function tabOf(pathname: string): P3Tab {
  // New event belongs to Events (its way out is Events).
  if (isCreate(pathname)) return 'events';
  const hit = P3_TABS.find((t) => t !== 'home' && (pathname === P3_PATHS[t] || pathname.startsWith(`${P3_PATHS[t]}/`)));
  return hit ?? 'home';
}

/** An R1 screen in P3's frame (the You hub's pushes, New event, an event's Organisers): it draws its own top bar, with the way back. */
export function isPushed(pathname: string): boolean {
  if (isCreate(pathname) || ORGANISERS.test(pathname)) return true;
  return pathname.startsWith(`${P3_PATHS.you}/`) && pathname !== `${P3_PATHS.you}/`;
}

const STRIP_TONE: Record<'owner' | 'manager', string> = {
  owner: 'bg-[var(--warn-bg)] text-[var(--warn-fg)]',
  manager: 'bg-[var(--ok-bg)] text-[var(--ok-fg)]',
};

// X1 (slice 1b fix): the existing Settings sheet (Account settings, Help, Sign out), loaded only when opened.
const SettingsSheet = lazyWithRetry(() => import('../onboarding/SettingsSheet'));
export const ACCOUNT_ENTRY = { word: 'Account', name: 'Account, help and sign out' } as const;

/** The one Account / Help / Sign out entry, on every P3 screen: the role strip's right edge, 44px. */
export function AccountEntry({ organiserId, pageName }: { organiserId: string | null; pageName: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [theme, setThemeState] = useState(readObTheme);
  const setTheme = useCallback((t: 'light' | 'dark') => {
    setThemeState(t);
    try {
      window.localStorage.setItem(OB_THEME_KEY, t);
    } catch {
      /* private mode */
    }
  }, []);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[44px] min-w-[44px] flex-none items-center justify-center px-[8px] text-[14px] font-semibold underline"
        data-testid="p3-account-entry"
        aria-label={ACCOUNT_ENTRY.name}
        aria-haspopup="dialog"
      >
        {ACCOUNT_ENTRY.word}
      </button>
      {open && (
        <Suspense fallback={null}>
          <SettingsSheet
            theme={theme}
            setTheme={setTheme}
            organiserId={organiserId}
            pageName={pageName}
            onRenamed={() => {
              void qc.invalidateQueries({ queryKey: ['organiser-home'] });
              void qc.invalidateQueries({ queryKey: ['p3-ob-status'] });
            }}
            onClose={() => setOpen(false)}
          />
        </Suspense>
      )}
    </>
  );
}

function RoleStripInner() {
  const scope = usePageScope();
  const strip = stripOf(scope.selected);
  if (scope.loading) return null;
  // No organiser page (claim pending, teacher/DJ/dancer only, no seat): no strip, no badge -- the Account entry stays.
  if (!strip) {
    return (
      <div className="flex min-h-[44px] w-full items-center justify-end px-[16px]" data-testid="p3-account-bar">
        <AccountEntry organiserId={null} pageName="" />
      </div>
    );
  }
  const badge = switchBadgeOf(scope.home.data, scope.pageId);
  const to = scope.pageId ? `${P3_PATHS.youSwitch}?o=${encodeURIComponent(scope.pageId)}` : P3_PATHS.youSwitch;
  return (
    <div
      className={`flex min-h-[44px] w-full min-w-0 items-center gap-[8px] px-[16px] text-[14px] ${STRIP_TONE[strip.role]}`}
      data-testid="p3-role-strip"
      data-role={strip.role}
    >
      <span className="flex-none font-bold" data-testid="p3-role-strip-role">{strip.roleWord}</span>
      <span className="min-w-0 flex-1 truncate" data-testid="p3-role-strip-page">{strip.page}</span>
      <Link
        to={to}
        className="relative inline-flex min-h-[44px] min-w-[44px] flex-none items-center justify-center gap-[6px] px-[8px] text-[14px] font-semibold underline"
        data-testid="p3-switch-control"
        aria-label={badge > 0 ? `${L.strip.switchName}, ${L.strip.todos(badge)}` : L.strip.switchName}
      >
        {L.strip.switchWord}
        {badge > 0 && (
          <span
            className="inline-flex min-w-[20px] items-center justify-center rounded-[999px] bg-[var(--btn)] px-[6px] text-[12px] font-bold leading-[20px] text-[var(--btnfg)] no-underline"
            data-testid="switch-todo-badge"
            aria-hidden="true"
          >
            {badge}
          </span>
        )}
      </Link>
      <AccountEntry organiserId={scope.pageId} pageName={scope.selected?.name ?? ''} />
    </div>
  );
}

/**
 * Slice 1a: the role-coloured strip (Owner or Manager, and the page open) with the Switch
 * control and its to-do badge. The P3 area mounts only behind flags.organiserP3 and
 * organiserSelfServe (AnimatedRoutes), so with either off none of this renders.
 */
export function P3RoleStrip() {
  // Frame tests render the shell without a query client: there the strip is absent, as before.
  const client = useContext(QueryClientContext);
  return client ? <RoleStripInner /> : null;
}

/** The P3 frame: top bar (the tab's name), the page, and the Home / Events / Stats / You tab bar. */
export function P3Shell() {
  const { pathname } = useLocation();
  const tab = tabOf(pathname);
  return (
    <div className="p3-theme p3-frame" data-testid="p3-shell">
      <P3RoleStrip />
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
      {/* A1 "A few details first": opened by any refused event write on these screens (P3-GATE) */}
      <GateHost />
    </div>
  );
}
