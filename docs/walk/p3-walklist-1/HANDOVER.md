# Handover — walk-p3-walklist-1
Done: ROWS.md, spec `tests/e2e/walk-p3-walklist.spec.ts` (10 tests run green), 43 pictures, observations.jsonl, RESULTS.md (4 PASS / 4 FAIL / 4 CANNOT-TELL).
Left (next worker): W-26 return trip and tap count; W-20 "answers filled in"; W-36 course scope reason; W-02 date sheets on a removed event; /door with the ticketing flag on.
Run: `VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npm run dev -- --host 127.0.0.1 --port 4173`, then `npx playwright test tests/e2e/walk-p3-walklist.spec.ts --project=chromium --workers=3`.
