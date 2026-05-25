import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

// Controls the site-wide search overlay (approach C). GlobalHeader's search
// icon calls open(); the overlay (mounted once in App) reads isOpen/close.
interface SearchOverlayValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const SearchOverlayContext = createContext<SearchOverlayValue | undefined>(undefined);

export const SearchOverlayProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  return (
    <SearchOverlayContext.Provider value={{ isOpen, open, close }}>
      {children}
    </SearchOverlayContext.Provider>
  );
};

export const useSearchOverlay = () => {
  const ctx = useContext(SearchOverlayContext);
  if (!ctx) throw new Error('useSearchOverlay must be used within SearchOverlayProvider');
  return ctx;
};
