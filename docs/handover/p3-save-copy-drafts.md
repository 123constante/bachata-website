# Handover: P3 save copy for drafts

Done: `model/saveWords.ts` (`saveWordsFor(lifecycle)`) is the one mapping. SessionSheet, DetailsScreen and
PricesScreen call it with `ws.series.lifecycle_status`. The six static labels were removed from `labels.ts`.
No change to when saves are allowed or what is sent.

Data source: `ws.series.lifecycle_status` (table `event_series_p5`; written by the owner lifecycle commands
and the admin console). Prod counts (read-only): archived 653, live 69, ended 21, draft 14, paused 2
(no cancelled/other on the series; cancelled is a per-date status, treated as unknown here).

Wording: live unchanged. Draft: "Saved for every date as a draft. Dancers do not see it yet." Paused: "...It is paused,
so dancers do not see it." Ended/archived/cancelled/null/unknown: no dancer claim at all ("Saved for every date.").

Red first: new table test `model/__tests__/saveWords.matrix.test.ts` (9 lifecycles x 6 messages + 2) run against a
lifecycle-blind stub (the old static behaviour): 49 of 56 failed. Green now. Note: `claimEdit.matrix.test.tsx`
does not exist in this tree; the two tests that used `L.savedEvery`/`L.detailsSaved` now use `saveWordsFor('live')`.

Checks: p3 vitest 56 files / 3143 passed; tsc no errors in p3; eslint 0 errors; build + check:bundle-budget all ok.
Not verified: browser walk (orchestrator's); `/code-review` round not run (no human to type it).
