# People arc S6 -- dancer world without the socials filler -- handover

- Branch: `claude/people-dancer-no-socials` (from `main` f4d9a69). Brief: `briefs/PEOPLE-S6-dancer-socials-removal-brief.md`
  on `brief/people-arc` (sha 9eef7fa8). Head: the last commit on the branch (`git log -1 origin/claude/people-dancer-no-socials`);
  this file is in that commit. PR: opened by the repo bot (bot-pr.yml) on the push; see the worker's final report.
- Design record: [`docs/design/people-s6-dancer-no-socials.md`](../../design/people-s6-dancer-no-socials.md).
- Lane: normal. No SQL, no migration, no RPC.

## Turning it on for a preview

`node scripts/preview-deploy.mjs --flag VITE_ENABLE_PERSON_WORLDS=true` (add `--flag VITE_ENABLE_TEACHER_DETAIL=true`
to see teacher previews: teacher pages closed = `snapshot.roles` drops teacher, so no teacher preview and no reserve).

## Files

| File | What |
|---|---|
| `src/modules/person-page/worlds/dancer/model.ts` | `lowerHalf(previews)` -> `{ heading: 'Coming up', items }` or null; socials code and copy deleted |
| `.../dancer/useDancerLower.ts` | `{ roles, half, reserve }`; no calendar read; paused/failed date read = settled |
| `.../dancer/DancerWorld.tsx` | `Lower`: previews, a 64px reserve, or nothing; `Socials`/`SkeletonWeek`/`PillLink` deleted |
| `.../dancer/DancerWorldPage.tsx` | `useDancerLower(id, slug)` (city no longer needed) |
| `.../dancer/__tests__/dancerWorld.matrix.test.tsx` | 8 shapes x 8 lower halves + signed-in rows + waiting states; `getCalendarEvents` never called; no filler text |
| `src/components/layout/GlobalLayout.tsx` (outside folder) | fitContent `<style>` as raw HTML: the served rule was `&gt;`-escaped, footer jumped on hydration |
| `src/components/layout/__tests__/GlobalLayout.fitContent.test.tsx` | `renderToString` pin for the above (red first) |
| `src/modules/person-page/__tests__/sharedWorldRules.test.ts` (outside folder) | D12 is the DJ world's only; the dancer model must carry no party button |
| `src/modules/person-page/facts/index.ts` (outside folder) | `FIND_A_PARTY` comment no longer names the dancer world |
| `src/components/dj/__tests__/djPageFonts.test.tsx` (outside folder) | fixture follows the new `DancerLower` type |
| `docs/people-arc/s6/walk.mjs`, `checks-*.json`, `shots/` | browser walk on prod data, before (main) / after / teacher-open |

## Shapes (prod `stsdtacfauprzrdebmzg`, read-only, counts, 2026-10-24)

174 live dancer rows (`get_public_person_roles_v1` + `get_profile_event_timeline_v2`, upcoming = not started):
dancer only 36 (27 photo, 30 city); teacher 98 (35 dated, 16 past only, 47 none); DJ 14 (5 dated, 2 past, 7 none);
teacher + DJ 26 (14 with a dated world, 12 none). Photo x city x other-role: no photo/no city 5 + 47, photo/no city
1 + 8, no photo/city 4, photo/city 26 + 83. (The brief's "159 of 189 hold no other role" does not match the roles RPC
today: 36 of 174.)

| Shape | Profile | 390 | 360 |
|---|---|---|---|
| aitor-style thin page, teacher past only | `aitor-angelica-tbf` | ![](shots/after-thin-teacher-past-390.png) | ![](shots/after-thin-teacher-past-360.png) |
| dancer only, photo, city | `ben` | ![](shots/after-dancer-only-photo-city-390.png) | ![](shots/after-dancer-only-photo-city-360.png) |
| dancer only, no photo, no city | `pao-pao-army` | ![](shots/after-dancer-only-no-photo-no-city-390.png) | ![](shots/after-dancer-only-no-photo-no-city-360.png) |
| dancer only, photo, no city | `florian` | ![](shots/after-dancer-only-photo-no-city-390.png) | ![](shots/after-dancer-only-photo-no-city-360.png) |
| teacher, dated (teacher pages closed in this build) | `alex-boneva` | ![](shots/after-teacher-dated-390.png) | ![](shots/after-teacher-dated-360.png) |
| teacher, no dates | `alexa-bzuk26` | ![](shots/after-teacher-undated-390.png) | ![](shots/after-teacher-undated-360.png) |
| DJ dated | `bobby-blanco` | ![](shots/after-dj-dated-390.png) | ![](shots/after-dj-dated-360.png) |
| DJ no dates | `brito` | ![](shots/after-dj-undated-390.png) | ![](shots/after-dj-undated-360.png) |
| DJ past only | `kal` | ![](shots/after-dj-past-390.png) | ![](shots/after-dj-past-360.png) |
| teacher + DJ dated | `b` | ![](shots/after-both-dated-390.png) | ![](shots/after-both-dated-360.png) |
| teacher + DJ no dates | `john-otaran` | ![](shots/after-both-undated-390.png) | ![](shots/after-both-undated-360.png) |
| teacher past + DJ dated, no photo, no city | `nickchata` | ![](shots/after-both-dj-dated-no-photo-no-city-390.png) | ![](shots/after-both-dj-dated-no-photo-no-city-360.png) |

