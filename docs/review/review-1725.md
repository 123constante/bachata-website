# Review of PR #1725 -- merge-tier slice 4a: guard-path and money sets, flag off

PR #1725, branch claude/merge-tier-slice4a, reviewed at head d9708c5727891dc7a23b133045d0f26c37dc7060 (base main d3f562d).
Brief: docs/briefs/review-1725.md on brief/review-1725 (024b407). Build brief: docs/briefs/slice4a-merge-tier-sets.md on brief/merge-tier-slice4a.
Reviewer: zero-context cloud worker, read-only on the PR branch; checkout of the reviewed commit, existing node_modules. Date 2026-11-16.
Hard tier: the PR touches .github/automation/* and scripts/.

## Verdict: PASS WITH NITS

## Hard-tier: PASS

Every change raises a tier or leaves it alone; none lowers one. Proven over the whole tree, not by reading: classifying all 6861 tracked files with main's merge-tier.mjs plus main's two JSON sets, then with the PR's, gives 81 files that move (76 C->A, 3 C->B, 2 B->A) and ZERO that drop. The brief's six checks are all answered below with file:line evidence. The nits are doc-accuracy and one wider-than-described over-match; nothing blocks the owner's Approve.

## Findings

1. **N1 Nit (over-match wider than the PR says).** `.github/automation/money-set.json:39-40` adds `**/*fee*` and `**/*fee*/**`. The PR body and `tests/mergeTier.test.ts:31-32` pin only the `Feedback*` over-match. The glob also catches every `feed` path: `src/modules/going/CalendarGoingFeed.tsx`, `src/modules/profile/organiserStatsByFeed.ts`, `tests/icsFeedInstants.test.ts`, `tests/icsFeedPaging.test.ts`, `src/pages/__tests__/OrganiserProfileFeedError.matrix.test.tsx`, `docs/handover/organiser-page-nights-feed.md`. That is fail-closed (more review, never less), so it is harmless by the brief's criterion, but the owner should know the ICS feed and the going feed are now "money" paths. Worth one line in the PR body or a follow-up narrowing (for example `**/*fee.*`, `**/*fees*`, `**/*-fee-*`, `**/*Fee[A-Z]*` cannot be expressed in this glob dialect, so a narrowing would need a names-style rule or an explicit exempt list).

2. **N2 Nit (live effect, not behind the flag).** The money set is read by three auto paths that run today regardless of MERGE_TIERS_ENABLED: `scripts/lib/autopilot-merge.mjs`, `scripts/automerge-classify.mjs` (bot-automerge) and `scripts/automation-money-check.mjs` (Dependabot lane). Each refuses on a path hit. So from the moment this merges, a bot or autopilot PR touching any of the 76 newly-money paths (the list in the appendix) is refused and waits for the owner. The PR body frames the change as "flag stays OFF"; the guard-paths and DEPLOY_CONFIG parts are indeed inert until the flag flips, but the money-set widening is live. Fail-closed, so a PASS; say it in the hand-off.

3. **N3 Nit (header comment now false).** `scripts/lib/merge-tier.mjs:12` still says "No second path list: guard paths and the hard tier come from their one owner each", and `tests/mergeTier.test.ts:89` names a test "no second list". Line 32 adds `DEPLOY_CONFIG`, a path list owned by this file. Line 9 was updated to mention it; line 12 was not. Either amend line 12 or move the three root files and `supabase/functions/` into a config owner in slice 4b.

4. **N4 Nit (description vs diff).** The review brief and the PR title/body item 2 read as if `package.json`, `vercel.json`, `vite.config.ts` and non-ticket `supabase/functions/**` went into money-set.json. They did not: they are tier B via the `DEPLOY_CONFIG` regex in `scripts/lib/merge-tier.mjs:32,61`, and money-set.json gained only the eight `*price*/*payment*/*promo*/*fee*` globs. The build brief allowed "tier A/B", so the choice is in scope and the PR body's "Why B and not A" paragraph is sound (guarding package.json would make the Dependabot lane refuse every bump). Only the one-line summary is misleading.

5. **Info.** `supabase/functions/` does not exist in this repo (`ls supabase/functions` is empty). The five pre-existing `supabase/functions/ticket-*`/`stripe-*` money globs and the new `supabase\/functions\/.+` branch of DEPLOY_CONFIG are forward-looking, like `server/` in review-scope's SOFT_PATTERNS. No behaviour today.

## The brief's six checks

**1. New guard-paths entries exist and land in A; nothing fails open.** `.github/automation/guard-paths.json:27-29` adds `scripts/lib/merge-tier.mjs`, `scripts/lib/review-scope.mjs`, `tests/mergeTier.test.ts`. All three exist on disk at the reviewed commit (5474, 66822 and 10816 bytes). `scripts/lib/guard-paths.mjs:20-29` compiles each as an anchored case-insensitive regex, and `scripts/lib/merge-tier.mjs:59` checks `guard(q)` first, so each is A; the whole-tree comparison shows merge-tier.mjs and review-scope.mjs moving B->A and mergeTier.test.ts C->A. No entry was removed. Fail-open is impossible by construction: fileTier's A checks (guard, SQL, secret, money) are all additive, and DEPLOY_CONFIG is consulted only after them (`merge-tier.mjs:61`), so it can only lift C to B. Zero files lowered (appendix).

**2. Money-set widening.** Eight globs appended at `money-set.json:30-37`; the existing 26 `paths` entries, and the `tables`, `functions`, `keys`, `flags`, `env` lists, are byte-identical to main (the diff touches only the paths array). `is-money.mjs:60-69` makes `**/` match zero or more directories, so a root-level `priceList.ts` would also hit. Over-match is harmless in the brief's sense (N1, N2 for what it costs). Ticket and Stripe functions stay the strictest tier: `supabase/functions/ticket-checkout/**` etc. remain in `paths`, and money is tested before DEPLOY_CONFIG, pinned at `tests/mergeTier.test.ts:38-39`.

**3. tests/automationMoney.test.ts, outside the brief's file list.** `tests/automationMoney.test.ts:49` adds the eight new globs to an `expect(SET.paths).toEqual([...])` pin of the live set. Without it that test fails against the new JSON, so the change is required, harmless, and strictly a test pin. Justified.

**4. merge-tier.mjs classification change.** Full diff read: comment at line 9, `DEPLOY_CONFIG` at lines 29-32, and the one-token change at line 61 (`tier(q) === 'hard' || DEPLOY_CONFIG.test(q)`). The regex is anchored `^...$` at the repo root, so `src/package.json` and `docs/vite.config.ts.md` stay C (`tests/mergeTier.test.ts:40-41`). Effect on existing paths, measured: exactly `package.json`, `vercel.json`, `vite.config.ts` move C->B; every other change in the tree comes from the two JSON sets. Tests run on the reviewed commit: `npx vitest run tests/mergeTier.test.ts tests/automationMoney.test.ts tests/automationRegister.test.ts` = 3 files, 239 tests, all pass. Also `tests/automationGuardPaths.test.ts` + `tests/automationDrillRecords.test.ts` = 155 pass.

**5. check-workflow-artifact-policy.mjs MEASURED block.** Note first: MEASURED is not a comment. `measuredDrift()` (`scripts/check-workflow-artifact-policy.mjs:2755-2771`) reads all five fields and the self-test canaries at lines 4804-4818 compare FLOORS against them. The new numbers match the guard's own output on the reviewed commit exactly: "measured 48 workflow file(s), 73 job(s), 467 step(s), 8 upload-artifact step(s)", largest workflow 69 steps (the parser's count; a naive `grep -c '- name:'` on db-contract-check.yml gives 65 and is not the authority). Main's version of the script, run against the same workflows, also exits 0: the stale 60/389/7/67 were inside the 25% drift band, so this is a re-pin that re-centres the band, not a fix of a red guard. No logic changed: the diff is the four numbers plus comment lines. `--self-test` on the reviewed commit: PASS, 393 cases.

**6. Commands run in a checkout of the reviewed commit.** Listed above. Additionally `npm run check:mojibake` (2779 files, clean) and `npx tsc --noEmit -p .` (exit 0, no output).

## PR body and CI

- PR body has `## Verified on real data` with Shapes surveyed / Checks run / NOT verified, no TO FILL, and no Phone QA section (docs/tests/config PR, correct). It also carries a real `## Self-review`.
- Check runs at review time (snapshot 11:26 UTC): contract-check, live-db-gate, integrity, bom-check, real-data-verified, phone-qa-section, build-smoke, bundle-budget, wallclock-brand, masking-check, notification-check, route, decide, open-pr, unit (America/New_York) and unit (Australia/Sydney) all success; phone-qa (2) and (3) success; still in progress: unit (Europe/London, full), phone-qa (1), e2e-smoke. Skipped jobs are the preview/og/seo/lighthouse routes that do not apply. `mergeable_state: blocked` (awaiting review). Not re-polled after the snapshot.

## Not verified

- The merge-tier workflows have never run and the flag is OFF; no live classification was observed. The whole-tree comparison is the strongest available substitute.
- CI jobs still in progress at the snapshot (listed above).
- No Supabase read applies: there is no data path in this PR.

## Appendix: the 81 tier changes, main -> PR (whole tracked tree)

C->A (76; 41 are walk/handover PNG and JPG screenshots whose names contain `price` or `payment`, not listed):
docs/briefs/ticket-t3-price-steps-editor.handover.md, docs/design/ticket-promo-codes-organiser-INVENTORY.md, docs/design/ticket-promo-codes-organiser.md, docs/design/ticket-promo-codes-web.md, docs/handover/organiser-page-nights-feed.md, docs/handovers/ticket-fee-zero-web.md, docs/handovers/ticket-promo-codes-organiser.md, docs/handovers/ticket-promo-codes-web.md, docs/organiser-rebuild/handovers/S-FEEDBACK.md, docs/review/ticket-fee-zero-web-r1.md, src/hooks/usePublicPromoCodes.ts, src/lib/paymentMethods.ts, src/modules/dancer-app/screens/options/FeedbackSheet.tsx, src/modules/dancer-app/screens/options/feedbackModel.ts, src/modules/event-page/bento/blocks/PromoBlock.tsx, src/modules/event-page/promoFormat.ts, src/modules/event-page/sections/EventPromoSection.tsx, src/modules/event-page/sections/FestivalPromoBanner.tsx, src/modules/going/CalendarGoingFeed.tsx, src/modules/organiser/__tests__/promoted.test.tsx, src/modules/organiser/events/PaymentEdit.tsx, src/modules/organiser/events/__tests__/paymentModel.test.ts, src/modules/organiser/events/paymentModel.ts, src/modules/organiser/p3/data/prices.ts, src/modules/organiser/p3/screens/PriceCard.tsx, src/modules/organiser/p3/screens/PricesScreen.tsx, src/modules/profile/organiserStatsByFeed.ts, src/pages/PromoCodes.tsx, src/pages/__tests__/OrganiserProfileFeedError.matrix.test.tsx, tests/e2e/walk-p3-promo-codes.spec.ts, tests/e2e/walk-sfeedback.spec.ts, tests/e2e/walk-ticket-t3-price-steps.spec.ts, tests/icsFeedInstants.test.ts, tests/icsFeedPaging.test.ts, tests/mergeTier.test.ts.

C->B (3): package.json, vercel.json, vite.config.ts.

B->A (2): scripts/lib/merge-tier.mjs, scripts/lib/review-scope.mjs.

Lowered: none.

Commits reviewed: 905dfce (the slice) and d9708c5 (hand-off, no product change).
