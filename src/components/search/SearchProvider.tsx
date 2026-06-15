import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { flags } from '@/lib/featureFlags';
import { useSearchHotkeys } from './useSearchHotkeys';
import { SearchOverlay } from './SearchOverlay';

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
      {flags.searchV5 ? <SearchOverlay open={open} onClose={closeSearch} /> : null}
    </SearchContext.Provider>
  );
}
