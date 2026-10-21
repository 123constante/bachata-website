# ER-FIX-C2 handover (fix pass for ER-W1 findings C2-1..C2-6)

Ticket dt_570cfcf44481. Branch `claude/er-ui-ember` (PR 902). Brief `docs/organiser-rebuild/briefs/ER-FIX-W1.md` Section C2 (sha 2984b1b). Review: `ER-W1.md` on `claude/review-er-wave1`.

## Per finding

| Finding | Outcome | What changed | Red-first proof |
|---|---|---|---|
| C2-1 selected Chip text 4.04:1 | fixed | New token `--gold-fg` (accent as small text): default `#ffa600` (= today's `--gold`, no default change), Ember `#f5865a` = 4.81:1 on card2. Chip selected text reads `var(--gold-fg,#ffa600)`. `--gold #f0703a` stays for fills and borders. | `emberContrast.test.ts` row "Chip selected text" RED on the unfixed code |
| C2-2 warn-fg on warn-bg 3.86:1 in a Card | fixed | Ember `--warn-fg` `#f0703a` -> `#ff9a6a`; warn-bg alpha unchanged (.14). Composite ratios: bg 6.28, card/sheet 5.48, card2 4.81. | 12 rows (StatusTag draft/party, Home problem tag, dates cancelled note x 4 surfaces) RED on unfixed |
| C2-3 no selector-scope guard | fixed | Test: every selector in ember.css starts with `.ember-world` or `.org-theme`. | Mutant `.ember-world,` -> `:root,`: test RED (reverted) |
| C2-4 placeholder on card2 4.06:1 | fixed | Ember `--ph` `#9097a1` -> `#9aa1ab` = 4.59:1. | row "Field placeholder" RED on unfixed |
| C2-5 DateChip stadium shape | fixed | DateChip reads its own `--r-date` (default 8px, Ember 12px = prototype `.thumb` 48px tile). `--r-chip` unchanged for chips and PersonRow role pill. | test "DateChip has its own radius token" RED on unfixed |
| C2-6 `.org-theme` inside `.ember-world` resets tokens | fixed | Override selector list adds `.ember-world .org-theme` (specificity 0,2,0 beats `.org-theme`), documented in the css comment. Test checks the selector is present and every override selector out-ranks `.org-theme`. | test RED on unfixed |
| Chip structure (mutant 13) | fixed | "default render unchanged" test now asserts the container's only child is the `<button>` itself. | Mutant wrapping the no-onRemove chip in `<span>`: RED (reverted) |

Contrast test (`src/modules/organiser/__tests__/emberContrast.test.ts`) is table-driven: each row names fg token, background stack (alpha composited over an opaque surface), the file, and the class text that file must still contain, so the table cannot drift from the components. It computes the WCAG 2.x ratio from ember.css and fails under 4.5. Formula checked against the reference values (21:1, #767676 on white 4.54:1). Rows: Chip selected / text, Field placeholder / text, StatusTag neutral, StatusTag draft/party and live on bg/card/card2/sheet, Home problem tag and job sub line, dates cancelled note, accent text buttons on sheet and card, button label on accent.

No public export renamed or removed. Default (non-Ember) values unchanged: the default-token tests pin every token to today's value, including the two new ones.

## Checks (sandbox)

Job (workflow) | Command | Exit
---|---|---
architecture-guard | `bin/check-integrity.sh` (after the job's `chmod +x`) | 0 (2037 files, 0 issues)
architecture-guard | `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture` | 0, 0, 0
architecture-guard | `AUDIT_STRICT=1 check:images`, `check:image-widths:self-test`, `check:image-widths` | 0, 0, 0
architecture-guard | `check:plan-hygiene:self-test`, `check:workflow-artifact-policy(:self-test)` | 0, 0, 0
architecture-guard | `check:mojibake:self-test`, `check:mojibake`, `prove:entry-point(:self-test)` | 0, 0, 0, 0
unit-tests | `check-dancer-area-isolation --self-test`, `check:dancer-area-isolation` | 0, 0
unit-tests | `test:unit:offline` (the PR leg: no DB path changed) | 1: 5 failures, all in `tests/integrityCouldNotRun.test.ts`; the SAME 5 fail with this change stashed (sandbox / pre-existing, not this PR). 10203 pass, incl. the organiser suite
unit-tests | `test:unit:timing` | 0
unit-tests | `npx vitest run` ember.test.tsx + emberContrast.test.ts | 0 (97)
typecheck | `check:rpc-typing`, `check:wallclock-brand` | 0, 0
(not a job step) | `npm run typecheck` | 2: 99 errors, same count as the base (ER-W1 measured 99 there); none in touched files
perf-budget | bundle-budget / first-load-requests / chunk-cycles self-tests | 0, 0, 0
perf-budget | `npm run build` | 0
perf-budget | `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | 0, 0, 0
perf-budget | `check:doc-weight` | 1: cannot run in a sandbox (`GITHUB_REPOSITORY is not set`, it probes the Vercel preview)
perf-budget | `check:lighthouse` | not run (needs a deploy)
workflow-lint | masking, notification (+self-test), no-preview-prefixes (+self-test) | 0, 0, 0, 0, 0
seo-check | `check:seo:self-test` | 0 (`check:seo` needs a deploy: not run)
(conventions) | `node scripts/check-script-conventions.mjs` | 0
(lint chain) | `npm run lint` (with `bin/*.sh` executable, as in CI) | 0, 20 of 20 links green. Without the exec bit the integrity link exits 126: sandbox checkout mode only
(eslint) | `npx eslint` on the 4 touched .ts/.tsx | 0
e2e-smoke, db-contract-check, live-qa, phone-qa, prod-smoke, og-image-check | | not run: need a deploy, DB secrets or a browser walk against a preview

## Verified / Not verified

Verified: WCAG ratios computed in a test from the shipped tokens; both surviving mutants from ER-W1 now RED; default tokens equal today's values; the CI steps above.

Not verified:
- No 390x844 browser walk: no route mounts EmberWorld yet (Release B adds it), so there is no screen to walk. Prod shape survey not relevant to tokens (no data read).
- Contrast is computed, not measured on a rendered page or a real phone.
- Steps a sandbox cannot run: db-contract-check and live DB suites (no DB secrets), Lighthouse, OG/SEO live checks, e2e-smoke against a deploy, GitHub-only workflows (bot, budget, mergeable, real-data-verified on the PR body).
