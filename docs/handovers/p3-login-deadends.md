# Handover: login dead-ends F1 + F2

**Done**
- F1: invite Done screen (`admin-organisers/join/JoinScreens.tsx`, `JoinPage.tsx`, `joinCopy.ts`). Flag ON unchanged (`/account/o`). Flag OFF (`flags.organiserSelfServe`): "You're on <page>'s team", body says the organiser tools are not open yet, one button to `/`. The preview carries no organiser id, so the public `/organisers/:id` page is not linkable here; home chosen.
- F2: retired `/create-organiser-profile`, `/create-videographer-profile`, `/listing-request` removed from `auth-otp-routing.ts` (flag-off landing is `/` for every role), `AuthCallback`, `Onboarding`, `ProfileEntryFlow`, `ProfileEntryRouter`, `VendorDashboard`, `OrganiserDashboard` (-> `/`), and the Get-listed CTAs (`GetListedHoloCta`, `Organisers.tsx` Join -> `/account/new` flag on, `/auth` flag off). Three ratchet entries removed from `navigateTargetsRoutable.test.ts`.
- Test: `src/lib/__tests__/loginDeadEnds.table.test.tsx` (role x flag x signup, CTA files, Done screen). Red on unfixed code (12 failures incl. `/create-organiser-profile has no route`), green now.

**Left / not done**
- Remaining KNOWN_UNROUTABLE entries are in unrouted dashboards/pages (not reachable) and other retired paths (`/profile`, `/create-dancers-profile`, `/partners`...), outside the six named; left on the ratchet.
- No 390x844 screenshot walk (no harness run).
