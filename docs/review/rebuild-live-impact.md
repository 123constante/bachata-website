# Rebuild PRs: live impact with today's production flags

Read-only audit, 2026-10-30. Main at `1dc1660` (holds #1162). PR heads fetched with
plain git (`refs/pull/N/head`). Production flags assumed: `organiserP3` OFF,
`organiserTicketing` OFF, `organiserSelfServe` ON.

Citations: `main:` is the current main, `#NNNN:` is that PR's head.

## Verdict in one table

| Rank | PR | Live with flags as today? | What a real visitor sees change |
|---|---|---|---|
| 1 | #1163 bare /auth -> sign-in | **YES, unflagged** | Every bare `/auth` URL now opens **Sign in** instead of **Sign up**; header/chrome shows on bare `/auth` (no longer focus mode) |
| 2 | #1164 invite -> Welcome | **YES** (gated only on `organiserSelfServe`, which is ON) | Invite "Done" button goes to `/account/o/welcome?o=<id>` instead of `/account/o` |
| 3 | #1162 (on main) | Practically no | Label-only; the P3 branch needs a P3 returnTo; trailing-slash normalisation only |
| 4 | #1165 retire /account/tickets | **No** | `/account/tickets/*` is NotFound before and after (route mounts only with ticketing + P3 + self-serve) |

**Merge first: #1163.** It is the only PR that changes unflagged behaviour on the
most-visited auth URL, and it also carries the fix for the one link that minted a
bare `/auth` meaning "sign up" (the team invite share). Merging anything that adds
another bare-`/auth` producer before it would reproduce the old ambiguity. #1164
and #1165 do not depend on #1163 or each other (no shared source files); #1165 is
safe to merge in any order. All three branches are based on `a1d0fa6` and are
**behind main by #1162**; none touches #1162's files (`src/lib/accountRouting.ts`,
`perf-budgets.json`, `newOrganiserLanding.test.ts`), so expect a clean rebase, but CI
must re-run on the rebased head (perf budgets moved in #1162).

## #1163 &mdash; bare /auth defaults to sign-in (LIVE, no flag)

Mechanism: `main:src/pages/Auth.tsx:120` `mode = searchParams.get("mode") || "signup"`
becomes `#1163:src/pages/Auth.tsx:123` `authModeFromSearch(searchParams)`, defined at
`#1163:src/lib/focusMode.ts:31` (only exact `mode=signup` is sign-up; absent, empty,
junk or other-case values are sign-in). Focus-mode chrome follows the same rule:
`main:src/lib/focusMode.ts:33` (bare `/auth` = focus) -> `#1163:src/lib/focusMode.ts:42`.

(a) Signed-out visitor
- `/auth` (bare, or `?mode=` anything but `signup`, e.g. `?mode=SignUp`, `?mode=login`):
  **was** the 3-step "Join the community" sign-up in focus mode (no site header);
  **now** "Welcome back" sign-in with the normal chrome and a "Continue browsing"
  action. A brand-new person who types an unknown email is not dead-ended: the 422
  path auto-switches to sign-up with the email kept (`main:src/pages/Auth.tsx:349`,
  unchanged). Cost: one extra round-trip and a "no account" notice for new people
  who arrive on a bare link.
- `/auth?mode=signup`: **unchanged**.

(b) Signed-in dancer and (c) signed-in organiser with a page, on any `/auth` URL:
**unchanged** &mdash; the signed-in redirect to `returnTo` runs before either form
renders and does not read `mode` (`main:src/pages/Auth.tsx:140`).

(d) Invite links: `/invite/...` and the join flow do not route through bare `/auth`;
unchanged.

Link trace (who produces a bare or non-standard `/auth`, main today):

| Producer | URL | Effect of #1163 |
|---|---|---|
| Team invite share, `main:src/modules/organiser/edit-in-place/teamPickerModel.ts:218` (used by `team/AddSomeone.tsx:84`, `edit-in-place/TeamSheet.tsx:155`; live, self-serve ON) | `${origin}/auth` meaning **sign up** | Fixed in the PR to `buildSignInHref(null,'signup')` (`#1163:...teamPickerModel.ts:219`). **Already-sent** shares (WhatsApp etc.) still say bare `/auth` and will now open sign-in; recipients recover via the unknown-email auto-switch. |
| `SIGN_IN_PATH = '/auth'`, `main:src/modules/areas/shared/paths.ts:15`, used by the "You are signed out / Sign in" action (`areas/shared/BlockedState.tsx:14`) on Your areas, teacher and DJ pages | bare `/auth` meaning **sign in** | Today this button wrongly opens sign-up; #1163 makes it correct. No returnTo is carried (pre-existing gap, not this PR). |
| `buildSignInHref` (`main:src/lib/authRouting.ts:35`), `AuthPromptModal` (`:37`), `attendanceAuth.ts:60`, `homeAnnounceBanner.ts:8`, `ProfileEntryRouter.tsx:72`, `AuthCallback.tsx:161,468` | always explicit `mode=signin` / `mode=signup` | Unchanged. |
| `public/robots.txt:76` | `Disallow: /auth` | n/a. |
| Admin-repo emails / edge functions | not in this repo | **Not verified** &mdash; if any email or admin screen links to bare `/auth` expecting sign-up, it flips. Check `bachata-admin-11april` before merge. |

## #1164 &mdash; accepted invite lands on Welcome (LIVE, self-serve ON)

`main:src/modules/admin-organisers/join/JoinScreens.tsx:170` links Done to
`ORG_PATHS.home` (`/account/o`). `#1164:.../JoinScreens.tsx:168` links to
`acceptedInviteLanding(id, flags)` (`src/modules/organiser/p3/shell/paths.ts:51`),
which with P3 OFF returns `ORG_PATHS.welcome(id)` = `/account/o/welcome?o=<id>`.
The id comes from the redeem result (`#1164:.../JoinPage.tsx:96,219,237`) or a
unique name match on the person's own pages (`:128`); with no id it stays
`/account/o`. The Welcome route exists on main and is mounted under self-serve
(`src/modules/organiser/shell/OrganiserRoutes.tsx:100`), so this is live the moment
#1164 merges.

(d) Someone opening an invite link, today's flags:
- New seat: Done -> Welcome "You manage X" + first-event offer -> Home on that page.
  Intended. Welcome also `rememberChoice`s the page, so a multi-page person's Home
  now opens on the newly joined page (behaviour change, arguably desired).
- **Already a member reopening a used link** (`JoinPage.tsx:84`: redeem answers
  `already_member` and is shown as Done): `organiserId` is set regardless of
  `alreadyMember`, so they too land on Welcome, which its own header says is for
  "only a NEW seat" (`src/modules/organiser/switch/Welcome.tsx:8`). They see a
  "welcome" for a page they already manage. Low severity, live; worth a one-line
  fix (pass null when `alreadyMember`) before merge.
- Button copy stays "Open your organiser home" while it now opens Welcome, not Home
  (`JOIN_COPY.done.button`, pinned by the PR's own test). Welcome is a step toward
  Home, so not a dead pointer, but the label is no longer literal.
- Self-serve OFF: unchanged (`/`).

(a)-(c) unaffected. Prod shape: 10 organiser invites, 6 redeem attempts recorded
(read-only count) &mdash; low traffic, so the blast radius is small either way.

## #1165 &mdash; retire old /account/tickets screens (NOT live)

Route: `main:src/components/AnimatedRoutes.tsx:272` mounts `/account/tickets/*`
only when `organiserTicketing && organiserSelfServe`; `#1165` mounts the new
`LegacyTicketsRedirect` only when `organiserTicketing && organiserP3 && organiserSelfServe`.
Ticketing is OFF, so today **and** after merge the path falls to the client
NotFound (`src/components/catchallClientPaths.ts` keeps it in the catch-all list).

(e) Old `/account/tickets` URL or Stripe return URL: NotFound before and after.
When flags later flip, `legacyTicketsTarget` (`#1165:src/modules/organiser/tickets/legacyRedirect.ts`)
sends `?o=&stripe=return|refresh` to P3 Get paid with the same params, and
`/events/:id` to the P3 event page. **Trap for the flag flip:** turning on
`organiserTicketing` without `organiserP3` makes old URLs NotFound (today they
would render the old screens). Prod has 2 `organiser_stripe_accounts` rows and 2
`ticket_types` (read-only counts), so a small number of real Stripe return links
minted by the old screens may exist.

Copy: `PAYMENTS_WHERE` ("Connect payments in You &rsaquo; Get paid&hellip;") now lives in
`ticketModel.ts` and replaces "on your Tickets home" for every caller. All callers
(`p3/tickets/*`) render only behind `flags.organiserTicketing`
(`p3/screens/EventPage.tsx:221`, `HomeScreen.tsx:111,152`, `P3Routes.tsx:51`,
`shell/youTickets.tsx:11`), so no visitor sees it today.

## #1162 (already on main)

`src/lib/accountRouting.ts` `onboardingEndLabel`: adds trailing-slash normalisation
and a `P3_START_PATH` label branch. The P3 branch only triggers when the onboarding
returnTo is the P3 start path, which only P3 (OFF) mints. Live effect: an end path
with a trailing slash (`/app/home/`) now says "Go to Home" instead of "Continue".
Negligible.

## Not verified

- Admin-repo emails/screens linking to bare `/auth` (out of this repo).
- No browser walk at 390x844 was run (read-only audit); conclusions are from code
  and the PRs' own tests.
- The 2 Stripe accounts were counted, not inspected (no personal data read), so
  whether they are test accounts is unknown.
