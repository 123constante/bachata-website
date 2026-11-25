# Brief A: dancer onboarding v8, data / % model / partner gating (invisible)

Repo: Website (123constante/bachata-website). Branch: claude/dancer-onboarding-v8-a-data
Size: 5 files, ~260 lines
Mockup (the spec): docs/design/dancer-onboarding/mockup-v8-after-code.md (HTML inside a code fence). Rules: docs/design/dancer-onboarding-rules.md.
Flag: none needed (pure functions + tests, nothing renders). Visible use comes in B and C, behind VITE_ENABLE_DANCER_ONBOARDING_V3.
Merge order: A first, then B1..B4 and C1..C2 build on it.
No DB change. Do NOT touch STRENGTH_STEPS (api/types.ts:24), rpc.ts, or any server contract.

## Files (all under src/modules/dancer-app/)
1. screens/onboarding/profileProgress.ts (NEW)
2. screens/onboarding/neonMotion.ts (NEW): constants only
3. screens/onboarding/modelV3.ts (EDIT): partner gating
4. screens/onboarding/__tests__/profileProgress.test.ts (NEW)
5. screens/onboarding/__tests__/modelV3.test.ts (EDIT)

## 1. profileProgress.ts: the v8 percentage
Client-side pure function, separate from server `profile.strength` (the README says never recompute server strength; this is a different number, shown only by the v8 UI).
Mockup logic (screen 14): `done = 3 + (partner?1:0) + (bio?1:0) + (ig?1:0)`, `tot = 7`, `pct = Math.round(done/tot*100)`.
The 3 base items = photo, years (started year), styles (all required, so always done once Home is reachable).
Export:
- `PROGRESS_TOTAL` constant
- `profileProgress(input): { done, total, pct, missing: ProgressItem[], next: ProgressItem | null }`
- `ProgressItem` = 'photo' | 'years' | 'styles' | 'partner' | 'bio' | 'link'
- input: { photo, startedYear, styles[], partnerAnswered, bio, link }
- `missing` is in this order: photo, years, styles, partner, bio, link. `next` = first missing. Label for the line "Next: add a bio (+1 step closer)" = the first missing item lowercased ("add a photo", "add your years dancing", "add your styles", "answer the partner question", "add a bio", "add a link").
- partner counts as done for YES or NO (any answer). OWNER 2026-11-25: EVERY role (organiser, teacher, DJ too) has a dancer profile, so the partner step is shown to EVERYONE; stepsFor in modelV3.ts must stop skipping it. OWNER 2026-11-25: PROGRESS_TOTAL = 6 (confirmed).
- bio done = trimmed bio non-empty. link done = instagram or website_url non-empty (use linkTarget/linkPrefill logic from bioModel.ts; do not duplicate).

### OWNER QUESTION (open, STOP-AND-TELL)
As coded in the mockup, tot=7 but the maximum of done is 3+1+1+1 = 6, so pct max = 86% and "100%" (Profile complete badge, big confetti) can never happen. The items are photo, years, styles, partner, bio, link = 6. Build `PROGRESS_TOTAL` as ONE constant and the 100% test as `done === total`. Default: `PROGRESS_TOTAL = 6` so 100% is reachable (3 base + partner + bio + link = 6). Flag it in the PR body as "owner to confirm 6 vs a 4th base item". Tests assert behaviour via the constant, not the literal 7. Do not ship with 7.
(The lead agent will ask the owner by click before merge.)

## 2. neonMotion.ts: constants copied from the mockup
- YOURE_IN_MS = 2000 (auto-advance, no button)
- TOAST_MS = 2200, TOAST_FADE_MS = 250
- SHAKE_MS = 450 (translateX -7, 7, -5, 5, 0)
- RING_MS = 1100, RING_EASE = 'cubic-bezier(.2,.8,.2,1)', RING_CIRC = 213.6
- COUNT_STEP = 3, COUNT_TICK_MS = 18
- WIN_DELAY_MS = 250, CONFETTI_DELAY_MS = 120
- CONFETTI_SMALL = { n: 28, colours: ['#ff2d95','#ffa600','#7a1fff','#fff','#2ee6a6'], ms: 1100, removeMs: 3200, startX: 195, spreadX: 30, startTop: 520, w: 9, h: 14, dx: 150, dyMin: 150, dyMax: 400, rot: 720 }
- CONFETTI_BIG = { n: 90, ms: [1800,2800], removeMs: 3200, topStart: -20, dx: 100, dyMin: 500, dyMax: 850, bannerText: 'PROFILE COMPLETE!', bannerRemoveMs: 2600 }
Reduced motion: record `prefers-reduced-motion` handling is the consumer's job (B3/C2).

## 3. modelV3.ts: partner gating (copy of mockup pmiss())
Today `stepIsSatisfied` accepts partner YES with only partnerRole. Change: YES requires ALL of kind (at least one), role (one), years range (one). Note is optional.
Add exports:
- `partnerMissing(draft): string[]` returns the missing parts in order from {'a kind','their role','years dancing'}
- `PARTNER_HINT(missing)`: "Pick {a, b and c} to save." joined with ", " and last " and ". All three missing => "Pick a kind, their role and years dancing to save."
- `partnerCanSave(draft)`: missing.length === 0
- Continue on the partner step with YES and incomplete sheet = reopens the sheet (return value 'reopen-sheet'), never advances.
- Save in the sheet closes it and auto-continues to the next step (consumer wires it in B2; model exposes `partnerSaveAdvances = true`).
Existing storage mapping stays (Classes -> 'Practice', Either -> 'Lead and Follow'). PARTNER_DETAILS_MAX 300 stays.
Years labels in the sheet: "0-2", "2-5", "5+", "Any" (check PARTNER_YEARS_V3 already matches; do not change stored values).

## Tests (named; all block merge)
- profileProgress: each item toggles done by 1; missing order; next label; partner yes==no==done; non-dancer partner done; reaches 100% only when all items present; pct = Math.round(done/total*100); with PROGRESS_TOTAL the max is 100.
- modelV3: partner yes with role only -> NOT satisfied; yes with kind+role+years -> satisfied; no -> satisfied; PARTNER_HINT exact strings for 3, 2, 1 missing; existing keep-list tests unchanged and green.

## Keep-list (must not change)
Server strength, STRENGTH_STEPS, existing step order helpers, resumeStep, celebratesOnLeave, every existing test id.

## Not in scope
Any rendering, CSS, Home change, DB, flag changes.

## Tap table
None (no UI). PR body states: "No UI. No tap table."
