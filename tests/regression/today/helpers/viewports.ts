/**
 * The two viewports every regression row renders at. jsdom has no layout, so a
 * "viewport" here is what the code can observe: window.innerWidth/innerHeight
 * and the answers of matchMedia for width queries (useIsMobile and friends).
 * Call `setViewport` in a beforeEach; the polyfills must be installed first.
 */
import { setMatchMedia } from '../../../client/jsdomPolyfills';

export const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 },
] as const;
export type Viewport = (typeof VIEWPORTS)[number];

export function setViewport(v: Viewport) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: v.width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: v.height });
  setMatchMedia((query) => {
    const min = /\(min-width:\s*(\d+)px\)/.exec(query);
    const max = /\(max-width:\s*(\d+)px\)/.exec(query);
    if (!min && !max) return false;
    if (min && v.width < Number(min[1])) return false;
    if (max && v.width > Number(max[1])) return false;
    return true;
  });
}
