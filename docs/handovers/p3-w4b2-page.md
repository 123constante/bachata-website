# Handover: P3 W4b build 2, slices 2+3 (page screens, Review, Live, Home banner, Settings) - PARTIAL

Branch `claude/p3-w4b2-page` (from `main` at `84a97e2`). Brief: `docs/briefs/p3-w4b2-page.md` on `brief/p3-w4b2-page`.
Design record: [`docs/design/onboarding-prototype.md`](../design/onboarding-prototype.md). Flag `organiserP3` stays OFF. No migration, no `supabase/**`.
Stopped at the owner's cloud context gate (30%). The CODE and its tests are done; the CI-job sweep, bundle-budget run, `/code-review` and the PR are NOT done (below).

## Done

- **Route** `/account/p3/start[?o=<page>][&at=<step>]` (`P3_PATHS.start`), lazy, full screen, outside `P3Shell`: `OnboardingFlow.tsx`.
  Welcome -> (no page) Find / claim sheet / ask to join, or Create name -> city -> `create_organiser_profile_v1` -> contact ... logo -> slice 1's
  `PersonScreens` (REUSED, not rewritten) -> Review -> Live. `at` opens a step directly (Review rows, Home banner).
- **Progress (S6 fixed)**: `pageModel.fullPath` + `flowPercent` = the FULL path (find group if no page, contact group, WhatsApp if a usable
  number, cat, link, logo, every person step, Review). `PersonScreens` got two optional props (`percentOf`, `lastLabel`); its defaults are unchanged,
  so `/you/details` behaves as before. aria-valuenow = the % shown; Review = 100; About < 100.
- **Screens 1-9** on build 1's RPCs + existing writers: claim/ask/create (`selfServeApi`), `confirm_organiser_contact_v1` (one-tap Yes, or a new
  E.164 phone; UK `07...` -> `+44`), WhatsApp = `socials.whatsapp` wa.me link (whole-object socials patch keeps the other keys), category / link
  (by shape: @handle or instagram.com -> instagram, facebook.com -> socials.facebook, else website; `fieldRules` checks) / logo
  (`uploadToR2('avatars')`) via `organiser_profile_update_p5_v1`. Diff-first everywhere: an untouched screen sends nothing.
- **Review** from `organiser_onboarding_status_v1(p_organiser_id)`: person.missing + this page's missing; "N things left", the next row,
  Show all sheet. Every one of the 18 codes `_onboarding_missing_v1` returns has a row (unknown future codes still show).
- **Go live**: `complete_organiser_onboarding_v1` is deployed in admin #1119 (merged 2026-10-29); intentionally not wired in this PR, `deployed: false` until the go-live slice. `pageApi.GoLiveApi` + the stub
  `GO_LIVE_NOT_DEPLOYED` (`deployed: false`): a draft page with nothing left sees Go live DISABLED with "Going live opens soon. Everything you
  added is saved." Never a fake "You're live". A live page (all 49 on prod) sees "All done" / Go to Home. Live screen + confetti (off under
  reduced motion) is reachable only with a deployed implementation (tested with a fake).
- **Home grace banner** (`screens/GraceBanner.tsx`, in P3 Home): shown while not complete, never to admins, "Hide for today" per device (London
  day); no grace end date (none on the server). Its pure rules live in `graceModel.ts` (no imports) so Home's chunk stays small; the
  **Settings sheet** (`SettingsSheet.tsx`: dark mode -> `p3-ob-theme`, page name rename diff-first, sign out) is lazy-loaded from Home and
  also opens from Welcome's "Not you?".
