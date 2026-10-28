# Brief: S3a nationality, continuation (PR #1113, branch claude/nationality-list-gb-home-nations)

Repo: 123constante/bachata-website. Branch: claude/nationality-list-gb-home-nations (head 50d0bdd, PR #1113).
Lane: normal. Model: Sonnet. Output: one push, handover. Do not merge. No prod write. No Supabase write.

## Already done (do not redo)
- Full ISO 3166-1 list + GB-ENG, GB-SCT, GB-WLS, GB-NIR. Readers accept 5-char codes. Wizard search words restored (50d0bdd).

## What is left (in this order)
1. BUNDLE: the dancer-app first load grew by 154 B gzip (32330 -> 32484 raw +268 B). Target is ZERO. Trim it to zero
   without removing the four home-nation entries: move the large static data out of the dancer-app chunk (for example a
   lazy import used only by the picker, or shorter ISO data source), or keep the list out of the dancer-app entry.
   Run `npm run check:bundle-budget` on main and on the branch. Must show 0 B added. Never edit perf-budgets.json or vite.config.ts.
2. FLAGS: check that flagcdn serves gb-eng, gb-sct, gb-wls and gb-nir (HTTP 200 for the PNG). If one is missing, use the
   fallback and say so. Do not invent a URL. Record the result in the PR body.
3. TESTS: run the table test for nationality values and the walkFixes copy test. Name any test you could not run.
4. PR BODY: keep "## Verified on real data" with three labelled lines (shapes, checks run, NOT verified). Add the bundle
   result and the flag result. Name contract-check as inherited red from main (prod RPC check_occurrence_delete_booking_safety_v1 missing).

## Stop rules
- Stop on any NEW red (a check that is green on main). Report the exact error.
- Do not add the run-ci label. Push once.

## Required output
Final line: `DONE <head sha>` or `PARTIAL <what is left>`, with the bundle numbers (before/after, bytes) and the flag results.
