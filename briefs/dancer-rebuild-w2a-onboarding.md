# Brief: Dancer Rebuild W2a, onboarding (`/app/welcome`) -- PR B1a sub-branch

Repo `123constante/bachata-website` (PUBLIC: no secret or email in any commit). Model Sonnet 5.5.
NEVER run `gh api` in this repo; read other branches with `git fetch origin <branch>` +
`git show FETCH_HEAD:<path>`. Read `briefs/dancer-rebuild-COMMON.md`, `briefs/dancer-rebuild-INTERFACE.md`
(sections 3 and 5) and `briefs/dancer-rebuild-W2-SHARED.md` (the wave-2 rules + mockup spec) on
`arc/briefs-dancer-rebuild` FIRST, then the plan sections 1 (decision 5, 6), 4.2, 7.3 and Appendix A
rows 4, 5. BRANCH: `arc/dancer-app-w2a`, created FROM `claude/dancer-app-r1a` (the B1a PR branch tip
that carries W1 + R0; the orchestrator names the SHA in the dispatch prompt). Push only this branch.
Do NOT open a PR. Four sibling screen workers run in parallel (W2b home+nights, W2c me+edit, W2d photo,
W2e options); each owns ONLY its `screens/<name>/` folder. Shared files (shell, gate, api, theme, seams)
belong to W1 and are FROZEN: a needed change goes into your handover's "INTERFACE deviations" and the
orchestrator applies it once.

## Files you OWN
`src/modules/dancer-app/screens/onboarding/**` (screen, steps, tests), `tests/e2e/dancer-app/onboarding.spec.ts`
(Playwright at 390x844 against the dev server with the fake backend / `page.route` on the RPC URL),
`docs/handover/dancer-rebuild-w2a.md`.

## The screen (mockup "2 Onboarding"; one question per card; strength meter at the top; bold gradient
## cards; the "You're in" card uses the plum-to-coral gradient)
Driven by `strength.missing` from `my_dancer_edit_v1` (decision 5: ask ONLY what is missing; a sign-up
from today's wizard already has first name, city and role, so it lands on the photo step; an admin-made
person starts at their first missing step). Order and copy:
1. "What's your name?" First name (required) + "Name shown on your page" (display name, optional,
   1-40). Shown only when `first_name` is missing.
2. "Where do you dance?" The REAL `CityPicker` the site already uses (319 cities; London 64, Madrid 22),
   never four chips, and no copy that says "London only". Shown only when `city` is missing.
3. "How do you dance?" Leader / Follower / Both as big chips. Only when `role` is missing.
4. "Add your photo" with the head-and-shoulders guide and two buttons "Take photo" / "Choose from my
   photos"; it HANDS OFF to W2d's photo screen (`/app/me/photo?return=/app/welcome`) and comes back with
   the photo saved. Cannot be skipped. Only when `photo` is missing.
5. "You're in, <first name>" at exactly 70% (the server's `strength.pct`; the client never computes it):
   "Your page is live and Going and Interested are unlocked" (NOT "Save": the site has no Save). Buttons
   "Boost to 100%" and "Go to Home".
6. Optional "How long have you been dancing?" (Just started / 1 to 3 years / 3 to 6 years / More than 6
   years mapped to a `dance_started_year`; the mapping lives in ONE helper with a test) with Skip.
7. Optional "Which styles do you love?" multi-chips (the style vocabulary the public page already renders
   for `favorite_styles`; reuse its list, never a new copy) with Skip.
8. "Nice work" -> Home.
Every step saves through `saveMyDancerProfile(delta)` with ONLY the keys of that step (diff-first: a step
with nothing changed sends nothing). Resume mid-way: reopening `/app/welcome` recomputes the first missing
step from the server. Continue is disabled WITH the reason until the step's required value exists. Per-code
error copy from `api/errors.ts` (`first_name_required`, `city_required`, `invalid_display_name`, `area_closed`,
`rate_limited`, network). Progress meter = `strength.pct` after each save (10 / 25 / 40 / 55 / 70 / 80 / 90 /
100 are the mockup's illustrations; the server value wins).
Consent line (C23b): the FIRST onboarding card shows "By continuing you accept the Terms and Privacy
policy" with the two links; release 1a does NOT call `accept_terms_v1` (that RPC ships in PR A2); leave a
`// TODO(1b): accept_terms_v1` with the test stub.
Funnel events: `onboarding_step` ({step}) on each card shown, `profile_strength_70` once when the server
reports >= 70 for the first time; through W1's `trackDancerEvent`.
Linked-profile notice (D1): if `linked_from_admin` is true, the first card carries a small line "We linked
your existing profile. Not you? Message us." (link = the existing WhatsApp message-us link the site uses).

## Tests (table-driven; red-first for bug-shaped ones)
Rows = plan section-3 shapes from W1's `fakeBackend` fixtures: empty stub (starts at step 1), name+city
only (starts at 3), name+city+role photoless (starts at 4), four-field complete (lands on "You're in"),
complete + extras (no onboarding: redirect to `/app/home`), admin-made linked (notice line), claimed-but-
incomplete admin profile. For each: first card shown, Continue disabled-with-reason, the delta sent per step
(assert exact keys), the meter value after each save, resume after reload, every error code's copy, 200%
text and long names wrap, 44px targets. Red-first: a mutant that sends `first_name` on the city step must
red a test; a mutant computing 70 client-side must red the "server pct wins" test.

## Gates
Unit (Node 22), lint, typecheck, `npm run build`, the Playwright spec (or NOT RUN + reason), R0's
`node scripts/check-dancer-area-isolation.mjs`, `npm run pre-ship`, every applicable workflow job.
390x844 screenshots of every step on at least three shapes, saved under `docs/handover/dancer-rebuild-w2a/`.

## Failures this brief exists to prevent
A step that can be skipped when it is required; a city step with hard-coded cities; "Save" in copy;
client-side strength maths; a save that re-sends untouched keys; a screen that renders before the server
shape is known (show the skeleton).

## Done means
Everything above + handover (decisions, INTERFACE deviations, shapes, red-first quotes, CI table,
screenshots, Verified / Not verified). Commit, push ONCE with `[worker-done <ticket>]`. Stop after the push.
