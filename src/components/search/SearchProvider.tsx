import { createContext, Suspense, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { flags } from '@/lib/featureFlags';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useSearchHotkeys } from './useSearchHotkeys';

// LAZY ON PURPOSE (supabase-defer arc, P4b). SearchProvider mounts in root, so a
// STATIC import of the overlay put four modules on home's first-load graph that
// each hold an edge to the Supabase client -- searchClickTelemetry, searchRpc,
// searchTelemetry and usePopularSearches (the last two via usePublicSearch and
// DiscoveryPanel). The `flags.searchV5` guard below does NOT help: it gates
// RENDERING, not the module graph, so the edge survived the flag being off.
//
// Routed through lazyWithRetry so a deploy-stale overlay chunk heals the same
// way every other lazy chunk does.
const SearchOverlay = lazyWithRetry(() =>
  import('./SearchOverlay').then((m) => ({ default: m.SearchOverlay })),
);

interface SearchContextValue {
  open: boolean;
  openSearch: () => void;
  closeSearch: () => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function useSearch(): SearchContextValue {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearch must be used within <SearchProvider>');
  return ctx;
}

// Owns the federated-search overlay state and mounts one overlay instance.
// Gated by flags.searchV5: when off, the context still exists (so any consumer
// is safe) but openSearch is inert, no hotkeys are bound and no overlay mounts,
// so prod keeps the existing HeaderSearch omnibox untouched.
export function SearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openSearch = useCallback(() => {
    if (flags.searchV5) setOpen(true);
  }, []);
  const closeSearch = useCallback(() => setOpen(false), []);

  useSearchHotkeys(openSearch, flags.searchV5);

  const value = useMemo(
    () => ({ open, openSearch, closeSearch }),
    [open, openSearch, closeSearch],
  );

  return (
    <SearchContext.Provider value={value}>
      {children}
      {flags.searchV5 ? (
        // ErrorBoundary OUTSIDE Suspense, both falling back to null. Making the
        // overlay lazy also made it able to FAIL: SearchProvider sits above
        // AppChrome in root, so an unhandled throw from the chunk load would
        // replace the whole page with the route error boundary instead of just
        // failing to open a modal. That happens when a tab left open across a
        // deploy has already spent its once-per-session reload, so
        // safeDynamicImport rethrows rather than healing. Degrading to "the
        // overlay does not open" is the correct blast radius for a modal.
        //
        // fallback null on the Suspense side too: a modal reserves no layout,
        // so a suspended first open should show the page unchanged.
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <SearchOverlay open={open} onClose={closeSearch} />
          </Suspense>
        </ErrorBoundary>
      ) : null}
    </SearchContext.Provider>
  );
}
