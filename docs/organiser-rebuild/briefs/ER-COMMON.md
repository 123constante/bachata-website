# ER-COMMON: rules every Organiser Events Rebuild (ER) worker follows

You are one worker on card/slice named in your own brief. Read THIS file, then your slice brief, then the files they name.

## Read first (all on branch `arc/briefs-organiser-r1`, fetch with plain git)
- `docs/organiser-rebuild/er/PLAN.md`: the approved plan. Binding sections: Rule sheet 1-29, D1 DEEP-CHECK GAPS, D1 APPROVED, CO-ORGANISING, COLLISION RULES, SHARED EMBER WORLD, DISPATCH METHOD.
- `docs/organiser-rebuild/er/organiser-prototype.html`: the APPROVED prototype (v7). Open it in a browser at 390x844 (and desktop) and build to it: screens, states, wording, sizes. If it and a rule disagree, the owner-approved prototype wins; record the difference in your PR.
- `docs/organiser-rebuild/er/DESIGN-base.md`: the site's current DESIGN.md (not yet on main). Organiser world = Ember `#f0703a`, ink `#1d0a03`, Outfit, graphite ground, Monzo radii; scoped to `.ember-world` (see ER-C2).
- `docs/organiser-rebuild/briefs/ER-INTERFACE.md`: the PINNED server interface (names, arguments, results). Build to it.
- The repo's own `CLAUDE.md` and `.claude/rules/`.

## Hard limits
- NEVER merge, approve, or enable automerge. The bot opens the PR from your `claude/**` branch; never `gh pr create`.
- Plain git only (`git fetch`, `git show`, `git push`). Never `gh api` (it stalls on a prompt nobody can answer). Write shell commands without variables, loops or `$(...)` where a plain command works.
- Supabase connector is READ-ONLY. No writes, no migrations. The Website repo owns NO `supabase/migrations/`.
- Never `--no-verify`. Never edit `.github/workflows/*`, `.env*`, secrets. If a workflow step is needed, say so in the PR body ("needs owner: workflow step").
- ONE push at the end of your slice (plus one PARTIAL push if you hit the context limit). No WIP pushes: each push costs a Vercel build (cap ~100/day).
- Calendar exclusion-list files (`EventCalendar.tsx`, `CalendarGrid.tsx`, `CalendarListView.tsx`, `DayDetailModal.tsx`, `calendarUtils.ts`, `useCalendarEvents.tsx`, `ui/dialog.tsx`): CONTENT strings only, and only if your brief says so. Never layout or density.
- JSX text: use HTML entities (`&mdash;`, `&rsquo;`, `&hellip;`), never pasted Unicode punctuation. Files over 2 KB go through `scripts/safe-edit.py` / `scripts/safe-write.py` if the repo hook tells you to.
- Phones set `html` font-size to about 13.5px: use explicit px for tap targets (44px minimum).
- Design bar: one primary action per screen; pickers allow only valid values; a control that cannot work is disabled with a 2-4 word reason; no helper paragraphs; full weekday names.

## Questions: park, do not stop
`cards.mjs` lives on the orchestrator's PC and is not in your sandbox. When a question comes up, DO NOT stop: take the sensible default and append an entry to `docs/organiser-rebuild/er/parked/<your-ticket>.md` (create it), one block each:
`Q: ... | Default used: ... | Cost if wrong: small|large | Where: path:line`
The orchestrator copies each into `cards.mjs park`. EXCEPTION (that tool's keyword guard): if the question touches prod, production, migration, delete, drop, truncate, payment, refund, price or rpc, do not guess that part: stop that part only, push what is safe, and say in the PR body what you need.

## Definition of done (all must be stated in the PR body, honestly)
1. Shape survey (read-only, counts only) of the prod shapes your screens meet: live 67 (18 with no coming date), ended 21, paused 2, draft 1, archived 82; formats recurring / one_off / course / festival; 7 live festivals (median 6 sessions over 4 days, max 14); payment: 51 ticket link, 3 passes, 16 none. Prod project `stsdtacfauprzrdebmzg`.
2. Table-driven tests: every screen x every shape; one shared mapping for any fact shown twice; no text pointing at a control not on screen; every empty state says what the person CAN do; an impossible control is disabled WITH a reason; saving an untouched record sends nothing. For a bug fix, run the new test on the UNFIXED code first (red) and say so.
3. EVERY CI job step run in your sandbox (read `.github/workflows`), including `npm run build` (production build, not only dev), `npm run test:unit`, `npm run lint`, the `check:*` scripts that apply. GitHub Actions billing is unreliable: put a per-job table (command + exit code) in the PR body and the handover. Say plainly what a sandbox cannot run (Docker, real phone).
4. 390x844 browser walk on prod-shaped data (not only a record you just created), screenshots in the PR.
5. A "Verified / Not verified" block. Server pieces not landed yet: build the screen and client against ER-INTERFACE.md, fake the server in tests, write "server not landed" in the PR, and list end-to-end as NOT verified.

## Context relay (hard)
Never pass 30% of your context. At 25% start nothing new. By 30% push your work plus `docs/organiser-rebuild/er/handover/<your-ticket>.md` (done / left / exact next steps) with the last commit subject ending `PARTIAL [worker-done <ticket>]`. A continuation worker continues on the SAME branch from your handover. Do not shrink the slice to avoid this.

## Last action
Final commit subject ends `[worker-done <ticket>]` (ticket is in your prompt). Push. Then report: head SHA, checks per job, Verified / Not verified.
