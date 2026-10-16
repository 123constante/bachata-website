# RED-src: the new tests run against the unfixed code (base 2abac36)

Run 1: every new or changed test file, before any change to src.
`npx vitest run src/lib/__tests__/personScopedStorage.test.tsx src/lib/__tests__/accountSidesRouting.test.ts src/modules/admin-organisers/__tests__/inviteJoiningAs.test.tsx src/modules/dancer-app/screens/onboarding/__tests__/onboardingEnds.test.tsx src/pages/__tests__/DancerInviteSelfClaim.test.tsx src/pages/__tests__/AuthCodeStep.test.tsx`

```
 ✓ src/pages/__tests__/DancerInviteSelfClaim.test.tsx  (3 tests) 89ms
 FAIL  src/lib/__tests__/personScopedStorage.test.tsx [ src/lib/__tests__/personScopedStorage.test.tsx ]
Error: Failed to resolve import "@/lib/personScopedStorage" from "src/lib/__tests__/personScopedStorage.test.tsx". Does the file exist?
⎯⎯⎯⎯⎯⎯ Failed Tests 17 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/lib/__tests__/accountSidesRouting.test.ts > 'signed in, no dancer profile, not adm…' > sign-in with no returnTo: straight to the one side, or the chooser
AssertionError: expected '/' to deeply equal '/app/welcome'
 FAIL  src/lib/__tests__/accountSidesRouting.test.ts > 'signed in, no dancer profile, not adm…' > sign-in as an account whose metadata says organiser still gets the chooser (sign-in, not sign-up)
AssertionError: expected '/' to deeply equal '/app/welcome'
 FAIL  src/lib/__tests__/accountSidesRouting.test.ts > 'signed in, no dancer profile, not adm…' > sign-up as a dancer
AssertionError: expected '/' to deeply equal '/app/welcome'
 FAIL  src/lib/__tests__/accountSidesRouting.test.ts > loading and failed reads > no side at all: waits for the admin read; a failed admin read keeps the site home (M44)
AssertionError: expected { kind: 'go', to: '/' } to deeply equal { kind: 'wait' }
 FAIL  src/pages/__tests__/AuthCodeStep.test.tsx > the code step survives a reload for 10 minutes > reload within 10 minutes: still on the code box, same e-mail
TestingLibraryElementError: Unable to find an element with the text: Check your email. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
 FAIL  src/pages/__tests__/AuthCodeStep.test.tsx > 5 wrong codes: the box stops accepting and offers "Send a new code" > locks after the fifth wrong code; a sixth is never sent; a new code unlocks
AssertionError: expected false to be true // Object.is equality
 FAIL  src/pages/__tests__/AuthCodeStep.test.tsx > 5 wrong codes: the box stops accepting and offers "Send a new code" > the lock survives a reload
TestingLibraryElementError: Unable to find an element with the text: Check your email. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
 FAIL  src/modules/admin-organisers/__tests__/inviteJoiningAs.test.tsx > the invite card names who is joining, before the link is used > dancer first name
 FAIL  src/modules/admin-organisers/__tests__/inviteJoiningAs.test.tsx > the invite card names who is joining, before the link is used > display name when no first name
 FAIL  src/modules/admin-organisers/__tests__/inviteJoiningAs.test.tsx > the invite card names who is joining, before the link is used > the e-mail when no name at all
 FAIL  src/modules/admin-organisers/__tests__/inviteJoiningAs.test.tsx > the invite card names who is joining, before the link is used > the e-mail when the row cannot be read
TestingLibraryElementError: Unable to find an element by: [data-testid="invite-joining-as"]
 FAIL  src/modules/admin-organisers/__tests__/inviteJoiningAs.test.tsx > the invite card names who is joining, before the link is used > Join uses the link once and lands on the organiser home (the bearer joins)
TestingLibraryElementError: Unable to find an element by: [data-testid="invite-join"]
 FAIL  src/modules/admin-organisers/__tests__/inviteJoiningAs.test.tsx > the invite card names who is joining, before the link is used > "Not you? Sign out": shared sign-out, then this invite's sign-in; the link is not used
TestingLibraryElementError: Unable to find an element by: [data-testid="invite-not-you"]
 FAIL  src/modules/admin-organisers/__tests__/inviteJoiningAs.test.tsx > the invite card names who is joining, before the link is used > a failed sign-out stays on the card and says so
TestingLibraryElementError: Unable to find an element by: [data-testid="invite-not-you"]
 FAIL  src/modules/dancer-app/screens/onboarding/__tests__/onboardingEnds.test.tsx > every end of onboarding replaces /app/welcome (Back never re-opens "You're in") > "You're in" -> Go to Home
AssertionError: expected [ [ '/app/home', { replace: false } ] ] to deeply equal [ [ '/app/home', { replace: true } ] ]
 FAIL  src/modules/dancer-app/screens/onboarding/__tests__/onboardingEnds.test.tsx > every end of onboarding replaces /app/welcome (Back never re-opens "You're in") > "Nice work" -> Go to Home
AssertionError: expected [ [ '/app/home', { replace: false } ] ] to deeply equal [ [ '/app/home', { replace: true } ] ]
 FAIL  src/modules/dancer-app/screens/onboarding/__tests__/onboardingEnds.test.tsx > every end of onboarding replaces /app/welcome (Back never re-opens "You're in") > "You're in" with an onward returnTo (the organiser link) -> Next: set up your organiser page
AssertionError: expected [ Array(1) ] to deeply equal [ [ '/account/o', { replace: true } ] ]
 Test Files  5 failed | 1 passed (6)
      Tests  17 failed | 119 passed (136)
```

