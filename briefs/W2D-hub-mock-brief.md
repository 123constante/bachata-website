# BRIEF W2D-hub-mock: three mockups for the redesigned person hub (Website, NO app code changes)

Repo: 123constante/bachata-website. Branch to push: `claude/w2d-hub-mock` (off main). ONE push at the end, bot-authored, plain git
(never `gh api`), no shell variables/loops/`$(...)`, Supabase read-only, never merge or approve, never `--no-verify`.
Context cap: 50% (normal lane); at 45% push + handover (`docs/handover/w2d-hub-mock.md`) with last commit subject ending
`PARTIAL [worker-done <ticket>]`. Final push subject ends `[worker-done <ticket>]`.

## What this is
The owner (a non-technical product owner, on a phone) asked to REDESIGN the person hub page `/people/:id` (flag `personHub`, now ON in
production). Design Gate stages 1-2: a brief and 2-3 MOCKUPS to choose from. Build nothing in the app. Output = static HTML mockups +
PNG screenshots at 390x844, so the owner picks one by click.

## Read first
- `docs/handover/w2b-hub.md`, `docs/design/w2b-hub.md`, `docs/design/w2b-hub-critique.md` (how the hub works today), and the hub route/components
  (find with `grep -r personHub src`). Also the DJ page and dancer bar designs (`docs/design/` for #956 / #958) so the hub shares their tokens.
- `docs/design/924.md` for the warm wall base and the soft-fade rule.

## What the owner saw on the live hub (390x844, prod data) - the problems
1. For a ONE-role person (about 70 of 166 active dancers: e.g. dancer-only 23, dj-only 4) the hub is a name card + ONE link "Their dancer page" +
   a large empty dark area down to the footer. It adds nothing.
2. A cool blue-grey band sits above the footer (hub ground ends in the cool palette while the footer is orange).
3. The bar above the footer is a hard seam; owner rule: two surfaces next to each other must share a base colour or blend (no hard seams).

## Owner decisions (click answers, 2026-10-22) - do not reopen
- Audience: dancers looking for partners AND people booking DJs/teachers, equally. Lead with the person's strongest role.
- **One-role people SKIP the hub**: `/people/:id` for a person with exactly one visible role goes straight to that role page (design the
  redirect behaviour in words; mockups cover only the MULTI-role hub, plus one small frame showing what the wall tile tap does for one-role vs multi-role).
- Feel: a NEUTRAL frame (warm dark brown, the wall base) that takes its ACCENT colour from the person's main role (dancer teal, DJ gold).
- Three options to choose from.

## Task
Produce THREE genuinely different layouts for the multi-role hub (e.g. A: stacked role cards, big photo; B: tabbed/segmented role switcher with
the active role's summary under it; C: one hero role card + an "Also" row). You may vary, but they must differ in structure, not colour.
Each mockup is a self-contained HTML file `docs/mockups/w2d-hub/<a|b|c>.html` using the real tokens file colours (no new colours), PLUS a PNG at
390x844 for each of these data shapes (use real prod shapes, counts only, no personal data in files beyond a first name already public):
 1. dancer + DJ with upcoming gigs (like Elias)  2. dancer + DJ, no photo  3. dancer + teacher where teacher pages are CLOSED (about 61 people; the teacher
 chip still shows but has no page)  4. three roles (dancer + DJ + teacher, 25 people). 3 options x 4 shapes = 12 PNGs, plus a contact sheet
 `docs/mockups/w2d-hub/overview.png` (one image, 3 columns).
Every mockup must: end with a soft fade into the orange footer (no hard seam, measure the step like in `docs/design/924.md`); fill the page (no big empty
dark gap on 390x844); keep every tap target >= 44px; say what each control does; state text contrast >= 4.5.
Also write `docs/design/w2d-hub.md`: the five-line brief (who, their one job, the feel), what each option trades off, your recommendation, and the
measured numbers (contrast, tap targets, seam step). Then a ready summary in `docs/handover/w2d-hub-mock.md`.

## Boundaries
No change to `src/`. No migrations. No Supabase writes. No PR needed (the orchestrator opens none for a mockup branch). One push.

## Required output
Branch pushed with the files above; handover lists the 12 PNG paths, the recommendation, and anything you could not do.
