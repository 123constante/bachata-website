# Handover — walk-p3-walklist-1
Done: ROWS.md (step 0), spec `tests/e2e/walk-p3-walklist.spec.ts` (10 tests, all run green as walks), pictures in `pics/`, raw observations in `observations.jsonl` (what the screens said + W-19 measurements per picture).
Left: opening every picture and writing RESULTS.md verdicts (see RESULTS.md if present).
Run: start `VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npm run dev -- --host 127.0.0.1 --port 4173`, then `npx playwright test tests/e2e/walk-p3-walklist.spec.ts --project=chromium --workers=3`.
