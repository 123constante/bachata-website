# Handover: W2-C build slice 1 &mdash; Back row + role switcher + DJ page (behind flags.personHub)

Ticket dt_9d0660a4fbb9. Branch `claude/w2c-build` off `main` at 3a21361. Brief:
`brief/w2c-role-pages:docs/briefs/W2C-build-brief.md`. Design Gate: [`docs/design/w2c-build.md`](../design/w2c-build.md).

## Fix pass (ticket dt_f255fcd10ccb, 2026-10-22) &mdash; read this first

Brief: `brief/w2c-role-pages:docs/briefs/W2C-fix-brief.md`. Base head 72f9b0c. Details and numbers:
[`docs/design/w2c-build.md`](../design/w2c-build.md#fix-pass-ticket-dt_f255fcd10ccb-2026-10-22).

### What changed

1. **Crash on 21 of 40 real DJs fixed for the class.** `get_public_dj_v1.faq` is an array (`[]`), the page called
   `.trim()` on it. Now every field the flag-ON page reads goes through ONE boundary, `djRoleFields(row)`
   (`src/components/dj/djRoleModel.ts`): text fields via `djText` (string &rarr; trimmed or null; string array &rarr; lines;
   else null), link/code/photo fields via `djFirst` (first non-blank string; an array of links is never joined into
   one href). Gig name/location/time are normalised in `gigRows`/`gigWhen` (blank name &rarr; "Event"). The flag-ON
   branch of `DJProfile` now returns before today's raw reads (`firstPhoto`, `splitInstagramWebsite`), which assume
   strings. `DjRolePage` calls no string method on its props. Flag OFF: same JSX (lines only moved below the flag-ON return).
2. **Colour seam fixed.** Cause: the page's bottom fade landed on `GlobalLayout`'s `default` graphite `#0E1215`.
   New `wall` page ground (`#1E1410` = `WALL.page`, pinned by test) used by the flag-ON DJ page and its skeleton;
   `<body>` is painted warm. Before: ground above the footer rgb(14,18,21); after: rgb(30,20,16), same as mid-page.
   `GlobalLayout`'s `gradientPalette` prop is now typed off `GroundPalette` (no second hand-kept list).
3. **Tests (red first):** `src/components/dj/__tests__/djRoleShapes.test.tsx`, 150+ cases: `djText` x 11 shapes;
   whole-page render through `DJProfile` with faq / pricing / bio in {null, missing, [], '', '  ', text, [strings],
   [{x:1}], 5, {}, true} asserting it renders and that the card shows only with text; 9 more fields (links, city,
   nationality, photo, gallery) x 11 shapes render; all-odd row; link arrays; the `wall` ground. Against the unfixed
   code: 71 failed, incl. `TypeError: p.faq?.trim is not a function` x18 (the prod error), `p.pricing?.trim`,
   `p.bio?.trim`, `website?.trim`, `raw?.trim`, `city?.trim`; the two ground tests failed without the `wall` ground.
   `GlobalLayout.grounds.test.tsx` gains the `wall` row.
4. **Pictures retaken on the REAL app** (react-router dev server, `GlobalLayout` + site header/footer, local mock
   Supabase serving the prod shapes, 390x844), looked at one by one: `docs/design/w2c-build/` dj-many, dj-none-ig,
   dj-none-noig, dj-pricing, dj-long, seam-before-dj-many; numbers in `walk.json`. First build's DJ harness pictures removed.
5. **/code-review x2 (high).** Round 1 (10 findings): fixed link-array join, doc staleness, `kicker` signature, gig-name
   fallback + spacing, `DJRow.faq` comment. Round 2 (10, last round per the stopping rule): fixed CRLF-only snapshot
   churn (not committed), JSDoc placement, `gradientPalette` typed off `GroundPalette`. Fixes to round 2 are unreviewed code.
   Declined, with reasons: see Owner calls 1-4; hex copy in `pageGrounds` (layout must not import a module's tokens;
   pinned by test); nested-array gallery element (no such shape on prod).

### Owner calls (new)

1. **Hub seam:** `/people/:id` (PersonHub, merged in #947) uses the same `WALL_FADE` on the graphite default, so it
   has the same cool band above the footer. One prop (`gradientPalette="wall"`) fixes it; not done here (outside this
   brief's DJ page). Say if you want it in this PR.
2. **Flag-OFF / embedded DJ page prints an empty FAQ card** for the 21 DJs whose faq is `[]` (today's latent
   oddity; also the DJ tab inside `/people/:id`, which uses today's page). Left byte-for-byte unchanged per brief.
3. Flag-ON DJ **error / not-found** state still uses today's near-black `dj` ground (a warm skeleton then a dark
   error page). Cosmetic, rare.
4. `DJRow.faq` stays typed `string | null` (today's page reads it that way); the flag-ON page never reads `dj.*` raw.

### CI, every applicable job step run in the sandbox (final tree)

| Job (workflow) | Command | Exit | Note |
|---|---|---|---|
| typecheck | `npm run check:rpc-typing`; `npm run check:wallclock-brand` | 0; 0 | re-run on final tree |
| unit-tests | `npm run test:unit:offline` | 1 | 12283 passed, 6 failed: 5 `tests/integrityCouldNotRun.test.ts` (sandbox precondition "typescript resolved in the temp repo", also red in the first build's run, no file of ours) + 1 `tests/client/festivalClientState.test.tsx` (passes alone: full-suite timing). Changed-area suites on final tree: 1513/1513 |
| unit-tests | `check-dancer-area-isolation --self-test`; `npm run check:dancer-area-isolation` | 0; 0 | "not a dancer-area PR: rule c only, OK" (needs a fresh `origin/main`) |
| architecture-guard | `bash bin/check-integrity.sh`, `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture`, `AUDIT_STRICT=1 check:images`, `check:image-widths` (+self-test), `check:plan-hygiene:self-test`, `check:mojibake:self-test`, `check:workflow-artifact-policy` (+self-test), `prove:entry-point` (+self-test) | all 0 | |
| perf-budget | 3 self-tests, `npm run build`, `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | all 0 | re-run on final tree |
| perf-budget | `npm run check:doc-weight` | 1 | cannot run here: needs `GITHUB_REPOSITORY` + a live preview (CI-only) |
| e2e-smoke | `npm run test:e2e` | 1 | 156 passed, 7 skipped, 2 failed (21 s timeouts: `dancer-app/home-nights.spec.ts:75`, `dancer-home.spec.ts:169`, dancer pages, no file of ours); both PASS re-run alone (one re-run) |
| phone-qa | `npx playwright test --config playwright.phone.config.ts` | 0 | 272 passed, 74 skipped |
| phone-qa (build) | `npx playwright test --config playwright.build.config.ts` | 0 | 67 passed (rebuilds the tree) |
| workflow-lint | `lint-workflow-masking`, `lint-workflow-notification`, `check-no-preview-prefixes` | 0 | |
| ci-budget-guard | `node scripts/check-ci-budget.mjs` | 2 | infra: `CI_BUDGET_GITHUB_TOKEN` not set here |
| lint chain | `npm run lint` | 1 | 19/20: `check:integrity` exit 126 (script not executable in this checkout; `bash bin/check-integrity.sh` exit 0), as in the first build |
| real-data-verified / phone-qa-section | the two PR-body scripts on the body below | 0; 0 | |

### Verified / Not verified

- Verified: the full real-shape matrix above (unit); real-app walk of 5 DJ shapes at 390x844 (pictures looked at):
  no "Something went wrong", no page errors, no empty FAQ/Pricing card, scrollWidth 390, ground warm to the footer.
- **Not verified:** on prod data itself (Supabase connector not authorised here; prod shapes taken from the
  orchestrator's 2026-10-22 survey and served by a local mock); no Vercel preview walk (one push); the role bar on a
  DJ-only person and on dj+teacher (the mock had no dancer row for them, so they show the fallback "Back to DJs";
  on prod the DJ id is a `dancer_profiles` id, so the bar should resolve); the hub seam (owner call 1); real phone.

### Ready-to-paste PR body (orchestrator updates the PR)

````markdown
## Summary
W2-C slice 1 behind `flags.personHub` (default OFF): Back row + role switcher (N-A pills), DJ page D-C on the warm hub ground.
Fix pass (dt_f255fcd10ccb): the flag-ON DJ page crashed ("Something went wrong") on 21 of 40 real DJs because `get_public_dj_v1.faq` is an array (`[]`); every field the page reads now goes through ONE boundary (`djRoleFields`: `djText` for text, `djFirst` for links/photos), and the page ground is warm to the footer (new `wall` page ground; before, the bottom fade landed on the graphite default).

## Scope
Flag ON only. Flag OFF: `DJProfile` returns the same JSX as before; `AlsoRoles` renders the old Also row. Files: `src/components/dj/{DjRolePage.tsx,djRoleModel.ts}`, `src/pages/DJProfile.tsx`, `src/components/layout/{pageGrounds.ts,GlobalLayout.tsx}`, person-page switcher files, tests, docs.

## Verified on real data
- Shapes surveyed: (read-only, counts) orchestrator survey 2026-10-22, 40 DJs: faq array 21 (all `[]`) / null 19; pricing string 1 / null 39; dates 0:17, 1-3:19, 4+:4; roles dancer+dj 10, dancer+dj+teacher 25, dj 4, dj+teacher 1.
- Checks run: `djRoleShapes.test.tsx` renders the whole page with faq / pricing / bio in 11 shapes (null, missing, [], '', '  ', text, [strings], [{x:1}], 5, {}, true) and 9 more fields x 11 shapes; red on the unfixed code with the prod error (`p.faq?.trim is not a function`), green now. Every applicable CI step run locally (table in docs/handover/w2c-build.md). Real-app walk (dev server + GlobalLayout, mock Supabase serving the prod shapes) of 5 DJ shapes at 390x844: no crash, no empty FAQ/Pricing card, scrollWidth 390, ground rgb(30,20,16) down to the footer (was rgb(14,18,21)).
- NOT verified: against prod itself (Supabase connector not authorised in the worker; shapes served by a local mock); no Vercel preview walk; the role bar for DJ-only and dj+teacher people (mock had no dancer row, so they showed the "Back to DJs" fallback); the /people/:id hub's own seam (same cause, not changed here); a real phone.

## Phone QA
- Sizes checked: 390x844 (real app, dev server, html font-size as on phones)
- Walked: /djs/:id flag ON for a DJ with 13 dates (faq []), no dates with Instagram (DJ only), no dates without Instagram, pricing string with 2 dates, long name with 4 dates; pictures in docs/design/w2c-build/ looked at one by one; e2e smoke and phone suites run locally.
- Not verified: 360x640; a real phone; the Vercel preview; the hub page seam.

## Owner calls
1. Hub `/people/:id` has the same cool band above the footer (one prop fixes it) &mdash; include here?
2. Flag-OFF / embedded DJ tab still prints an empty FAQ card for faq `[]` (left byte-for-byte per brief).
3. Flag-ON DJ error state still uses today's near-black ground.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01Tj8ehahgCAo91bf1Uw3DXE
````

---


# First build (dt_9d0660a4fbb9)

## Done

- **N-A bar** (`src/modules/person-page/roleSwitch.ts` pure model, `RoleSwitchBar.tsx` view + hook wrapper):
  "Back to &lt;name&gt;" (44 px, ellipsis) to `/people/:slug`, then one pill per role page that exists, current
  filled in its `CHIP` colour, others with a `CHIP` dot. Roles/labels/links from `roleTagsFor` (the ONE mapping
  the wall and hub read); colours from `wall/tokens.ts`. One role = back row only. Hidden until the person read
  answers, and hidden when the hub would 404.
- **Old "Also:" row replaced only with the flag ON**: `AlsoRoles` returns the switcher when `flags.personHub`,
  else the old row (body unchanged). So the **dancer page gets the bar with NO dancer file edited**
  (`DancerProfile.tsx` / `PublicDancerPageV2` untouched; isolation check: rule c, OK). The bar bleeds to the
  page edge and fades in (12 px) and out (24 px) onto the teal ground: measured seam step 2/255.
- **DJ page D-C** (`src/components/dj/DjRolePage.tsx`, model `djRoleModel.ts`): rendered by `DJProfile` only when
  `flags.personHub && !embedded`. Turntable extracted from `DjHero` as `DjTurntable` (188 there, 152 here; same DOM).
  Name 36/30/26 px by length, wraps, no clip. Dates first (max 3 + "See N more dates" expands in place), About,
  Photos (all of them, 3-column), Listen &amp; book, then Pricing / FAQ when present, Share at the foot. Gig times are
  read exactly as stored (naive "local-as-UTC", the DjTiles rule; never Intl-converted). Before the dates read
  answers: a placeholder; if it fails: "Dates could not load"; never a false "No dates". Flag-ON loading skeleton
  paints the warm ground. Shared helpers moved to `djFormat.ts` (`parseDateParts`, `normalizeUrl`, new
  `instagramUrl` for bare handles, used on the new page only; today's contact panel is unchanged).
- Tests: `roleSwitch.test.tsx` (67) and `djRolePage.test.tsx` (45), red on main (modules missing), green here.
- Two `/code-review` rounds (high): round 1 (10 findings) and round 2 (10) fixed or listed below; fixes to round 2
  are unreviewed code.

## Left / owner calls

1. **Two Backs on the dancer page** with the flag ON: the warm bar's "Back to &lt;name&gt;" and the dancer page's own
   "Back" (to /dancers). Removing the dancer page's own Back is a dancer-area file: left for the dancer-area PR
   (mock `P-after-*` already drops it).
2. **DJ sections not on the D-C mock** are not on the flag-ON page: genres EQ, "Played at" (past gigs, no route to
   them on the flag-ON page), SoundCloud/Mixcloud embedded players (links stay), contact panel (phone is not
   exposed by the RPC yet; when it is, the flag-ON page needs a phone slot; Instagram/website/SoundCloud/Mixcloud/Facebook are in Listen &amp;
   book), guestbook stub. Pricing and FAQ are kept as plain cards. Owner: keep any of the dropped ones?
3. **Sub-name** (real name under the DJ name, as in the mock) is NOT shown: the DJ RPC's first/surname are not
   privacy-masked; the masked name comes from the person read. Could be added from that read.
4. Back-label name = the person's (masked) real name from the person read, as the brief says; the hub's h1 for a
   DJ-led person is the stage name, so the label and the hub heading can differ ("Back to Roger Mart&iacute;nez" &rarr;
   hub titled "DJ Roger").
5. **Requests**: the bar needs the person's name, so each flag-ON role page also runs the person read
   (`loadPersonSnapshot`: dancer row, roles RPC, DJ read shared with the page's cache, teacher read only while
   teacher pages are open) plus the badges RPC. A narrow name+roles read would be cheaper; flag OFF = no change.
6. **Back control changes once on the DJ page**: "Back to DJs" (fallback, to /djs) until the reads answer, then the
   bar ("Back to &lt;name&gt;" + pills, about 50 px taller). Other pages show nothing until then (like today's Also row).
7. Initials on a photo-less DJ read "DN" for "DJ Nadia" (today's `initials()`); the mock showed "N".

## Verified / Not verified

- Verified (final tree): e2e smoke `npm run test:e2e` 158 passed / 7 skipped, exit 0; unit suite 12166 passed,
  16 failed = the same 15 that fail on untouched main in this sandbox (live-DB contract suites +
  `integrityCouldNotRun`) + 1 `auth.today` snapshot that passes 3/3 alone (full-suite timing; no auth file touched), lint chain 19/20 (`check:integrity` exit 126 = script not
  executable in this checkout; `bash bin/check-integrity.sh` ok, 0 issues), `npm run build`, perf budgets,
  first-load requests, chunk cycles, `AUDIT_STRICT=1 check:images`, isolation check + self-test, typecheck job
  steps. Six screenshots at 390x844 looked at.
- **Not verified on prod data**: the sandbox's Supabase env is a non-prod project, the Supabase MCP connector is not
  authorised here, and the live site is blocked by the sandbox proxy, so no prod shape survey ran. The non-prod
  project has 4 DJs (all with no dates/photo/bio): useless as a survey. Pictures use the mock's fixtures in a
  harness, not the deployed app; no Vercel preview walk (one push only).

## Next steps

1. Owner phone test on the Vercel preview with `VITE_ENABLE_PERSON_HUB=true` (preview env), on a DJ with &ge;4 dates,
   a DJ with none, a dancer-only person and a DJ+dancer.
2. Prod shape survey (needs the Supabase connector): count DJs by upcoming-dates bucket (0 / 1&ndash;3 / 4+), name
   length bucket, Instagram present, role combos from `get_public_people_badges_v1`.
3. Dancer-area PR (P pick) removes the dancer page's own Back under the flag.
