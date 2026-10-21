import { createContext, useContext, useEffect, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import './ember.css';

const InEmber = createContext(false);

/** True inside <EmberWorld>. SheetView reads it: its portal sits outside the wrapper's DOM. */
export function useInEmberWorld(): boolean {
  return useContext(InEmber);
}

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap';
const FONT_ID = 'ember-font-outfit';

/**
 * Adds the Outfit stylesheet once, only when an ember screen mounts (other
 * pages make no new request). Pages that just add className="ember-world"
 * without <EmberWorld> can call this themselves.
 */
export function loadEmberFont(): void {
  if (typeof document === 'undefined' || document.getElementById(FONT_ID)) return;
  const link = document.createElement('link');
  link.id = FONT_ID;
  link.rel = 'stylesheet';
  link.href = FONT_HREF;
  document.head.appendChild(link);
}

export type EmberWorldProps = HTMLAttributes<HTMLDivElement>;

/** Wrapper that puts its children in the Ember look (Ember accent, ink, Outfit, graphite ground). */
export function EmberWorld({ className, children, ...rest }: EmberWorldProps) {
  useEffect(() => {
    loadEmberFont();
  }, []);
  return (
    <InEmber.Provider value>
      <div {...rest} className={cn('ember-world', className)}>
        {children}
      </div>
    </InEmber.Provider>
  );
}
