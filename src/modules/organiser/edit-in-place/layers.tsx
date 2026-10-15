// Edit in place: where the layer's fixed pieces live (the Save bar, the sheet,
// the leave dialog). They render into document.body, NOT inside the page's
// <article>: an ancestor with a transform or filter makes position:fixed
// relative to that ancestor instead of the screen. The route's PageTransition
// wrapper leaves `filter: blur(0px)` behind after a client navigation, which put
// the bar at the bottom of the PAGE (above the footer) instead of the screen.
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * The layer only mounts for a signed-in owner (never on the server), but the
 * guard keeps a server render from touching document.
 */
export function inBody(node: ReactNode): ReactNode {
  return typeof document === 'undefined' ? null : createPortal(node, document.body);
}

/** Nothing is fixed to the bottom any more (the section row moved under the header), so fixed bars sit at the real bottom edge. */
export const BOTTOM_NAV_OFFSET = '0px + env(safe-area-inset-bottom, 0px)';

/**
 * The BottomNav's own layer (z-50). The bar never overlaps the nav (it sits
 * BOTTOM_NAV_OFFSET up), and a tie goes to whatever comes later in the DOM: this
 * body-level bar beats the nav inside #root, while a page dialog (shadcn, z-50,
 * portalled on open) still covers the bar instead of the bar covering its
 * buttons. Below this layer's sheet (60/61) and leave dialog (70/71).
 */
export const BAR_Z = 50;