Run 2 (M76/D1): Vite resolves even a dynamic import of a missing module when it
transforms the file, so run 1 failed the whole file as it loaded. To get red at
the assertion level, `src/lib/personScopedStorage.ts` was added as a NO-OP stub
(empty key lists, `clearPersonScopedStorage = () => {}`) that is NOT yet called
from useAuth. That is the unfixed behaviour. Then the file was run again:

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/lib/__tests__/personScopedStorage.test.tsx > clearPersonScopedStorage (the one key list) > removes every person-scoped key and prefix, keeps the supabase token and device prefs
AssertionError: expected [ 'auth_form_state_v1', …(1) ] to deeply equal [ 'auth_form_state_v1', null ]
 FAIL  src/lib/__tests__/personScopedStorage.test.tsx > clearPersonScopedStorage (the one key list) > the key list names the constants the code writes under
AssertionError: expected [] to include 'auth_pending_return_to'
 FAIL  src/lib/__tests__/personScopedStorage.test.tsx > AuthProvider.signOut is the choke point > signed-out: every person-scoped key is gone
 FAIL  src/lib/__tests__/personScopedStorage.test.tsx > AuthProvider.signOut is the choke point > signed-out-locally: every person-scoped key is gone
AssertionError: expected [ 'auth_form_state_v1', …(1) ] to deeply equal [ 'auth_form_state_v1', null ]
 FAIL  src/lib/__tests__/personScopedStorage.test.tsx > AuthProvider.signOut is the choke point > A signs out, B opens /auth: the form shows nothing of A
AssertionError: expected '{"email":"a@example.com","firstName":…' to contain '"email":""'
 Test Files  1 failed (1)
      Tests  5 failed | 2 passed (7)
```

Tests that passed against the unfixed code on purpose (they pin behaviour that already worked):
- M76 guard "auth.signOut( appears only in hooks/useAuth.tsx" and "storage that
  throws never breaks a sign-out" already passed at base: every sign-out control
  already goes through useAuth().signOut.
- M70 `DancerInviteSelfClaim.test.tsx` (3 tests): the callback already
  self-claims on mode=signup and on mode=signin. Pinned.
- M71 (in `onboardingEnds.test.tsx`): a dancer at 70% who opens /app/welcome
  already gets the "You're in" end card with "Go to Home" and no required card.
  A dancer at 100% is already sent straight to the end with replace:true (the
  `start === 'done'` path). Pinned. The red part was M10/M24: both end buttons
  navigated with `replace: false`.
- D7 "four wrong codes still accept a fifth try", "after 10 minutes", "another
  step" and "Use a different email" are negative cases, so they pass at base too.
