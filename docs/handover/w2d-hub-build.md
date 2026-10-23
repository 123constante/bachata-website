# Handover: W2-D person hub (option C), build + stage-5 critique

Branch `claude/w2d-hub-build`, PR #963. Built by ticket dt_aee601072cb9 (head a5f770f7); critiqued and fixed once by
ticket dt_35ff972ae82e (a different worker); step 2 (Back loop + owner wording) by ticket dt_ee031c530f23. Head SHA: the
commit carrying this file (subject ends `[worker-done dt_ee031c530f23]`). Design record: [`docs/design/w2d-hub-build.md`](../design/w2d-hub-build.md).
Critique: [`docs/design/w2d-hub-critique.md`](../design/w2d-hub-critique.md).

## Step 2 (ticket dt_ee031c530f23, 2026-10-23): Back loop FIXED, owner wording applied
- **Back loop: fixed.** Applied the person-page hunks of `docs/handover/w2d-hub-back-loop.patch`
  (`git apply --exclude='src/modules/dancer-app/*'`): `roleSwitchModel` asks `personDestination` whether
  `/people/<slug>` would show the hub; no hub = no role bar, the page keeps its own Back. Measured on prod ids at 390x844
  (`docs/mockups/w2d-hub-build/backloop.mjs`, `backloop-report.json`, `backloop-*.png`): `/dancers/unclaimed-00422bf9` ->
  no bar, its own "Back" -> `/dancers`; `/djs/bobby-blanco` -> no bar, "Back to DJs" -> `/djs`; no loop. Two-role
  `/djs/elias` and `/dancers/elias` keep the bar and "Back to Elias" lands on the hub `/people/elias`.
- Red first: the patch's roleSwitch tests on the unfixed `roleSwitch.ts`: 15 of 67 fail; after the fix 67/67.
- No file under `src/modules/dancer-app/` is touched: `check-dancer-area-isolation` says "not a dancer-area PR".
- **Expected red until `claude/oneback-no-hub-row` merges:** `src/modules/dancer-app/public-page/__tests__/oneBack.test.tsx`
  row 'one role' (4 cases, one per dancer shape) expects the bar this PR removes. Proved: with that PR's one-row change
  applied in the working tree only (never committed), oneBack is 52/52. **#963 merges after the oneBack PR.**
- **Owner wording 1 (count only from 2):** one gig reads "Next gig Friday 23 October"; 2+ keeps " &middot; N coming up"
  (N = total). `hub/model.ts`. Owner wording 2 (full weekday + month): the ONE shared label `wallDateLabel`
  (`wall/model.ts`) now reads "Friday 23 October" (London key, same rollover), so the wall chip and the hub change together.
  Table-driven `hub/__tests__/gigWording.test.ts` (0/1/2/5 gigs; this month, next month, next year): 8 red first, then green.
- **Late-data shift found and fixed:** at 360px the longer line wraps when " &middot; 2 coming up" arrives, so About moved
  22px. The DJ-lead hero line now reserves two rows (44px) while a gig line is expected (badge hint or gig list; a
  no-gig DJ keeps one row, from review), like the two-column Also lines: 0px at 360 and 390 on all 3 late shapes
  (`probe-report.json`). Tests added (red without the change).
- `/code-review` (one round, medium) on this step's diff: 7 findings. Fixed: the always-two-rows reservation (now only
  while a gig line is expected). Left, with reasons:
  - Wall chip wraps (owner call below).
  - The bar reads `badge.roles` (badges RPC) while `/people` redirects on `heldRoles` (person roles RPC), and the patch
    no longer counts `current`: if the two RPCs disagree for a person, a loop or a missing bar is still possible. The
    brief pins the patch ("apply it, do not redesign"); a follow-up should make both read one source. The test's hub
    predicate is likewise its own copy of the rule.
  - `nextGigOf` slices the UTC `event_start_time` as a London key: a gig 00:00-01:00 BST shows the previous day (now
    also the previous month on the 1st). Pre-existing; the brief says keep today's rollover. Worth a follow-up.
  - `home-map/venueNights.ts` `dateLabel` already makes "Friday 11 Sep" (short month, by its own wrap rule); the owner
    asked for the full month here, so the wall/hub keep their own label.


