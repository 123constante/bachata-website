// "Discard changes?" guard (D119 #2). BrowserRouter has no blocker, so ONE small store: a form with unsaved edits
// sets `dirty`; the frame that owns the sheet registers `ask`. Every area link asks first (requestLeave).
import { useEffect } from 'react';

let dirty = false;
let ask: ((go: () => void) => void) | null = null;

/** Run `go` now, or after the person confirms Discard when a form holds unsaved edits. */
export function requestLeave(go: () => void): void {
  if (dirty && ask) ask(go);
  else go();
}

export function isLeaveDirty(): boolean {
  return dirty && ask !== null;
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
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      dirty = false;
    };
  }, [isDirty]);
}
