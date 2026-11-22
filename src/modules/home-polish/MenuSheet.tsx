// homePolish full-screen menu sheet (owner click 2026-11-18/19, option 2): LIST ROWS with the
// bobbing emojis kept, a search bar that opens full-screen search (option C), per-role rows,
// and a quiet footer (theme, Instagram/WhatsApp, Rate us, Support us -> 3 amount buttons).
// a11y: role=dialog + aria-modal, focus moves in and is trapped, Escape / back goes back ONE
// level (support or search -> menu -> closed), focus returns to the menu button on close.
// Portalled to <body>: the header's backdrop-filter would otherwise trap position:fixed.

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight, Moon, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { flags } from '@/lib/featureFlags';
import { useAuth } from '@/hooks/useAuth';
import { useCity } from '@/contexts/CityContext';
import { buildCityPath } from '@/lib/cityPath';
import { buildSignInHref } from '@/lib/authRouting';
import { ACCOUNT_HOME_PATH, ORGANISER_AREA_HOME_PATH } from '@/lib/accountRouting';
import { INSTAGRAM_URL, WHATSAPP_GROUP_URL } from '@/lib/contactLinks';
import { fetchOrganiserHome, organiserHomeQueryKey } from '@/modules/organiser/shared/selfServeApi';
import { usePublicSearch } from '@/hooks/usePublicSearch';
import type { SearchResult } from '@/lib/searchRpc';
import { menuRows, RATE_US_URL, SUPPORT_LINKS, type MenuRole, type MenuRow } from './menuModel';
import { clearRecent, pushRecent, readRecent } from './recentSearches';
import { searchGroupOf, type SearchFilter, SEARCH_FILTERS } from './searchFilter';

type View = 'menu' | 'search' | 'support';

const ring = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';
const rowCls = cn('flex min-h-[48px] items-center gap-3 border-b border-border/60 px-1 text-[15px] font-semibold text-foreground no-underline', ring);

export default function MenuSheet({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<View>('menu');
  const panelRef = useRef<HTMLDivElement | null>(null);
  const opener = useRef<Element | null>(typeof document !== 'undefined' ? document.activeElement : null);

  // Lock the page behind the sheet; give focus back to the menu button on close -- but
  // only when the sheet closed on the SAME page (a row tap navigates; focus belongs to the new page).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const back = opener.current;
    const openedOn = window.location.pathname;
    return () => {
      document.body.style.overflow = prev;
      if (back instanceof HTMLElement && window.location.pathname === openedOn) back.focus();
    };
  }, []);

  // Each view takes focus on its first control.
  useEffect(() => {
    const el = panelRef.current?.querySelector<HTMLElement>('[data-autofocus]');
    el?.focus();
  }, [view]);

  const back = () => (view === 'menu' ? onClose() : setView('menu'));

  // Escape also works when focus sits on body (a tap on blank space moves it off the panel).
  useEffect(() => {
    const h = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !panelRef.current?.contains(e.target as Node)) back();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  });

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      back();
      return;
    }
    if (e.key !== 'Tab' || !panelRef.current) return;
    const f = panelRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input');
    if (f.length === 0) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const label = view === 'search' ? 'Search' : view === 'support' ? 'Support us' : 'Menu';

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-[80] flex flex-col overflow-y-auto bg-background text-foreground"
      data-testid="menu-sheet"
    >
      {view === 'search' ? (
        <SearchView onBack={() => setView('menu')} onDone={onClose} />
      ) : view === 'support' ? (
        <SupportView onBack={() => setView('menu')} />
      ) : (
        <MenuView onClose={onClose} onSearch={() => setView('search')} onSupport={() => setView('support')} />
      )}
    </div>,
    document.body,
  );
}

