# Brief: p3-fixlist -- one fix list and one walk list from the three P3 journey audits (docs only)

Repo 123constante/bachata-website, branch `claude/p3-fixlist` (from origin/main). DOCS ONLY: you write
`docs/design/p3-acceptance/FIXLIST.md` and `docs/design/p3-acceptance/WALKLIST.md`. No code, no tests, no prod write.
Context cap: stay under 35%; if you cannot finish, push what you have with `PARTIAL [worker-done <ticket>]` and say what is left.

## Inputs (read these, nothing else first)
- `docs/design/p3-acceptance/AUDIT-gate.md` on branch `origin/claude/p3-audit-gate`
- `docs/design/p3-acceptance/AUDIT-public.md` on branch `origin/claude/p3-audit-public`
- `docs/design/p3-acceptance/AUDIT-team.md` on branch `origin/claude/p3-audit-team`
- `docs/design/p3-acceptance/{CONTRACT,ACCOUNTS,INVENTORY,PEOPLE-INVENTORY}.md` on `origin/claude/p3-acceptance-contract-3`
  (`git fetch origin <branch>` then `git show origin/<branch>:<path>`). Copy all seven files unchanged into your branch too,
  so the whole acceptance folder lives in one PR.

## FIXLIST.md: every FAIL / PARTIAL / blocker row from the three audits, exactly once
Columns: `id | audit finding ids | journey steps | severity (blocker/high/medium/low) | what is wrong (one line, plain words) |
fix slice | files (file:line from the audit) | owner decision needed? (NO, or the one-line product question)`.
Fix slices to group by (create more only if a row fits none; never leave a row ungrouped):
- `P3-LAND`: every landing/link/redirect that still goes to R1 `/account/o` instead of P3 (G-01, G-04, G-26, G-09, claim done,
  dancer home links, Your areas, legacy paths, `/account?o=`, invite fallback, profile-lock link to `/account/o/complete`).
- `GATE-RETRY`: refused write not retried after the sheet (A-gate-5), banner copy/grace date (A-gate-1/2, J-e8.1), ticket refusal copy.
- `HOME-COPY`: Home all-ended / no-next copy and missing controls (J-d2.4, A-gate-J4).
- `EDITOR-STATES`: venue/place sheet dead error states, festival prices copy naming a switch not on screen, cancel-reasons empty,
  per-date Where sheet, edit lock for managers/contributors, Put it live without Undo (decision), Remove reading "Finished".
- `PAGE-SCOPE`: several pages merged on Home/Events/Stats, Switch page scope (J-e4), helper sees only their page.
- `DATES-100`: All dates capped at 100 with no Load more (J-e5.2).
- `SERIES-EDIT-RULE`: owner rule R1 (this date only / all dates with preview of dates changed and who is going), move with
  bookings not warned (A-public-5), moved date vs rule change (A-public-6), paused past dates (A-public-4), stored end drift (A-public-2).
- `CACHE`: public page and calendar keep data 1 h and a P3 write does not clear it (A-public-7); no "see it as dancers see it" link.
- `PEOPLE-JOIN`: the J-i* FAILs (stub never retired, ambiguous silent, sign-up mode no existence lookup, no merge path, legacy row
  grants nothing, banned copy, silent skip) and J-g* (invite minting admin-only, co-organiser leave not wired, manager contact rights).
- `TEAM-RIGHTS`: anything in the rights matrix where screen and server disagree.
Then a section `## Slice order` proposing the build order with a one-line reason each, and a `## Owner decisions` section listing
ONLY the rows whose column says a decision is needed, each as one plain-words click question with 2-3 options (no code words).
End with `## Coverage`: number of FAIL rows found in each audit, number placed in FIXLIST, must be equal; name any you dropped and why.

## WALKLIST.md: every CANNOT-TELL and every "walk must check" step, deduped
Columns: `id | audit ids | what to open (exact route under /account/p3 or public URL) | which account from ACCOUNTS.md | flag state |
what PASS looks like (one line) | needs seed data? (which shape from INVENTORY/PEOPLE-INVENTORY)`.
Group: (A) walkable today on prod-shaped test accounts with flags as on prod; (B) needs a preview build flag
(`VITE_ENABLE_GOING_PREVIEW`, gate ON, etc.); (C) needs seeded data (say the exact rows, never a prod write).
End with `## Coverage` as above (CANNOT-TELL rows per audit vs rows placed).

## Rules
- Plain words in the "what is wrong" and question columns: the owner reads them. No JSX, no RPC names there.
- Never invent a finding; every row cites its audit id. Never drop one.
- Commit message: `docs(p3-acceptance): FIXLIST + WALKLIST from the three journey audits [worker-done <ticket>]`. Open the PR via push
  (bot PR); PR body: what the two files are, the two coverage lines, "Not verified: no browser walk, no code change".
