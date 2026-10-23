import { createContext, useContext, useEffect, useRef, type MutableRefObject, type ReactNode } from 'react';

/** A screen with unsaved edits registers one: it gets where the person is going and returns true to let them go now. */
export type LeaveGuard = (to: string) => boolean;

const Ctx = createContext<MutableRefObject<LeaveGuard | null> | null>(null);

/** The shell provides it; its home link reads it before leaving (D120 "through Discard changes?"). */
export const LeaveGuardProvider = ({ children, guardRef }: { children: ReactNode; guardRef: MutableRefObject<LeaveGuard | null> }) => (
  <Ctx.Provider value={guardRef}>{children}</Ctx.Provider>
);

/** Register a guard while the screen is mounted (null clears it). */
export const useLeaveGuard = (guard: LeaveGuard | null): void => {
  const ref = useContext(Ctx);
  const latest = useRef(guard);
  useEffect(() => {
    latest.current = guard;
  });
  useEffect(() => {
    if (!ref) return;
    ref.current = (to) => (latest.current ? latest.current(to) : true);
    return () => {
      ref.current = null;
    };
  }, [ref]);
};
