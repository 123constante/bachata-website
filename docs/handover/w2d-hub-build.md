# Handover: W2-D person hub (option C), build + stage-5 critique

Branch `claude/w2d-hub-build`, PR #963. Built by ticket dt_aee601072cb9 (head a5f770f7); critiqued and fixed once by
ticket dt_35ff972ae82e (a different worker). Head SHA: the commit carrying this file (subject ends
`[worker-done dt_35ff972ae82e]`). Design record: [`docs/design/w2d-hub-build.md`](../design/w2d-hub-build.md).
Critique: [`docs/design/w2d-hub-critique.md`](../design/w2d-hub-critique.md).

## READ FIRST: one blocker is NOT fixed in this PR (owner call)
On a one-role person's dancer or DJ page the role bar's "Back to <name>" goes to `/people/<slug>`, which this PR now 302s
straight back to the same page: **Back loops** (measured on prod ids: `/dancers/unclaimed-00422bf9` and `/djs/bobby-blanco`).
About 29 active people (dancer-only and DJ-only). Prod has `flags.personHub` ON, so merging this PR alone ships the loop.
- Fix is ready: `docs/handover/w2d-hub-back-loop.patch` (`roleSwitchModel` asks `personDestination` whether there is a hub;
  no hub = no bar, the page keeps its own Back). Tests in the patch were red on the unfixed code (15 table cases).
- It is not applied because it must change one line in `src/modules/dancer-app/public-page/__tests__/oneBack.test.tsx`,
  which makes this a "dancer-area PR" for `check-dancer-area-isolation`; rule (a) then fails on 14 person-page files.
  Adding a seam is an orchestrator decision.
- Recommendation: orchestrator allows it (seam `src/modules/person-page/roleSwitch.ts`, or exempt `__tests__` files from
  the dancer-area trigger), then `git apply docs/handover/w2d-hub-back-loop.patch` on this branch before merge.

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
1. **Back loop** (blocker): above.
2. **Language codes** (should): the hub shows "es, en" where the dancer page shows "Spanish, English". The one mapping
   (`languageNames`) lives in the dancer-app module and the isolation guard forbids importing it. Recommend moving it to
   `src/lib/` in a dancer-area PR, then the hub uses it.
3. "Next gig Fri 23 · 1 coming up" counts the next gig itself (wording from the approved mock): recommend the count only at 2+.
4. Gig date without a month ("Fri 23") is the wall's `wallDateLabel`: change both or neither (low priority).

## CI jobs run in the sandbox (this head)
| Job | Result |
|---|---|
| architecture-guard (integrity, legacy tables/RPCs, lint:architecture, check:images AUDIT_STRICT=1, image-widths, plan-hygiene, mojibake, workflow-artifact-policy, prove:entry-point) | pass |
| lint (`npm run lint`, 20 links) | pass (after a local `chmod +x bin/*.sh`, as CI does; not committed) |
| typecheck | 100 errors = builder's count, below baseline 106; none in files this pass touched |
| unit-tests London (`npm run test:unit`) | 16 fail, all sandbox-only: live contract suites (sandbox has no prod secrets), `integrityCouldNotRun`, `datesCard.consistency` (both also fail on base a48ccd3). Same 16 as the build |
| dancer-area-isolation | pass ("not a dancer-area PR: rule c only") |
| perf-budget (bundle-budget, first-load-requests, chunk-cycles + self-tests, build) | pass |
| perf-budget doc-weight | could not run here: needs the Vercel preview URL (CI only) |
| e2e-smoke (`npm run test:e2e`) | 155 passed, 7 skipped, 3 failed under full-suite load (organiser-layout:171, organiser-legacy-redirects:27, organiser-onboarding:143: organiser code, not touched here); all 3 pass on a re-run alone |
| phone-qa-section, real-data-verified | need the PR body below |

## Verified
- Prod-shaped data: all 6 hub shapes and 4 redirect shapes on real prod ids (anon reads), 360/390/430.
- Late-data shift 0px; seam 3; lowest contrast 6.41; taps >= 44; no clipped text; no sideways scroll.
- Redirects land on the role page with the hub not in history.

## Not verified
- Real photos: the sandbox gets 403 from the media host, so every face seen is initials.
- A real phone; the Vercel build of this branch; desktop beyond the CSS rule.
- Live contract suites and doc-weight (CI secrets / preview URL).

## Ready-to-paste PR body
```
## Summary
- W2-D person hub, option C, behind flags.personHub: hero card for the main role, Also row, About line. One-role and
  no-role people skip the hub (/people/:id 302s to their role page). Footer fade on the hub route only. Dead photo link -> initials.
- Stage-5 critique (separate worker): late gig line no longer moves the page (18px -> 0), no filler hero line, balanced hint,
  Unicode escapes. Full list: docs/design/w2d-hub-critique.md.
- BLOCKER NOT FIXED HERE: Back on a one-role person's dancer/DJ page loops (/people 302s back). Patch ready:
  docs/handover/w2d-hub-back-loop.patch; needs an orchestrator call on check-dancer-area-isolation. Do not merge without it.

## Verified on real data
- Shapes surveyed (read-only, counts): 166 active; teacher-only 62, dancer+teacher 36, dancer+DJ+teacher 25 (11 with a gig),
  dancer-only 23-26, dancer+DJ 10 (3 with a gig), DJ-only 4, DJ+teacher 1, no role 5; 47 of 83 dancer rows have no photo.
- Checks run (matrix tests, every CI job step, browser walk at 390x844): destinationMatrix + hub tests (red first), every
  CI job step in the sandbox (see docs/handover/w2d-hub-build.md), walk at 360x844, 390x844 and 430x844 on prod ids, late-data probe.
- NOT verified (be honest): real photos (media host blocked, initials only), a real phone, the Vercel build, live contract
  suites; the Back loop is measured and NOT fixed in this PR.

## Phone QA
- Sizes checked: 360x844, 390x844, 430x844
- Walked: 6 hub shapes + 4 redirects on prod ids (walk.mjs), Back from one-role role pages and late gig list (probe.mjs), e2e smoke suite
- Not verified: real phone, real photos (media host 403 in the sandbox), Vercel preview
```

## Next steps
1. Orchestrator: decide the isolation question, then apply the Back-loop patch on this branch.
2. Check PR #963 checks on GitHub; paste the PR body above.
3. Owner phone test after merge + deploy.
