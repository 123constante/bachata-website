# Session handover: 2026-10-11, dancer home (Website)

Branch: `feat/dancer-home` (one push). PR: opened from this branch; its number is in the PR list and in the session's final message.

## Done (all in the branch)

1. **Dancer home** on `/account` (`src/pages/Account.tsx`, `src/components/account/DancerHome.tsx`). It shows the profile card, one completeness line, Finish your profile, My attendance, Browse parties, a collapsed "I organise events" section (the unchanged `OnboardingView`, lazy-loaded) and Sign out. Organisers, and people with an open access request, are redirected to `/account/o` with no change there.
2. **One routing mapping:** `src/lib/accountRouting.ts`. The header icon opens `/account`, and `accountHome()` decides from there. See `docs/dancer-home.md`.
3. **Finish to rate:** the flow test passes. It ALSO passes on unfixed main, so that flow already worked. The Finish screen now invalidates the dancer summary.
4. **Dead links:** every `/profile` link or navigate in `src` now points to `/account`, or to `/` for the flag-off sign-in landing. `/onboarding` had none left. The route guard now also scans `to=`, `href=` and `backHref=`, and bans `/profile` and `/onboarding` outright.
5. **Background seam** on `/finish-profile` fixed: the cause was an opaque `min-h-[70vh] bg-background` wrapper. The browser spec fails on main and passes here.
6. **My attendance** is routed at `/account/attendance`, with AuthGuard. A past night links to the event page's own rating card. The card is not embedded in the list, because embedding it would add one first-load chunk on `/event/:id`.

## Open

- **Review:** two rounds run (the stopping rule for user-facing changes). The round-2 fixes are UNREVIEWED code: the acted-here redirect rule, the offline summary, the single no-profile sentence, the allow-listed legacy keys, the role label, no wait on requests, and the key constant.
- **Declined review findings:** (a) DancerHome has its own sign-out rather than sharing SignOutLine's logic; (b) Account declares its own queries rather than reusing `useOrganiserHome`. Both would mean editing organiser files the brief keeps unchanged. The keys and fetchers are shared imports.
- **Gap:** organisers and requesters cannot reach My attendance or their dancer profile from the account icon. A link has to be added on the organiser Home or Profile page. Another session owns that area.
- **Dead links found, out of scope** (now ratchet entries): `/partners` (PartnersMarquee), `/create-organiser-profile` (GetListedHoloCta), `/privacy` (RaffleEntryDialog, on the event page), `/listing-request` (Organisers).
- **Not run here:** the `db-contract-check` live-DB jobs (they need secrets) and `test:unit` (full, live DB). `bin/check-integrity.sh` is mode 100644 in git, so the local lint chain reports exit 126. CI chmods it first, and running it with bash passes.

## Next

1. The owner (or the orchestrator) reads the PR and phone-tests it with a real dancer account: sign in, tap the account icon, Finish your profile, then rate a past night.
2. Add a "My attendance" / "Your dancer profile" link to the organiser area, in the organiser PR.
3. Fix the four out-of-scope dead links and delete their ratchet entries.
