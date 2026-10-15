/**
 * Browser storage that belongs to ONE PERSON, cleared at sign-out (owner
 * decision D1, matrix M76): on a shared device the next person must see nothing
 * of the last one. Before this, A's sign-up form state pre-filled B's form
 * (e-mail, name, city), A's "Skip for now" hid B's Finish hop, and a stale
 * pending role could turn B's callback into a sign-up.
 *
 * The ONE caller is AuthProvider's signOut (hooks/useAuth), which every sign-out
 * control goes through; personScopedStorage.test.tsx greps src to keep it so.
 *
 * NOT here, on purpose: the Supabase session token (sb-*-auth-token: supabase-js
 * removes it itself), and device prefs / anonymous per-browser ids that are not
 * a person's (activeCitySlug, calendar view, search recents, geolocation,
 * tap-hint dismissal, raffle/viewer session ids, chunk-reload and RUM flags).
 *
 * Import-free on purpose: useAuth is on every page's first load, and a string
 * list is all it needs (the test pins these literals to the constants that
 * write them).
 */

export const PERSON_SCOPED_LOCAL_KEYS: readonly string[] = [
  'auth_form_state_v1', // contexts/AuthFormContext: e-mail, name, city, role, dance role
  'auth_last_email', // pages/Auth, components/auth/AuthStepper
  'pending_profile_role', // pages/Auth, pages/AuthCallback
  'profile_entry_role', // pages/Auth, components/auth/ProfileEntryFlow
  'auth_pending_return_to', // lib/authRouting AUTH_PENDING_RETURN_TO_KEY
  'profile_last_active_role', // pages/Profile, components/profile/VendorDashboard
  'auth_signup_draft_v1', // legacy sign-up draft (pages/Onboarding clears it)
  'profile_entry_flow', // components/auth/ProfileEntryFlow default storageKey
  'videographer_pre_auth', // pages/CreateVideographerProfile pre-auth draft
  'pending_level_rating', // lib/pendingLevelRating: a vote waiting for sign-in
];

export const PERSON_SCOPED_LOCAL_PREFIXES: readonly string[] = [
  'finish_profile_',
  'bc:organiser-edit-draft:', // organiser edit-in-place draft (edit-in-place/draftModel)
  'vendor_dashboard_draft_', // pages/VendorDashboardPage, per user id
  'dancer_app_linked_notice_dismissed:', // dancer app Home, per user id
];

export const PERSON_SCOPED_SESSION_KEYS: readonly string[] = [
  'dancer_app_entered', // dancer app Home: the once-per-session entered event
  'auth_code_step_v1', // components/MagicLinkConfirmation: the code step kept over a reload
];

export const PERSON_SCOPED_SESSION_PREFIXES: readonly string[] = [
  'finish_profile_', // lib/auth-otp-routing POST_LOGIN_PROMPT_KEY, SKIP_FINISH_PROFILE_KEY
];

const clearFrom = (get: () => Storage, keys: readonly string[], prefixes: readonly string[]) => {
  let store: Storage;
  try {
    store = get();
  } catch {
    return; // storage blocked (private mode): nothing was stored either
  }
  try {
    const doomed = new Set(keys);
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key && prefixes.some((p) => key.startsWith(p))) doomed.add(key);
    }
    for (const key of doomed) {
      try {
        store.removeItem(key);
      } catch {
        /* one key failing never stops the rest, or the sign-out */
      }
    }
  } catch {
    /* never break a sign-out over storage */
  }
};

/** Removes every person-scoped key from localStorage and sessionStorage. Never throws. */
export const clearPersonScopedStorage = (): void => {
  if (typeof window === 'undefined') return;
  clearFrom(() => window.localStorage, PERSON_SCOPED_LOCAL_KEYS, PERSON_SCOPED_LOCAL_PREFIXES);
  clearFrom(() => window.sessionStorage, PERSON_SCOPED_SESSION_KEYS, PERSON_SCOPED_SESSION_PREFIXES);
};
