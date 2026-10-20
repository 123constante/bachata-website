# Brief: phone walk of the fix pass on Website PR #757 (screenshots + measurements only; ONE docs-only push)

Repo `123constante/bachata-website`, branch `claude/event-creation-w3`, PR #757 (head `a5157e5`). Plain git only, never `gh api`; no shell variables or loops.
You write NO product code. You may add a throwaway walk script under `scripts/` or reuse the earlier walk harness (the handover said it is not in the repo:
rebuild it from `playwright.build.config.ts` and the organiser fake used by `src/modules/organiser/__tests__/`), and you push ONE commit that adds screenshots to
`docs/screenshots/event-creation-w3/` plus a short `## Fix pass walk` note in `docs/handover/event-creation-w3.md`. Do NOT put [skip preview] on that push.

## What to walk (390x844, touch, PRODUCTION build: `npm run build` then the build-config server; organiser fake loaded with the prod shapes already in
`src/modules/organiser/__tests__/shapes/shapes.ts`)
1. Events list, the open event is a PAST one (ended or live-with-only-past-dates, e.g. `ended-picnic`): the Past section is OPEN on arrival; tap the "Past (n)" toggle:
   it COLLAPSES and `aria-expanded` flips to false; tap again, it opens. Record the 44 px toggle height and that nothing else moves. Screenshots: open, collapsed.
2. Events list, the open event is a CURRENT one: Past starts collapsed; tap opens it; the open row stays visible. Screenshot.
3. Date page of a PAST date of a lapsed live series (live, one-off or course, every date past): the status tag reads Finished (not Live). Also a lapsed
   live RECURRING series: reads Nothing coming up. Also a live series with later dates: still Live. One screenshot each.
4. Date page of a live series with a cancelled-only upcoming set: reads Live (decided).
5. No horizontal scroll on any of these (record `document.documentElement.scrollWidth <= 390`).

## Output
Print a compact table in the handover note: screen, shape, what the tag/toggle read, measured numbers. Report honestly what you could not walk. If a walk
contradicts the code (e.g. the toggle does not collapse, or a tag reads Live on the lapsed past date), do NOT fix it: push the evidence and say so.
Never merge or approve, never `--no-verify`, no credentials, Supabase read-only. Last commit subject ends `[worker-done <ticket>]`. Report head SHA and the table.
