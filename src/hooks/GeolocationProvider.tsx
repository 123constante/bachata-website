// One shared location state for the whole app (nearMe ON only). Mounting this does NOT ask for
// location: that only ever happens when someone taps the Near me chip.
import type { ReactNode } from 'react';
import { GeolocationContext, useGeolocationState } from '@/hooks/useGeolocation';

export function GeolocationProvider({ children }: { children: ReactNode }) {
  const geo = useGeolocationState(true);
  return <GeolocationContext.Provider value={geo}>{children}</GeolocationContext.Provider>;
}
