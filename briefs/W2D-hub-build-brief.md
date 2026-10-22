# BRIEF W2D-hub-build: build the redesigned person hub (option C) behind flags.personHub

Repo: 123constante/bachata-website. Branch: `claude/w2d-hub-build` (off main). ONE push at the end, bot-authored, plain git
(never `gh api`), no shell variables/loops/`$(...)`, Supabase read-only, never merge or approve, never `--no-verify`.
Lane: normal. Context cap 50%; at 45% push + handover `docs/handover/w2d-hub-build.md`, last commit subject ending
`PARTIAL [worker-done <ticket>]`. Final push subject ends `[worker-done <ticket>]`. Open the PR as the bot with a handover-based body
(sections "Phone QA" and "Verified on real data" are required by CI). Run EVERY CI job step in your sandbox (read .github/workflows)
and put the per-job table in the PR body.

## Read first
`docs/design/w2d-hub.md`, `docs/handover/w2d-hub-mock.md`, `docs/mockups/w2d-hub/c.html` + `c-s1..s4.png` + `overview.png` + `tap.png`
(branch `claude/w2d-hub-mock`: `git fetch origin claude/w2d-hub-mock` and `git show FETCH_HEAD:<path>`), then the current hub
(`grep -r personHub src`), `docs/design/w2b-hub*.md`, `docs/design/924.md` (soft-fade rule), `docs/handover/w2c-build.md`.

## Owner decisions (click answers 2026-10-22) - do not reopen
1. LAYOUT = **option C**: one hero card for the main role (big "Open <role> page" button) + an "Also" row for the other roles + short About line.
   Neutral warm-dark frame, accent colour from the main role (dancer teal, DJ gold). Main role order as in the mockup/design record.
2. **One-role people skip the hub.** `/people/:id` for a person who holds exactly ONE role goes straight to that role page. **Count every role the
   person HOLDS, including a closed one**: a dancer + teacher (teacher pages closed) still sees the hub, with a "Teacher pages open soon" card that does
   nothing (not a link). Only people with exactly one held role redirect. (The chip-fix PR #947 carries `heldRoles` on the snapshot: reuse it.)
3. The wall tile tap goes to the hub for multi-role people and directly to the role page for one-role people (see `tap.png`); keep ONE shared mapping
   used by tile link, hub redirect and chips (no two copies).
4. The fade into the orange footer: paint the footer's 64px top gap on the hub route ONLY (footer unchanged elsewhere). Decided by Claude (owner is a beginner); no seam
   (measure the row step < 6/255 like `docs/design/924.md`).
5. Bundled small fix (owner asked to bundle it): a wall/tile photo that fails to load (real case: a person whose photo URL returns a "Page not found" image,
   tile "Jxjx" on /dancers) must fall back to the initial-letter tile. Use onError-style fallback handled in React props (the site CSP blocks inline handlers).

## Data shapes to cover (counts from my prod survey 2026-10-22; 166 active dancers)
teacher-only 62, dancer+teacher 36, dancer+dj+teacher 25, dancer-only 23, dancer+dj 10, dj-only 4, dj+teacher 1, no role 5.
Teacher pages are CLOSED on prod. Build the shared role-mapping table test (table-driven): every shape above x {wall tile link, hub, redirect, chips}
must agree; no text may point at a control that is not on screen; the closed Teacher card is not a link; "no role" people (5) get a sane empty state saying what the visitor can do.
Write the test RED first against main and show it fail, then fix.

## Gates (Design Gate stages 3-4)
Colours/type/spacing from the existing tokens file only. Record numbers in `docs/design/w2d-hub-build.md`: text contrast >= 4.5, tap targets >= 44px, no clipped text,
no sideways scroll at 360/390/430, every empty/loading/error state says what the visitor can do, seam step. Screenshots at 390x844 of real-shaped data
(local dev with prod reads is fine, no Vercel preview needed) into `docs/mockups/w2d-hub-build/` for each shape; LOOK at each one for colour seams.
Layout shift: if the DJ gig timeline arrives late, reserve the space (no card re-order after first paint); say what you did.

## Boundaries
Flag `personHub` (default OFF in code; prod flag is ON so the live hub changes at merge+deploy, which is intended). No migrations, no Supabase writes, no new colours.
Do not touch the dancer or DJ role pages except where the shared mapping needs a one-line import.

## Required output
Bot PR, branch pushed, handover with the head SHA, per-job CI table, screenshots list, and an honest Verified / Not verified block.
