import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * The sheet and its scrim go to document.body, inside their own p3-theme (the frame's light or dark). A sheet opened
 * later is appended later, so it stacks above an open one (the gate sheet over the Repeat sheet, F-12).
 */
export function OnBody({ children }: { children: ReactNode }) {
  const theme = document.querySelector('.p3-frame')?.getAttribute('data-theme') ?? undefined;
  return createPortal(<div className="p3-theme p3-portal" data-theme={theme}>{children}</div>, document.body);
}
