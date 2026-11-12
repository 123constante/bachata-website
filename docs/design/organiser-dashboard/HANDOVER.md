# Handover: organiser dashboard 3 design options (admin #1538)

Branch `claude/profile-dash-organiser-designs`. Brief: `docs/briefs/dash-organiser-options.md` on
`brief/profile-dash-organiser-designs` (sha 7922e0b). Docs/design only: no app code, no DB writes, no migrations.

## Done
- `INVENTORY.md`, written BEFORE any drawing. It covers every field, state and option of the organiser area from the current
  Website (src/modules/organiser/p3 and others), the public organiser page, the admin app (through docs only) and
  the 3 existing prototypes. Each item is cited as file:line and mapped to O1-O4. There are 7 GAPs.
  **Coverage: 90 / 127**, and each of the 37 uncovered items is justified.
- 3 options as HTML at 390x844, each covering 6 states (no events, upcoming, selling via us, huge counts,
  all zero, cancelled night): `option-a.html` (Feed, adapted from org-proto-dashboard), `option-b.html` (One night in
  focus), `option-c.html` (Scoreboard + next steps).
- `options.md`: the design record, with tokens, the contract mapping, the trade-offs of each option, the recommendation (**B**) and the check results.
- `shots/`: 36 PNGs, a first screen and a full page for each option and state.
- `tools/gen.py` and `tools/check-shots.mjs`, so the mocks and checks can be rebuilt.

## Verified
- Tap targets of 44x44 or more, contrast of 4.5:1 or more (lowest 6.63), no sideways scroll at 390 and no clipping: **18/18 option x state
  pass** (`checks.json`). The first run caught one tap target under 44px, and it was fixed.
- I looked at the screenshots myself for huge counts (63,576 / 7,392 / 6,013), long names, the cancelled night and the empty states.
- `npm run check:mojibake`: pass (2675 files, no cp1252 corruption). Every generated file is ASCII only; `gen.py` asserts it.

## Not verified
- No app code was changed, so tsc, unit tests, e2e and the lint chain were not run because there is nothing to compile.
- No prod shape survey was run (no DB access was used). The magnitudes come from the brief: 63,576 opens rows,
  7,392 link clicks, and Going near empty.
- The admin repo (`bachata-admin-11april`) was not readable in this session, so its items are unverified (GAP-7).
- Mocks use the system font stack, not the site's own fonts, so line wraps may differ a little in the real build.
- There was no real-phone check, and no Vercel preview applies because these are static docs files.

## Next steps (owner)
1. Pick A, B or C (the recommendation is B).
2. Decide the gaps before any build: rating source and city average (GAP-1), a share-my-page link (GAP-2), cancelled
   nights in the RPCs (GAP-3 / E7), per-night opens and clicks with the click-type mapping (GAP-4), organiser
   profile views (GAP-5), and whole-team visibility in the admin RPCs (GAP-6).