### NEW owner call: the wall date chip
"Friday 23 October" no longer fits on one row of the wall's date chip: on `/djs` the tiles are 79px wide at 360 and
86px at 390, so every chip wraps to 2 rows (30px instead of 14px) and covers the lower ~40% of the face
(`backloop-wall-djs-360.png`). Nothing overflows sideways. Options: (a) accept; (b) the chip keeps a short form while the
hub keeps the long one (two labels, breaks "change both together"); (c) move the date under the name. Not changed here.

## What the build did (dt_aee601072cb9)
- Hub option C behind `flags.personHub`: hero card for the main role (big "Open <role> page" button and what it opens),
  Also row for every other HELD role (closed Teacher = dashed card, not a link, "Teacher pages open soon"), About line.
- One-role and no-role people skip the hub: `/people/:id` 302s to the page their wall tile opens (`personDestination`, the
  ONE rule in `src/modules/person-page/badges.ts`).
- Fade into the orange footer on the hub route only (index.css `body:has([data-hub-footer-join])`); seam step 3/255.
- Lead role fixed on first paint from the loader's badges row; the DJ gig line keeps a reserved row.
- Bundled fix: a dead photo link on a wall tile / hub face falls back to initials (`wall/usePhotoFallback.ts`). It does not
  fix the Jxjx tile: that URL serves a real 23 KB JPEG of a "Page not found" screen (test account, owner's to clean up).

## What the critique pass changed (dt_35ff972ae82e)
- Late gig list no longer moves the page: in a two-column Also row each line reserves two rows. About moved 18px at 360 and
  390 before; 0 after (all three late-data shapes, gig read held back 2.5s, `docs/mockups/w2d-hub-build/probe.mjs`).
- The hero no longer shows the filler "Their dancer page" when a dancer-led person has no facts (3 of 6 shapes did).
- The hint wraps balanced (no lone "hi.").
- `…` / `·` escapes instead of raw Unicode in `hub/model.ts` and `PersonHub.tsx` (CLAUDE.md rule) + a test.
- Tests red first: 6 new hub cases failed on the unfixed code; now 1484/1484 in person-page + dancer-app (incl. a
  Teacher-led case and an ASCII-only guard added in review).
- Two `/code-review` rounds (stopping rule for user-facing changes); what was taken and left is in the critique doc.
- Screens retaken (`walk.mjs`) and looked at: header over ground = site chrome as on the wall; cards one step lighter than
  the ground with role-colour edges; ground into the footer a smooth fade, no line, no plain band.

## Owner calls (not in code)
1. **Back loop**: fixed in step 2 (above). 3 and 4 below: applied in step 2. NEW: the wall date chip (above).
2. **Language codes** (should): the hub shows "es, en" where the dancer page shows "Spanish, English". The one mapping
   (`languageNames`) lives in the dancer-app module and the isolation guard forbids importing it. Recommend moving it to
   `src/lib/` in a dancer-area PR, then the hub uses it.
3. "Next gig Fri 23 · 1 coming up" counts the next gig itself (wording from the approved mock): recommend the count only at 2+.
4. Gig date without a month ("Fri 23") is the wall's `wallDateLabel`: change both or neither (low priority).

## CI jobs run in the sandbox (this head, step 2)
| Job | Result |
|---|---|
| architecture-guard (integrity, legacy tables/RPCs, lint:architecture, check:images AUDIT_STRICT=1, image-widths + self-test, plan-hygiene, mojibake + self-test, workflow-artifact-policy + self-test, prove:entry-point + self-test) | pass |
| lint (`npm run lint`, 20 links) | pass (after a local `chmod +x bin/*.sh`, as CI does; not committed) |
| typecheck (check:rpc-typing, check:wallclock-brand) | pass |
| unit-tests London (`npm run test:unit`) | 21 fail: 4 = oneBack 'one role' (**expected until `claude/oneback-no-hub-row` merges**; 52/52 with that row change in the working tree); 16 = the same sandbox-only set as before (live contract suites without prod secrets, `integrityCouldNotRun`, `datesCard.consistency`); 1 = `festivalClientState` under full-suite load (8/8 alone, untouched code) |
| dancer-area-isolation | pass ("not a dancer-area PR: rule c only") |
| perf-budget (bundle-budget, first-load-requests, chunk-cycles + self-tests, build) | pass |
| perf-budget doc-weight | could not run here: needs the Vercel preview URL (CI only) |
| e2e-smoke (`npm run test:e2e`, CI env) | 158 passed, 7 skipped, 0 failed |
| phone-qa-section, real-data-verified | need the PR body below |

## Verified
- Prod-shaped data: all 6 hub shapes and 4 redirect shapes on real prod ids (anon reads), 360/390/430; no clipped text,
  no sideways scroll, lowest contrast 6.41, taps >= 44, seam 3.
- Back: one-role dancer and DJ pages have no bar and no loop; two-role pages keep the bar and Back lands on the hub.
- Late-data shift 0px at 360 and 390 (3 late shapes) with the longer gig line.
- Wording: one gig = no count; 2+ = " &middot; N coming up"; "Friday 23 October" on the hub and the wall (seen).

## Not verified
- Real photos: the sandbox gets 403 from the media host, so every face seen is initials.
- A real phone; the Vercel build of this branch; desktop beyond the CSS rule.
- Live contract suites and doc-weight (CI secrets / preview URL).
- The bar/redirect role-source disagreement (review finding) was not measured on prod.

## Ready-to-paste PR body
```
## Summary
- W2-D person hub, option C, behind flags.personHub: hero card for the main role, Also row, About line. One-role and
  no-role people skip the hub (/people/:id 302s to their role page). Footer fade on the hub route only. Dead photo link -> initials.
- Stage-5 critique (separate worker): late gig line no longer moves the page (18px -> 0), no filler hero line, balanced hint,
  Unicode escapes. Full list: docs/design/w2d-hub-critique.md.
- Step 2: Back loop FIXED. A role page shows the role bar only when /people/<slug> would show the hub
  (personDestination); a one-role person's page keeps its own Back, so Back never loops. Person-page files only.
- Owner wording: gig count only from 2; gig date "Friday 23 October" (full weekday + month) on the hub and the wall
  (one shared label). DJ-lead hero line reserves two rows while a gig line is expected, so the late count moves nothing.
- Merge order: #963 merges AFTER the claude/oneback-no-hub-row PR (it drops oneBack's one-role row, which this PR
  makes red: 4 cases, expected until then).
- Owner call: on the wall the long date wraps the chip to two rows over the lower ~40% of the face (see
  docs/handover/w2d-hub-build.md).

## Verified on real data
- Shapes surveyed (read-only, counts): 166 active; teacher-only 62, dancer+teacher 36, dancer+DJ+teacher 25 (11 with a gig),
  dancer-only 23-26, dancer+DJ 10 (3 with a gig), DJ-only 4, DJ+teacher 1, no role 5; 47 of 83 dancer rows have no photo.
- Checks run (matrix tests, every CI job step, browser walk at 390x844): roleSwitch matrix (15 red first), gigWording
  table (0/1/2/5 gigs, this/next month; 8 red first), hub tests; every CI job step in the sandbox (see
  docs/handover/w2d-hub-build.md); walk at 360x844, 390x844 and 430x844 on prod ids; Back walk (backloop.mjs); late-data probe.
- NOT verified (be honest): real photos (media host blocked, initials only), a real phone, the Vercel build, live contract
  suites; the badges-vs-person-roles source disagreement (review finding, pinned patch) not measured.

## Phone QA
- Sizes checked: 360x844, 390x844, 430x844
- Walked: 6 hub shapes + 4 redirects on prod ids (walk.mjs), Back from one-role and two-role role pages (backloop.mjs),
  late gig list (probe.mjs), /djs wall date chips, e2e smoke suite
- Not verified: real phone, real photos (media host 403 in the sandbox), Vercel preview
```

## Next steps
1. Merge the `claude/oneback-no-hub-row` PR first, then #963 (paste the PR body above).
2. Owner: the wall date chip (accept the two-row chip, or pick a short form for the wall only).
3. Follow-ups (not here): one role source for the bar and the /people redirect; London-key the gig date from the instant;
   language names ("es, en") in a dancer-area PR.
4. Owner phone test after merge + deploy.
