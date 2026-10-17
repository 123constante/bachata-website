# Brief P-SERIES-cont -- continuation of P-SERIES (parity matrix test + browser walk + PR)

Repo `123constante/bachata-website`. Branch `claude/org-r1-parity-series` ALREADY EXISTS (head 1ad1a4fa, PARTIAL). Check it out (`git fetch origin claude/org-r1-parity-series`, then work on it) and push ONLY that branch, ONCE at the end. Plain git only (never `gh api`), commands without variables/loops/`$(...)`, never `--no-verify`. You are the only worker on this branch.

READ FIRST: `docs/organiser-rebuild/handovers/P-SERIES.md` on the branch (its "Left" section is your task list; Decisions 1-8 are binding), then the original brief `git show origin/arc/briefs-organiser-r1:docs/organiser-rebuild/briefs/P-SERIES.md`, and `git show origin/claude/org-r1-parity:docs/organiser-rebuild/PARITY-GAP.md` (section (c) is the parity-matrix spec).

## Do
1. **Item 9, the parity matrix test** `src/modules/organiser/__tests__/parity-matrix.test.ts`, exactly as the handover "Left" step 1 says. RED-FIRST for the rule itself: mutate one row (point a reachability path at a screen no route reaches), paste the red output into the handover, restore. P-DATES rows (C13, C19, C20, C22, C24, C26, C39, C52-C55, C59, C61, plus its bulk/copy rows) are `owner: 'P-DATES'` + `it.todo` for now; the integration worker fills them.
2. **Browser walk at 390x844** (Playwright against the production build `npm run build` + preview, fake Supabase as the phone specs do): a draft's One event (Go live off with reason, Discard confirm, See it live), Details (Gallery, Videos, Ends, Prices, a team-made price list read-only), Stop repeating, Make it weekly, the wizard's last step. Screenshots into `docs/organiser-rebuild/walk-P-SERIES/`, one line each saying what to look at; fix any visible defect red-first.
3. Run EVERY CI job step again on the final tree (read `.github/workflows`; same table as the handover: rpc-typing, wallclock, integrity after `chmod +x bin/*.sh`, legacy checks, lint:architecture, `AUDIT_STRICT=1 check:images`, `npm run lint`, unit (the 15 live-DB sandbox reds are expected; env -u NODE_PATH for integrityCouldNotRun), build + budgets, e2e). GitHub may refuse jobs for billing; that is not a code failure.
4. Update the handover (append "Continuation" with the table, the walk, the red-first proof, Verified / Not verified). Do NOT open a PR (the integration branch collects both slices).

## Rules
Context under 30%; at 25% start nothing new; by 30% push + handover, last commit subject ending `PARTIAL [worker-done dt_xxx]`. Final push subject ends `[worker-done <ticket>]`. Supabase prod SELECT only, counts only. `&mdash;` entities, 44px tap targets, `loading` on images.
