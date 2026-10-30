# Handover: onboarding playful mood

Class: BUILD-visual. Branch `claude/onboarding-playful-mood`. Design record: `docs/design/onboarding-playful-mood.md`.

## Verified
- Red first: `welcomeTitle.matrix.test.ts` failed 12/12 before the mapping existed; now green (known, empty, whitespace, null, multi-word, non-Latin, Arabic, long, emoji, flag fallback).
- `vitest src/modules/organiser/p3/onboarding`: 383/383 (one existing Welcome assertion updated to the new copy).
- `npm run lint`: 22 of 22 links green. `tsc` shows no error in the files touched (other errors exist on main, none in these files).
- `npm run build` + `check:bundle-budget`: all budgets respected; /app first-load line identical main vs branch (373.6 KB, 49 files). Neither `perf-budgets.json` nor `vite.config.ts` touched.
- Browser walk at 390x844, light and dark, flags served and flags failing: 0 scroll, 0 sideways scroll, 0 small taps; screenshots in the design folder.
- Real first-name shapes (Supabase, read-only, counts only; `dancer_profiles`, 195 rows): 49 empty, 15 multi-word, 0 over 24 characters, 0 non-Latin. Every shape is in the table.
- Copy is British English; no raw Unicode punctuation in JSX/TS (escapes only).

## Not verified
- CI jobs run on GitHub (not run here as a whole): only the lint chain, unit tests and bundle budget were run locally. No PR opened by me.
- Real flagcdn rendering and a real device; the walk faked every call and flagcdn.
- Find / create / contact screens and the Welcome-with-invite-card (out of scope / not walked).
- Gap 4 (Review %) and Languages flags untouched by design.

## Fix round r1 (review `docs/reviews/onboarding-playful-mood-r1.md`)
- F1 (BLOCK): the raw ellipsis in `welcomeTitle` is now `…`. Whole `src/modules/organiser` vitest tree: 204 files, run after the fix (G3 included); the only red was my own new emoji test case, fixed (see below), then the touched suites re-ran green (445/445).
- F2: first name now comes from the dancer read alone (`dancer.data?.first_name`), and Welcome shows the loading state until that read settles, so the title does not change after first paint. A failed dancer read just gives the page-name title.
- F3: `flagEmoji` returns '' for `gb-nir` (no RGI emoji); the fallback box then shows the code as text ("NI"). Emoji span is `overflow:hidden`, 14px. Tests added for gb-eng, gb-wls, gb-nir.
- F4: pictures recaptured before any answer, so unpicked and picked now differ (md5 checked). Before / after / after-flagfail all redone.
- F6: dead `data-failed` on the img removed. F8: O'Brien, `<b>&` and punctuation-only first word added to the table (punctuation-only now falls back to the page copy; emoji-only names still greet).
- Not changed, on purpose: F5 (pop replays on remount: mild, playful), F7 (clips by code point, not grapheme: prod max is 21 characters, 0 non-ASCII).
- Still not verified: real device, real flagcdn, Windows glyph width.
