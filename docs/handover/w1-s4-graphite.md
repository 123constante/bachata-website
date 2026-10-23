# W1 S4 handover: calm graphite default ground

Branch `claude/w1-s4-graphite` (from origin/main 0ab0ff9). Sub-branch: no PR opened.

## Done
- `src/components/layout/pageGrounds.ts` (new): `PAGE_GROUNDS` for `default` (#0e1215 + faint top light, S13 option B values), `dancer` (#06191F), `dj` (#0A080B).
- `GlobalLayout.tsx`: `gradientPalette` now accepts `'dancer' | 'dj'`. These three palettes render a static fixed backdrop (`data-testid="page-ground"`), NO floating icons, NO animation, and paint `<html>` and `<body>` background (restored on unmount) so no band shows above the footer. Global CSS NOT touched (body ground is set from the layout effect). bento / velvet / brass / organiser / `showGradientBg=false` / progress bar: code paths unchanged.
- Test: `src/components/layout/__tests__/GlobalLayout.grounds.test.tsx` (table). RED on main (3 failed: default/dancer/dj), GREEN now (9 passed).

## Measured (production build, 390x844, prod anon key, read-only; docs/mockups/w1-s4/*, measure-{before,after}.json)
| | before | after |
|---|---|---|
| body bg (parties, faq, dancers, search, classes, 404) | rgb(0,0,0) | rgb(14,18,21) |
| floating icons | 20 | 0 |
| /venues (brass, unchanged) | rgb(0,0,0), 0 icons | identical |
| contrast on ground white / muted(160,160,170) / amber | 21 / 8.1 / 9.78 | 18.82 / 7.26 / 8.76 |

## Gates (command -> exit)
- `npx vitest run src/components/layout` -> 0 (9 passed)
- `npx eslint src/components/layout` -> 0 (2 warnings: pre-existing-style react-refresh on pageGrounds import? and unused disable directive at GlobalLayout:138, both pre-existing)
- `npm run typecheck` -> 2, 99 TS errors both on main and on branch (none in layout files): pre-existing
- `NODE_OPTIONS=--max-old-space-size=3072 npm run build` -> 0
- Not run: full `npm run lint` chain, full `test:unit`, e2e, `check:integrity`, other CI jobs (time-boxed; only the layout slice was run).

## Phone QA / NOT verified
- Screenshots served from static build with an SPA fallback to the prerendered /parties shell (only parties, faq, classes are prerendered), so /dancers, /search, /404, /venues pages show the shell's hydration, not necessarily their own content; the `footer` probe returned the same y (361) on every page, so "strip above the footer" colour and "px² of icon over text" were NOT properly measured (icons are 0 by construction; body/html paint covers the full canvas). Re-measure on a real deploy preview.
- `/faq` icon-over-text: icons 0, so 0 by construction.
- Real phone, Docker/local Supabase: NOT RUN.
- Slices S1/S2 must pass `gradientPalette="dancer"|"dj"`; no page files changed.
