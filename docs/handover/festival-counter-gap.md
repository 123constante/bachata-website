# Festival Hub counter gap

- Cause: stats row in `src/pages/FestivalHub.tsx` had `-mt-4`, pulling "N upcoming festivals" 16px over the intro paragraph at 390px.
- Change: `mt-2 mb-6`; wording via `festivalCountLabel` (`src/pages/festivalCountLabel.ts`): singular for 1, no line for 0.
- Tests: `tests/festivalHubCounter.test.ts` (table-driven label + class-list guard; the e2e fake has no festival data to measure, so no pixel check). Class-list test was red against old code.
- Not verified: real-data walk at 390x844 on prod, pixel measurement, full CI job set (only tsc, eslint on touched files, the new vitest file run).
