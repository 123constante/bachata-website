# W2-D person hub: independent critique (Design Gate stage 5)

Ticket dt_35ff972ae82e. Brief: `brief/w2d-hub-build:briefs/W2D-hub-critique-brief.md`. Reviewer: a new worker who did not
build it. Judged at 360 / 390 / 430 x 844 on local dev reading prod data (anon reads only), side by side with the approved
mock (option C, `claude/w2d-hub-mock:docs/mockups/w2d-hub/c-s1..s4.png`). Every face is initials: the sandbox gets a 403
from the media host. Probes: `docs/mockups/w2d-hub-build/walk.mjs` (screens + numbers) and `probe.mjs` (Back control,
late-data shift).

Who it is for: a dancer on a phone who tapped a face on the /dancers wall and wants to see what this person does and get to
the right page fast.

## Fix list (most serious first)

| # | Finding | Why it matters to the visitor | Severity | Verdict |
|---|---|---|---|---|
| 1 | **Back loops for one-role people.** On a one-role person's dancer or DJ page, the role bar says "Back to Biskit" and links to `/people/<slug>`. This PR now 302s that URL straight back to the same page. Measured (`probe.mjs`, prod ids): dancer-only `/dancers/unclaimed-00422bf9` -> tap Back -> `/dancers/unclaimed-00422bf9`; DJ-only `/djs/bobby-blanco` -> tap Back -> `/djs/bobby-blanco`. Hits about 29 of 166 active people (dancer-only 23-26, DJ-only 4). Teacher-only and no-role people get no bar today (no open role page), so they are not hit. | The Back control does nothing you can see. A newcomer taps it again and again, then gives up or closes the tab. | blocker | **owner call** (see below): the fix is ready but cannot ship from this PR without breaking a CI guard |
| 2 | **Late gig line moved the page by 18px.** In the two-column Also row, the DJ card read "Checking for gigs..." (one line) and then "No gigs listed right now" (two lines at 360 and 390), so the row grew and About jumped 18px. Measured with the gig read held back 2.5s: dancer + DJ + teacher, no gig: About moved 18px at 360 and 390. | Content jumping under your thumb is the thing that looks broken. | should | **fixed here**: side by side, each Also line reserves two rows (36px). After: 0px at 360 and 390, all three late-data shapes. No new read. |
| 3 | **Filler hero line "Their dancer page".** A dancer-led hub with no years-dancing fact showed "Their dancer page" as the hero's summary, right above an "Open dancer page" button and a hint saying the same thing. 3 of 6 walked hub shapes showed it. | Three lines saying one thing reads as a template with nothing in it, the "empty" look the brief rules out. | should | **fixed here**: the dancer (or teacher) hero line shows only when there are facts. The DJ line always shows (its row is held for the late gig list, item 2). |
| 4 | **Hint left one word on its own line.** "Opens their dancer page: style, level and how to say" / "hi." at 360 and 390. | Looks unfinished. | nice | **fixed here**: `text-wrap: balance` on the hint (now "Opens their dancer page:" / "style, level and how to say hi."). |
| 5 | **Raw Unicode punctuation in source.** `...` (U+2026) and `·` (U+00B7) were typed straight into `hub/model.ts` and `PersonHub.tsx`. CLAUDE.md bans this (the cp1252 round-trip turns them into mojibake on prod). | A garbled ellipsis in "Checking for gigs" (the cp1252 mojibake form) would look broken. | should | **fixed here**: `…` / `·` escapes, plus a test that fails if one comes back. |
| 6 | **Languages show as codes.** The Dancer Also card and About read "es, en" (Roger Cracco). The dancer page shows "Spanish, English" for the same person through `languageNames` in `src/modules/dancer-app/public-page/model.ts`. | A newcomer may not read "es, en" as languages at all. | should | **owner call**: the one mapping lives in the dancer-app module, and the isolation guard (`check-dancer-area-isolation`, rule c) forbids importing it from person-page. A second copy breaks the "one mapping" rule. Recommendation: move `languageName(s)` to `src/lib/` (an orchestrator seam decision), then the hub uses it. |
| 7 | **Chip order is Teacher, DJ, Dancer, not lead-first** as in the mock (DJ, Dancer, Teacher). | Could look out of step with the hero. | - | **not a bug**: it is the site-wide `ROLE_ORDER`, the same order as the wall pills and the role bar's pills. Matching the wall wins (brief check 5). |
| 8 | **Gig date "Fri 23" has no month** (mock: "Sat 7 Nov"). | Could be unclear for a gig weeks away. | nice | **not a bug here**: it is the wall's `wallDateLabel`, so the hub and the wall say the same thing. Change both or neither (owner call, low priority). |
| 9 | **Facts repeat**: the Dancer Also card and About both say "es, en". | Some repetition. | nice | **not a bug**: as in the approved mock (c-s4). |
| 10 | **Closed Teacher card** (check 2). | Must read as "not yet". | - | **not a bug**: dashed edge, no "Open" row, muted "Teacher pages open soon", not a link (`aria-disabled`). It does not look like a button next to the solid-edged "Open" cards. |
| 11 | **Fade into the footer** (check 1). | No band, no hard line. | - | **not a bug**: largest one-row step 3/255 (x=4 column, hub top to 40px into the footer) at 360, 390 and 430, all 6 shapes. In the full-page shot the brown runs into gold, then the footer's own gold padding: no plain band, no line. Other routes unchanged: the CSS hooks only on `[data-hub-footer-join]`, which only the hub renders (index.css not touched in this pass). |
| 12 | **Header seam.** A black site header with a gold rule over the brown page. | - | - | **not a bug**: site chrome, the same on the /dancers wall and the DJ page. |
| 13 | **Thin page** (DJ + teacher, no city: no About). | Dark space between the Also row and the fade. | nice | **not a bug**: the fade still sits on the first screen. Nothing honest to add without new content. |
| 14 | **Redirects** (check 4). | One-role people must never see the hub. | - | **not a bug**: dancer-only, DJ-only, teacher-only and no-role all land on their role page with `history.length` 2 (the hub is not in history). Item 1 is the opposite direction (Back from the role page). |
| 15 | Contrast, taps, focus, overflow. | - | - | **not a bug**: lowest text contrast 6.41 (DJ initials), smallest tap 44 (Back), no clipped text, scrollWidth = viewport at all three widths. Focus ring `#FBEBDD` 2px outline, offset 2, on `#1E1410` / `#2B1D16` (about 14:1). |
| 16 | Wording (check 5). | - | - | **not a bug**: every chip and card title comes from `ROLE_LABEL` (Teacher / DJ / Dancer), the same words as the wall pills and the DJ page role bar. |
| 17a | **"1 coming up"** after "Next gig Fri 23": the count includes the next gig itself, so one gig reads as if another follows. | Slightly misleading. | nice | **owner call**: the approved mock uses the same wording ("Next gig Sat 7 Nov · 1 coming up"). Recommend showing the count only when it is 2 or more. |
| 17b | **Two-row reserve at 320px**: a half-width DJ line could need three rows below 360. | A shift on very small phones. | nice | **not verified**: the brief's widths are 360/390/430; at those the shift is 0. |
| 17 | Jxjx tile. | - | - | **not a bug for this PR**: its photo URL returns a real 23 KB JPEG that is a screenshot of a "Page not found" page. The dead-link fallback cannot see that, and is not claimed to fix it. Test account, owner's to clean up. |