Every render: contrast >= 5.06, no tap under 44px, nothing clipped, no sideways scroll, invite last, no filler text.
Shift numbers before/after are in the design record.

## Not verified

- Signed-in renders in a browser (no test account): matrix only.
- Teacher previews on screenshots: walked with teacher pages open (`checks-teacher.json`, numbers only, no shots).
- On a Vercel preview: not deployed by this worker (push builds it; the orchestrator flips the flag).
- Stage 5 critique: separate worker.
- Unit suite: `test:unit` shows 15 failures that fail identically on `main` in this sandbox (live-DB contract tests
  against the session's non-prod Supabase env, and `integrityCouldNotRun` fixtures).

## S6 critique (Design Gate stage 5, separate worker, 2026-10-24)

Brief: `briefs/PEOPLE-S6-critique-brief.md` on `brief/people-arc` (sha 3bee9ba3). Record:
[`docs/design/people-s6-critique.md`](../../design/people-s6-critique.md).

### What changed

- **No code change.** Nothing that was a blocker or a "should" fit inside the owner decisions: the three findings that
  matter go to the owner (below). The PR's own code passed every check the brief lists.
- Walk re-run on the same build (`walk.mjs`, flag ON, prod data): the 24 shots in `shots/` are retaken (dates moved
  on since the builder's run) and looked at one by one; `checks-after.json` came out identical.
- Design record updated (re-measured prod counts; a Stage 5 section). The PR body below fixes the red
  `real-data-verified` check (its heading read "## Verified on real data (required)", which the check does not accept).

### Owner calls (recommendations)

1. **DJ / teacher holders' dancer pages shift 0.13-0.16** (DJ page 0.056, teacher world 0.005). 0.12 of it is the
   role-tab bar arriving after mount, with the 64 px reserve in the same frame; the reserve cannot be in the first
   paint because the roles are read client-side. Recommendation: dehydrate `get_public_person_roles_v1` in the
   `/dancers/:id` loader (one RPC; the `/people/:id` loader already runs it), so tabs + reserve are served. Do NOT hold
   the tabs row client-side today: 134 of 174 pages show no tabs (teacher pages closed) and would take the jump.
2. **The reserve has no heading room**: reserve -> preview still moves 22-45 px (0.005-0.017). Keep (owner's 64 px
   rule; heading room would grow the collapse on the 23 undated DJ holders, the majority).
3. **Website label shows the raw URL** ("www.instagram.com/ben_bachatero/?hl=en", wraps inside the query at 360) on 4
   of 12 walked shapes. Lives in `src/modules/dancer-app/public-page/model.ts:277`, shared with the flag-OFF page, so
   not fixable here. Recommendation: a separate PR (drop the query string; an instagram.com website files under
   Instagram).
4. Signed-in dancer-only with no contacts = the card alone (owner D8''). Keep.

### Seams seen on every retaken shot

Header (black, gold rule) -> teal ground: clean. Card on ground: lighter gradient + border, reads as a card. DJ preview
row (brown, bordered) on teal: the DJ world's colour, intended. Invite section on ground: a quiet step. Page -> amber
footer: the site-wide hard edge. Thin pages end with ~75 px of ground under the invite -- the page's bottom padding,
reads finished, not broken. No empty box or heading without an item on any shape.

### CI table (this pass, sandbox)

| Job / step | Result |
|---|---|
| `npm run build` (flag ON; teacher closed and open) | pass |
| `npm run typecheck` | 94 errors, baseline 106 (same count as the builder's head) |
| `npm run test:unit` | 13692 pass, 15 fail -- all sandbox-only (live-DB contract tests on a non-prod env, `integrityCouldNotRun`), same on main |
| `npm run lint` | 21/22; `check:integrity` exit 126 = the script is mode 644 here; `bash bin/check-integrity.sh` ok (0 issues) |
| `AUDIT_STRICT=1 npm run check:images` | pass (0 missing) |
| `check:mojibake`, `check:dancer-area-isolation` | pass |
| `test:e2e` | 72 fail / 13 pass when stopped: signed-in specs time out at 16 s in this sandbox; `header-signin-fit` + `dancer-home` on a `main` worktree: 20 fail / 1 pass, the same. No person-page spec in the list. CI is the judge. |
| `check-pr-real-data-verified`, `check-pr-phone-qa` on the body below | pass (locally, with `PR_BODY` / `PR_FILES`) |
| `check:doc-weight`, lighthouse, seo/og | CI only (need a preview) |

### Verified / Not verified

- Verified: prod counts (anon reads); every shot at 390 and 360; layout shift with sources on 7 pages x 2 widths;
  frame boxes on the three worlds; shell-guard mutation; the GlobalLayout pin red on main; the negative greps.
- Not verified: signed-in in a browser; a real phone; the Vercel preview; `test:e2e` green (sandbox).

### Ready-to-paste PR body

````markdown
## Summary
- Removes the "Socials in <city> this week" filler from the dancer world (flag `personWorlds`). Owner, phone test 2026-10-24: it "looked like the dancer's own plans".
- Owner choices: a dancer with no other dated world ends after the card and the "Get your own card" invite (no filler, no extra link, no "Find a party"). The "Coming up" preview of the dancer's own next class / gig stays. A person holding a teacher or DJ role reserves ONE 64px row while their dates load; a dancer-only person reserves nothing.
- Also fixes a footer jump the walk found: `GlobalLayout` served the fitContent `<style>` rule HTML-escaped (`&gt;`), so the footer moved on hydration. OUTSIDE the dancer folder (`src/components/layout/GlobalLayout.tsx`, 5 lines, `renderToString` pin test red first). Stage 5 critique: the style renders only with `fitContent`, whose only caller is `frame/WorldPage.tsx` (flag-ON dancer / DJ / teacher worlds), so no other page can change.
- No SQL, migration, RPC or flag change. Flag OFF = the old dancer page, untouched.
- Design record: `docs/design/people-s6-dancer-no-socials.md`. Stage 5 critique: `docs/design/people-s6-critique.md` (no code change; 3 owner calls). Handover: `docs/people-arc/s6/HANDOVER.md`.

## Verified on real data
- Shapes surveyed: prod, read-only, anon key, counts only (2026-10-24, re-measured by the Stage 5 critique): 174 live dancer rows; dancer only 36 (26 photo+city, 4 city only, 1 photo only, 5 neither); teacher 98 (35 dated, 16 past only, 47 none); DJ 14 (5 dated, 2 past, 7 none); teacher + DJ 26 (teacher 12 dated / 4 past / 10 none, DJ 12 dated / 4 past / 10 none). With teacher pages closed, 134 of 174 behave as dancer-only and 40 (DJ holders) reserve one row. The brief's "159 of 189" does not reproduce.
- Checks run: matrix test (8 shapes x 8 lower halves, signed-in rows, waiting states incl. failed/paused date reads; `getCalendarEvents` never called; no filler text), red first; `renderToString` pin red against main's GlobalLayout; worldShellGuard mutation (padding around the dancer PersonFrame -> red); typecheck (94, baseline 106); `test:unit` (15 sandbox-only failures, same on main, none in a touched file); `npm run lint` (21/22 green, `check:integrity` green when run with bash: the script is mode 644); `AUDIT_STRICT=1 check:images`; `check:mojibake`; `check:dancer-area-isolation`; build (flag ON, teacher closed and open); browser walk on prod data at 390x844 and 360x800, 12 profiles x 2 widths (contrast >= 5.06, 0 taps under 44px, nothing clipped, no sideways scroll, invite last, no filler); frame boxes identical on dancer / DJ / teacher worlds; layout shift with sources.
- NOT verified: signed-in renders in a browser (no test account; matrix only); a real phone; the Vercel preview (orchestrator walk); `test:e2e` locally (the signed-in specs time out in this sandbox, identically on main -- CI is the judge); `check:doc-weight` (needs a preview). Known and left as owner calls: DJ holders' dancer pages shift 0.13-0.16 (0.12 is the role-tab bar arriving after mount; recommendation: dehydrate the roles read in the `/dancers/:id` loader), the reserve has no heading room, the website contact label shows raw URLs like `www.instagram.com/x/?hl=en`.

## Phone QA
- Sizes checked: 390x844, 360x800
- Walked: /dancers/:id with personWorlds ON on prod data, 12 profiles: thin teacher-past (aitor), dancer only (photo+city, no photo/no city, photo/no city), teacher dated and undated (teacher pages closed), DJ dated, undated and past, teacher + DJ dated and undated, DJ dated with no photo and no city; plus /djs/bobby-blanco and /teachers/alex-boneva for the frame boxes
- Not verified: signed-in view; real phone; Vercel preview (orchestrator walk pending)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_019B9NNXVgap6whfKQoG2X3K
````
