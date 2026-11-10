# Brief: whole-flyer link card, B1 review-fix round (continuation of PR #1522)

Brief-version: 2
Branch: `claude/whole-flyer-og-b1` (EXISTING branch, PR #1522, head cb91320b at review time: commit on top of it, do NOT open a new branch or PR)
Lane: careful, Opus build. Website repo only. No SQL, no new route, no env or Vercel change, no workflow edit. This is the ONE fix round after the ONE independent review; the lead walks the result, there is no second review round.

## Read first
- The review: `C:/Users/ecual/.claude/plans/REVIEW-1522-whole-flyer-og-b1.md` (verdict FIX, findings 1 to 6). The lead gives you its text in the ticket if the path is not readable from the cloud: the six findings are restated below, so this brief stands alone.
- The first brief `docs/briefs/whole-flyer-og-b1.md` (branch `brief/whole-flyer-og-b1`) and the contract `docs/design/whatsapp-whole-flyer.CONTRACT.md` DRAFT 4 (branch `brief/whole-flyer-og-contract-d4`), sections D1 to D10. Nothing in the contract changes.
- Fixes to review findings are unreviewed code: keep them small, one concern each.

## What main lacks
(The PR is not merged, so main still lacks all of B1; these are the NEW pieces of this round.)
- the guard comparing the decoded size of an `l=wf1` card to the `s=` in its URL -- grep: decoded size differs from s=
- the guard failing a JPEG whose size it cannot read -- grep: cannot read decoded size
- extends: the guard `wholeFlyerFailures` and `imageInfoFromBytes` -- scripts/check-og-images.mjs
- extends: the backfill dry run -- scripts/backfill-og-images.mjs
- extends: the `?ogtest=whole-flyer` gate -- app/routes/event.tsx

## Files
- scripts/check-og-images.mjs
- tests/ogWholeFlyerGolden.test.ts (new on main, exists on the PR branch)
- scripts/backfill-og-images.mjs
- app/routes/event.tsx
- tests/og*.test.ts (the guard's own tests and the event-route test; existing OG test files only, plus new `tests/ogGuardMutants.test.ts` if the guard tests do not already live in one file)
- docs/handover-whole-flyer-og-b1.md (new on main, exists on the PR branch; update: what this round changed, what is left)

Do NOT touch: `.github/workflows/*`, `app/lib/ogLayout.ts` (its read rule is correct, see finding 4), `vercel.json`, `vite.config.ts`, `perf-budgets.json`, festival files, any SQL.

## Deliverables
1. **Golden test that reproduces on CI (finding 1, RED job `unit (Europe/London, full)`).** `tests/ogWholeFlyerGolden.test.ts:97` fails 4 of 8 cases ("flag off, cover unfetchable", "flag on, cover absent", "flag on, portrait (branded)", "flag on, wide (branded)") because the sha256 values were pinned on Windows and every failing case draws TEXT, which depends on the host's fonts. Fix: for the four text-drawing cases do NOT pin a hash. Compare the new code's output with main's render path run IN THE SAME TEST on the same host (import or inline the main render function for the l-less, mode-off path, or render it twice through the two code paths that must agree) and assert byte equality there; also assert status, content-type, Cache-Control, ETag and decoded size explicitly. Keep the pinned sha256 only for the four text-free cases that already pass on CI. State in the test header why (host-dependent text rasterisation). Acceptance: the file is green on `ubuntu` CI and on the worker host; it still goes RED if the l-less mode-off card changes by one byte (prove it with a mutant: change one pixel of the l-less output, run, see red, revert).
2. **Guard holes (findings 2 and 3), `scripts/check-og-images.mjs`, mutation proof required.**
   (a) For an `l=wf1` live URL, require the decoded width and height to EQUAL the `s=<W>x<H>` in the URL; otherwise a failure named "decoded size differs from s=". Mutant that must go RED: an `l=wf1&s=960x1200` URL answered with a 1200x630 JPEG, `X-OG-Layout: wf1`, Cache-Control 3600, page declaring 1200x630 (today: zero failures).
   (b) A JPEG whose decoded size cannot be read (`imageInfoFromBytes` returns width null and height null, for example a JPEG header plus EOI with no SOF) is a FAILURE named "cannot read decoded size", for live, baked and legacy URLs alike; no size, ratio or declared-vs-decoded check may be skipped because the size is null (remove the `if (w && h)` skips or make them fail first). Mutant that must go RED: JPEG header plus EOI, no SOF (today: zero failures).
   Add both mutants to the guard's own tests next to the eight from the first brief. Run `node scripts/check-og-images.mjs --self-test` (must still pass; add the new cases to it) and the guard tests; print the mutant table (mutant, result before, result after) into the PR body. The healthy fixtures (legacy plain key, legacy facts key, wf1 key with the right size) must still PASS. Do not add an empty catch; read `scripts/check-script-conventions.mjs` rules before editing and run it (`node scripts/check-script-conventions.mjs`). Stopping rule: a finding proved by mutation means fix it and stop, no further guard round.
3. **Two small fixes (findings 5 and 6).**
   (a) `?ogtest=whole-flyer` is honoured in every mode except off (`app/routes/event.tsx`, `OG_LAYOUT_POLICY.mode !== "off"`); contract D3 says TEST mode only. Restrict it to mode `test`; add a table-driven test, mode x query: off, test, allowlist, on, each with and without the query; only `test` + query applies it; it still never bakes.
   (b) `scripts/backfill-og-images.mjs --dry-run` must not demand `OG_BAKE_SECRET` (it never POSTs): require the secret only when a bake will be sent. Test: dry run with the secret unset exits 0 and prints the target counts; a real run without the secret still refuses.
4. **Evidence.** Re-run the unit suite for the OG files and `npm run check:bundle-budget` (sharp must stay out of the client bundle); push ONCE (commit locally as often as you like, one push), do not add `run-ci` yourself. In the PR (update the existing body, keep the exact skeleton): a per-job CI table at the new head, the mutant table, `## Verified on real data` with `- Shapes surveyed:`, `- Checks run:`, `- NOT verified:` (real WhatsApp rendering, Cloudflare zone settings, Vercel env values, every real event card). The CI job `unit (Europe/London, full)` must be green at the new head, or say exactly which job is red and why.

## Not in this round (lead FYI only, do NOT change)
Finding 4: with mode off, a baked `image_url` whose last segment is neither `-<16hex>(-<12hex>).jpg` nor a wf key is now rejected and the live l-less card is served instead; contract D4(c) mandates this and all 401 prod rows are legacy-shaped, so there is no prod effect. Leave `app/lib/ogLayout.ts` as it is.

## Out of scope (do not start)
Festivals; removing `layout=tall`; the Vercel env var and GitHub repository variable (owner steps O1 to O3); `.github/workflows/og-image-check.yml`; flipping any mode; running the backfill against prod; any other change to what the calendar or any page renders.

## Hand-over
Last commit subject ends with the done marker from the ticket. Report: head SHA, PR number, per-job CI at that head, the mutant table, Verified / Not verified.
