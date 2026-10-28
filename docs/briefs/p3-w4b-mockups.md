# Brief: P3 W4b stage 2, MOCKUPS ONLY for onboarding + no-city (Website, normal lane, Opus)

Branch `claude/p3-w4b-mockups` from current `main`. Context cap 30%: push early. **Design Gate stage 2: mockups only. No product code, no src/ changes.** The owner picks an option next; nothing is built before.

Owner clicks 2026-10-28: first cluster = onboarding + claim states under `src/modules/organiser/home/onboarding/*`; THIS round covers only two shapes: **brand-new account** and **no city**. **2 options per shape**, named (e.g. "A: Quiet steps", "B: One card"). P3 owns the tokens (P3 look: read the existing P3 screens in `src/modules/organiser/p3/` and their tokens/DESIGN.md if present; do not invent a new palette). Compact layout rules from `.claude/rules/design-density.md`. 390x844, taps >= 44px, contrast >= 4.5, no sideways scroll.

## Do
1. **Inventory first (mandatory, before drawing).** Read the CURRENT screens for these two shapes (`OnboardingView.tsx`, `OrganiserSheet.tsx`, `citySearch.ts`, `SignOutLine.tsx`, `claimStates.ts`, and the code that decides which shape a user is in) and list: every control, field, copy line, and state each shape has today, plus what each control sends (RPC names). The mockups must not drop a capability without saying so. Put the inventory at the top of `docs/design/p3-w4b-mockups.md`.
2. **Prove the data source:** read-only on prod (project stsdtacfauprzrdebmzg, SELECT only, counts only): how many accounts have no city, no page, a pending claim; who writes those fields. Never any write.
3. **Mockups:** standalone HTML files `docs/design/p3-w4b/<shape>-<option>.html` (inline CSS, no external fonts/CDN, one file per option per shape = 4 files) rendered at 390x844, plus one `index.html` gallery that links them side by side. Each option shows the full flow of that shape (every step, the empty/error/loading state, the disabled-with-reason control). Copy: British English, full weekday names, HTML entities for punctuation.
4. **Self-checks (stage 4 preview, scripted):** a small script that renders each file at 390x844 with the available headless browser or reads the CSS: contrast pairs >= 4.5, tap targets >= 44px, no horizontal overflow. Report the numbers in the doc.
5. **Decision table:** for each shape, A vs B: what it optimises, what it costs, which existing capability each keeps or drops, your recommendation with the reason.
6. Write `docs/design/p3-w4b-mockups.md` (inventory, data counts, decision table, self-check numbers, Verified / Not verified). Open a PR titled `docs(design): P3 W4b stage 2 mockups (onboarding, no city) [skip preview]`; docs-only.

## Not in this round
Claim states, go-live, Dancer4, the create wizard (wizard waits for the event-truth PR). No tokens file (stage 3).

Standing header lines:
- Prove the data source first (step 2). Tests: none (docs/design only).
- Zero bytes to /app first load: touch nothing under `src/`, `perf-budgets.json`, `vite.config.ts`.
- Stopping rule: one Fable review of the mockups, one fix round, then the owner picks.
Run the repo's docs checks that apply (lint, mojibake, doc-weight). PR body needs `## Verified on real data` with the exact literal lines `- Shapes surveyed:`, `- Checks run:`, `- NOT verified:` and `## Phone QA`. Final commit subject ends `[worker-done dt_<ticket>]`.
