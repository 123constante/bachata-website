# Brief: fix the red phone-qa on PR #740 (header search sticker covers text)

Branch `feat/people-nationality-flags`, open PR #740, head before this brief `a38e596acff3ada896c9ae5c5b5e5090f13b9d24` (plus the brief commit). Push ONE commit to this branch. Do not open a new PR. Do not edit the PR body (CI check `real-data-verified` re-runs on a body edit; the orchestrator already fixed its format).

## Previous worker report (quote)
The previous worker swapped the waving flag for the static Sticker (style F: 46% of the photo width, min 20px, top -6% right -14%, rotate 9deg, 2px white edge). It reported 152 phone-qa tests passing locally and 0 clipping on all 15 surfaces. It reported the `/vendors/:id` team circles are 17px on a phone, so the 20px-minimum sticker covers 93% of the photo.

## The red check on head a38e596 (CI job phone-qa)
1. REAL FAILURE, fails on retry too: `tests/e2e-phone/people-nationality-flag.phone.spec.ts:193` "360x640 > header search rows (36px): sticker on screen, not clipped, clear of names and neighbours, taps go through". Error `covers no text (AR on header-search)`, received `[{ "px": 184, "text": "Bachata" }]` at line 222. The sticker on a 36px header-search row photo overlaps result text in CI. It passed locally, so the CI data/fonts/results differ from the local fake: reproduce the CI run (same env as `.github/workflows` phone-qa job: read it) before changing anything.
2. NOT yours, do not touch: `tests/e2e-phone/overlap.phone.spec.ts:22` `/auth` at 360x640, `scrollWidth 390 > viewport 360; widest: div.absolute.rounded-full`. /auth shows no person photos; this was seen flaky on PR #733 (green on rerun). Report whether it also fails on `origin/main` with the same command; do not fix it in this PR.

## Task
Make the header-search rows (and the Cmd+K overlay rows, which use the same markup) keep the sticker clear of text at 360x640 and 390x844 WITHOUT changing the Sticker spec for other surfaces: add space on that row (padding or placement) or use the existing inset placement for that surface, the same way the previous worker fixed `/organisers/:id` and `/account`. Prove the fix with the failing test red before (run the spec in the CI-like env first) and green after; run the whole `people-nationality-flag.phone.spec.ts` at both sizes plus the matrix tests, the lint chain steps the CI runs, and push ONCE.

## Also decide and report (do not implement)
For photos under about 28px (the `/vendors/:id` team circles at 17-20px) list 3 options with a screenshot each at 390x844: (a) 20px sticker as now, (b) a smaller sticker clamped to the corner, (c) no sticker under 28px and country in the aria-label/title only. Put the screenshots under `docs/screenshots/nationality-flags/small-photo-options/` and describe them in your report. The owner picks.

## Report
Head SHA, CI per job on the new head (wait for it; if a job is red say why and whether it is flaky), the reproduction of the failure, the fix, test counts, screenshots, and an honest Verified / Not verified. Leave `docs/session-handover-2026-10-12-people-nationality-flags.md` accurate.
