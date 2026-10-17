/**
 * One vocabulary for the two auth actions on every surface (audit M12): the
 * /auth tabs, the event sign-in prompt and the level-rating sheet all say these
 * words, never "Log In" / "Sign Up". A leaf module (no imports), so the lazy
 * sheets that read it add no request to the event page.
 */
export const AUTH_ACTION_LABELS = { signin: 'Sign in', signup: 'Create account' } as const;

/**
 * A 44px close button for a dialog built on the shared ui/dialog primitive,
 * which draws a 16px one (audit M11). Applied from the dialog's own className,
 * so ui/dialog.tsx -- and the calendar's DayDetailModal -- are untouched.
 */
export const DIALOG_CLOSE_44 =
  '[&>button:last-child]:right-1 [&>button:last-child]:top-1 [&>button:last-child]:flex [&>button:last-child]:h-[44px] [&>button:last-child]:w-[44px] [&>button:last-child]:items-center [&>button:last-child]:justify-center';
