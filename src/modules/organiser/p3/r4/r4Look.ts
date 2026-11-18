import { createContext, useContext } from 'react';

/** true inside the R4 Tickets screen: shared sheets it opens (Refund) draw the R4 board layout. */
export const R4LookContext = createContext(false);
export const useR4Look = (): boolean => useContext(R4LookContext);
