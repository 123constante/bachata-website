# Brief: Dancer Rebuild W2e, Options (`/app/options`) -- PR B1a sub-branch

Repo `123constante/bachata-website` (PUBLIC). Model Sonnet 5.5. NEVER run `gh api` in this repo; read
other branches with `git fetch origin <branch>` + `git show FETCH_HEAD:<path>`. Read
`briefs/dancer-rebuild-COMMON.md`, `briefs/dancer-rebuild-INTERFACE.md` and `briefs/dancer-rebuild-W2-SHARED.md`
on `arc/briefs-dancer-rebuild` FIRST, then the plan change rows C1, C25 and Appendix A rows 7, 15.
BRANCH: `arc/dancer-app-w2e`, created FROM `claude/dancer-app-r1a` (SHA in the dispatch prompt). Push
only this branch. Do NOT open a PR. Siblings own their own `screens/` folders; W1's shared files are
FROZEN.

## Files you OWN
`src/modules/dancer-app/screens/options/**`, `tests/e2e/dancer-app/options.spec.ts`,
`docs/handover/dancer-rebuild-w2e.md`.

## The screen (mockup "9 Options": calm, no gradients)
Card 1 (buttons, 48px, full width):
- "Switch profile": shows the person's profile types from `other_roles` + dancer. In 1a the only other
  destination is the organiser area: "I run events" -> `/account/o` (only when `other_roles` includes
  `organising`; otherwise the row says "Organiser tools: not on your account" disabled WITH that reason).
  Teacher/DJ areas do not exist yet: list them as "coming soon" rows, disabled with the reason.
- "Share my page": copies `https://<site>/dancers/<slug-or-id>` with the Clipboard API, falls back to
  a selectable field; toast "Link copied". Uses the public URL helper the site already has for dancer
  pages (find it on `origin/main`; never build the URL by hand).
- "Send feedback: what's missing?": release 1a = the EXISTING WhatsApp "message us" link the site uses
  (find the helper/constant on `origin/main`); fires `feedback_sent` ONLY in 1b when the inbox exists
  (leave a TODO + test stub; 1a fires nothing).
- "Add to my phone's home screen": a sheet with iOS Safari and Android Chrome steps (text, no screenshots),
  detects the platform from the UA to show the right one first.
- "Help and message us": the same WhatsApp link.
- "Terms and privacy policy": links to the site's existing terms and privacy routes (find them in
  `catchallClientPaths.ts` / `siteIa.ts` on `origin/main`).
- "Sign out": confirm sheet; calls `accountSettings.signOut` from `src/lib/accountSettings.ts` (REUSE;
  never a new `supabase.auth.signOut`); on success navigate to `/`; on failure show the same failure copy
  today's `DancerHome` shows (read it on `origin/main`) with Retry.
Card 2: "Back to the Bachata Calendar website" -> `/`; "Browse all events" -> the city calendar.
Release 2 rows (privacy, pause, erase, download): NOT rendered in 1a. Instead ONE plain line: "Hide your
profile, download your data or delete your account: Account settings" linking to today's
`/account/settings` (release 1a keeps that screen for beta people; C24).
Header label stays "Dancer" (W1's shell).

## Tests (table-driven; red-first)
Shapes: pure dancer; dancer + organising; dancer + teaching; paused; sign-out success; sign-out failure;
clipboard available / unavailable; iOS / Android / desktop UA. Assert: every disabled row carries its
reason; no row points at a route that is not in `catchallClientPaths.ts` (import the list and check each
href); sign-out uses the shared helper (mock it and assert the call); the share URL equals the site's
helper output. Red-first: a mutant calling `supabase.auth.signOut` directly must red; a mutant with an
"I run events" row for a pure dancer must red.

## Gates
Unit (Node 22), lint, typecheck, `npm run build`, Playwright spec (or NOT RUN + reason), isolation
check, `npm run pre-ship`, every applicable workflow job. 390x844 screenshots of the screen and the two
sheets under `docs/handover/dancer-rebuild-w2e/`.

## Failures this brief exists to prevent
A second sign-out path; a link to a route that does not exist; a hand-built public URL; an enabled
control that cannot work; release-2 rows rendered as if they worked.

## Done means
Everything above + handover. Commit, push ONCE with `[worker-done <ticket>]`. Stop after the push.
