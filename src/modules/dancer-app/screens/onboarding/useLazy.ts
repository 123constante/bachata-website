import { useEffect, useState } from 'react';
import { safeDynamicImport } from '@/lib/lazyWithRetry';

/**
 * Load a small module on demand and give back its exports (null while loading). The /app first load is
 * ratcheted (perf-budgets.json), and a static import of these would add a chunk to every /app route.
 */
export function useLazy<T>(load: () => Promise<T>): T | null {
  const [mod, setMod] = useState<T | null>(null);
  useEffect(() => {
    let live = true;
    void safeDynamicImport(load).then((m) => {
      if (live) setMod(m);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return mod;
}
