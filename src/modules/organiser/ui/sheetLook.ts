import { createContext, useContext } from 'react';

/**
 * Which theme a portalled SheetView paints in. The sheet renders in document.body, outside
 * the area's own theme element, so it cannot inherit it: R1 (.org-theme) by default, and
 * P3 (.p3-theme) where a P3 screen provides it (P3 W4b: Welcome / Add a page).
 */
export type SheetLook = 'r1' | 'p3';
const SheetLookContext = createContext<SheetLook>('r1');
export const SheetLookProvider = SheetLookContext.Provider;
export const useSheetLook = (): SheetLook => useContext(SheetLookContext);