## Owner call 1 (blocker): stop Back looping on one-role role pages
- **Fix (ready, 69-line patch):** `docs/handover/w2d-hub-back-loop.patch`. `roleSwitchModel` asks the ONE rule
  (`personDestination`) whether `/people/<slug>` would show the hub. If not, there is no bar and the page keeps its own Back
  ("Back to DJs" on the DJ page, the dancer card's Back on the dancer page). Tests: the role-switch table (15 cases failed on
  the unfixed code) and one line in `src/modules/dancer-app/public-page/__tests__/oneBack.test.tsx` (the "one role" row
  expected a Back to the hub: it becomes "no hub").
- **Why it is not in this PR:** editing any file under `src/modules/dancer-app/` (even a test) turns this into a
  "dancer-area PR" for `check-dancer-area-isolation`. Rule (a) then fails on every person-page file in the PR (checked: 14
  violations). Adding a seam is an orchestrator decision, never a code edit.
- **Recommendation:** the orchestrator lets this PR (or a follow-up carrying only the patch) change that one dancer-app
  test line: either add `src/modules/person-page/roleSwitch.ts` to the seam list or exempt `__tests__` files from the
  "dancer-area PR" trigger. Then apply the patch (`git apply docs/handover/w2d-hub-back-loop.patch`). Do not merge this PR
  without it: prod has the flag ON, so this PR alone turns the loop on for about 29 people.

## Owner call 2 (should): language names
See item 6. Recommendation: move `languageName` / `languageNames` to `src/lib/languages.ts` in a dancer-area PR (the dancer
model re-exports it), then the hub calls it. Until then "es, en" stays.

## Review of the fix pass (two rounds, the stopping rule for user-facing changes)
Round 1 (8 findings): taken: a Teacher-led hero no longer borrows dancer facts (new test); one shared dancer facts line;
the two-row reserve applies to the side-by-side DJ line only (it is the one line that changes late); the Unicode guard reads
the module folder by `__dirname` and itself uses escapes. Left: the Also card keeps "Their dancer page" (beside "Open" it
names the tap target, unlike the hero where the button already does); a jsdom test cannot measure the row height, so the
live probe is the proof of the 0px shift. Round 2 (7 findings, the last round): taken: the guard checks for any non-ASCII
character (mutation-checked: a pasted U+201C turns it red), and About reuses `MIDDOT`. Left as recorded calls: 17a, 17b, and
the hero choosing its line next to `lineOf` (a small ternary, no copy of any wording). Fixes from round 2 are unreviewed.

## After the fix pass (numbers in `docs/design/w2d-hub-build.md`)
Late-data shift 18px -> 0px. Filler hero line gone (3 shapes). Seam 3, contrast 6.41, taps 44: unchanged.