function SheetTop({ title, onBack, backLabel, icon }: { title: string; onBack: () => void; backLabel: string; icon: 'back' | 'close' }) {
  const Icon = icon === 'back' ? ArrowLeft : X;
  return (
    <div className="sticky top-0 z-[1] flex h-[56px] shrink-0 items-center gap-2 border-b border-border bg-background px-2">
      {icon === 'back' && (
        <button type="button" onClick={onBack} aria-label={backLabel} className={cn('inline-flex h-[44px] w-[44px] items-center justify-center rounded-md', ring)}>
          <Icon className="h-6 w-6" aria-hidden="true" />
        </button>
      )}
      <h2 className={cn('flex-1 text-base font-extrabold', icon === 'close' && 'pl-2')}>{title}</h2>
      {icon === 'close' && (
        <button type="button" onClick={onBack} aria-label={backLabel} className={cn('inline-flex h-[44px] w-[44px] items-center justify-center rounded-md', ring)}>
          <Icon className="h-6 w-6" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function RowLink({ row, onNavigate }: { row: MenuRow; onNavigate: () => void }) {
  const inner = (
    <>
      <span className="chrome-bob-sm w-6 text-center text-lg leading-none" style={{ '--bob-dur': row.bob } as CSSProperties} aria-hidden="true">
        {row.emoji}
      </span>
      <span className="flex-1">{row.label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    </>
  );
  if (row.external) {
    return (
      <a href={row.href} target="_blank" rel="noopener noreferrer" className={rowCls}>
        {inner}
      </a>
    );
  }
  return (
    <Link to={row.href} onClick={onNavigate} className={rowCls} data-testid={`menu-row-${row.id}`}>
      {inner}
    </Link>
  );
}

function MenuView({ onClose, onSearch, onSupport }: { onClose: () => void; onSearch: () => void; onSupport: () => void }) {
  const { user, authStatus } = useAuth();
  const { citySlug } = useCity();
  const { pathname, search } = useLocation();
  const signedIn = !!user && !user.is_anonymous;
  // Organiser rows only for someone who runs an organiser (same read the organiser area uses).
  const home = useQuery({ queryKey: organiserHomeQueryKey(user?.id), queryFn: fetchOrganiserHome, enabled: signedIn, staleTime: 5 * 60_000 });
  const role: MenuRole = !signedIn ? 'signedOut' : (home.data?.organisers?.length ?? 0) > 0 ? 'organiser' : 'signedIn';
  const p3 = ORGANISER_AREA_HOME_PATH === '/account/p3';
  const { account, browse } = menuRows({
    role,
    signInHref: buildSignInHref(`${pathname}${search}`),
    venuesHref: buildCityPath(citySlug, 'venues'),
    communityHref: WHATSAPP_GROUP_URL,
    rafflesOn: flags.rafflesPage,
    accountHref: ACCOUNT_HOME_PATH,
    organiserHomeHref: ORGANISER_AREA_HOME_PATH,
    sellTicketsHref: p3 ? `${ORGANISER_AREA_HOME_PATH}/events` : ORGANISER_AREA_HOME_PATH,
  });
  // Auth still resolving: no Sign in row yet (a signed-in reader would read it as a dropped session).
  const accountRows = authStatus === 'ready' || signedIn ? account : [];

  return (
    <>
      <SheetTop title="Menu" onBack={onClose} backLabel="Close menu" icon="close" />
      <div className="flex-1 px-3 pb-6 pt-3">
        <button
          type="button"
          onClick={onSearch}
          data-autofocus
          className={cn('flex h-[44px] w-full items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 text-left text-[15px] text-muted-foreground', ring)}
        >
          <Search className="h-5 w-5" aria-hidden="true" />
          Search events, people, venues
        </button>

        {accountRows.length > 0 && (
          <nav aria-label="Your account" className="mt-3">
            {accountRows.map((r) =>
              r.id === 'signin' ? (
                // Contrast fix: dark text on amber (white on #e2415c was 4.1:1).
                <Link key={r.id} to={r.href} onClick={onClose} data-testid="menu-row-signin" className={cn('flex min-h-[48px] items-center justify-center rounded-xl bg-primary text-[15px] font-bold text-primary-foreground no-underline', ring)}>
                  Sign in
                </Link>
              ) : (
                <RowLink key={r.id} row={r} onNavigate={onClose} />
              ),
            )}
          </nav>
        )}

        <nav aria-label="Browse" className="mt-3">
          {browse.map((r) => (
            <RowLink key={r.id} row={r} onNavigate={onClose} />
          ))}
        </nav>

        <footer className="mt-6 space-y-2 text-[13px]">
          <button type="button" disabled className="flex min-h-[44px] w-full items-center gap-2 rounded-xl border border-border px-3 text-muted-foreground opacity-70">
            <Moon className="h-4 w-4" aria-hidden="true" />
            Light theme
            <span className="ml-auto text-[12px]">Coming soon</span>
          </button>
          <div className="grid grid-cols-2 gap-2">
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className={cn('flex min-h-[44px] items-center justify-center rounded-xl border border-border font-semibold text-foreground no-underline', ring)}>Instagram</a>
            <a href={WHATSAPP_GROUP_URL} target="_blank" rel="noopener noreferrer" className={cn('flex min-h-[44px] items-center justify-center rounded-xl border border-border font-semibold text-foreground no-underline', ring)}>WhatsApp</a>
            <a href={RATE_US_URL} target="_blank" rel="noopener noreferrer" className={cn('flex min-h-[44px] items-center justify-center rounded-xl border border-border font-semibold text-foreground no-underline', ring)}>Rate us on Google</a>
            <button type="button" onClick={onSupport} className={cn('flex min-h-[44px] items-center justify-center rounded-xl border border-border font-semibold text-foreground', ring)}>Support us</button>
          </div>
        </footer>
      </div>
    </>
  );
}

function SupportView({ onBack }: { onBack: () => void }) {
  return (
    <>
      <SheetTop title="Support us" onBack={onBack} backLabel="Back to menu" icon="back" />
      <div className="px-3 pt-4">
        <p className="text-sm text-muted-foreground">Bachata Calendar is free. A one-off tip keeps it running. Payment is by Stripe.</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {SUPPORT_LINKS.map((s, i) => (
            <a
              key={s.href}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              {...(i === 0 ? { 'data-autofocus': true } : {})}
              className={cn('flex min-h-[48px] items-center justify-center rounded-xl bg-primary text-base font-extrabold text-primary-foreground no-underline', ring)}
            >
              {s.label}
            </a>
          ))}
        </div>
      </div>
    </>
  );
}

function SearchView({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const navigate = useNavigate();
  const { citySlug } = useCity();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<SearchFilter>('all');
  const [recent, setRecent] = useState<string[]>(() => readRecent());
  const { results, isLoading, hasQuery } = usePublicSearch(q, citySlug);
  const shown = filter === 'all' ? results : results.filter((r) => searchGroupOf(r.kind) === filter);

  const go = (r: SearchResult) => {
    setRecent(pushRecent(q));
    // Navigate FIRST: the header closes the sheet on the pathname change; onDone covers
    // a result that points at the page already open.
    navigate(r.href);
    onDone();
  };

  return (
    <>
      <div className="sticky top-0 z-[1] flex h-[56px] shrink-0 items-center gap-1 border-b border-border bg-background px-2">
        <button type="button" onClick={onBack} aria-label="Back to menu" className={cn('inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-md', ring)}>
          <ArrowLeft className="h-6 w-6" aria-hidden="true" />
        </button>
        <input
          data-autofocus
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search events, people, venues"
          aria-label="Search"
          enterKeyHint="search"
          className="h-[44px] min-w-0 flex-1 rounded-xl border border-border bg-muted/30 px-3 text-[16px] outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <div className="px-3 pb-6 pt-2">
        {q.trim().length >= 2 && !hasQuery ? (
          // Inside the 220ms debounce: say so rather than flash the recent list.
          <p role="status" className="pt-2 text-sm text-muted-foreground">Searching&hellip;</p>
        ) : !hasQuery ? (
          recent.length > 0 ? (
            <section aria-label="Recent searches">
              <div className="flex items-center justify-between">
                <h3 className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Recent</h3>
                <button
                  type="button"
                  onClick={() => {
                    clearRecent();
                    setRecent([]);
                  }}
                  className={cn('inline-flex min-h-[44px] items-center px-2 text-[13px] font-bold text-primary', ring)}
                >
                  Clear
                </button>
              </div>
              {recent.map((r) => (
                <button key={r} type="button" onClick={() => setQ(r)} className={cn(rowCls, 'w-full text-left')}>
                  <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  {r}
                </button>
              ))}
            </section>
          ) : (
            <p className="pt-2 text-sm text-muted-foreground">Type at least 2 letters to search events, teachers, DJs, dancers and venues.</p>
          )
        ) : (
          <>
            <div role="group" aria-label="Show" className="flex gap-2 py-2">
              {SEARCH_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "relative h-[32px] rounded-full border px-3 text-[13px] font-bold before:absolute before:inset-x-0 before:-inset-y-[6px] before:content-['']",
                    ring,
                    filter === f.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {isLoading ? (
              <p role="status" className="pt-2 text-sm text-muted-foreground">Searching&hellip;</p>
            ) : shown.length === 0 ? (
              <p role="status" className="pt-2 text-sm text-muted-foreground">
                No matches. Try another spelling{filter !== 'all' ? ', or tap All' : ''}.
              </p>
            ) : (
              <ul>
                {shown.map((r) => (
                  <li key={`${r.kind}-${r.id}`}>
                    <button type="button" onClick={() => go(r)} className={cn(rowCls, 'w-full text-left')}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{r.title}</span>
                        {r.subtitle && <span className="block truncate text-[12px] font-normal text-muted-foreground">{r.subtitle}</span>}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </>
  );
}
