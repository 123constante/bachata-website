

## Fix: Navigation Buttons Freeze After Sign-Out

### Root Cause

When you sign out, Supabase fires the `SIGNED_OUT` event through `onAuthStateChange`. The current `useAuth` hook sets `isLoading(false)` inside that callback (line 32), which triggers a cascade of re-renders across the entire app tree. Combined with `AnimatePresence mode="wait"` in the router (which blocks new page renders until exit animations finish), these rapid re-renders restart the animation cycle, making navigation appear completely frozen until a manual page refresh.

### Solution

One change to `src/hooks/useAuth.tsx`:

- `onAuthStateChange` will update `session` and `user` only -- it will NOT touch `isLoading`
- `isLoading` will only be set to `false` once, after the initial `getSession()` call resolves
- An `isMounted` guard prevents state updates after unmount

```text
Current (problematic):
  onAuthStateChange --> setSession, setUser, setIsLoading(false)  // fires on every auth event
  getSession        --> setSession, setUser, setIsLoading(false)

Fixed:
  onAuthStateChange --> setSession, setUser                       // no isLoading touch
  getSession        --> setSession, setUser, setIsLoading(false)  // one-time initial load
```

This ensures that sign-out (and sign-in) auth events update the user/session cleanly without causing `isLoading` flip-flops that restart page transitions.

### Why This Fixes the Problem

- Sign-out fires one `onAuthStateChange` event setting `user` to `null` -- no `isLoading` change, no animation restart
- The app re-renders once (to reflect logged-out state), AnimatePresence completes normally
- Navigation works immediately without needing a page refresh