- **Tests**: `pageModel.matrix.test.ts` (126) + `pageScreens.matrix.test.tsx` (44) + slice 1's suites: 269/269 in
  `p3/onboarding/__tests__`. E2E `tests/e2e/walk-p3-w4b2-page.spec.ts` (added to `test:e2e` by name): filled / empty / no-page personas x
  390x844, 360x640, 320x568 x 100% / 130% text, no scroll on every screen incl. Review, tap targets >= 44, claim / Review / Settings sheets
  and the toast in the viewport: **19/19 with both flags on** (skips with P3 off, like slice 1's walk).

## Data source (read-only on prod, pg_get_functiondef, 2026-10-29)

| Screen | Reads | Writes |
|---|---|---|
| find | `organiser_profiles` live ilike + `organiser_claim_hints_v1` | `claim_organiser_v1` / `request_organiser_access_v1` |
| create | `search_cities` | `create_organiser_profile_v1` (name, city) |
| contact | `get_organiser_contact_settings_v1` (contact_phone), status (contact_confirm) | `confirm_organiser_contact_v1` -> `organiser_onboarding_progress.contact_confirmed_at` (+ phone via update_p5) |
| WhatsApp, cat, link, logo | `organiser_profiles` public select | `organiser_profile_update_p5_v1` (`socials` / `organisation_category` / `instagram`, `website`, `socials.facebook` / `avatar_url`) |
| Review, banner | `organiser_onboarding_status_v1` | - |
| Settings | - | `organiser_profile_update_p5_v1 {name}` |

Shape survey (counts only): 49 pages, all live; phone E.164 40 / legacy 5 / none 4; WhatsApp set 0; category null 2; no link 2 (IG 47, web 27,
FB 24); logo null 1; city null 0; bio null 48. 61 memberships / 12 users (1 user on 2+ pages); progress rows 0; gate flag off; complete
members 0; missing codes: teach_answer 60, dj_answer 59, contact_confirm 56, languages 7, nationality 6, instagram 6, dance_role 2, org_link 2,
and 1 each of city, org_category, org_logo, first_name, teach_years, photo, dj_genres, teach_levels.

## Decisions taken here (say if wrong)

1. **"Use an email instead" (5c) NOT built**: `organiser_profile_update_p5_v1` refuses `contact_email` for non-admins
   (`contact_email_admin_only`). Replaced by a "No public number" link on the phone screen (confirms the contact with no phone, skips WhatsApp).
2. **Codes with no screen in this flow** (person `city`, `instagram`, `dj_answer`, `dj_genres`) open the dancer profile editor
   (`finishProfileHref`, returnTo = Review); `org_city` opens `/account/p3/you/page`. 59 of 61 members miss `dj_answer`, so nearly everyone
   leaves the flow once for it: a DJ screen (prototype assumption 6) is the obvious next slice.
3. Claim with an unproven mailbox shows the refusal + "Confirm with an email code" -> build 1's `/account/p3/you/add` (full code proof), not a
   second copy of the email-code sheet.
4. The Settings dark switch themes the onboarding screens (`p3-ob-theme`) only, not P3Shell (which follows the OS).
5. A held UK `07...` number (legacy) counts as usable for WhatsApp (converted to +44).

## Left / next (continuation worker)

1. Run every CI job step locally (read `.github/workflows`; incl. `check:images` AUDIT_STRICT=1, `npm run lint`, `check:bundle-budget`
   on main AND branch with both flags off and on; never edit `perf-budgets.json` / `vite.config.ts`). tsc: 117 errors total, NONE in changed
   files; compare against main's count.
2. `/code-review` before the PR (Ricky types it), then open the PR with the template, the "Verified on real data" block (survey above),
   the per-job CI table and the design-record link. Push WITHOUT `[skip preview]` on the final push.
3. Entry link: only the Home banner (and `?at=`) leads in; consider a row on the You hub. N3 (`?o=` not checked against the person's pages)
   still open: the flow trusts `?o=`; reads/writes are server-gated (not_found / permission_denied).

## Verified / Not verified

**Verified:** prod function bodies and shapes (read-only, counts only); 269 unit/matrix tests; the no-scroll walk 19/19 in Chromium with
prod-shaped fakes at 390x844 / 360x640 / 320x568 x 100% / 130%, both flags on.
**Not verified:** the CI job sweep, bundle budget, eslint; real saves on prod (no writes allowed); a real iPhone / Android keyboard; dark mode
in the walk; the Live screen in a browser (unreachable until go-live ships); Vercel preview; review.
