# S10 mini-mockup: the small "DJ" label next to a stage name that already starts with "DJ" (prototype, NO PR)

Repo: Website. Your branch: `claude/s10-mockups`, created FROM `origin/claude/s9-mockups`. Read `docs/handover/s9-mockups.md` there first (route `/__mock/s9/...`, `src/modules/person-page/mockups/S9Mock.tsx`). Plain git only (never `gh api`). Commands without variables/loops/`$(...)` where a plain command works. PRODUCTION build (`VITE_MOCKS=true npm run build` + preview; `NODE_OPTIONS=--max-old-space-size=3072` if needed). Push ONCE; final subject ends `[worker-done <ticket>]`; 30% context rule. Never merge, approve or open a PR. Supabase READ-ONLY. Prototype files only.

## Task
Show the owner, side by side, two variants (A = label always shown, B = label dropped when the shown name already starts with "DJ", case-insensitive, e.g. "DJ El Rugido", "Dj Lobo", "DJ Carlos De La Cruz") on the three places the label appears: (1) the organiser team strip (organiser `unidos-flow`, as S9), (2) the /dancers list tiles that carry a DJ label (pick a crop showing at least 2 DJ-prefixed names and 2 plain names), (3) one search result row (S8 search card) for a DJ-prefixed person. Owner decisions already made (do not change): stage name leads on DJ things; teacher list/pages stay OFF, so NO teacher link and no "Teaches" link target anywhere (a "Teaches" label may stay as plain text only if it does not link); DJs with upcoming gigs first + "Playing soon".

## Output
- 390x844 screenshots `docs/mockups/s10/<place>-A.png` and `<place>-B.png` (place = organiser, dancers, search). Count from prod (counts only): how many of the 40 DJs have a shown name starting with "DJ".
- `docs/handover/s10-mockups.md`: what each variant does, the count, what is NOT verified. Stop after the push.
