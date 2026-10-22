// "Discard changes?" guard (D119 #2). ONE small store: a form with unsaved edits sets `dirty`; the frame that owns the
// sheet registers `ask`. Under the production data router (app/root.tsx) the frame ALSO registers a router blocker
// (useAreaLeaveBlocker), which catches every in-app exit: browser Back/Forward, header links, switcher rows. Then links
// navigate normally and the blocker asks. The store's own asking is the fallback for MemoryRouter / BrowserRouter.
import { useEffect } from 'react';

let dirty = false;
let ask: ((go: () => void) => void) | null = null;
let routerGuard = false;

/** Run `go` now, or after the person confirms Discard when a form holds unsaved edits. */
export function requestLeave(go: () => void): void {
  if (dirty && ask && !routerGuard) ask(go);
  else go();
}

/** Should a link stop its own navigation and ask? False when the router blocker asks instead. */
export function isLeaveDirty(): boolean {
  return dirty && ask !== null && !routerGuard;
}

/** Does a form hold unsaved edits right now? Read by the router blocker at navigation time. */
export function isFormDirty(): boolean {
  return dirty;
}

/** AreaFrame says whether a router blocker is guarding (then links do not ask themselves). */
export function setRouterGuard(on: boolean): void {
  routerGuard = on;
}

/** AreaFrame registers the sheet opener for as long as it is mounted. */
export function useRegisterLeaveAsk(open: (go: () => void) => void): void {
  useEffect(() => {
    ask = open;
    return () => {
      if (ask === open) ask = null;
    };
  }, [open]);
}

/** A form reports whether it holds unsaved edits. Also warns on closing the tab while dirty. */
export function useLeaveGuard(isDirty: boolean): void {
  useEffect(() => {
    dirty = isDirty;
    if (!isDirty) return undefined;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Safari and older Chromium show the prompt only when returnValue is set.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      dirty = false;
    };
  }, [isDirty]);
}
