/**
 * The jsdom gaps this component's provider stack walks into.
 *
 * jsdom implements the DOM, not the browser around it. Anything the tree calls
 * that lives on `window` but outside the DOM spec is simply absent, and the
 * failure is a TypeError deep inside a vendor effect rather than anything that
 * names the missing API -- sonner's toaster calling `window.matchMedia` was the
 * first one, six frames into react-dom's commit phase.
 *
 * KEEP THESE HONEST. A stub that returns a plausible answer where the real
 * browser would return something else does not fix a test, it moves the lie.
 * The default answer here is FALSE for every query, so a file using these
 * polyfills is a DESKTOP viewport and no case in it may claim anything about
 * mobile breakpoint behaviour.
 *
 * WHAT THESE STUBS DO NOT DO: dispatch change events. A listener registered
 * through `addEventListener` or the deprecated `addListener` is accepted and
 * never called, because nothing here changes a media result mid-test. Code
 * under test that depends on being NOTIFIED of a viewport change will not be
 * exercised -- it will silently never fire, which is a coverage gap and not a
 * failure. Making that real means driving the listeners from `setMatchMedia`,
 * and it should be done when a case actually needs it rather than guessed at
 * now.
 */

type MediaListener = (ev: Partial<MediaQueryListEvent>) => void;

const DESKTOP: (query: string) => boolean = () => false;

let matchesAnswer = DESKTOP;

/**
 * Decide what media queries answer for the rest of the file. Call it in a
 * `beforeEach` if a case needs a different viewport.
 *
 * `installJsdomPolyfills` RESETS this to the desktop default, so an answer set
 * by one file cannot leak into the next through a reused worker environment --
 * which would make the file header's DESKTOP claim false for a suite that
 * never called this at all.
 */
export function setMatchMedia(answer: (query: string) => boolean) {
  matchesAnswer = answer;
}

export function installJsdomPolyfills() {
  if (typeof window === 'undefined') {
    throw new Error('installJsdomPolyfills: no window -- this file needs @vitest-environment jsdom');
  }

  matchesAnswer = DESKTOP;

  // Assigned unconditionally, unlike the observer stubs below: vitest can reuse
  // an environment across files in a worker, so a stub left behind by a sibling
  // suite -- with ITS answer function still captured -- must not outlive it.
  window.matchMedia = ((query: string) => {
    const listeners = new Set<MediaListener>();
    return {
      // A GETTER, not a value frozen at construction. Components hold the
      // MediaQueryList and re-read `.matches`; a snapshot taken when the list
      // was created would answer with whatever the viewport was one
      // `setMatchMedia` ago.
      get matches() {
        return matchesAnswer(query);
      },
      media: query,
      onchange: null,
      addEventListener: (_: string, fn: MediaListener) => void listeners.add(fn),
      removeEventListener: (_: string, fn: MediaListener) => void listeners.delete(fn),
      // Deprecated pair, still called by older libraries. Present so their
      // absence cannot be the thing that reds a case about something else.
      addListener: (fn: MediaListener) => void listeners.add(fn),
      removeListener: (fn: MediaListener) => void listeners.delete(fn),
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;

  // The three below are guarded on absence rather than assigned outright: they
  // are inert no-op classes with no captured state, so a real implementation
  // (or a richer stub installed by another file) is worth keeping over this.

  // jsdom has no layout engine, so scrollIntoView does not exist. A component
  // scrolling a selected day into view would otherwise throw in an effect.
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = function scrollIntoView() {};
  }

  if (typeof window.ResizeObserver === 'undefined') {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }

  if (typeof window.IntersectionObserver === 'undefined') {
    window.IntersectionObserver = class {
      root = null;
      rootMargin = '';
      thresholds: number[] = [];
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    } as unknown as typeof IntersectionObserver;
  }
}
